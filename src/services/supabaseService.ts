import { supabase, isSupabaseConfigured, canUseSupabaseRuntime, markSupabaseAsBroken } from '../supabaseClient';
import { User, ChecklistTemplate, ChecklistResponse } from '../types';
import { localService } from './localService';

const checkSupabaseError = (error: any) => {
  if (!error) return false;
  
  const errorMessage = error.message || String(error);
  const isInvalidKey = errorMessage.includes('Invalid API key') || 
                       errorMessage.includes('api key') || 
                       error.code === 'PGRST301' ||
                       error.code === '401';
  const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError');

  if (isInvalidKey || isNetworkError) {
    markSupabaseAsBroken();
    return true;
  }
  return false;
};

const canUseSupabase = () => canUseSupabaseRuntime();

export const supabaseService = {
  // Auth
  async syncUser(sessionUser: any): Promise<User | null> {
    if (!sessionUser) return null;
    if (!canUseSupabase()) {
      throw new Error('Supabase não configurado. Autenticação obrigatória via Supabase.');
    }

    const email = sessionUser.email;
    if (!email) return null;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error && checkSupabaseError(error)) {
        throw new Error('Erro de conexão com o banco de dados do Supabase.');
      }

      if (error || !data) {
        // Se o usuário não existe na tabela 'users', mas está autenticado no Auth,
        // podemos decidir se criamos ele ou se bloqueamos. 
        // Para ser seguro e seguir a regra "apenas senha do supabase", 
        // vamos tentar criar com permissões mínimas ou conforme a lógica anterior, 
        // mas sem o fallback de "ADMIN" genérico se falhar a escrita.
        
        const dbUser = {
          id: sessionUser.id,
          email,
          name: sessionUser.user_metadata?.full_name || email.split('@')[0],
          role: 'USER', // Default to USER for new signups
          allowed_screens: ['dashboard', 'checklists'], // Minimal screens
          updated_at: new Date().toISOString()
        };
        
        const { data: created, error: createError } = await supabase
          .from('users')
          .insert([dbUser])
          .select()
          .single();
          
        if (createError || !created) {
          console.error("Erro ao criar perfil de usuário no Supabase:", createError);
          throw new Error("Seu usuário está autenticado, mas não foi possível criar seu perfil no banco de dados.");
        }
        
        const mappedUser: User = {
          id: created.id,
          email: created.email,
          name: created.name,
          role: created.role,
          allowedScreens: created.allowed_screens
        };
        
        localStorage.setItem('checklist_user', JSON.stringify(mappedUser));
        return mappedUser;
      }

      const mappedData: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        allowedScreens: data.allowed_screens
      };

      localStorage.setItem('checklist_user', JSON.stringify(mappedData));
      return mappedData;
    } catch (err: any) {
      console.error('Erro ao sincronizar usuário:', err);
      throw err;
    }
  },

  async login(email: string, password?: string): Promise<User | null> {
    if (!canUseSupabase()) {
      throw new Error('O sistema de autenticação (Supabase) não está configurado corretamente. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
    }

    if (password) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          console.error('Auth error:', authError.message);
          
          // Check if it's an API key error and mark as broken
          if (checkSupabaseError(authError)) {
            throw new Error('Erro de Configuração: A chave de API (anon key) não corresponde à URL do projeto Supabase ou é inválida. Verifique se copiou as chaves corretamente do painel do Supabase.');
          }

          throw new Error(authError.message === 'Invalid login credentials' 
            ? 'E-mail ou senha incorretos no Supabase.' 
            : `Erro de Autenticação: ${authError.message}`);
        }

        if (authData.user) {
          return await this.syncUser(authData.user);
        }
        return null;
      } catch (err: any) {
        if (checkSupabaseError(err)) {
          throw new Error('Erro de Conexão: Não foi possível conectar ao Supabase. Verifique sua chave de API e URL.');
        }
        throw err;
      }
    }

    throw new Error('A senha do Supabase é obrigatória para acessar o sistema.');
  },

  async logout() {
    try {
      if (canUseSupabase()) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
    } finally {
      localStorage.removeItem('checklist_user');
    }
  },

  async getUser(): Promise<User | null> {
    const stored = localStorage.getItem('checklist_user');
    return stored ? JSON.parse(stored) : null;
  },

  // Templates
  async getTemplates(): Promise<ChecklistTemplate[]> {
    if (!canUseSupabase()) {
      throw new Error('Supabase não configurado.');
    }
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error fetching templates:', error);
        return [];
      }
      
      return (data || []).map(t => ({
        id: t.id,
        title: t.title,
        stages: t.stages,
        signatureTitle: t.signature_title,
        customIdPlaceholder: t.custom_id_placeholder,
        image: t.image_url
      }));
    } catch (err) {
      console.error('Erro ao buscar templates:', err);
      throw err;
    }
  },

  async saveTemplate(template: ChecklistTemplate): Promise<void> {
    if (!canUseSupabase()) {
      throw new Error('Supabase não configurado.');
    }
    try {
      const dbTemplate = {
        id: template.id,
        title: template.title,
        stages: template.stages,
        signature_title: template.signatureTitle,
        custom_id_placeholder: template.customIdPlaceholder,
        image_url: template.image,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('templates')
        .upsert([dbTemplate]);

      if (error) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error saving template:', error);
        throw error;
      }
    } catch (err) {
      console.error('Erro ao salvar template:', err);
      throw err;
    }
  },

  async deleteTemplate(id: string): Promise<void> {
    if (!canUseSupabase()) throw new Error('Supabase não configurado.');
    try {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error deleting template:', error);
        throw error;
      }
    } catch (err) {
      console.error('Erro ao deletar template:', err);
      throw err;
    }
  },

  // Responses
  async getResponses(): Promise<ChecklistResponse[]> {
    if (!canUseSupabase()) throw new Error('Supabase não configurado.');
    try {
      const { data, error } = await supabase
        .from('responses')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error fetching responses:', error);
        return [];
      }
      
      return (data || []).map(r => ({
        id: r.id,
        templateId: r.template_id,
        customId: r.custom_id,
        status: r.status,
        currentStageId: r.current_stage_id,
        data: r.data,
        stageTimeSpent: r.stage_time_spent,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        completedAt: r.completed_at,
        pdfUrl: r.pdf_url
      }));
    } catch (err) {
      console.error('Erro ao buscar respostas:', err);
      throw err;
    }
  },

  async getResponseById(id: string): Promise<ChecklistResponse | null> {
    if (!canUseSupabase()) throw new Error('Supabase não configurado.');
    try {
      const { data: r, error } = await supabase
        .from('responses')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !r) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error fetching response:', error);
        return null;
      }
      
      return {
        id: r.id,
        templateId: r.template_id,
        customId: r.custom_id,
        status: r.status,
        currentStageId: r.current_stage_id,
        data: r.data,
        stageTimeSpent: r.stage_time_spent,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        completedAt: r.completed_at,
        pdfUrl: r.pdf_url
      };
    } catch (err) {
      console.error('Erro ao buscar resposta por ID:', err);
      throw err;
    }
  },

  async saveResponse(response: ChecklistResponse): Promise<void> {
    if (!canUseSupabase()) throw new Error('Supabase não configurado.');
    try {
      const dbResponse = {
        id: response.id,
        template_id: response.templateId,
        custom_id: response.customId,
        status: response.status,
        current_stage_id: response.currentStageId,
        data: response.data,
        stage_time_spent: response.stageTimeSpent,
        created_at: response.createdAt,
        updated_at: new Date().toISOString(),
        completed_at: response.completedAt,
        pdf_url: response.pdfUrl
      };

      const { error } = await supabase
        .from('responses')
        .upsert([dbResponse]);

      if (error) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error saving response:', error);
        throw error;
      }
    } catch (err) {
      console.error('Erro ao salvar resposta:', err);
      throw err;
    }
  },

  async deleteResponse(id: string): Promise<void> {
    if (!canUseSupabase()) throw new Error('Supabase não configurado.');
    try {
      const { error } = await supabase
        .from('responses')
        .delete()
        .eq('id', id);

      if (error) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error deleting response:', error);
        throw error;
      }
    } catch (err) {
      console.error('Erro ao deletar resposta:', err);
      throw err;
    }
  },

  // Users Management
  async getUsers(): Promise<User[]> {
    if (!canUseSupabase()) throw new Error('Supabase não configurado.');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*');

      if (error) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error fetching users:', error);
        return [];
      }
      
      return (data || []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        allowedScreens: u.allowed_screens
      }));
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      throw err;
    }
  },

  async saveUser(user: User): Promise<void> {
    if (!canUseSupabase()) throw new Error('Supabase não configurado.');
    try {
      const dbUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        allowed_screens: user.allowedScreens,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('users')
        .upsert([dbUser]);

      if (error) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error saving user:', error);
        throw error;
      }
    } catch (err) {
      console.error('Erro ao salvar usuário:', err);
      throw err;
    }
  },

  async deleteUser(id: string): Promise<void> {
    if (!canUseSupabase()) throw new Error('Supabase não configurado.');
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error deleting user:', error);
        throw error;
      }
    } catch (err) {
      console.error('Erro ao deletar usuário:', err);
      throw err;
    }
  },

  // Storage
  async uploadFile(bucket: string, path: string, file: File | Blob | string): Promise<string | null> {
    if (!canUseSupabase()) return null;
    
    try {
      let fileBody: File | Blob;
      
      if (typeof file === 'string' && file.startsWith('data:')) {
        // Convert DataURL to Blob
        const res = await fetch(file);
        fileBody = await res.blob();
      } else if (typeof file === 'string') {
        return null;
      } else {
        fileBody = file;
      }

      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, fileBody, {
          upsert: true,
          contentType: fileBody.type
        });

      if (error) {
        console.error(`Erro ao fazer upload para ${bucket}:`, error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      return publicUrl;
    } catch (err) {
      console.error(`Erro inesperado no upload para ${bucket}:`, err);
      return null;
    }
  }
};
