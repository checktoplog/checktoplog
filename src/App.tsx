
import React, { useState, useEffect, useCallback, useRef, Component, useMemo, useDeferredValue } from 'react';
import { User, ChecklistTemplate, ChecklistResponse } from './types.ts';
import { supabaseService } from './services/supabaseService.ts';
import { supabase, canUseSupabaseRuntime, isSupabaseConfigured, isSupabaseBroken, resetSupabaseBroken } from './supabaseClient.ts';
import Layout from './components/Layout.tsx';
import TemplateEditor from './pages/TemplateEditor.tsx';
import ChecklistRunner from './pages/ChecklistRunner.tsx';
import ChecklistSummary from './pages/ChecklistSummary.tsx';
import UserManagement from './pages/UserManagement.tsx';
import Reports from './pages/Reports.tsx';
import BatchDownload from './pages/BatchDownload.tsx';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Erro crítico na aplicação:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6">
          <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-red-100 max-w-md w-full text-center">
            <div className="text-4xl mb-4">😵</div>
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Ops! Algo deu errado.</h2>
            <p className="text-gray-500 text-sm mb-6">Ocorreu um erro inesperado ao carregar a aplicação.</p>
            <div className="bg-red-50 p-4 rounded-xl text-left mb-6 overflow-auto max-h-40">
              <p className="text-[10px] font-mono text-red-600 break-words">{this.state.error?.message}</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => { localStorage.clear(); window.location.reload(); }}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg"
              >
                Limpar Cache e Recarregar
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-white text-gray-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all border border-gray-100"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const GUEST_USER: User = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Administrador',
  email: 'admin@checktoplog.com',
  role: 'ADMIN',
  allowedScreens: ['templates', 'checklists', 'reports', 'batch_download', 'users'],
};

