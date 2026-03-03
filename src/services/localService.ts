
import { User, ChecklistTemplate, ChecklistResponse } from '../types.ts';

const STORAGE_KEYS = {
  TEMPLATES: 'checklist_templates',
  RESPONSES: 'checklist_responses',
  USER: 'checklist_user'
};

export const localService = {
  // Auth
  async getUser(): Promise<User | null> {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  async login(email: string): Promise<User> {
    const user: User = {
      id: 'user_1',
      name: email.split('@')[0],
      email: email,
      role: 'ADMIN',
      allowedScreens: ['dashboard', 'templates', 'checklists', 'reports', 'users']
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  },

  async logout(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  // Templates
  async getTemplates(): Promise<ChecklistTemplate[]> {
    const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    return data ? JSON.parse(data) : [];
  },

  async saveTemplate(template: ChecklistTemplate): Promise<void> {
    const templates = await this.getTemplates();
    const index = templates.findIndex(t => t.id === template.id);
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  },

  async deleteTemplate(id: string): Promise<void> {
    const templates = await this.getTemplates();
    const filtered = templates.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(filtered));
  },

  // Responses
  async getResponses(): Promise<ChecklistResponse[]> {
    const data = localStorage.getItem(STORAGE_KEYS.RESPONSES);
    return data ? JSON.parse(data) : [];
  },

  async saveResponse(response: ChecklistResponse): Promise<void> {
    const responses = await this.getResponses();
    const index = responses.findIndex(r => r.id === response.id);
    if (index >= 0) {
      responses[index] = response;
    } else {
      responses.push(response);
    }
    localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(responses));
  },

  async deleteResponse(id: string): Promise<void> {
    const responses = await this.getResponses();
    const filtered = responses.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(filtered));
  },

  // Users
  async getUsers(): Promise<User[]> {
    const data = localStorage.getItem('checklist_users');
    return data ? JSON.parse(data) : [];
  },

  async saveUser(user: User): Promise<void> {
    const users = await this.getUsers();
    const index = users.findIndex(u => u.id === user.id || u.email === user.email);
    if (index >= 0) {
      users[index] = { ...users[index], ...user };
    } else {
      if (!user.id) user.id = `user_${Math.random().toString(36).substr(2, 9)}`;
      users.push(user);
    }
    localStorage.setItem('checklist_users', JSON.stringify(users));
  },

  async deleteUser(id: string): Promise<void> {
    const users = await this.getUsers();
    const filtered = users.filter(u => u.id !== id);
    localStorage.setItem('checklist_users', JSON.stringify(filtered));
  }
};
