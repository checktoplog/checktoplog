
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { ChecklistTemplate, ChecklistResponse } from '../types';
import { generateChecklistPDF } from '../utils/pdfGenerator';

interface DownloadItem {
  id: string;
  response?: ChecklistResponse;
  template?: ChecklistTemplate;
  filename: string;
  date: Date;
  pdfUrl?: string;
  type: 'checklist';
  responsible?: string;
}

const BatchDownload: React.FC = () => {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      // Safety timeout
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 8000);

      try {
        const [templates, responses] = await Promise.all([
          supabaseService.getTemplates(),
          supabaseService.getResponses()
        ]);

        const checklistItems = responses
          .filter(r => r.status === 'COMPLETED')
          .map(r => {
            const t = templates.find(temp => temp.id === r.templateId);
            if (!t) return null;
            
            const d = new Date(r.updatedAt);
            const dateStr = d.toISOString().split('T')[0];
            const timeStr = d.getHours().toString().padStart(2, '0') + 'h' + d.getMinutes().toString().padStart(2, '0');
            
            const rawFilename = `${r.customId || 'S-ID'}_${t.title}_${dateStr}_${timeStr}`;
            
            return {
              id: r.id,
              response: r,
              template: t,
              date: d,
              filename: rawFilename.replace(/[^a-z0-9_-]/gi, '_'),
              pdfUrl: r.pdfUrl,
              type: 'checklist' as const
            };
          })
          .filter(Boolean);

        setItems(checklistItems as any);
      } catch (err) {
        console.error("Erro ao carregar dados", err);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredItems = items.filter(item => 
    (item.filename || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleDownload = async () => {
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;

    if (selectedItems.length > 1) {
      const confirmMultiple = confirm(`Você selecionou ${selectedItems.length} arquivos. O navegador iniciará vários downloads individuais dos arquivos salvos no servidor. Deseja continuar?`);
      if (!confirmMultiple) return;
    }

    setIsDownloading(true);
    setProgress(0);

    try {
      let count = 0;
      for (const item of selectedItems) {
        if (item.pdfUrl) {
            // Se já tem link no Supabase, baixa direto
            const link = document.createElement('a');
            link.href = item.pdfUrl;
            link.download = `${item.filename}.pdf`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // Fallback: Gera na hora se não foi salvo no storage por algum motivo
            if (item.type === 'checklist' && item.response && item.template) {
              const doc = generateChecklistPDF(item.response, item.template);
              doc.save(`${item.filename}.pdf`);
            }
        }
        
        count++;
        setProgress(Math.round((count / selectedItems.length) * 100));
        await new Promise(r => setTimeout(r, 800));
      }
    } catch (err) {
      console.error("Erro no download em lote", err);
      alert("Erro ao processar a fila de PDFs.");
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  if (loading) {
     return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-orange-600">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
        <p className="font-bold">Buscando arquivos no servidor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Gerenciador de Arquivos Cloud</h2>
           <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Acesse os arquivos PDFs hospedados no Supabase Storage</p>
        </div>
      </header>

      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden flex flex-col h-[70vh]">
         <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-96">
                <input 
                  type="text" 
                  placeholder="Pesquisar nome do arquivo..." 
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 pl-10 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none text-gray-700"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-3 top-3 text-gray-400 text-lg">🔍</span>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                    onClick={handleDownload}
                    disabled={selectedIds.size === 0 || isDownloading}
                    className="flex-1 md:flex-none bg-orange-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                    {isDownloading ? (
                    <>⏳ Baixando {progress}%</>
                    ) : (
                    <>📥 Baixar PDFs ({selectedIds.size})</>
                    )}
                </button>
            </div>
         </div>

          <div className="flex-1 overflow-y-auto bg-white">
            {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300">
                   <span className="text-6xl mb-4">📂</span>
                   <p className="text-xs font-bold uppercase tracking-widest">Pasta Vazia no Cloud</p>
                </div>
            ) : (
                <div className="flex flex-col divide-y divide-gray-50">
                   <div className="flex items-center px-6 py-3 bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm border-b border-gray-100">
                      <label className="flex items-center cursor-pointer group select-none">
                        <input 
                           type="checkbox" 
                           className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer transition-all"
                           checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                           onChange={toggleSelectAll}
                        />
                        <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-orange-600 transition-colors">Selecionar Todos</span>
                      </label>
                   </div>

                   {filteredItems.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => toggleSelect(item.id)}
                        className={`flex items-center px-4 md:px-6 py-4 cursor-pointer transition-all group ${
                            selectedIds.has(item.id) ? 'bg-orange-50' : 'hover:bg-gray-50'
                        }`}
                      >
                         <div className="flex items-center h-full" onClick={(e) => e.stopPropagation()}>
                            <input 
                               type="checkbox" 
                               checked={selectedIds.has(item.id)}
                               onChange={() => toggleSelect(item.id)}
                               className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                            />
                         </div>
                         
                         <div className="ml-3 md:ml-4 flex items-center flex-1 min-w-0">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 text-blue-500 rounded-lg flex items-center justify-center text-lg md:text-xl shadow-sm mr-3 md:mr-4 shrink-0">
                                {item.pdfUrl ? '☁️' : '📄'}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className={`text-xs md:text-sm font-bold truncate ${selectedIds.has(item.id) ? 'text-orange-900' : 'text-gray-700'}`}>
                                    {item.filename}.pdf
                                </span>
                                <span className="text-[8px] md:text-[10px] text-gray-400 font-medium flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span className="text-blue-600 font-black uppercase tracking-tighter">Checklist</span>
                                    <span className="hidden md:inline">•</span>
                                    {item.pdfUrl ? <span className="text-blue-500 font-bold">Cloud</span> : <span className="text-gray-400">Local</span>} 
                                    <span className="hidden md:inline">•</span>
                                    <span className="truncate">{item.date.toLocaleString('pt-BR')}</span>
                                    {(item as any).responsible && (
                                      <>
                                        <span className="hidden md:inline">•</span>
                                        <span className="text-gray-500 italic truncate">Por: {(item as any).responsible}</span>
                                      </>
                                    )}
                                </span>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default BatchDownload;
