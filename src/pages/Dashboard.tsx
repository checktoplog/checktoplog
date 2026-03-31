
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService.ts';
import { ChecklistTemplate, ChecklistResponse } from '../types.ts';

interface DashboardProps {
  onNavigate: (page: string) => void;
  onNewTemplate: () => void;
  templates: ChecklistTemplate[];
  responses: ChecklistResponse[];
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onNewTemplate, templates, responses }) => {
  const [loading, setLoading] = useState(true);
  const [chartError, setChartError] = useState(false);

  const stats = useMemo(() => {
    const trendMap: Record<string, number> = {};
    const last7DaysLabels: string[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('pt-BR');
      last7DaysLabels.push(key);
      trendMap[key] = 0;
    }

    let tYes = 0;
    let tNo = 0;
    let tQuestions = 0;
    let completedCount = 0;
    let draftCount = 0;

    for (const res of responses) {
      if (res.status === 'COMPLETED') {
        completedCount++;
        const dateKey = new Date(res.updatedAt).toLocaleDateString('pt-BR');
        
        if (res.data) {
          for (const stageData of Object.values(res.data)) {
            if (stageData && typeof stageData === 'object') {
              for (const val of Object.values(stageData)) {
                tQuestions++;
                if (val === 'Sim') tYes++;
                if (val === 'Não') {
                  tNo++;
                  if (trendMap.hasOwnProperty(dateKey)) {
                    trendMap[dateKey]++;
                  }
                }
              }
            }
          }
        }
      } else {
        draftCount++;
      }
    }

    return {
      totalChecklists: responses.length,
      completed: completedCount,
      drafts: draftCount,
      complianceRate: tQuestions > 0 ? Math.round((tYes / tQuestions) * 100) : 0,
      totalQuestions: tQuestions,
      totalYes: tYes,
      totalNo: tNo,
      last7DaysLabels,
      trendMap
    };
  }, [responses]);

  const complianceChartRef = useRef<HTMLCanvasElement>(null);
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const chartsInstance = useRef<{ compliance?: any; trend?: any }>({});

  const waitForChartLib = async (retries = 30): Promise<any> => {
    const Chart = (window as any).Chart;
    if (Chart) return Chart;
    if (retries === 0) return null;
    await new Promise(r => setTimeout(r, 100)); 
    return waitForChartLib(retries - 1);
  };

  useEffect(() => {
    let isMounted = true;

    const initCharts = async () => {
      try {
        setLoading(true);
        const ChartLib = await waitForChartLib();
        if (ChartLib && isMounted) {
          renderCharts(ChartLib, stats.totalYes, stats.totalNo, stats.last7DaysLabels, stats.trendMap);
          setLoading(false);
        } else if (isMounted) {
          setChartError(true);
          setLoading(false);
        }
      } catch (error) {
        console.error("Erro ao inicializar gráficos:", error);
        if (isMounted) setLoading(false);
      }
    };

    initCharts();

    return () => {
      isMounted = false;
      if (chartsInstance.current.compliance) chartsInstance.current.compliance.destroy();
      if (chartsInstance.current.trend) chartsInstance.current.trend.destroy();
    };
  }, [stats]);

  const renderCharts = (Chart: any, yes: number, no: number, labels: string[], trendData: Record<string, number>) => {
    if (complianceChartRef.current) {
      if (chartsInstance.current.compliance) chartsInstance.current.compliance.destroy();
      chartsInstance.current.compliance = new Chart(complianceChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Conforme', 'Não Conforme'],
          datasets: [{
            data: [yes, no],
            backgroundColor: ['#22c55e', '#ef4444'],
            hoverOffset: 12,
            borderWidth: 0,
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              position: 'bottom', 
              labels: { 
                font: { family: 'Inter', size: 11, weight: 'bold' }, 
                usePointStyle: true, 
                padding: 20 
              } 
            }
          },
          cutout: '70%'
        }
      });
    }

    if (trendChartRef.current) {
      if (chartsInstance.current.trend) chartsInstance.current.trend.destroy();
      chartsInstance.current.trend = new Chart(trendChartRef.current, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Não Conformidades (Não)',
            data: labels.map(label => trendData[label]),
            backgroundColor: '#f97316',
            hoverBackgroundColor: '#ea580c',
            borderRadius: 6,
            barThickness: 16
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { stepSize: 1, font: { size: 10, weight: 'bold' } } },
            x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
          }
        }
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border border-gray-100 shadow-sm">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Carregando Painel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-10 animate-fadeIn pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tighter uppercase">Painel de Controle</h2>
          <p className="text-gray-400 font-bold text-sm mt-1">Gestão de conformidade em tempo real.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
           <button onClick={() => onNavigate('templates')} className="flex-1 md:flex-none bg-orange-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all active:scale-95">📝 Novo Checklist</button>
           <button onClick={() => onNavigate('checklists')} className="flex-1 md:flex-none bg-white text-gray-700 px-6 py-4 rounded-2xl font-black uppercase text-[10px] border border-gray-100 shadow-sm hover:bg-gray-50 transition-all active:scale-95">Histórico</button>
           <button onClick={() => onNavigate('reports')} className="flex-1 md:flex-none bg-white text-orange-600 px-6 py-4 rounded-2xl font-black uppercase text-[10px] border border-orange-100 shadow-sm hover:bg-orange-50 transition-all active:scale-95">📊 Relatórios</button>
           <button onClick={onNewTemplate} className="flex-1 md:flex-none bg-white text-gray-400 px-6 py-4 rounded-2xl font-black uppercase text-[10px] border border-gray-100 shadow-sm hover:bg-gray-50 transition-all active:scale-95">Config</button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Inspeções</p>
          <p className="text-3xl md:text-4xl font-black text-gray-900 tracking-tighter">{stats.totalChecklists}</p>
        </div>
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm border-b-8 border-orange-500">
          <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">Conformidade</p>
          <p className="text-3xl md:text-4xl font-black text-orange-600 tracking-tighter">{stats.complianceRate}%</p>
        </div>
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Finalizados</p>
          <p className="text-3xl md:text-4xl font-black text-gray-900 tracking-tighter">{stats.completed}</p>
        </div>
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Rascunhos</p>
          <p className="text-3xl md:text-4xl font-black text-gray-900 tracking-tighter">{stats.drafts}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 min-h-[400px]">
           <h3 className="text-base font-black text-gray-800 uppercase tracking-tight mb-8">Qualidade Geral</h3>
           <div className="w-full relative h-[300px]">
             {stats.totalQuestions > 0 ? <canvas ref={complianceChartRef}></canvas> : <div className="h-full flex items-center justify-center text-gray-300 font-bold uppercase text-[10px]">Sem dados</div>}
           </div>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 min-h-[400px]">
           <h3 className="text-base font-black text-gray-800 uppercase tracking-tight mb-8">Tendência de Falhas (7 dias)</h3>
           <div className="w-full relative h-[300px]">
             {stats.totalQuestions > 0 ? <canvas ref={trendChartRef}></canvas> : <div className="h-full flex items-center justify-center text-gray-300 font-bold uppercase text-[10px]">Sem dados</div>}
           </div>
        </div>
      </div>

      <section className="bg-gradient-to-br from-gray-900 to-black text-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 group">
        <div className="relative z-10 text-center md:text-left">
          <h3 className="text-2xl md:text-3xl font-black tracking-tighter uppercase mb-2">Relatórios Inteligentes</h3>
          <p className="text-gray-400 text-sm font-medium max-w-md">Visualize métricas detalhadas e performance da equipe em tempo real.</p>
        </div>
        <button 
          onClick={() => onNavigate('reports')}
          className="w-full md:w-auto bg-white text-black px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-orange-600 hover:text-white transition-all active:scale-95"
        >
          Ver Relatórios 📊
        </button>
      </section>
    </div>
  );
};

export default Dashboard;
