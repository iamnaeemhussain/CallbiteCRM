import React, { createContext, useContext, useState, useEffect } from 'react';
import { StaffUser } from '../types';
import { api, TOKEN_KEY, USER_KEY } from '../utils/api';

interface AuthContextType {
  user: StaffUser | null;
  isLoading: boolean;
  login: (token: string, user: StaffUser) => void;
  logout: () => Promise<void>;
  updateUser: (user: StaffUser) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StaffUser | null>(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      return Boolean(savedToken);
    }
    return false;
  });

  useEffect(() => {
    let isCancelled = false;

    async function checkSession() {
      const token = api.getToken();
      if (!token) {
        if (!isCancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await api.get('/api/auth/me');
        if (isCancelled) return;

        if (res && res.success && res.user) {
          setUser(res.user);
          if (typeof window !== 'undefined') {
            localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          }
        } else {
          api.setToken(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(TOKEN_KEY);
          }
          setUser(null);
        }
      } catch (err) {
        if (isCancelled) return;
        console.warn('Session verification notice:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const login = (token: string, newUser: StaffUser) => {
    api.setToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      localStorage.setItem(TOKEN_KEY, token);
    }
    setUser(newUser);
    setIsLoading(false);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore
    } finally {
      api.setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
      setUser(null);
      setIsLoading(false);
      window.location.href = '/login';
    }
  };

  const updateUser = (updated: StaffUser) => {
    setUser(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
