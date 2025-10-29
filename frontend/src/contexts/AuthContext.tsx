'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchWithRetry, handleRateLimitedResponse } from '../utils/api';

export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  superuser?: boolean;
  esUsuarioTesoreria?: boolean;
  profile?: {
    id: string;
    codigo: string;
    descripcion: string;
  };
}

export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  configuracion?: any;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchTenant: (tenantId: string) => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperuser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;
  const isSuperuser = !!user?.superuser;

  useEffect(() => {
    // Verificar si hay un token guardado al cargar la aplicación
    console.log('🚀 [AuthContext] Inicializando contexto...');

    // Solo acceder a localStorage en el cliente
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('token');
      console.log('🚀 [AuthContext] Token guardado encontrado:', savedToken ? 'SÍ' : 'NO');

      if (savedToken) {
        console.log('🚀 [AuthContext] Verificando token guardado...');
        verifyToken(savedToken);
      } else {
        console.log('🚀 [AuthContext] No hay token, marcando como no cargando');
        setIsLoading(false);
      }
    } else {
      // En el servidor, simplemente marcar como no cargando
      console.log('🚀 [AuthContext] Ejecutándose en servidor, marcando como no cargando');
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      console.log('🔍 [AuthContext] Verificando token:', tokenToVerify?.substring(0, 20) + '...');
      console.log('🔍 [AuthContext] API URL:', process.env.NEXT_PUBLIC_API_URL);

      const response = await fetchWithRetry(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenToVerify }),
      }, {
        maxRetries: 2,
        baseDelay: 1000
      });

      console.log('🔍 [AuthContext] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [AuthContext] Token válido, datos recibidos:', {
          user: data.user?.nombre + ' ' + data.user?.apellido,
          tenant: data.tenant?.nombre,
          userObject: data.user
        });
        console.log('🔍 [AuthContext] User details:', {
          superuser: data.user?.superuser,
          profile: data.user?.profile,
          profileCodigo: data.user?.profile?.codigo
        });

        setUser(data.user);
        setTenant(data.tenant);
        setToken(tokenToVerify);
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', tokenToVerify);
        }

        // Si es superuser y no tiene tenant, disparar auto-selección
        if (data.user?.superuser && !data.tenant) {
          console.log('🏢 [AuthContext] Superuser sin tenant detectado, se auto-seleccionará en TenantSelector');
        }
      } else {
        console.error('❌ [AuthContext] Token inválido, status:', response.status);

        // Intentar obtener el mensaje de error de forma segura
        try {
          const errorData = await handleRateLimitedResponse(response);
          console.error('❌ [AuthContext] Error data:', errorData);
        } catch (rateLimitError) {
          console.error('❌ [AuthContext] Rate limit o error de parsing:', rateLimitError instanceof Error ? rateLimitError.message : rateLimitError);
        }

        // Token inválido o expirado
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
        setUser(null);
        setTenant(null);
        setToken(null);
      }
    } catch (error) {
      console.error('💥 [AuthContext] Error verificando token:', error);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
      setUser(null);
      setTenant(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('🔑 [AuthContext] Iniciando login para:', email);

      const response = await fetchWithRetry(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      }, {
        maxRetries: 2,
        baseDelay: 2000
      });

      console.log('🔑 [AuthContext] Login response status:', response.status);

      const data = await handleRateLimitedResponse(response);
      console.log('✅ [AuthContext] Login exitoso, datos recibidos:', {
        user: data.user?.nombre + ' ' + data.user?.apellido,
        tenant: data.tenant?.nombre,
        hasToken: !!data.token
      });

      setUser(data.user);
      setTenant(data.tenant);
      setToken(data.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
      }

      // Si es superuser y no tiene tenant, disparar auto-selección
      if (data.user?.superuser && !data.tenant) {
        console.log('🏢 [AuthContext] Superuser sin tenant detectado en login, se auto-seleccionará en TenantSelector');
      }

      console.log('💾 [AuthContext] Estado guardado en localStorage y contexto');
    } catch (error) {
      console.error('💥 [AuthContext] Error en login:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const switchTenant = async (tenantId: string) => {
    if (!isSuperuser) {
      throw new Error('Solo los superusuarios pueden cambiar de tenant');
    }

    setIsLoading(true);
    try {
      console.log('🔄 [AuthContext] Cambiando a tenant:', tenantId);

      const response = await fetchWithRetry(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/switch-tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tenantId }),
      }, {
        maxRetries: 2,
        baseDelay: 1000
      });

      const data = await handleRateLimitedResponse(response);
      console.log('✅ [AuthContext] Tenant cambiado exitosamente:', data.tenant?.nombre);

      setTenant(data.tenant);
      // Actualizar token con el nuevo que incluye tenantId
      setToken(data.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
      }
    } catch (error) {
      console.error('💥 [AuthContext] Error en switchTenant:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        login,
        logout,
        switchTenant,
        isLoading,
        isAuthenticated,
        isSuperuser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}