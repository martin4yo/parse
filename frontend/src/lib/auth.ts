import { useState, useEffect } from 'react';
import { User } from './api';
import Cookies from 'js-cookie';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const authUtils = {
  setToken: (token: string) => {
    Cookies.set(TOKEN_KEY, token, { 
      expires: 7, // 7 días
      secure: false, // Deshabilitado para permitir HTTP
      sameSite: 'lax'
    });
  },

  getToken: (): string | null => {
    return Cookies.get(TOKEN_KEY) || null;
  },

  removeToken: () => {
    Cookies.remove(TOKEN_KEY);
  },

  setUser: (user: User) => {
    Cookies.set(USER_KEY, JSON.stringify(user), {
      expires: 7,
      secure: false, // Deshabilitado para permitir HTTP
      sameSite: 'lax'
    });
  },

  getUser: (): User | null => {
    const userCookie = Cookies.get(USER_KEY);
    if (userCookie) {
      try {
        return JSON.parse(userCookie);
      } catch (error) {
        console.error('Error parsing user cookie:', error);
        return null;
      }
    }
    return null;
  },

  removeUser: () => {
    Cookies.remove(USER_KEY);
  },

  logout: () => {
    authUtils.removeToken();
    authUtils.removeUser();
  },

  isAuthenticated: (): boolean => {
    return !!authUtils.getToken();
  },

  login: (token: string, user: User) => {
    authUtils.setToken(token);
    authUtils.setUser(user);
  }
};

// Hook personalizado para usar en componentes
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Solo acceder a cookies en el cliente
    const token = authUtils.getToken();
    const userData = authUtils.getUser();
    
    setIsAuthenticated(!!token);
    setUser(userData);
    setIsLoading(false);
  }, []);

  const login = (token: string, userData: User) => {
    authUtils.login(token, userData);
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = () => {
    authUtils.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  return {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout
  };
};