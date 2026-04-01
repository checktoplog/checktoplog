
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../supabaseClient';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'USER',
    allowedScreens: ['checklists', 'batch_download'],
    accessCode: ''
  });

  const availableScreens = [
    { id: 'dashboard', label: 'Painel Inicial' },
    { id: 'templates', label: 'Checklists (Modelos)' },
    { id: 'checklists', label: 'Histórico (Checklists)' },
    { id: 'reports', label: 'Relatórios (Métricas)' },
    { id: 'batch_download', label: 'Arquivos (Download)' },
    { id: 'users', label: 'Equipe (Gestão)' }
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const [tableError, setTableError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setTableError(null);
    try {
      const data = await supabaseService.getUsers();
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
      if (error.code === '42P01') {
        setTableError('A tabela "users" não foi encontrada no banco de dados.');
      } else {
        setTableError(error.message || 'Erro ao carregar usuários.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      alert("Preencha o nome e o e-mail.");
      return;
    }

    setLoading(true);
    try {
      const user: User = {
        id: editingUser?.id || '',
        name: formData.name!,
        email: formData.email!,
        role: formData.role as UserRole,
        allowedScreens: formData.allowedScreens!,
      };

      await supabaseService.saveUser(user);
      alert("Usuário salvo com sucesso!");
      await loadUsers();
      setShowModal(false);
      setEditingUser(null);
      setFormData({ 
        name: '', 
        email: '', 
        role: 'USER', 
        allowedScreens: ['checklists', 'batch_download'],
        accessCode: ''
      });
    } catch (error: any) {
      console.error("Error saving user:", error);
      alert("Erro ao salvar usuário: " + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const toggleScreen = (screenId: string) => {
    const screens = [...(formData.allowedScreens || [])];
    if (screens.includes(screenId)) {
      setFormData({ ...formData, allowedScreens: screens.filter(s => s !== screenId) });
    } else {
      setFormData({ ...formData, allowedScreens: [...screens, screenId] });
    }
  };

  const deleteUser = async (id: string) => {
    if (confirm('Deseja excluir as permissões deste usuário?')) {
      setLoading(true);
      try {
        await supabaseService.deleteUser(id);
        await loadUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("Erro ao excluir usuário.");
      } finally {
        setLoading(false);
      }
    }
  };

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [syncing, setSyncing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const syncLocalData = async () => {
    if (!isSupabaseConfigured) {
      setDebugInfo(`Configuração ausente:
URL: ${import.meta.env.VITE_SUPABASE_URL ? 'Definida' : 'Ausente'}
KEY: ${import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Definida' : 'Ausente'}

Certifique-se de definir as variáveis de ambiente no seu painel de deploy (Vercel/Cloud Run).`);
      return;
    }

    if (!confirm('Deseja enviar todos os dados salvos localmente neste navegador para o Supabase? Isso ajudará a unificar as informações entre todos os usuários.')) return;
    
    setSyncing(true);
    try {
      const templates = JSON.parse(localStorage.getItem('checktoplog_templates_local') || '[]');
      const responses = JSON.parse(localStorage.getItem('checktoplog_responses_local') || '[]');
      const localUsers = JSON.parse(localStorage.getItem('checktoplog_users_local') || '[]');
      
      let count = 0;
      for (const t of templates) { await supabaseService.saveTemplate(t); count++; }
      for (const r of responses) { await supabaseService.saveResponse(r); count++; }
      for (const u of localUsers) { await supabaseService.saveUser(u); count++; }
      
      alert(`Sincronização concluída! ${count} itens foram enviados para o Supabase.`);
      loadUsers();
    } catch (err: any) {
      alert(`Erro na sincronização: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      await supabaseService.getUsers();
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (e) {
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 5000);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-orange-600">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
        <p className="font-bold">Carregando usuários...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-20 px-2 md:px-0">
      {!isSupabaseConfigured && (
        <div className="bg-red-50 border-2 border-red-200 p-8 rounded-[2rem] shadow-sm animate-pulse">
          <div className="flex items-center space-x-4 mb-4">
            <span className="text-4xl">⚠️</span>
            <h3 className="text-red-800 font-black uppercase tracking-tighter text-lg">Supabase não configurado no Vercel</h3>
          </div>
          <p className="text-red-700 text-sm font-bold leading-relaxed mb-6">
            O aplicativo detectou que as chaves do banco de dados estão faltando no seu painel da Vercel. Siga estes passos para ativar a sincronização:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white/50 p-4 rounded-2xl border border-red-100">
              <p className="text-[10px] font-black text-red-800 uppercase mb-2">1. Adicione as Variáveis</p>
              <ul className="space-y-1 text-[9px] font-bold text-red-600 uppercase">
                <li>• VITE_SUPABASE_URL</li>
                <li>• VITE_SUPABASE_ANON_KEY</li>
              </ul>
            </div>
            <div className="bg-white/50 p-4 rounded-2xl border border-red-100">
              <p className="text-[10px] font-black text-red-800 uppercase mb-2">2. Faça o Redeploy</p>
              <p className="text-[9px] font-bold text-red-600 uppercase">
                Vá em Deployments {'>'} Redeploy. Sem isso, as chaves não funcionam.
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              const url = import.meta.env.VITE_SUPABASE_URL || '';
              const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
              const isVercel = window.location.hostname.includes('vercel.app');
              const isAIStudio = window.location.hostname.includes('run.app');

              setDebugInfo(`🔍 DIAGNÓSTICO TÉCNICO:
--------------------------------
Ambiente Detectado: ${isVercel ? 'VERCEL' : isAIStudio ? 'AI STUDIO PREVIEW' : 'LOCAL/OUTRO'}
URL Detectada: ${url ? `${url.substring(0, 15)}... (OK)` : 'AUSENTE ❌'}
KEY Detectada: ${key ? `${key.substring(0, 10)}... (OK)` : 'AUSENTE ❌'}

ONDE CONFIGURAR:
${isAIStudio ? '👉 No menu SETTINGS (Engrenagem) aqui do AI Studio.' : '👉 No painel da VERCEL (Settings > Environment Variables).'}

DICA: Se você configurou no Vercel agora, você PRECISA ir em 'Deployments' e clicar em 'REDEPLOY' para as chaves passarem a valer.`);
            }}
            className="text-[9px] font-black text-red-600 uppercase underline"
          >
            Ver Diagnóstico de Conexão
          </button>

          {debugInfo && (
            <div className="mt-4 p-4 bg-white/80 border border-red-200 rounded-xl">
              <pre className="text-[9px] font-mono whitespace-pre-wrap text-red-900">{debugInfo}</pre>
              <button onClick={() => setDebugInfo(null)} className="mt-2 text-[9px] font-black text-red-700 uppercase underline">Fechar</button>
            </div>
          )}
        </div>
      )}

      {isSupabaseConfigured && (
        <div className={`p-6 rounded-[2rem] shadow-sm border-2 ${tableError ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center space-x-4 mb-4">
            <span className="text-3xl">{tableError ? '❌' : '🛠️'}</span>
            <h3 className={`font-black uppercase tracking-tighter ${tableError ? 'text-red-800' : 'text-blue-800'}`}>
              {tableError ? 'Tabela Não Encontrada' : 'Configuração do Banco de Dados'}
            </h3>
          </div>
          
          {debugInfo && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-yellow-800 text-[10px] font-black uppercase mb-2">🔍 Diagnóstico de Conexão</p>
              <pre className="text-[9px] font-mono whitespace-pre-wrap text-yellow-900">{debugInfo}</pre>
              <button onClick={() => setDebugInfo(null)} className="mt-2 text-[9px] font-black text-yellow-700 uppercase underline">Fechar Diagnóstico</button>
            </div>
          )}
          
          {tableError && (
            <div className="mb-4 p-4 bg-white/50 rounded-xl border border-red-100">
              <p className="text-red-700 text-[10px] font-black uppercase tracking-widest">
                Ocorreu um erro ao acessar a tabela de usuários. Isso geralmente significa que a tabela ainda não foi criada no Supabase.
              </p>
            </div>
          )}

          <div className="bg-red-50 border-2 border-red-200 p-6 rounded-[2rem] mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-black text-red-900 uppercase tracking-tight">Correção de Erro: Colunas Faltando</h3>
            </div>
            <p className="text-red-700 text-xs font-bold mb-4 leading-relaxed uppercase tracking-widest">
              Se você recebeu o erro "Could not find the 'external_data' column", execute o script abaixo no SQL Editor do Supabase para atualizar seu banco de dados:
            </p>
            <pre className="bg-white p-4 rounded-xl text-[10px] font-mono text-gray-800 overflow-x-auto border border-red-100 mb-4 select-all">
{`ALTER TABLE templates ADD COLUMN IF NOT EXISTS external_data jsonb DEFAULT '[]';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS external_data_imported_at timestamp with time zone;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS external_data_row jsonb;`}
            </pre>
            <p className="text-red-600 text-[9px] font-black uppercase tracking-tighter">
              Copie o código acima, vá no Supabase -> SQL Editor -> New Query, cole e clique em RUN.
            </p>
          </div>

          <p className={`${tableError ? 'text-red-700' : 'text-blue-700'} text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-4`}>
            {tableError ? 'Para corrigir, execute o comando abaixo no SQL Editor do seu Supabase:' : 'Certifique-se de que todas as tabelas existem no seu Supabase. Execute o comando abaixo no SQL Editor do Supabase:'}
          </p>
          <pre className={`p-4 rounded-xl text-[9px] font-mono overflow-x-auto border ${tableError ? 'bg-red-100/50 text-red-900 border-red-200' : 'bg-white/50 text-blue-900 border-blue-100'}`}>
{`-- CONFIGURAÇÃO COMPLETA DO BANCO DE DADOS

-- 1. Tabela de Usuários
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text not null default 'USER',
  allowed_screens text[] default '{}',
  updated_at timestamp with time zone default now()
);

-- 2. Tabela de Modelos (Templates)
create table if not exists templates (
  id text primary key,
  title text not null,
  stages jsonb not null default '[]',
  signature_title text,
  custom_id_placeholder text,
  image_url text,
  external_data jsonb default '[]',
  external_data_imported_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

-- 3. Tabela de Respostas (Checklists)
create table if not exists responses (
  id text primary key,
  template_id text not null,
  custom_id text,
  status text not null default 'DRAFT',
  current_stage_id text,
  data jsonb not null default '{}',
  stage_time_spent jsonb default '{}',
  external_data_row jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  pdf_url text
);

-- 4. Habilitar Acesso Público (RLS)
alter table users enable row level security;
drop policy if exists "Acesso Público Users" on users;
create policy "Acesso Público Users" on users for all using (true) with check (true);

alter table templates enable row level security;
drop policy if exists "Acesso Público Templates" on templates;
create policy "Acesso Público Templates" on templates for all using (true) with check (true);

alter table responses enable row level security;
drop policy if exists "Acesso Público Responses" on responses;
create policy "Acesso Público Responses" on responses for all using (true) with check (true);

`}
          </pre>

          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-blue-800 text-[10px] font-black uppercase tracking-widest mb-2">📁 Configuração de Arquivos (Storage)</p>
            <p className="text-blue-700 text-[9px] font-medium leading-relaxed">
              Para salvar fotos e assinaturas, crie dois buckets no menu <b>Storage</b> do Supabase chamados: 
              <span className="font-bold"> "templates"</span> e <span className="font-bold"> "responses"</span>. 
              Certifique-se de marcá-los como <span className="font-bold text-red-600">PUBLIC</span>.
            </p>
          </div>
          
          <div className="flex gap-2 mt-4">
            <button 
              onClick={loadUsers}
              className="bg-red-600 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-700 transition-all"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={testConnection}
              className="bg-white border border-red-200 text-red-600 px-6 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-50 transition-all"
            >
              {testStatus === 'testing' ? 'Testando...' : 'Testar Conexão'}
            </button>
            <button 
              onClick={syncLocalData}
              disabled={syncing}
              className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar Dados Locais'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-orange-50 border-2 border-orange-200 p-4 md:p-6 rounded-[2rem] flex items-start space-x-4 shadow-sm">
        <div className="text-3xl">ℹ️</div>
        <div>
          <p className="font-black text-orange-800 text-xs uppercase tracking-tight">Gestão de Acessos</p>
          <p className="text-orange-700 text-[10px] font-bold uppercase tracking-widest mt-1 leading-relaxed">
            O usuário deve acessar o app pelo menos uma vez para ser registrado automaticamente. 
            Depois disso, você poderá editar as permissões dele nesta tela.
          </p>
        </div>
      </div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Equipe & Permissões</h2>
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Controle de acesso e funções dos colaboradores</p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setShowModal(true); }}
          className="w-full md:w-auto bg-orange-600 text-white px-6 py-4 md:py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-orange-700 transition-all active:scale-95"
        >
          + Vincular Perfil
        </button>
      </header>

      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          {users.length === 0 ? (
            <div className="p-20 text-center">
              <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Colaborador</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Função</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Telas Permitidas</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-orange-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-xs shadow-inner">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900 uppercase">{u.name}</p>
                        <p className="text-[9px] text-gray-400 font-bold">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight max-w-xs truncate">
                      {u.role === 'ADMIN' ? 'Acesso Total' : (u.allowedScreens || []).join(', ')}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right space-x-4">
                    <button 
                      onClick={() => { setEditingUser(u); setFormData(u); setShowModal(true); }}
                      className="text-orange-600 hover:text-orange-700 font-black text-[10px] uppercase tracking-widest"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => deleteUser(u.id)}
                      className="text-red-400 hover:text-red-600 font-black text-[10px] uppercase tracking-widest"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-4">
          {users.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Nenhum usuário encontrado.</p>
            </div>
          ) : (
            users.map(u => (
            <div key={u.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shadow-lg">
                    {u.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-black text-gray-900 text-xs uppercase truncate">{u.name}</h4>
                    <p className="text-[9px] font-bold text-gray-400 truncate">{u.email}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shrink-0 ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {u.role}
                </span>
              </div>

              <div className="pt-3 border-t border-gray-200/50">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Acessos:</p>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-tight line-clamp-2">
                  {u.role === 'ADMIN' ? 'Acesso Total ao Sistema' : (u.allowedScreens || []).join(', ')}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => { setEditingUser(u); setFormData(u); setShowModal(true); }}
                  className="flex-1 bg-white border border-gray-200 text-orange-600 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-sm"
                >
                  Editar
                </button>
                <button 
                  onClick={() => deleteUser(u.id)}
                  className="flex-1 bg-red-50 text-red-500 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest"
                >
                  Excluir
                </button>
              </div>
            </div>
          )))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="p-8 bg-orange-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tighter">{editingUser ? 'Editar Perfil' : 'Vincular Perfil'}</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl font-black hover:scale-110 transition-transform">✕</button>
            </div>
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:border-orange-500 transition-colors"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">E-mail Corporativo</label>
                  <input
                    type="email"
                    disabled={!!editingUser}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:border-orange-500 disabled:opacity-50 transition-colors"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Função no Sistema</label>
                  <select
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:border-orange-500 cursor-pointer transition-colors"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                  >
                    <option value="USER">👤 Usuário Comum</option>
                    <option value="ADMIN">🛡️ Administrador</option>
                  </select>
                </div>

                {formData.role === 'USER' && (
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Telas Permitidas</label>
                    <div className="grid grid-cols-1 gap-2 bg-gray-50 p-4 rounded-2xl border-2 border-gray-100">
                      {availableScreens.map(screen => (
                        <label key={screen.id} className="flex items-center space-x-3 cursor-pointer group p-2 hover:bg-white rounded-xl transition-colors">
                          <input
                            type="checkbox"
                            className="w-5 h-5 text-orange-600 rounded-lg border-gray-300 focus:ring-orange-500 cursor-pointer"
                            checked={formData.allowedScreens?.includes(screen.id)}
                            onChange={() => toggleScreen(screen.id)}
                          />
                          <span className="text-[10px] font-black text-gray-600 uppercase tracking-tight group-hover:text-orange-600 transition-colors">{screen.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-orange-700 transition-all active:scale-95"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
