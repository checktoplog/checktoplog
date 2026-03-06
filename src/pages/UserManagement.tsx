
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabaseService } from '../services/supabaseService';

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

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getUsers();
      setUsers(data || []);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.accessCode) {
      alert("Preencha todos os campos, incluindo o código de acesso.");
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
        accessCode: formData.accessCode.trim()
      };

      await supabaseService.saveUser(user);
      alert("Usuário salvo com sucesso! Agora ele pode entrar usando o código: " + formData.accessCode.trim());
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
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Código</th>
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
                    <code className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">
                      {u.accessCode || '---'}
                    </code>
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
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Código de Acesso:</p>
                <code className="text-[10px] font-mono font-bold text-orange-600 bg-white px-2 py-1 rounded border border-orange-100">
                  {u.accessCode || 'Não definido'}
                </code>
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
                    value={formData.name}
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
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Código de Acesso Único</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:border-orange-500 transition-colors"
                    value={formData.accessCode}
                    onChange={e => setFormData({ ...formData, accessCode: e.target.value })}
                    placeholder="Ex: Dwss14112001"
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
