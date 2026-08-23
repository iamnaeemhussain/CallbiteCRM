import React, { createContext, useContext, useState, useEffect } from 'react';
import { StaffUser } from '../types';
import { api, TOKEN_KEY, USER_KEY } from '../utils/api';

const DEFAULT_ADMIN_USER: StaffUser = {
  id: 'STF-001',
  name: 'System Admin',
  email: 'Admin@callbite.com',
  role: 'ADMIN',
  phone: '+923000000001',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-08-23T00:00:00Z',
};

interface AuthContextType {
  user: StaffUser;
  isLoading: boolean;
  login: (token: string, user: StaffUser) => void;
  logout: () => Promise<void>;
  updateUser: (user: StaffUser) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StaffUser>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(USER_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return DEFAULT_ADMIN_USER;
        }
      }
    }
    return DEFAULT_ADMIN_USER;
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function checkMe() {
      try {
        const res = await api.get('/api/auth/me');
        if (res && res.success && res.user) {
          setUser(res.user);
          if (typeof window !== 'undefined') {
            localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          }
        }
      } catch (err) {
        // Keep active default user
      }
    }

    checkMe();
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
      setUser(DEFAULT_ADMIN_USER);
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
