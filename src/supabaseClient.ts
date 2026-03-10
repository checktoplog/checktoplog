import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

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

if (!isSupabaseConfigured) {
  console.error('SUPABASE CONFIGURATION MISSING or INVALID:', {
    urlSet: !!supabaseUrl,
    urlValid: supabaseUrl.startsWith('https://'),
    keySet: !!supabaseAnonKey,
    keyLength: supabaseAnonKey.length
  });
} else {
  console.log('Supabase initialized with URL:', supabaseUrl.substring(0, 15) + '...');
  console.log('Supabase Key starts with:', supabaseAnonKey.substring(0, 10) + '...');
}

let runtimeSupabaseBroken = false;

export const markSupabaseAsBroken = () => {
  if (!runtimeSupabaseBroken) {
    console.warn('Supabase marked as broken at runtime.');
    runtimeSupabaseBroken = true;
    // Trigger a custom event so the app can react
    window.dispatchEvent(new CustomEvent('supabase-broken'));
  }
};

export const isSupabaseBroken = () => runtimeSupabaseBroken;

export const canUseSupabaseRuntime = () => isSupabaseConfigured && !runtimeSupabaseBroken;

// Use a valid-looking placeholder URL to prevent "Failed to fetch" from empty string
const finalUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const finalKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key';

export const supabase = createClient(finalUrl, finalKey);
