import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Improved check to avoid using placeholder values
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  supabaseUrl.startsWith('https://') && 
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('placeholder') &&
  !!supabaseAnonKey &&
  supabaseAnonKey.length > 20 && 
  !supabaseAnonKey.includes('your-anon-key') &&
  !supabaseAnonKey.includes('placeholder');

let runtimeSupabaseBroken = false;

export const markSupabaseAsBroken = () => {
  if (!runtimeSupabaseBroken) {
    console.warn('Supabase marked as broken at runtime. Falling back to local mode.');
    runtimeSupabaseBroken = true;
  }
};

export const canUseSupabaseRuntime = () => isSupabaseConfigured && !runtimeSupabaseBroken;

if (!isSupabaseConfigured && (supabaseUrl || supabaseAnonKey)) {
  console.warn('Supabase configuration appears invalid or incomplete. Falling back to local storage mode.');
}

// Use a valid-looking placeholder URL to prevent "Failed to fetch" from empty string
const finalUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const finalKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key';

export const supabase = createClient(finalUrl, finalKey);
