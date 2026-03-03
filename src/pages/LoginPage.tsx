
import React, { useState } from 'react';

interface LoginPageProps {
  onLogin: (email: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setLoading(true);
    // Simular delay de rede
    setTimeout(() => {
      onLogin(email);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-br from-orange-600 to-orange-500 rounded-b-[4rem] shadow-xl z-0"></div>
      
      <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl w-full max-w-md relative z-10 border border-gray-100 flex flex-col items-center text-center space-y-6 animate-fadeIn">
        <div className="w-20 h-20 bg-orange-600 rounded-[1.5rem] flex items-center justify-center text-5xl font-black text-white shadow-2xl shadow-orange-200 mb-2 select-none">
          T
        </div>
        
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tighter mb-1">CheckTopLog</h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">
            Acesso Local (Modo Desenvolvimento)
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-xl text-xs font-bold w-full border border-red-100 text-left">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <input 
            type="email" 
            placeholder="E-mail"
            className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-medium outline-none focus:border-orange-500 transition-colors"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
          />
          
          <input 
            type="password" 
            placeholder="Senha"
            className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-medium outline-none focus:border-orange-500 transition-colors"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
          />
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-70"
          >
            {loading ? 'Acessando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          Utilize qualquer e-mail e senha para acessar.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
