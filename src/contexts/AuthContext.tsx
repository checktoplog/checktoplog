
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { User as AppUser } from '../types';
import { supabaseService } from '../services/supabaseService';

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (sessionUser: SupabaseUser) => {
    try {
      const appUser = await supabaseService.syncUser(sessionUser);
      setUser(appUser);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Fallback to minimal user if sync fails but session exists
      setUser({
        id: sessionUser.id,
        email: sessionUser.email || '',
        name: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'User',
        role: 'USER',
        allowedScreens: ['dashboard', 'checklists']
      });
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('checklist_user');
    setSession(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (session?.user) {
      await fetchUserProfile(session.user);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
