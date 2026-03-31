
import React, { useState } from 'react';
import { User } from '../types';
import QRCode from 'react-qr-code';
import { isSupabaseConfigured, isSupabaseBroken } from '../supabaseClient';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentPage, onNavigate }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: '🏠' },
    { id: 'templates', label: 'Checklists', icon: '📋' },
    { id: 'checklists', label: 'Histórico', icon: '✅' },
    { id: 'reports', label: 'Relatórios', icon: '📊' },
    { id: 'batch_download', label: 'Arquivos', icon: '📂' },
    { id: 'users', label: 'Equipe', icon: '👥', adminOnly: true },
  ];

  const allowedItems = menuItems.filter(item => {
    // Se for ADMIN, tem acesso a tudo
    if (user.role === 'ADMIN') return true;
    
    // Caso contrário, verifica se a tela está na lista de permitidas
    return Array.isArray(user.allowedScreens) && user.allowedScreens.includes(item.id);
  });

  const isOnline = isSupabaseConfigured && !isSupabaseBroken();

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-gray-50">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-orange-600 text-white p-4 flex justify-between items-center shadow-lg z-50 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black tracking-tighter">CheckTopLog</h1>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} title={isOnline ? 'Online' : 'Offline'}></div>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-xl active:scale-90 transition-transform text-xl"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar - Desktop & Mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] w-72 bg-white border-r transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 shrink-0 shadow-2xl md:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-8 hidden md:block border-b bg-gradient-to-br from-orange-50 to-white">
            <h1 className="text-2xl font-black text-orange-600 tracking-tighter">CheckTopLog</h1>
            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">Inteligência Operacional</p>
          </div>
          
          <div className="md:hidden p-6 border-b flex justify-between items-center bg-gray-50">
             <span className="font-black text-gray-500 uppercase text-xs">Menu</span>
             <button onClick={() => setSidebarOpen(false)} className="text-gray-400 font-bold">Fechar</button>
          </div>

          <nav className="flex-1 p-4 space-y-2 mt-2 overflow-y-auto">
            {allowedItems.map(item => (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all duration-200 ${
                  currentPage === item.id 
                    ? 'bg-orange-600 text-white shadow-xl shadow-orange-200 translate-x-1' 
                    : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600'
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="font-bold text-sm uppercase tracking-wide">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-6 border-t bg-gray-50/50 space-y-4">
            {/* Sync Status */}
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl border ${isOnline ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-[8px] font-black uppercase tracking-widest">
                {isOnline ? 'Sincronização Ativa' : 'Modo Offline (Local)'}
              </span>
            </div>

            <button 
              onClick={() => { setShowQR(true); setSidebarOpen(false); }}
              className="w-full flex items-center justify-center space-x-2 bg-white border-2 border-orange-100 text-orange-600 p-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 transition-all shadow-sm mb-2"
            >
              <span>📱 Acesso Mobile</span>
            </button>

            <div className="flex items-center space-x-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shadow-inner shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black truncate text-gray-900 leading-tight">{user.name}</p>
                <p className="text-[8px] text-orange-600 uppercase font-black tracking-widest mt-0.5">{user.role}</p>
              </div>
              <button 
                onClick={onLogout}
                className="flex flex-col items-center justify-center bg-gray-50 text-gray-400 p-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors group shrink-0"
                title="Limpar Sessão"
              >
                <span className="text-sm">🔄</span>
                <span className="text-[7px] font-black uppercase tracking-widest mt-0.5">Reset</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 relative flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-10 -webkit-overflow-scrolling-touch scroll-smooth">
          <div className="max-w-6xl mx-auto pb-24 md:pb-10">
            {children}
          </div>
        </div>
      </main>

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {showQR && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn" onClick={() => setShowQR(false)}>
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl max-w-sm w-full text-center relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowQR(false)} 
              className="absolute top-4 right-4 bg-gray-100 w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors font-black"
            >
              ✕
            </button>
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2">Acesso Rápido</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">Escaneie para abrir</p>
            <div className="bg-white p-2 rounded-xl border-2 border-orange-100 inline-block shadow-inner mb-4">
               <QRCode 
                 value={window.location.href} 
                 size={200}
                 fgColor="#ea580c"
                 bgColor="#ffffff"
               />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
