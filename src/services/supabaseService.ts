import { supabase, isSupabaseConfigured, canUseSupabaseRuntime, markSupabaseAsBroken, isSupabaseBroken } from '../supabaseClient';
import { User, ChecklistTemplate, ChecklistResponse } from '../types';

const checkSupabaseError = (error: any) => {
  if (!error) return false;
  
  const errorMessage = error.message || String(error);
  const isInvalidKey = errorMessage.includes('Invalid API key') || 
                       errorMessage.includes('api key') || 
                       error.code === 'PGRST301' ||
                       error.code === '401';
  const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('TypeError');

  if (isInvalidKey || isNetworkError) {
    console.warn("Conexão com Supabase indisponível. O aplicativo continuará funcionando em modo offline (armazenamento local).", errorMessage);
    markSupabaseAsBroken();
    return true;
  }
  return false;
};

const canUseSupabase = () => canUseSupabaseRuntime();

// Helper for local storage fallback
const LOCAL_STORAGE_KEYS = {
  TEMPLATES: 'checktoplog_templates_local',
  RESPONSES: 'checktoplog_responses_local',
  USERS: 'checktoplog_users_local',
  RESPONSE_DETAIL_PREFIX: 'checktoplog_resp_detail_'
};

const isQuotaExceeded = (e: any) => {
  return (
    e instanceof DOMException &&
    (e.code === 22 ||
      e.code === 1014 ||
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
};

const getLocal = <T>(key: string): T[] => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error(`Error reading from localStorage key ${key}:`, e);
    return [];
  }
};

const saveLocal = <T extends { id: string }>(key: string, item: T) => {
  const items = getLocal<T>(key);
  const index = items.findIndex(i => i.id === item.id);
  
  // For responses, we often want to save a summary in the main list
  // to keep the list small and avoid quota issues.
  let itemToSave = item;
  if (key === LOCAL_STORAGE_KEYS.RESPONSES) {
    const { data, divergences, ...summary } = item as any;
    itemToSave = summary as any;
  }

  if (index >= 0) {
    items[index] = itemToSave;
  } else {
    items.push(itemToSave);
  }
  
  const trySave = (data: any[]): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  };

  if (trySave(items)) return;

  // If we reach here, quota was exceeded
  console.warn(`Quota exceeded for ${key}. Attempting aggressive pruning...`);
  
  if (key === LOCAL_STORAGE_KEYS.RESPONSES) {
    // Try keeping only the 20 most recent summaries (they are small)
    if (items.length > 20 && trySave(items.slice(-20))) {
      return;
    }
  }

  // Fallback for other keys
  if (items.length > 5 && trySave(items.slice(-5))) return;
  if (trySave([itemToSave])) return;

  console.error(`Critical failure: could not save any data to ${key} even with aggressive pruning.`);
};

const saveResponseDetail = (response: ChecklistResponse) => {
  const key = `${LOCAL_STORAGE_KEYS.RESPONSE_DETAIL_PREFIX}${response.id}`;
  try {
    localStorage.setItem(key, JSON.stringify(response));
  } catch (e) {
    if (isQuotaExceeded(e)) {
      console.warn("Could not cache full response detail due to quota.");
      // We don't prune other details here to avoid deleting user data unexpectedly
    }
  }
};

