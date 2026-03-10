import { createClient } from "@supabase/supabase-js"

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Mantendo esta verificação para que o App saiba quando mostrar os avisos de configuração
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  supabaseUrl.startsWith('https://') && 
  !!supabaseAnonKey &&
  supabaseAnonKey.length > 20;

if (!isSupabaseConfigured) {
  console.error("Supabase não configurado ou chaves inválidas");
}

// Funções auxiliares que o restante do código utiliza para gerenciar o estado da conexão
let runtimeSupabaseBroken = false;
export const markSupabaseAsBroken = () => { 
  runtimeSupabaseBroken = true; 
  window.dispatchEvent(new CustomEvent('supabase-broken')); 
};
export const isSupabaseBroken = () => runtimeSupabaseBroken;
export const canUseSupabaseRuntime = () => isSupabaseConfigured && !runtimeSupabaseBroken;

// Criando o cliente com a configuração de Auth solicitada
// Usamos placeholders caso as chaves não existam para evitar que o app quebre no carregamento
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
);
