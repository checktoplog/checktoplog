
import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await supabaseService.signInWithGoogle();
      // Redirect happens automatically with OAuth
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar com Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-50 rounded-full blur-[120px] opacity-60 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-100 rounded-full blur-[120px] opacity-40" />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-white rounded-[2rem] shadow-2xl shadow-orange-100 border border-orange-50 mb-8 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            <span className="text-5xl">📋</span>
          </div>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter uppercase mb-2 leading-none">
            Check<span className="text-orange-600">Top</span>Log
          </h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-1">
            Gestão Inteligente de Logística
          </p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-orange-100/50 border border-orange-50 relative">
          <div className="absolute -top-4 -right-4 bg-orange-600 text-white text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-xl">
            Acesso Restrito
          </div>

          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-8 text-center">
            Bem-vindo de volta
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-bold flex items-center gap-3 animate-shake">
              <span className="text-lg">⚠️</span>
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full group relative flex items-center justify-center gap-4 bg-white border-2 border-gray-100 text-gray-700 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-orange-200 hover:bg-orange-50/30 transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Entrar com Google</span>
              </>
            )}
          </button>

          <div className="mt-10 text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
              Ao entrar, você concorda com nossos<br />
              <span className="text-gray-900 cursor-pointer hover:text-orange-600 transition-colors">Termos de Uso</span> e <span className="text-gray-900 cursor-pointer hover:text-orange-600 transition-colors">Privacidade</span>
            </p>
          </div>
        </div>

        <p className="mt-12 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
          © 2026 CheckTopLog • Crafted with Precision
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
