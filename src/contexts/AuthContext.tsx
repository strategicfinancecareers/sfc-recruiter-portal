
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'recruiter' | 'admin' | 'owner' | 'candidate';
  has_accepted_terms?: boolean;
  notify_intro_requests?: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: Profile | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signInWithMicrosoft: () => Promise<boolean>;
  logout: () => void;
  acceptTerms: () => void;
  setAdminNotifications: (value: boolean) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          roles (
            name
          )
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        if (data.is_active === false) {
          await supabase.auth.signOut();
          toast({
            title: "Account Deactivated",
            description: "Your account has been deactivated. Please contact an administrator.",
            variant: "destructive",
          });
          return null;
        }
        
        const role = data.roles?.name as 'recruiter' | 'admin' | 'owner' | 'candidate' || 'recruiter';
        return { ...data, role };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange is the single source of truth for auth state.
    // It fires on every session change AND on initial load, so we always
    // call setIsLoading(false) after it resolves.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      setSession(session);

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (mounted) setUser(profile);
      } else {
        if (mounted) setUser(null);
      }

      if (mounted) setIsLoading(false);
    });

    // Fallback: if there's no session at all, onAuthStateChange may not fire
    // quickly enough. getSession ensures we don't hang on the loading state.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        toast({
          title: "Signup failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          title: "Google sign-in failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const signInWithMicrosoft = async (): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          title: "Microsoft sign-in failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const acceptTerms = async () => {
    if (user) {
      try {
        const { error } = await (supabase as any)
          .from('users')
          .update({ has_accepted_terms: true, updated_at: new Date().toISOString() })
          .eq('id', user.id);

        if (error) throw error;

        setUser({ ...user, has_accepted_terms: true, updated_at: new Date().toISOString() });
      } catch (error) {
        console.error('Error accepting terms:', error);
      }
    }
  };

  const setAdminNotifications = async (enabled: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ notify_intro_requests: enabled, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;

      setUser(prev => prev ? { ...prev, notify_intro_requests: enabled, updated_at: new Date().toISOString() } : prev);
      toast({
        title: 'Preferences updated',
        description: `Admin email notifications ${enabled ? 'enabled' : 'disabled'}.`
      });
    } catch (error: any) {
      console.error('Error updating notification preference:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'Could not update preference',
        variant: 'destructive'
      });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      login,
      signup,
      signInWithGoogle,
      signInWithMicrosoft,
      logout,
      acceptTerms,
      setAdminNotifications,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};
