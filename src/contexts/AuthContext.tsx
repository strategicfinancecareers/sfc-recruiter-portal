
import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'recruiter' | 'admin';
  hasAcceptedTerms?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Mock login - in real app, this would call your authentication API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock users for demo
      const mockUsers = [
        { id: '1', email: 'recruiter@example.com', name: 'John Recruiter', role: 'recruiter' as const, hasAcceptedTerms: false },
        { id: '2', email: 'admin@example.com', name: 'Admin User', role: 'admin' as const, hasAcceptedTerms: true },
      ];
      
      const foundUser = mockUsers.find(u => u.email === email);
      if (foundUser && password === 'password') {
        setUser(foundUser);
        localStorage.setItem('user', JSON.stringify(foundUser));
        return true;
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newUser = {
        id: Date.now().toString(),
        email,
        name,
        role: 'recruiter' as const,
        hasAcceptedTerms: false
      };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const acceptTerms = () => {
    if (user) {
      const updatedUser = { ...user, hasAcceptedTerms: true };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      signup,
      logout,
      acceptTerms,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};