const getResponseDetail = (id: string): ChecklistResponse | null => {
  const key = `${LOCAL_STORAGE_KEYS.RESPONSE_DETAIL_PREFIX}${id}`;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

const deleteLocal = (key: string, id: string) => {
  const items = getLocal<{ id: string }>(key);
  const filtered = items.filter(i => i.id !== id);
  try {
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {
    console.error(`Error deleting from localStorage key ${key}:`, e);
  }

  if (key === LOCAL_STORAGE_KEYS.RESPONSES) {
    localStorage.removeItem(`${LOCAL_STORAGE_KEYS.RESPONSE_DETAIL_PREFIX}${id}`);
  }
};

export const supabaseService = {
  // Auth
  async loginWithCode(code: string): Promise<User | null> {
    // Retorna sempre o administrador padrão para simplificar, já que o login foi removido
    const adminUser: User = {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Administrador',
      email: 'admin@checktoplog.com',
      role: 'ADMIN',
      allowedScreens: ['dashboard', 'templates', 'checklists', 'reports', 'batch_download', 'users'],
    };
    try {
      localStorage.setItem('checklist_user', JSON.stringify(adminUser));
    } catch (e) {
      console.error("Error saving user to localStorage:", e);
    }
    return adminUser;
  },

  async syncUser(sessionUser: any): Promise<User | null> {
    if (!sessionUser) return null;
    if (!canUseSupabase()) {
      throw new Error('Supabase não configurado ou com erro de conexão.');
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
        
        try {
          localStorage.setItem('checklist_user', JSON.stringify(mappedUser));
        } catch (e) {
          console.error("Error saving user to localStorage:", e);
        }
        return mappedUser;
      }

      const mappedData: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        allowedScreens: data.allowed_screens
      };

      try {
        localStorage.setItem('checklist_user', JSON.stringify(mappedData));
      } catch (e) {
        console.error("Error saving user to localStorage:", e);
      }
      return mappedData;
    } catch (err: any) {
      console.error('Erro ao sincronizar usuário:', err);
      throw err;
    }
  },

  async logout() {
    localStorage.clear();
    window.location.reload();
  },

  async getUser(): Promise<User | null> {
    const stored = localStorage.getItem('checklist_user');
    return stored ? JSON.parse(stored) : null;
  },

  // Templates
  async getTemplates(): Promise<ChecklistTemplate[]> {
    if (!canUseSupabase()) {
      return getLocal<ChecklistTemplate>(LOCAL_STORAGE_KEYS.TEMPLATES);
    }
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        if (checkSupabaseError(error)) {
          return getLocal<ChecklistTemplate>(LOCAL_STORAGE_KEYS.TEMPLATES);
        }
        console.error('Error fetching templates:', error);
        return getLocal<ChecklistTemplate>(LOCAL_STORAGE_KEYS.TEMPLATES);
      }
      
      const templates = (data || []).map(t => ({
        id: t.id,
        title: t.title,
        stages: t.stages,
        signatureTitle: t.signature_title,
        customIdPlaceholder: t.custom_id_placeholder,
        image: t.image_url,
        externalData: t.external_data,
        externalDataImportedAt: t.external_data_imported_at
      }));

      // Cache locally with quota protection
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
      } catch (e) {
        if (isQuotaExceeded(e)) {
          console.warn("Template cache exceeded quota, skipping local storage.");
        }
      }
      return templates;
    } catch (err) {
      if (checkSupabaseError(err)) {
        return getLocal<ChecklistTemplate>(LOCAL_STORAGE_KEYS.TEMPLATES);
      }
      console.error('Erro ao buscar templates:', err);
      return getLocal<ChecklistTemplate>(LOCAL_STORAGE_KEYS.TEMPLATES);
    }
  },

  async saveTemplate(template: ChecklistTemplate): Promise<void> {
    // Always try to save locally as a backup
    saveLocal(LOCAL_STORAGE_KEYS.TEMPLATES, template);

    if (!canUseSupabase()) {
      return;
    }
    try {
      console.log("Salvando modelo no Supabase...", template.id);
      const dbTemplate = {
        id: template.id,
        title: template.title,
        stages: template.stages,
        signature_title: template.signatureTitle,
        custom_id_placeholder: template.customIdPlaceholder,
        image_url: template.image,
        external_data: template.externalData,
        external_data_imported_at: template.externalDataImportedAt,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('templates')
        .upsert([dbTemplate]);

      if (error) {
        if (checkSupabaseError(error)) return;
        console.error('Erro Supabase ao salvar modelo:', error);
        if (error.code === '42P01') throw new Error('A tabela "templates" não existe no seu Supabase. Vá na aba Equipe e execute o script de configuração completo.');
        if (error.code === '42703') throw new Error('Colunas ausentes na tabela "templates". Execute o script SQL atualizado na aba Equipe.');
        throw error;
      }
      console.log("Modelo salvo com sucesso no Supabase.");
    } catch (err) {
      if (checkSupabaseError(err)) return;
      console.error('Erro crítico ao salvar template:', err);
      throw err;
    }
  },

  async deleteTemplate(id: string): Promise<void> {
    deleteLocal(LOCAL_STORAGE_KEYS.TEMPLATES, id);
    if (!canUseSupabase()) {
      return;
    }
    try {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) {
        if (checkSupabaseError(error)) return;
        console.error('Error deleting template:', error);
        throw error;
      }
    } catch (err) {
      if (checkSupabaseError(err)) return;
      console.error('Erro ao deletar template:', err);
      throw err;
    }
  },

  // Responses
  async getResponses(): Promise<ChecklistResponse[]> {
    if (!canUseSupabase()) {
      return getLocal<ChecklistResponse>(LOCAL_STORAGE_KEYS.RESPONSES);
    }
    try {
      const { data, error } = await supabase
        .from('responses')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        if (checkSupabaseError(error)) {
          return getLocal<ChecklistResponse>(LOCAL_STORAGE_KEYS.RESPONSES);
        }
        console.error('Error fetching responses:', error);
        return getLocal<ChecklistResponse>(LOCAL_STORAGE_KEYS.RESPONSES);
      }
      
      const responses = (data || []).map(r => ({
        id: r.id,
        templateId: r.template_id,
        customId: r.custom_id,
        status: r.status,
        currentStageId: r.current_stage_id,
        data: r.data,
        stageTimeSpent: r.stage_time_spent,
        lockedStages: r.locked_stages,
        divergences: r.divergences,
        divergenceResolved: r.divergence_resolved || false,
        externalDataRow: r.external_data_row,
        externalDataRows: r.external_data_rows || (r.external_data_row ? [r.external_data_row] : []),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        completedAt: r.completed_at,
        pdfUrl: r.pdf_url
      }));

      // Cache locally with metadata-only summaries to avoid quota issues
      try {
        const summaries = responses.map(r => {
          const { data, ...summary } = r as any;
          return summary;
        });
        localStorage.setItem(LOCAL_STORAGE_KEYS.RESPONSES, JSON.stringify(summaries));
      } catch (e) {
        if (isQuotaExceeded(e)) {
          console.warn("Response list cache exceeded quota, keeping only most recent summaries.");
          try {
            const summaries = responses.slice(0, 20).map(r => {
              const { data, ...summary } = r as any;
              return summary;
            });
            localStorage.setItem(LOCAL_STORAGE_KEYS.RESPONSES, JSON.stringify(summaries));
          } catch (e2) {
            console.error("Failed to save even pruned response summary cache.");
          }
        }
      }
      return responses;
    } catch (err) {
      if (checkSupabaseError(err)) {
        return getLocal<ChecklistResponse>(LOCAL_STORAGE_KEYS.RESPONSES);
      }
      console.error('Erro ao buscar respostas:', err);
      return getLocal<ChecklistResponse>(LOCAL_STORAGE_KEYS.RESPONSES);
    }
  },

  async getResponseById(id: string): Promise<ChecklistResponse | null> {
    if (!canUseSupabase()) {
      // Check specific detail cache first
      const detail = getResponseDetail(id);
      // Ensure it has the 'data' field, otherwise it's just a summary
      if (detail && detail.data && Object.keys(detail.data).length > 0) return detail;

      // Fallback to list (which might only have metadata now)
      const items = getLocal<ChecklistResponse>(LOCAL_STORAGE_KEYS.RESPONSES);
      const found = items.find(i => i.id === id);
      
      // If we found something but it has no data, it's a summary. 
      // We return null to avoid showing an empty checklist.
      if (found && (!found.data || Object.keys(found.data).length === 0)) {
        console.warn(`Checklist ${id} found in local list but has no data (summary only).`);
        return null;
      }
      
      return found || null;
    }
    try {
      const { data: r, error } = await supabase
        .from('responses')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !r) {
        if (checkSupabaseError(error)) throw error;
        console.error('Error fetching response:', error);
        
        // Try local detail cache if server fails
        const detail = getResponseDetail(id);
        if (detail) return detail;
        return null;
      }
      
      const response: ChecklistResponse = {
        id: r.id,
        templateId: r.template_id,
        customId: r.custom_id,
        status: r.status,
        currentStageId: r.current_stage_id,
        data: r.data || {},
        stageTimeSpent: r.stage_time_spent,
        lockedStages: r.locked_stages || [],
        divergences: r.divergences || {},
        divergenceResolved: r.divergence_resolved || false,
        externalDataRow: r.external_data_row,
        externalDataRows: r.external_data_rows || (r.external_data_row ? [r.external_data_row] : []),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        completedAt: r.completed_at,
        pdfUrl: r.pdf_url
      };

      // Cache full detail locally
      saveResponseDetail(response);

      return response;
    } catch (err) {
      console.error('Erro ao buscar resposta por ID:', err);
      // Try local detail cache as fallback
      const detail = getResponseDetail(id);
      if (detail && detail.data) return detail;
      return null;
    }
  },

  async saveResponse(response: ChecklistResponse): Promise<void> {
    // 1. Save full detail in its own key
    saveResponseDetail(response);
    
    // 2. Save summary in the main list
    saveLocal(LOCAL_STORAGE_KEYS.RESPONSES, response);

    if (!canUseSupabase()) {
      return;
    }
    try {
      console.log("Salvando resposta no Supabase...", response.id);
      const dbResponse = {
        id: response.id,
        template_id: response.templateId,
        custom_id: response.customId,
        status: response.status,
        current_stage_id: response.currentStageId,
        data: response.data,
        stage_time_spent: response.stageTimeSpent,
        locked_stages: response.lockedStages,
        divergences: response.divergences,
        divergence_resolved: response.divergenceResolved || false,
        external_data_row: response.externalDataRow,
        external_data_rows: Array.isArray(response.externalDataRows) ? response.externalDataRows : (response.externalDataRow ? [response.externalDataRow] : []),
        created_at: response.createdAt,
        updated_at: new Date().toISOString(),
        completed_at: response.completedAt,
        pdf_url: response.pdfUrl
      };

      const { error } = await supabase
        .from('responses')
        .upsert([dbResponse]);

      if (error) {
        if (checkSupabaseError(error)) return;
        console.error('Erro Supabase ao salvar resposta:', error);
        if (error.code === '42P01') throw new Error('A tabela "responses" não existe no seu Supabase. Vá na aba Equipe e execute o script de configuração completo.');
        if (error.code === '42703') throw new Error('Colunas ausentes na tabela "responses". Execute o script SQL atualizado na aba Equipe.');
        throw error;
      }
      console.log("Resposta salva com sucesso no Supabase.");
    } catch (err) {
      if (checkSupabaseError(err)) return;
      console.error('Erro crítico ao salvar resposta:', err);
      throw err;
    }
  },

  async deleteResponse(id: string): Promise<void> {
    deleteLocal(LOCAL_STORAGE_KEYS.RESPONSES, id);
    if (!canUseSupabase()) {
      return;
    }
    try {
      const { error } = await supabase
        .from('responses')
        .delete()
        .eq('id', id);

      if (error) {
        if (checkSupabaseError(error)) return;
        console.error('Error deleting response:', error);
        throw error;
      }
    } catch (err) {
      if (checkSupabaseError(err)) return;
      console.error('Erro ao deletar resposta:', err);
      throw err;
    }
  },

  // Users Management
  async getUsers(): Promise<User[]> {
    if (!canUseSupabase()) {
      return getLocal<User>(LOCAL_STORAGE_KEYS.USERS);
    }
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
        allowedScreens: u.allowed_screens,
        accessCode: u.access_code
      }));
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      throw err;
    }
  },

  async saveUser(user: User): Promise<void> {
    const generateId = () => {
      try {
        return crypto.randomUUID();
      } catch (e) {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
      }
    };

    const userId = user.id && user.id !== '' ? user.id : generateId();
    const cleanUser = { ...user, id: userId };

    saveLocal(LOCAL_STORAGE_KEYS.USERS, cleanUser);

    if (!isSupabaseConfigured) {
      console.warn('Supabase não configurado, usuário salvo apenas localmente.');
      return;
    }
    try {
      const dbUser = {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        allowed_screens: user.allowedScreens,
        access_code: user.accessCode,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('users')
        .upsert([dbUser]);

      if (error) {
        console.error('Erro ao salvar usuário no Supabase:', error);
        if (error.code === '42P01') throw new Error('A tabela "users" não existe no seu Supabase. Crie-a no SQL Editor.');
        throw new Error(`Erro ao salvar no banco (${error.code}): ${error.message}`);
      }
    } catch (err) {
      console.error('Erro fatal ao salvar usuário:', err);
      throw err;
    }
  },

  async deleteUser(id: string): Promise<void> {
    if (!canUseSupabase()) {
      deleteLocal(LOCAL_STORAGE_KEYS.USERS, id);
      return;
    }
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
