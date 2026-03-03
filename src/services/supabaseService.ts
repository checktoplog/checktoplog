import { supabase } from '../supabaseClient';
import { User, ChecklistTemplate, ChecklistResponse } from '../types';

export const supabaseService = {
  // Auth
  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  },

  async syncUser(sessionUser: any): Promise<User | null> {
    if (!sessionUser) return null;

    const email = sessionUser.email;
    if (!email) return null;

    // Check if user exists in a 'users' table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      const newUser: User = {
        id: sessionUser.id,
        email,
        name: sessionUser.user_metadata?.full_name || email.split('@')[0],
        role: 'ADMIN' as const,
        allowedScreens: ['dashboard', 'templates', 'checklists', 'reports', 'users'],
      };
      
      const { data: created, error: createError } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();
        
      if (createError) {
        console.error('Error creating user:', createError);
        return null;
      }
      
      localStorage.setItem('checklist_user', JSON.stringify(created));
      return created;
    }

    localStorage.setItem('checklist_user', JSON.stringify(data));
    return data;
  },

  async login(email: string): Promise<User | null> {
    // For this app, we're doing a simple "email-based" login simulation or real Supabase Auth
    // The previous implementation was just saving the user object.
    // Let's stick to the user's flow: they provide an email.
    
    // Check if user exists in a 'users' table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      // Create user if not exists? Or just return null if not found.
      // Let's create it for convenience in this demo/app
      const newUser: User = {
        id: crypto.randomUUID(),
        email,
        name: email.split('@')[0],
        role: 'ADMIN' as const,
        allowedScreens: ['dashboard', 'templates', 'checklists', 'reports', 'users'],
      };
      
      const { data: created, error: createError } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();
        
      if (createError) {
        console.error('Error creating user:', createError);
        return null;
      }
      
      localStorage.setItem('checklist_user', JSON.stringify(created));
      return created;
    }

    localStorage.setItem('checklist_user', JSON.stringify(data));
    return data;
  },

  async logout() {
    await supabase.auth.signOut();
    localStorage.removeItem('checklist_user');
  },

  async getUser(): Promise<User | null> {
    const stored = localStorage.getItem('checklist_user');
    return stored ? JSON.parse(stored) : null;
  },

  // Templates
  async getTemplates(): Promise<ChecklistTemplate[]> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
    return data || [];
  },

  async saveTemplate(template: ChecklistTemplate): Promise<void> {
    const { error } = await supabase
      .from('templates')
      .upsert([template]);

    if (error) {
      console.error('Error saving template:', error);
      throw error;
    }
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  },

  // Responses
  async getResponses(): Promise<ChecklistResponse[]> {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .order('updatedAt', { ascending: false });

    if (error) {
      console.error('Error fetching responses:', error);
      return [];
    }
    return data || [];
  },

  async getResponseById(id: string): Promise<ChecklistResponse | null> {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching response:', error);
      return null;
    }
    return data;
  },

  async saveResponse(response: ChecklistResponse): Promise<void> {
    const { error } = await supabase
      .from('responses')
      .upsert([response]);

    if (error) {
      console.error('Error saving response:', error);
      throw error;
    }
  },

  async deleteResponse(id: string): Promise<void> {
    const { error } = await supabase
      .from('responses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting response:', error);
      throw error;
    }
  },

  // Users Management
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }
    return data || [];
  },

  async saveUser(user: User): Promise<void> {
    const { error } = await supabase
      .from('users')
      .upsert([user]);

    if (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  },

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
};
