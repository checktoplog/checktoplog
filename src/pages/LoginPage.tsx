
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { error: authContextError, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authContextError) {
      setError(authContextError);
    }
  }, [authContextError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 space-y-8 border border-gray-100"
      >
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-orange-600 rounded-3xl flex items-center justify-center text-white text-3xl mx-auto shadow-xl mb-4 rotate-3">
            📋
          </div>
          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Acesse o App</h2>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest leading-none">CheckTopLog Operational System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail</label>
              <input 
                type="email" 
                required
                className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-4 text-xs font-bold focus:border-orange-500 focus:bg-white outline-none transition-all"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Senha</label>
              <input 
                type="password" 
                required
                className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-4 text-xs font-bold focus:border-orange-500 focus:bg-white outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="space-y-4">
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight text-center border border-red-100"
              >
                {error}
              </motion.div>
              
              {authContextError && (
                <button 
                  type="button"
                  onClick={() => signOut()}
                  className="w-full bg-gray-100 text-gray-500 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all"
                >
                  Limpar Sessão e Tentar Novamente
                </button>
              )}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-orange-700 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {loading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="pt-6 border-t border-gray-50 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Não tem acesso? Procure o administrador.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
