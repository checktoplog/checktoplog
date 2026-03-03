
import React, { useState, useEffect, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { ChecklistTemplate, ChecklistResponse } from '../types';

interface TemplateStat {
  id: string;
  name: string;
  total: number;
  completed: number;
  draft: number;
  avgTimeMinutes: number;
  complianceRate: number;
}

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [responses, setResponses] = useState<ChecklistResponse[]>([]);
  const [allStats, setAllStats] = useState<TemplateStat[]>([]);
  const [filterTemplateId, setFilterTemplateId] = useState<string>('all');
  
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  const waitForChartLib = async (retries = 20): Promise<any> => {
    const Chart = (window as any).Chart;
    if (Chart) return Chart;
    if (retries === 0) return null;
    await new Promise(r => setTimeout(r, 200)); 
    return waitForChartLib(retries - 1);
  };

  useEffect(() => {
    const fetchData = async () => {
      // Safety timeout
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 8000);

      try {
        const [tData, rData] = await Promise.all([
          supabaseService.getTemplates(),
          supabaseService.getResponses()
        ]);
        setTemplates(tData);
        setResponses(rData);

        const computedStats: TemplateStat[] = tData.map(tmpl => {
          const tmplResponses = rData.filter(r => r.templateId === tmpl.id);
          const completedList = tmplResponses.filter(r => r.status === 'COMPLETED');
          
          let totalEffectiveTimeMs = 0;
          let countTime = 0;
          let totalYes = 0;
          let totalQuestions = 0;

          completedList.forEach(r => {
            const stageTimes = r.stageTimeSpent || {};
            const effectiveTimeForThisResponse = Object.values(stageTimes).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
            
            if (effectiveTimeForThisResponse > 0) {
              totalEffectiveTimeMs += effectiveTimeForThisResponse;
              countTime++;
            }

            Object.values(r.data || {}).forEach((stageData: any) => {
              Object.values(stageData || {}).forEach((val: any) => {
                totalQuestions++;
                if (val === 'Sim') totalYes++;
              });
            });
          });

          return {
            id: tmpl.id,
            name: tmpl.title,
            total: tmplResponses.length,
            completed: completedList.length,
            draft: tmplResponses.filter(r => r.status === 'DRAFT').length,
            avgTimeMinutes: countTime > 0 ? Math.round((totalEffectiveTimeMs / countTime) / 1000 / 60) : 0,
            complianceRate: totalQuestions > 0 ? Math.round((totalYes / totalQuestions) * 100) : 0
          };
        });

        computedStats.sort((a, b) => b.total - a.total);
        setAllStats(computedStats);
        setLoading(false);
      } catch (err) {
        console.error("Erro ao gerar relatórios:", err);
        setLoading(false);
      } finally {
        clearTimeout(timeout);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const renderChart = async () => {
      const Chart = await waitForChartLib();
      if (!Chart || !chartRef.current || loading) return;

      if (chartInstance.current) chartInstance.current.destroy();

      const filteredStats = filterTemplateId === 'all' 
        ? allStats 
        : allStats.filter(s => s.id === filterTemplateId);

      if (filterTemplateId === 'all') {
        chartInstance.current = new Chart(chartRef.current, {
          type: 'bar',
          data: {
            labels: filteredStats.map(s => s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name),
            datasets: [
              { label: 'Finalizados', data: filteredStats.map(s => s.completed), backgroundColor: '#ea580c', borderRadius: 8 },
              { label: 'Rascunhos', data: filteredStats.map(s => s.draft), backgroundColor: '#fed7aa', borderRadius: 8 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', weight: 'bold', size: 10 } } } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f3f4f6' } } }
          }
        });
      } else {
        const s = filteredStats[0];
        chartInstance.current = new Chart(chartRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Finalizados', 'Rascunhos'],
            datasets: [{
              data: [s.completed, s.draft],
              backgroundColor: ['#ea580c', '#fed7aa'],
              borderWidth: 0,
              hoverOffset: 10
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', weight: 'bold', size: 12 } } } },
            cutout: '70%'
          }
        });
      }
    };
    renderChart();
  }, [filterTemplateId, allStats, loading]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-orange-600">
      <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
      <p className="font-bold uppercase tracking-widest text-xs">Calculando Métricas...</p>
    </div>
  );

  const displayedStats = filterTemplateId === 'all' ? allStats : allStats.filter(s => s.id === filterTemplateId);
  const totalInspections = displayedStats.reduce((acc, curr) => acc + curr.total, 0);
  const totalCompleted = displayedStats.reduce((acc, curr) => acc + curr.completed, 0);
  const avgTime = displayedStats.length > 0 
    ? Math.round(displayedStats.reduce((acc, curr) => acc + curr.avgTimeMinutes, 0) / (displayedStats.filter(s => s.avgTimeMinutes > 0).length || 1)) 
    : 0;
  const avgCompliance = displayedStats.length > 0
    ? Math.round(displayedStats.reduce((acc, curr) => acc + curr.complianceRate, 0) / (displayedStats.length || 1))
    : 0;

  return (
    <div className="space-y-8 animate-fadeIn pb-24">
       <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Métricas de Performance</h2>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Tempo calculado por soma de etapas efetivas</p>
          </div>
          <div className="w-full md:w-72">
            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Filtrar por Modelo</label>
            <select 
              value={filterTemplateId}
              onChange={(e) => setFilterTemplateId(e.target.value)}
              className="w-full bg-white border-2 border-orange-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none cursor-pointer shadow-sm"
            >
              <option value="all">📁 Todos os Modelos</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
       </header>

       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
           <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Inspeções</p>
               <p className="text-3xl font-black text-gray-900">{totalInspections}</p>
           </div>
           <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 border-b-8 border-orange-500">
               <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Tempo Médio Real</p>
               <p className="text-3xl font-black text-orange-600">{avgTime}<span className="text-sm text-gray-400 ml-1">min</span></p>
           </div>
           <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Finalizados</p>
               <p className="text-3xl font-black text-gray-900">{totalCompleted}</p>
           </div>
           <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 border-b-8 border-green-500">
               <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Qualidade</p>
               <p className="text-3xl font-black text-green-600">{avgCompliance}%</p>
           </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 h-[450px] flex flex-col">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight mb-6 flex items-center">
                <span className="mr-2">📈</span> {filterTemplateId === 'all' ? 'Volume de Operações' : `Status de Inspeção`}
              </h3>
              <div className="flex-1 relative w-full"><canvas ref={chartRef}></canvas></div>
          </div>
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center space-y-4">
              <div className="w-20 h-20 bg-orange-50 rounded-[2rem] flex items-center justify-center text-3xl mb-2">📊</div>
              <h4 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Resumo Operacional</h4>
              <p className="text-xs text-gray-500 font-medium px-4">O tempo médio agora reflete apenas o esforço real de preenchimento, excluindo intervalos.</p>
          </div>
       </div>

       <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
               <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Detalhamento por Modelo</h3>
            </div>
            
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-white border-b border-gray-100">
                        <tr>
                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Modelo de Checklist</th>
                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Total</th>
                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Concluídos</th>
                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Tempo Médio Real</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {displayedStats.map(s => (
                            <tr key={s.id} className="hover:bg-orange-50/50 transition-colors">
                                <td className="px-8 py-5 font-bold text-gray-700 text-sm">{s.name}</td>
                                <td className="px-8 py-5 font-black text-gray-900 text-center">{s.total}</td>
                                <td className="px-8 py-5 text-center"><span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase">{s.completed}</span></td>
                                <td className="px-8 py-5 text-center font-black text-gray-900">{s.avgTimeMinutes} min</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden p-4 space-y-4">
                {displayedStats.map(s => (
                    <div key={s.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                        <h4 className="font-black text-gray-900 text-xs uppercase tracking-tight">{s.name}</h4>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white p-2 rounded-xl border border-gray-100 text-center">
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Total</p>
                                <p className="text-sm font-black text-gray-900">{s.total}</p>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-gray-100 text-center">
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Concl.</p>
                                <p className="text-sm font-black text-green-600">{s.completed}</p>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-gray-100 text-center">
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Tempo</p>
                                <p className="text-sm font-black text-orange-600">{s.avgTimeMinutes}m</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default Reports;
