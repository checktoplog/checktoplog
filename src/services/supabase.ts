
import { createClient } from '@supabase/supabase-js';
import { User, ChecklistTemplate, ChecklistResponse, UserRole } from '../types.ts';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://najolorobwcugxqkxxyx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ham9sb3JvYndjdWd4cWt4eHl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTU4MDQsImV4cCI6MjA4NTI5MTgwNH0.8XWpdvgy4AuuPp_1Z2pm_V1ljzAjXB59N2LCyn-09iY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Helper para retry em operações assíncronas
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000, name = 'unnamed'): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.warn(`[SupabaseService] Error in ${name}:`, error);
    
    // Se a tabela não existe (erro comum em setups novos), retorna vazio em vez de travar
    if (error?.code === '42P01') {
      console.info(`[SupabaseService] Table not found for ${name}, returning empty.`);
      return [] as any;
    }

    if (retries <= 0) {
      console.error(`[SupabaseService] Max retries reached for ${name}.`);
      throw error;
    }

    console.info(`[SupabaseService] Retrying ${name} in ${delay}ms... (${retries} left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2, name);
  }
}

export const supabaseService = {
  // --- AUTH ---
  async handleUserSession(authUser: any): Promise<User> {
    if (!authUser) throw new Error("Não autenticado");

    console.log("[SupabaseService] Iniciando sessão para:", authUser.email, "ID:", authUser.id);

    const defaultUser: User = {
      id: authUser.id,
      email: authUser.email || '',
      name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
      role: 'USER',
      allowedScreens: ['dashboard', 'templates', 'checklists']
    };

    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.warn("[SupabaseService] Erro ao buscar perfil na tabela 'users':", error.message);
        return defaultUser;
      }

      if (profile) {
        console.log("[SupabaseService] Perfil encontrado:", profile.role);
        return {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: (profile.role as UserRole) || 'USER',
          allowedScreens: Array.isArray(profile.allowed_screens) ? profile.allowed_screens : ['dashboard', 'templates', 'checklists']
        };
      }

      console.info("[SupabaseService] Perfil não encontrado, criando registro inicial...");
      const { error: insertError } = await supabase.from('users').insert({
        id: defaultUser.id,
        name: defaultUser.name,
        email: defaultUser.email,
        role: defaultUser.role,
        allowed_screens: defaultUser.allowedScreens,
        updated_at: new Date().toISOString()
      });

      if (insertError) {
        console.error("[SupabaseService] Falha ao criar perfil inicial:", insertError.message);
      }

      return defaultUser;
    } catch (err: any) {
      console.error("[SupabaseService] Erro crítico no handleUserSession:", err.message || err);
      return defaultUser; 
    }
  },

  async login(email: string, password: string) { 
    console.log("[SupabaseService] Tentando login para:", email);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      console.error("[SupabaseService] Erro no signInWithPassword:", result.error.message);
    } else {
      console.log("[SupabaseService] Login bem-sucedido!");
    }
    return result;
  },

  async register(email: string, password: string) { 
    return await supabase.auth.signUp({ email, password });
  },

  async logout() { 
    await supabase.auth.signOut(); 
  },

  async loginWithGoogle() {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  },

  async loginWithMicrosoft() { 
    return await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo: window.location.origin }
    });
  },

  async resetPasswordForEmail(email: string) { 
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  },

  // --- USERS ---
  async getUsers(): Promise<User[]> {
    return withRetry(async () => {
      const { data, error } = await supabase.from('users').select('*').order('name');
      if (error) throw error;
      return (data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        allowedScreens: u.allowed_screens
      }));
    }, 3, 1000, 'getUsers');
  },

  async saveUser(user: User) {
    const { error } = await supabase.from('users').upsert({
      id: user.id || DEFAULT_USER_ID,
      name: user.name,
      email: user.email,
      role: user.role,
      allowed_screens: user.allowedScreens,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteUser(id: string) { 
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  },

  // --- TEMPLATES ---
  async getTemplates(): Promise<ChecklistTemplate[]> {
    return withRetry(async () => {
      const { data, error } = await supabase.from('templates').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(t => ({
        id: t.id,
        title: t.title,
        stages: t.stages,
        signatureTitle: t.signature_title || 'Assinatura',
        customIdPlaceholder: t.custom_id_placeholder,
        image: t.image_url
      }));
    }, 3, 1000, 'getTemplates');
  },

  async getTemplate(id: string): Promise<ChecklistTemplate | null> {
    return withRetry(async () => {
      const { data, error } = await supabase.from('templates').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        title: data.title,
        stages: data.stages,
        signatureTitle: data.signature_title || 'Assinatura',
        customIdPlaceholder: data.custom_id_placeholder,
        image: data.image_url
      };
    }, 3, 1000, `getTemplate:${id}`);
  },

  async saveTemplate(template: ChecklistTemplate) {
    const { error } = await supabase.from('templates').upsert({
      id: template.id,
      title: template.title,
      stages: template.stages,
      signature_title: template.signatureTitle || 'Assinatura',
      custom_id_placeholder: template.customIdPlaceholder || '',
      image_url: template.image || '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteTemplate(id: string) {
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) throw error;
  },

  // --- RESPONSES ---
  async getResponses(): Promise<ChecklistResponse[]> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('responses')
        .select('id, template_id, custom_id, status, current_stage_id, created_at, updated_at, completed_at, pdf_url')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).map(r => ({
        id: String(r.id),
        templateId: String(r.template_id),
        customId: r.custom_id || '',
        status: r.status,
        currentStageId: r.current_stage_id,
        data: {}, // Lazy load
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        completedAt: r.completed_at,
        pdfUrl: r.pdf_url
      }));
    }, 3, 1000, 'getResponses');
  },

  async getResponseById(id: string): Promise<ChecklistResponse | null> {
    return withRetry(async () => {
      const { data, error } = await supabase.from('responses').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: String(data.id),
        templateId: String(data.template_id),
        customId: data.custom_id || '',
        status: data.status,
        currentStageId: data.current_stage_id,
        data: data.data,
        stageTimeSpent: data.stage_time_spent,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        completedAt: data.completed_at,
        pdfUrl: data.pdf_url
      };
    }, 3, 1000, `getResponseById:${id}`);
  },

  async saveResponse(response: ChecklistResponse) {
    const { error } = await supabase.from('responses').upsert({
      id: response.id,
      template_id: response.templateId,
      custom_id: response.customId,
      status: response.status,
      current_stage_id: response.currentStageId,
      data: response.data,
      stage_time_spent: response.stageTimeSpent,
      created_at: response.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: response.completedAt,
      pdf_url: response.pdfUrl
    }, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteResponse(id: string) {
    const { error } = await supabase.from('responses').delete().eq('id', id);
    if (error) throw error;
  },

  // --- STORAGE ---
  async uploadReport(filename: string, blob: Blob) {
    const { data, error } = await supabase.storage.from('checklists').upload(`reports/${filename}`, blob, { upsert: true });
    if (error) return { url: null, error: error.message };
    const { data: { publicUrl } } = supabase.storage.from('checklists').getPublicUrl(`reports/${filename}`);
    return { url: publicUrl, error: null };
  }
};
