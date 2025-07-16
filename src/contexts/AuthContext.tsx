
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'recruiter' | 'admin' | 'candidate';
  has_accepted_terms?: boolean;
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
      console.log('Fetching profile for user ID:', userId);
      
      // First, try to get the profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Profile data:', profileData);
      console.log('Profile error:', profileError);

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw profileError;
      }

      // Then get the role name
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profileData.role_id)
        .single();

      console.log('Role data:', roleData);
      console.log('Role error:', roleError);
      
      // Transform the data to include role name
      const profile = {
        ...profileData,
        role: (roleData?.name || 'recruiter') as 'recruiter' | 'admin' | 'candidate'
      };
      
      console.log('Final transformed profile:', profile);
      return profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  useEffect(() => {
    console.log('AuthProvider useEffect mounting...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', !!session);
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id).then((profile) => {
          console.log('Initial profile fetch completed:', !!profile);
          setUser(profile);
          setIsLoading(false);
        }).catch((error) => {
          console.error('Initial profile fetch failed:', error);
          setIsLoading(false);
        });
      } else {
        console.log('No initial session, setting loading to false');
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, !!session);
      setSession(session);
      if (session?.user) {
        try {
          const profile = await fetchProfile(session.user.id);
          console.log('Auth change profile fetch completed:', !!profile);
          setUser(profile);
        } catch (error) {
          console.error('Auth change profile fetch failed:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      console.log('Setting isLoading to false after auth state change');
      setIsLoading(false);
    });

    return () => {
      console.log('AuthProvider cleanup');
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

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
        description: error.message || "Login failed",
        variant: "destructive",
      });
      return false;
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string): Promise<boolean> => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    setIsLoading(true);
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
        setIsLoading(false);
        return false;
      }

      // Don't set loading to false here - the redirect will handle it
      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return false;
    }
  };

  const signInWithMicrosoft = async (): Promise<boolean> => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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
          .from('profiles')
          .update({ has_accepted_terms: true, updated_at: new Date().toISOString() })
          .eq('id', user.id);

        if (error) throw error;

        // Update local state
        const updatedUser = { ...user, has_accepted_terms: true, updated_at: new Date().toISOString() };
        setUser(updatedUser);
      } catch (error) {
        console.error('Error accepting terms:', error);
      }
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
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};