const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [user, setUser] = useState<User | null>(GUEST_USER);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState('templates');

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [responses, setResponses] = useState<ChecklistResponse[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterTemplateId, setFilterTemplateId] = useState('');

  const userRef = useRef<User | null>(GUEST_USER);

  const [activeTemplate, setActiveTemplate] = useState<ChecklistTemplate | null>(null);
  const [editTemplateId, setEditTemplateId] = useState<string | undefined>();
  const [activeChecklistId, setActiveChecklistId] = useState<string | undefined>();

  const fetchResponses = async () => {
    try {
      const resps = await supabaseService.getResponses();
      setResponses(resps);
    } catch (err) {
      console.error("Erro ao atualizar respostas:", err);
    }
  };

  const [isBroken, setIsBroken] = useState(isSupabaseBroken());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r] = await Promise.all([
        supabaseService.getTemplates(),
        supabaseService.getResponses()
      ]);
      setTemplates(t || []);
      setResponses(r || []);
    } catch (err: any) {
      console.error("Erro ao carregar dados:", err);
      // Se falhar o fetch, o serviço já deve ter marcado como broken
      // Não bloqueamos mais a UI aqui, o Layout mostrará o status offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleBroken = () => setIsBroken(true);
    const handleRetry = () => {
      setIsBroken(false);
      loadData();
    };
    window.addEventListener('supabase-broken', handleBroken);
    window.addEventListener('supabase-retry', handleRetry);
    return () => {
      window.removeEventListener('supabase-broken', handleBroken);
      window.removeEventListener('supabase-retry', handleRetry);
    };
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    if (window.confirm('Deseja realmente limpar a sessão local?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const handleDeleteTemplate = async (id: string) => {
    if (window.confirm('Deseja realmente excluir este modelo? Todos os dados vinculados a ele podem ser afetados.')) {
      // Optimistic update
      const previousTemplates = [...templates];
      setTemplates(templates.filter(t => t.id !== id));
      
      try {
        await supabaseService.deleteTemplate(id);
        // No need to reload everything, just keep the optimistic state
      } catch (err) {
        setTemplates(previousTemplates);
        alert('Erro ao excluir modelo.');
      }
    }
  };

  const handleDeleteResponse = async (id: string) => {
    if (window.confirm('Deseja realmente excluir este registro do histórico? Esta ação é irreversível.')) {
      // Optimistic update
      const previousResponses = [...responses];
      setResponses(responses.filter(r => r.id !== id));
      
      try {
        await supabaseService.deleteResponse(id);
        // No need to reload everything
      } catch (err) {
        setResponses(previousResponses);
        alert('Erro ao excluir registro.');
      }
    }
  };

  const handleDuplicateTemplate = async (template: ChecklistTemplate) => {
    const newTemplate: ChecklistTemplate = {
      ...template,
      id: `tmpl_${Math.random().toString(36).substr(2, 9)}`,
      title: `${template.title} (Cópia)`
    };

    // Optimistic update
    setTemplates([newTemplate, ...templates]);

    try {
      await supabaseService.saveTemplate(newTemplate);
    } catch (err) {
      setTemplates(templates); // Revert
      alert('Erro ao duplicar modelo.');
    }
  };

  const filteredResponses = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase();
    return responses.filter(r => {
      const t = templates.find(temp => temp.id === r.templateId);
      const idMatch = r.customId?.toLowerCase().includes(term) || false;
      const titleMatch = t?.title?.toLowerCase().includes(term) || false;
      const termMatches = !term || idMatch || titleMatch;
      let dateMatches = true;
      if (filterDate) {
        const resDate = new Date(r.updatedAt).toISOString().split('T')[0];
        dateMatches = resDate === filterDate;
      }
      const templateMatches = !filterTemplateId || r.templateId === filterTemplateId;
      return termMatches && dateMatches && templateMatches;
    });
  }, [responses, templates, deferredSearchTerm, filterDate, filterTemplateId]);

  const renderContent = () => {
    // Removido o bloqueio total por isBroken para permitir modo offline
    
    try {
      switch (currentPage) {
        case 'reports':
           return <Reports templates={templates} responses={responses} />;
        case 'batch_download':
           return <BatchDownload />;
        case 'checklists':
          return (
            <div className="space-y-8 animate-fadeIn pb-24">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Histórico</h2>
                 <button onClick={() => setCurrentPage('templates')} className="md:hidden bg-orange-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg">+ Novo</button>
              </div>
                 
              <div className="flex flex-col gap-4">
                 <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
                     <div className="relative flex-1">
                       <input 
                        type="text" 
                        placeholder="🔍 Buscar por ID ou nome..." 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pl-10 text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                       />
                       <span className="absolute left-3 top-3 text-gray-400">🔎</span>
                     </div>
                     <div className="relative w-full md:w-56">
                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 group focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                           <span className="text-gray-400 text-xs mr-2">📅</span>
                           <input 
                             type="date"
                             className="bg-transparent border-none py-3 text-xs font-bold focus:ring-0 outline-none text-gray-600 flex-1 h-full"
                             value={filterDate}
                             onChange={(e) => setFilterDate(e.target.value)}
                           />
                           {filterDate && <button onClick={() => setFilterDate('')} className="ml-2 text-gray-400 hover:text-red-500 font-bold p-1">✕</button>}
                        </div>
                     </div>
                     {(searchTerm || filterDate || filterTemplateId) && (
                         <button onClick={() => { setSearchTerm(''); setFilterDate(''); setFilterTemplateId(''); }} className="px-4 py-3 bg-red-50 text-red-500 rounded-xl font-black text-[10px] uppercase hover:bg-red-100 transition-colors whitespace-nowrap">Limpar</button>
                     )}
                 </div>
                 <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                    <button onClick={() => setFilterTemplateId('')} className={`whitespace-nowrap px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all shadow-sm ${filterTemplateId === '' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200'}`}>📂 Todos</button>
                    {templates.map(t => (
                        <button key={t.id} onClick={() => setFilterTemplateId(t.id === filterTemplateId ? '' : t.id)} className={`whitespace-nowrap px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all shadow-sm ${filterTemplateId === t.id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-200'}`}>{t.title}</button>
                    ))}
                 </div>
              </div>

              {filteredResponses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-gray-100">
                      <div className="text-6xl mb-4 grayscale opacity-20">📭</div>
                      <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest text-center">Nenhum resultado encontrado</p>
                  </div>
              ) : (
              <div className="space-y-4">
                {filteredResponses.map(r => {
                  const t = templates.find(temp => temp.id === r.templateId);
                  const isDraft = r.status === 'DRAFT';
                  return (
                    <div 
                      key={r.id} 
                      onClick={() => { if(t) { setActiveTemplate(t); setActiveChecklistId(r.id); setCurrentPage(isDraft ? 'run_checklist' : 'view_checklist'); } }}
                      className="bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center p-4 hover:shadow-xl transition-all cursor-pointer group/card relative"
                    >
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-2xl overflow-hidden shrink-0 border border-gray-100">
                        {t?.image ? (
                          <img src={t.image} className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-500" alt={t.title} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📦</div>
                        )}
                      </div>
                      
                      <div className="ml-4 md:ml-6 flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${!isDraft ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {!isDraft ? 'Concluído' : 'Rascunho'}
                          </span>
                          <span className="text-[8px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md uppercase tracking-widest">
                            #{r.customId || 'S/ID'}
                          </span>
                        </div>
                        <h3 className="text-sm md:text-base font-black text-gray-800 truncate uppercase tracking-tighter">
                          {t?.title || 'Checklist'}
                        </h3>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                          {new Date(r.updatedAt).toLocaleDateString('pt-BR')} às {new Date(r.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 ml-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteResponse(r.id); }}
                          className="p-3 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                          title="Excluir Registro"
                        >
                          <span className="text-sm">🗑️</span>
                        </button>
                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover/card:bg-orange-600 group-hover/card:text-white transition-all">
                          <span className="text-lg font-bold">→</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        case 'run_checklist': return activeTemplate && <ChecklistRunner template={activeTemplate} editId={activeChecklistId} onBack={() => { fetchResponses(); setCurrentPage('checklists'); }} />;
        case 'view_checklist': return activeTemplate && activeChecklistId && <ChecklistSummary template={activeTemplate} responseId={activeChecklistId} onBack={() => { fetchResponses(); setCurrentPage('checklists'); }} />;
        case 'users': return <UserManagement />;
        case 'templates':
        default:
          if (editTemplateId !== undefined) return <TemplateEditor editId={editTemplateId} onBack={() => { setEditTemplateId(undefined); setCurrentPage('templates'); }} />;
          return (
            <div className="space-y-8 animate-fadeIn pb-24">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Checklists</h2>
                <button onClick={() => setEditTemplateId("")} className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg tracking-widest hover:bg-orange-700 transition-all">+ Novo</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {templates.map(t => (
                  <div key={t.id} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-2xl transition-all group border-b-8 border-orange-500 overflow-hidden flex flex-col relative">
                    <div className="h-48 bg-gray-50 relative overflow-hidden shrink-0">
                      {t.image ? <img src={t.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={t.title} /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">📋</div>}
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDuplicateTemplate(t); }}
                           title="Duplicar Modelo"
                           className="bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg text-orange-600 hover:bg-orange-600 hover:text-white transition-all"
                         >
                           <span className="text-xs">📄📄</span>
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                           title="Excluir Modelo"
                           className="bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg text-red-500 hover:bg-red-500 hover:text-white transition-all"
                         >
                           <span className="text-xs">🗑️</span>
                         </button>
                      </div>
                    </div>
                    <div className="p-8 flex-1 flex flex-col justify-between">
                      <h3 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-tighter line-clamp-2">{t.title}</h3>
                      <div className="flex gap-3">
                        <button onClick={() => { setActiveTemplate(t); setActiveChecklistId(undefined); setCurrentPage('run_checklist'); }} className="flex-1 bg-orange-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl tracking-widest hover:bg-orange-700">Iniciar</button>
                        <button onClick={() => setEditTemplateId(t.id)} className="bg-gray-50 text-gray-400 px-5 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-gray-100 transition-all">Editar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
      }
    } catch (error) {
      console.error("Erro na renderização:", error);
      return <div className="p-10 text-center text-red-500">Erro ao carregar componente.</div>;
    }
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50"><div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div></div>;

  return (
    <ErrorBoundary>
      <Layout user={user || GUEST_USER} onLogout={handleLogout} currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
};

export default App;
