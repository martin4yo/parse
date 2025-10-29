import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

interface ApiConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

export function useApiClient() {
  const { token, logout } = useAuth();

  const apiCall = useCallback(
    async (url: string, config: ApiConfig = {}) => {
      const { method = 'GET', headers = {}, body } = config;

      // Construir URL completa
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

      // Agregar token de autenticación si existe
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      if (token) {
        authHeaders.Authorization = `Bearer ${token}`;
      }

      // Construir configuración de fetch
      const fetchConfig: RequestInit = {
        method,
        headers: authHeaders,
      };

      if (body && method !== 'GET') {
        fetchConfig.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(fullUrl, fetchConfig);

        // Si el token ha expirado, hacer logout automático
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.code === 'TOKEN_EXPIRED' || errorData.error?.includes('Token')) {
            logout();
            throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
          }
        }

        // Si la respuesta no es exitosa, lanzar error
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `HTTP Error ${response.status}`,
          }));
          throw new Error(errorData.error || `Error ${response.status}`);
        }

        // Intentar parsear como JSON, si falla devolver texto
        try {
          return await response.json();
        } catch {
          return await response.text();
        }
      } catch (error) {
        console.error('API call error:', error);
        throw error;
      }
    },
    [token, logout]
  );

  // Métodos de conveniencia
  const get = useCallback(
    (url: string, headers?: Record<string, string>) =>
      apiCall(url, { method: 'GET', headers }),
    [apiCall]
  );

  const post = useCallback(
    (url: string, body?: any, headers?: Record<string, string>) =>
      apiCall(url, { method: 'POST', body, headers }),
    [apiCall]
  );

  const put = useCallback(
    (url: string, body?: any, headers?: Record<string, string>) =>
      apiCall(url, { method: 'PUT', body, headers }),
    [apiCall]
  );

  const patch = useCallback(
    (url: string, body?: any, headers?: Record<string, string>) =>
      apiCall(url, { method: 'PATCH', body, headers }),
    [apiCall]
  );

  const del = useCallback(
    (url: string, headers?: Record<string, string>) =>
      apiCall(url, { method: 'DELETE', headers }),
    [apiCall]
  );

  return {
    apiCall,
    get,
    post,
    put,
    patch,
    delete: del,
  };
}