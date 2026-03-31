import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = 
  !!supabaseUrl && 
  supabaseUrl.startsWith('https://') && 
  !!supabaseAnonKey && 
  supabaseAnonKey.length > 20 &&
  !supabaseUrl.includes('placeholder-project');

let runtimeSupabaseBroken = false;
export const markSupabaseAsBroken = () => {
  runtimeSupabaseBroken = true;
  window.dispatchEvent(new CustomEvent('supabase-broken'));
};
export const isSupabaseBroken = () => runtimeSupabaseBroken;
export const canUseSupabaseRuntime = () => isSupabaseConfigured && !runtimeSupabaseBroken;

if (isSupabaseConfigured) {
  console.log("Supabase Client Initialized with URL:", supabaseUrl);
} else {
  console.warn("Supabase Client using placeholders. Check environment variables.");
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key'
)
