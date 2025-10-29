import { authUtils } from './auth';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050') + '/api';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Configurar headers por defecto
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Agregar token de autenticación si existe
    const token = authUtils.getToken();
    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    // Combinar headers
    const headers = {
      ...defaultHeaders,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Si no está autenticado, redirect a login
      if (response.status === 401) {
        authUtils.logout();
        window.location.href = '/auth/login';
        throw new Error('No autorizado');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // Si la respuesta está vacía, retornar objeto vacío
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      try {
        return JSON.parse(text) as T;
      } catch (error) {
        return text as unknown as T;
      }
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Métodos HTTP
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Instancia singleton del cliente API
export const apiClient = new ApiClient();

// Helper functions para endpoints específicos
export const api = {
  // Parámetros - Relaciones
  parametros: {
    relaciones: {
      getAll: () => apiClient.get('/parametros/relaciones'),
      create: (data: any) => apiClient.post('/parametros/relaciones', data),
      update: (id: number, data: any) => apiClient.put(`/parametros/relaciones/${id}`, data),
      delete: (id: number) => apiClient.delete(`/parametros/relaciones/${id}`),
    },
    maestros: {
      getAll: (params?: URLSearchParams) => {
        const endpoint = params ? `/parametros/maestros?${params}` : '/parametros/maestros';
        return apiClient.get(endpoint);
      },
      create: (data: any) => apiClient.post('/parametros/maestros', data),
      update: (id: number, data: any) => apiClient.put(`/parametros/maestros/${id}`, data),
      delete: (id: number) => apiClient.delete(`/parametros/maestros/${id}`),
      getTiposCampo: () => apiClient.get('/parametros/maestros/tipos-campo'),
      getValoresPadre: (tipoCampo?: string) => {
        const params = tipoCampo ? `?tipo_campo=${tipoCampo}` : '';
        return apiClient.get(`/parametros/maestros/valores-padre${params}`);
      },
      getJerarquia: (tipoCampo: string, valorPadre?: string) => {
        const params = valorPadre ? `?valor_padre=${valorPadre}` : '';
        return apiClient.get(`/parametros/maestros/jerarquia/${tipoCampo}${params}`);
      }
    }
  },

  // Auth
  auth: {
    login: (email: string, password: string) => apiClient.post('/auth/login', { email, password }),
    register: (data: any) => apiClient.post('/auth/register', data),
    me: () => apiClient.get('/auth/me'),
  },

  // Tarjetas
  tarjetas: {
    getAll: () => apiClient.get('/tarjetas'),
    create: (data: any) => apiClient.post('/tarjetas', data),
    update: (id: string, data: any) => apiClient.put(`/tarjetas/${id}`, data),
    delete: (id: string) => apiClient.delete(`/tarjetas/${id}`),
  },

  // DKT
  dkt: {
    upload: (formData: FormData) => {
      // Para uploads, no usar JSON headers
      const token = authUtils.getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      return fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/api/dkt/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
    },
  }
};

export default apiClient;