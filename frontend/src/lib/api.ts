import axios from 'axios';
import Cookies from 'js-cookie';

// Usar directamente la URL del backend tanto en cliente como servidor
const getBaseURL = () => {
  return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100'}/api`;
};

// Crear instancia de axios
export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use(
  (config) => {
    // Usar localStorage en lugar de cookies
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Si el token ha expirado, redirigir al login
    if (error.response?.status === 401) {
      // Limpiar localStorage en lugar de cookies
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');

        // Solo redirigir si no estamos ya en login
        if (!window.location.pathname.includes('/auth')) {
          window.location.href = '/auth/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Tipos para las respuestas de la API
export interface ApiResponse<T = any> {
  message?: string;
  error?: string;
  errors?: Array<{ msg: string; field?: string }>;
  data?: T;
}

export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  configuracion?: any;
}

export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  profileId?: string;
  profile?: Profile;
  autorizantes?: UsuarioAutorizante[];
  recibeNotificacionesEmail?: boolean;
  esUsuarioTesoreria?: boolean;
  emailVerified?: boolean;
  tenantId?: string;
  tenant?: Tenant;
  createdAt: string;
  updatedAt: string;
  delegaciones?: { id: string }[];
}

export interface Profile {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
}

export interface Tarjeta {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  tiposTarjeta?: TipoTarjeta[];
}

export interface TipoTarjeta {
  id: string;
  codigo: string;
  descripcion: string;
  tarjetaId: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  tarjeta?: Tarjeta;
  bancosTipoTarjeta?: BancoTipoTarjeta[];
}

export interface Banco {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  bancosTipoTarjeta?: BancoTipoTarjeta[];
}

export interface BancoTipoTarjeta {
  id: string;
  bancoId: string;
  tipoTarjetaId: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  banco?: Banco;
  tipoTarjeta?: TipoTarjeta;
}

export interface BancoTipoTarjetaForImport {
  id: string;
  value: string;
  label: string;
  banco: {
    codigo: string;
    descripcion: string;
  };
  tipoTarjeta: TipoTarjeta & {
    tarjeta: {
      codigo: string;
      descripcion: string;
    };
  };
}

export interface ResumenTarjeta {
  id: string;
  loteId: string;
  codigoTarjeta: string;
  periodo: string;
  estado: string;
  fechaImportacion: string;
  usuarioImportacion?: string;
  totalRegistros?: number;
  tarjeta?: Tarjeta;
  _count?: {
    rendiciones: number;
  };
}

export interface ProcessingJob {
  id: string;
  type: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  totalItems?: number;
  processedItems?: number;
  message?: string;
  userId: string;
  parameters: any;
  result?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  loteDeleted?: boolean; // Indica si el lote fue eliminado de la BD
}

export interface ParametroMaestro {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  orden: number;
}

export interface Atributo {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  valores?: ValorAtributo[];
}

export interface ValorAtributo {
  id: string;
  codigo: string;
  descripcion: string;
  atributoId: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  atributo?: Atributo;
}

export interface UserAtributo {
  id: string;
  userId: string;
  valorAtributoId: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  valores_atributo?: {
    id: string;
    codigo: string;
    descripcion: string;
    atributoId: string;
    activo: boolean;
    createdAt: string;
    updatedAt: string;
    atributos?: {
      id: string;
      codigo: string;
      descripcion: string;
    };
  };
}

export interface UsuarioAutorizante {
  id: string;
  usuarioId: string;
  autorizanteId: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  autorizante: User;
}

export interface UserTarjetaCredito {
  id: string;
  userId: string;
  numeroTarjeta: string;
  marcaTarjeta: string;
  codigoExterno?: string;
  autorizanteId?: string;
  autorizante?: User;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CardValidationResult {
  marcaTarjeta: string;
  isValid: boolean;
  numeroLimpio: string;
}

export interface Moneda {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Caja {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  fondoFijo: boolean;
  monedaId: string;
  tenantId?: string;
  activo: boolean;
  color?: string;
  limite?: number;
  createdAt: string;
  updatedAt: string;
  moneda?: Moneda;
}

export interface Delegacion {
  id: string;
  usuarioId: string;
  tarjetaCreditoId: string;
  activo: boolean;
  tarjetaCredito: {
    id: string;
    numeroTarjeta: string;
    marcaTarjeta: string;
    user: {
      id: string;
      nombre: string;
      apellido: string;
      email: string;
    };
  };
}

// Funciones de autenticación
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (userData: {
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    profileId?: string;
  }) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  verifyEmail: async (token: string) => {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  },

  resendVerification: async (email: string) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  getProfiles: async () => {
    const response = await api.get('/auth/profiles');
    return response.data;
  },

  getAvailableTenants: async () => {
    const response = await api.get('/auth/available-tenants');
    return response.data;
  },

  assignTenant: async (userId: string, tenantId: string) => {
    const response = await api.post('/auth/assign-tenant', { userId, tenantId });
    return response.data;
  }
};

// Funciones de tarjetas
export const tarjetasApi = {
  getAll: async (): Promise<{ tarjetas: Tarjeta[] }> => {
    const response = await api.get('/tarjetas');
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/tarjetas/${id}`);
    return response.data;
  },
  
  create: async (tarjetaData: { codigo: string; descripcion: string }) => {
    const response = await api.post('/tarjetas', tarjetaData);
    return response.data;
  },
  
  update: async (id: string, tarjetaData: Partial<{ codigo: string; descripcion: string; activo: boolean }>) => {
    const response = await api.put(`/tarjetas/${id}`, tarjetaData);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/tarjetas/${id}`);
    return response.data;
  }
};

// Funciones de tipos de tarjeta
export const tiposTarjetaApi = {
  getAll: async (tarjetaId?: string): Promise<{ tiposTarjeta: TipoTarjeta[] }> => {
    const url = tarjetaId ? `/tipos-tarjeta?tarjetaId=${tarjetaId}` : '/tipos-tarjeta';
    const response = await api.get(url);
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/tipos-tarjeta/${id}`);
    return response.data;
  },
  
  create: async (tipoData: { codigo: string; descripcion: string; tarjetaId: string }) => {
    const response = await api.post('/tipos-tarjeta', tipoData);
    return response.data;
  },
  
  update: async (id: string, tipoData: Partial<{ codigo: string; descripcion: string; activo: boolean }>) => {
    const response = await api.put(`/tipos-tarjeta/${id}`, tipoData);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/tipos-tarjeta/${id}`);
    return response.data;
  }
};

// Funciones de bancos
export const bancosApi = {
  getAll: async (): Promise<{ bancos: Banco[] }> => {
    const response = await api.get('/bancos');
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/bancos/${id}`);
    return response.data;
  },
  
  create: async (bancoData: { codigo: string; descripcion: string }) => {
    const response = await api.post('/bancos', bancoData);
    return response.data;
  },
  
  update: async (id: string, bancoData: Partial<{ codigo: string; descripcion: string; activo: boolean }>) => {
    const response = await api.put(`/bancos/${id}`, bancoData);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/bancos/${id}`);
    return response.data;
  }
};

// Funciones de banco-tipo-tarjeta (asociaciones)
export const bancoTipoTarjetaApi = {
  getAll: async (bancoId?: string, tipoTarjetaId?: string): Promise<{ asociaciones: BancoTipoTarjeta[] }> => {
    const params = new URLSearchParams();
    if (bancoId) params.append('bancoId', bancoId);
    if (tipoTarjetaId) params.append('tipoTarjetaId', tipoTarjetaId);
    
    const url = params.toString() ? `/banco-tipo-tarjeta?${params.toString()}` : '/banco-tipo-tarjeta';
    const response = await api.get(url);
    return response.data;
  },
  
  getForImport: async (): Promise<{ asociaciones: BancoTipoTarjetaForImport[] }> => {
    const response = await api.get('/banco-tipo-tarjeta/for-import');
    return response.data;
  },
  
  getTiposDisponibles: async (bancoId: string): Promise<{ tiposDisponibles: TipoTarjeta[] }> => {
    const response = await api.get(`/banco-tipo-tarjeta/banco/${bancoId}/tipos-disponibles`);
    return response.data;
  },
  
  create: async (asociacionData: { bancoId: string; tipoTarjetaId: string }) => {
    const response = await api.post('/banco-tipo-tarjeta', asociacionData);
    return response.data;
  },
  
  createMultiple: async (bancoId: string, tipoTarjetaIds: string[]) => {
    const response = await api.post(`/banco-tipo-tarjeta/banco/${bancoId}/tipos`, { tipoTarjetaIds });
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/banco-tipo-tarjeta/${id}`);
    return response.data;
  }
};

// Funciones de DKT
export const dktApi = {
  importar: async (file: File, bancoTipoTarjetaId: string) => {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('bancoTipoTarjetaId', bancoTipoTarjetaId);
    
    const response = await api.post('/dkt/importar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  importarAsync: async (file: File, bancoTipoTarjetaId: string) => {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('bancoTipoTarjetaId', bancoTipoTarjetaId);

    const response = await api.post('/dkt/importar-async', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  importarPDF: async (file: File, bancoTipoTarjetaId: string) => {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('bancoTipoTarjetaId', bancoTipoTarjetaId);

    const response = await api.post('/dkt/importar-pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 60 segundos para PDFs que pueden tardar más en procesarse
    });
    return response.data;
  },


  getPorBancoTipoTarjeta: async (bancoTipoTarjetaId: string, page: number = 1, limit: number = 10) => {
    const response = await api.get(`/dkt/por-banco-tipo-tarjeta/${bancoTipoTarjetaId}?page=${page}&limit=${limit}`);
    return response.data;
  },
  
  getPorTarjeta: async (codigoTarjeta: string, page: number = 1, limit: number = 10) => {
    const response = await api.get(`/dkt/por-tarjeta/${codigoTarjeta}?page=${page}&limit=${limit}`);
    return response.data;
  },
  
  getLoteDetail: async (loteId: string, page: number = 1, limit: number = 20) => {
    const response = await api.get(`/dkt/lote/${loteId}?page=${page}&limit=${limit}`);
    return response.data;
  },
  
  deleteLote: async (loteId: string) => {
    const response = await api.delete(`/dkt/lote/${loteId}`);
    return response.data;
  },

  checkCanDeleteLote: async (loteId: string): Promise<{ canDelete: boolean; reason?: string }> => {
    const response = await api.get(`/dkt/can-delete-lote/${loteId}`);
    return response.data;
  }
};

// Funciones de parámetros
export const parametrosApi = {
  getPorCampo: async (campo: string, padreId?: string): Promise<{ parametros: ParametroMaestro[] }> => {
    const params = new URLSearchParams({ tipo_campo: campo });
    if (padreId) {
      params.append('valor_padre', padreId);
    }
    const response = await api.get(`/parametros/maestros?${params.toString()}`);
    // El endpoint devuelve el array directamente cuando no hay paginación
    return { parametros: Array.isArray(response.data) ? response.data : response.data.data || [] };
  },
  
  getHijos: async (padreId: string) => {
    const response = await api.get(`/parametros/hijos/${padreId}`);
    return response.data;
  },
  
  getRelaciones: async () => {
    const response = await api.get('/parametros/relaciones');
    return response.data;
  },
  
  getCampoPadre: async (campoHijo: string) => {
    const response = await api.get(`/parametros/relaciones?campo_hijo=${campoHijo}`);
    return response.data;
  },
  
  getMaestros: async (filters?: {
    tipo_campo?: string;
    valor_padre?: string;
    activo?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.tipo_campo) params.append('tipo_campo', filters.tipo_campo);
    if (filters?.valor_padre) params.append('valor_padre', filters.valor_padre);
    if (filters?.activo !== undefined) params.append('activo', filters.activo.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const response = await api.get(`/parametros/maestros?${params.toString()}`);
    return response.data;
  },
  
  getCamposRendicion: async () => {
    const response = await api.get('/parametros/maestros/campos-rendicion');
    return response.data;
  },
  
  getValoresPadre: async (tipo_campo?: string) => {
    const params = tipo_campo ? `?tipo_campo=${tipo_campo}` : '';
    const response = await api.get(`/parametros/maestros/valores-padre${params}`);
    return response.data;
  },
  
  createMaestro: async (parametroData: {
    codigo: string;
    nombre: string;
    descripcion?: string;
    tipo_campo: string;
    valor_padre?: string;
    orden?: number;
    activo?: boolean;
  }) => {
    const response = await api.post('/parametros/maestros', parametroData);
    return response.data;
  },
  
  updateMaestro: async (id: number, parametroData: {
    codigo?: string;
    nombre?: string;
    descripcion?: string;
    tipo_campo?: string;
    valor_padre?: string;
    orden?: number;
    activo?: boolean;
    parametros_json?: Record<string, string> | null;
  }) => {
    const response = await api.put(`/parametros/maestros/${id}`, parametroData);
    return response.data;
  },
  
  deleteMaestro: async (id: number) => {
    const response = await api.delete(`/parametros/maestros/${id}`);
    return response.data;
  },
  
  create: async (parametroData: {
    campo: string;
    codigo: string;
    descripcion: string;
    padreId?: string;
    orden?: number;
  }) => {
    const response = await api.post('/parametros', parametroData);
    return response.data;
  },

  // CRUD operations for relaciones
  createRelacion: async (relacionData: {
    campo_padre: string;
    campo_hijo: string;
    descripcion?: string;
    activo: boolean;
  }) => {
    const response = await api.post('/parametros/relaciones', relacionData);
    return response.data;
  },

  updateRelacion: async (id: number, relacionData: {
    campo_padre: string;
    campo_hijo: string;
    descripcion?: string;
    activo: boolean;
  }) => {
    const response = await api.put(`/parametros/relaciones/${id}`, relacionData);
    return response.data;
  },

  deleteRelacion: async (id: number) => {
    const response = await api.delete(`/parametros/relaciones/${id}`);
    return response.data;
  }
};

// Funciones de atributos
export const atributosApi = {
  getAll: async () => {
    const response = await api.get('/atributos');
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/atributos/${id}`);
    return response.data;
  },
  
  create: async (atributoData: { codigo: string; descripcion: string }) => {
    const response = await api.post('/atributos', atributoData);
    return response.data;
  },
  
  update: async (id: string, atributoData: Partial<{ codigo: string; descripcion: string; activo: boolean }>) => {
    const response = await api.put(`/atributos/${id}`, atributoData);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/atributos/${id}`);
    return response.data;
  }
};

// Funciones de valores de atributo
export const valoresAtributoApi = {
  getAll: async (atributoId?: string) => {
    const url = atributoId ? `/atributos/valores-atributo?atributoId=${atributoId}` : '/atributos/valores-atributo';
    const response = await api.get(url);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/atributos/valores-atributo/${id}`);
    return response.data;
  },

  create: async (valorData: { codigo: string; descripcion: string; atributoId: string }) => {
    const response = await api.post('/atributos/valores-atributo', valorData);
    return response.data;
  },

  update: async (id: string, valorData: Partial<{ codigo: string; descripcion: string; activo: boolean }>) => {
    const response = await api.put(`/atributos/valores-atributo/${id}`, valorData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/atributos/valores-atributo/${id}`);
    return response.data;
  }
};

// Funciones de usuarios
export const usersApi = {
  getAll: async (filters?: {
    page?: number;
    limit?: number;
    search?: string;
    activo?: boolean;
  }): Promise<{ users: User[]; pagination: { page: number; limit: number; total: number; pages: number } }> => {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.activo !== undefined) params.append('activo', filters.activo.toString());
    
    const response = await api.get(`/users?${params.toString()}`);
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  
  create: async (userData: {
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    profileId?: string;
  }) => {
    const response = await api.post('/users', userData);
    return response.data;
  },
  
  update: async (id: string, userData: Partial<{
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    profileId: string;
    activo: boolean;
  }>) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
  
  toggleStatus: async (id: string) => {
    const response = await api.patch(`/users/${id}/toggle-status`);
    return response.data;
  },

  verifyEmail: async (id: string) => {
    const response = await api.patch(`/users/${id}/verify-email`);
    return response.data;
  }
};

// Funciones de user-atributos
export const userAtributosApi = {
  getByUserId: async (userId: string): Promise<{ userAtributos: UserAtributo[] }> => {
    const response = await api.get(`/atributos/user-atributos/usuario/${userId}`);
    return response.data;
  },

  getAtributosDisponibles: async (userId: string): Promise<{ atributos: Atributo[] }> => {
    const response = await api.get(`/atributos/user-atributos/usuario/${userId}/disponibles`);
    return response.data;
  },

  create: async (userAtributoData: {
    userId: string;
    valorAtributoId: string;
  }) => {
    const response = await api.post('/atributos/user-atributos', userAtributoData);
    return response.data;
  },

  update: async (id: string, userAtributoData: {
    valorAtributoId: string;
  }) => {
    const response = await api.put(`/atributos/user-atributos/${id}`, userAtributoData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/atributos/user-atributos/${id}`);
    return response.data;
  }
};

// Funciones de usuarios autorizantes
export const usuariosAutorizantesApi = {
  getByUserId: async (userId: string): Promise<{ autorizantes: UsuarioAutorizante[] }> => {
    const response = await api.get(`/usuario-autorizantes/usuario/${userId}`);
    return response.data;
  },

  create: async (data: { usuarioId: string; autorizanteId: string }): Promise<UsuarioAutorizante> => {
    const response = await api.post('/usuario-autorizantes', data);
    return response.data.usuarioAutorizante;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/usuario-autorizantes/${id}`);
  }
};

// Funciones de tarjetas de crédito de usuarios
export const userTarjetasCreditoApi = {
  getByUserId: async (userId: string): Promise<{ tarjetas: UserTarjetaCredito[] }> => {
    const response = await api.get(`/user-tarjetas-credito/usuario/${userId}`);
    return response.data;
  },
  
  create: async (tarjetaData: {
    userId: string;
    numeroTarjeta: string;
  }) => {
    const response = await api.post('/user-tarjetas-credito', tarjetaData);
    return response.data;
  },
  
  update: async (id: string, tarjetaData: {
    numeroTarjeta: string;
  }) => {
    const response = await api.put(`/user-tarjetas-credito/${id}`, tarjetaData);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/user-tarjetas-credito/${id}`);
    return response.data;
  },
  
  validate: async (numeroTarjeta: string): Promise<CardValidationResult> => {
    const response = await api.post('/user-tarjetas-credito/validate', { numeroTarjeta });
    return response.data;
  }
};

// Funciones de Jobs
export const jobsApi = {
  getJobs: async (limit: number = 50): Promise<{ jobs: ProcessingJob[] }> => {
    const response = await api.get(`/jobs?limit=${limit}`);
    return response.data;
  },

  getJob: async (id: string): Promise<ProcessingJob> => {
    const response = await api.get(`/jobs/${id}`);
    return response.data;
  },

  cancelJob: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/jobs/${id}/cancel`);
    return response.data;
  }
};

// Funciones de delegaciones
export const delegacionesApi = {
  getByUserId: async (userId: string): Promise<Delegacion[]> => {
    const response = await api.get(`/delegaciones/${userId}`);
    return response.data;
  },

  getUsuariosConTarjetas: async () => {
    const response = await api.get('/delegaciones/usuarios-con-tarjetas');
    return response.data;
  },

  update: async (usuarioId: string, tarjetasSeleccionadas: string[]) => {
    const response = await api.post('/delegaciones', {
      usuarioId,
      tarjetasSeleccionadas
    });
    return response.data;
  }
};

// Tipos para auto-complete
export interface AutoCompleteRequest {
  campo: string;
  valor: any;
  itemData: Record<string, any>;
}

export interface AutoCompleteResponse {
  found: boolean;
  values: Record<string, any>;
  message?: string;
}

// Funciones de rendiciones
export const rendicionesApi = {
  autoComplete: async (data: AutoCompleteRequest): Promise<AutoCompleteResponse> => {
    const response = await api.post('/rendiciones/auto-complete', data);
    return response.data;
  }
};

// Funciones de monedas
export const monedasApi = {
  getAll: async (): Promise<{ monedas: Moneda[] }> => {
    const response = await api.get('/monedas');
    return response.data;
  },

  getById: async (id: string): Promise<{ moneda: Moneda }> => {
    const response = await api.get(`/monedas/${id}`);
    return response.data;
  },

  create: async (data: Omit<Moneda, 'id' | 'activo' | 'createdAt' | 'updatedAt'>): Promise<{ message: string; moneda: Moneda }> => {
    const response = await api.post('/monedas', data);
    return response.data;
  },

  update: async (id: string, data: Omit<Moneda, 'id' | 'activo' | 'createdAt' | 'updatedAt'>): Promise<{ message: string; moneda: Moneda }> => {
    const response = await api.put(`/monedas/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/monedas/${id}`);
    return response.data;
  }
};

// Funciones de cajas
export const cajasApi = {
  getAll: async (): Promise<{ cajas: Caja[] }> => {
    const response = await api.get('/cajas');
    return response.data;
  },

  getById: async (id: string): Promise<{ caja: Caja }> => {
    const response = await api.get(`/cajas/${id}`);
    return response.data;
  },

  create: async (data: Omit<Caja, 'id' | 'activo' | 'createdAt' | 'updatedAt' | 'moneda' | 'tenantId'>): Promise<{ message: string; caja: Caja }> => {
    const response = await api.post('/cajas', data);
    return response.data;
  },

  update: async (id: string, data: Omit<Caja, 'id' | 'activo' | 'createdAt' | 'updatedAt' | 'moneda' | 'tenantId'>): Promise<{ message: string; caja: Caja }> => {
    const response = await api.put(`/cajas/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/cajas/${id}`);
    return response.data;
  },

  getUsers: async (cajaId: string): Promise<{ users: any[] }> => {
    const response = await api.get(`/cajas/${cajaId}/users`);
    return response.data;
  }
};

// Interfaces para user-cajas
export interface UserCaja {
  id: string;
  userId: string;
  cajaId: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  caja?: Caja;
}

// Funciones de user-cajas
export const userCajasApi = {
  getByUser: async (userId: string): Promise<{ userCajas: UserCaja[] }> => {
    const response = await api.get(`/user-cajas/user/${userId}`);
    return response.data;
  },

  getAvailableCajas: async (): Promise<{ cajas: Caja[] }> => {
    const response = await api.get('/user-cajas/available-cajas');
    return response.data;
  },

  create: async (data: { userId: string; cajaId: string }): Promise<{ message: string; userCaja: UserCaja }> => {
    const response = await api.post('/user-cajas', data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/user-cajas/${id}`);
    return response.data;
  }
};

// Interfaces para AI Prompts
export interface AIPrompt {
  id: string;
  clave: string;
  nombre: string;
  descripcion?: string;
  prompt: string;
  variables?: Record<string, any>;
  activo: boolean;
  version: number;
  motor?: string;
  vecesUsado: number;
  ultimoUso?: string;
  tasaExito?: number;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface PlanFeature {
  id: string;
  planId: string;
  feature: string;
  config?: Record<string, any>;
  createdAt: string;
}

export interface Plan {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  precio?: number;
  activo: boolean;
  orden: number;
  color?: string;
  createdAt: string;
  updatedAt: string;
  features?: PlanFeature[];
  tenants?: Array<{
    id: string;
    nombre: string;
    email?: string;
    activo?: boolean;
  }>;
  cantidadFeatures?: number;
  cantidadTenants?: number;
}

// Funciones de AI Prompts
export const promptsApi = {
  getAll: async (filters?: {
    clave?: string;
    motor?: string;
    activo?: boolean;
  }): Promise<{ prompts: AIPrompt[] }> => {
    const params = new URLSearchParams();
    if (filters?.clave) params.append('clave', filters.clave);
    if (filters?.motor) params.append('motor', filters.motor);
    if (filters?.activo !== undefined) params.append('activo', filters.activo.toString());

    const url = params.toString() ? `/prompts?${params.toString()}` : '/prompts';
    const response = await api.get(url);
    return response.data;
  },

  getById: async (id: string): Promise<{ prompt: AIPrompt }> => {
    const response = await api.get(`/prompts/${id}`);
    return response.data;
  },

  create: async (data: {
    clave: string;
    nombre: string;
    descripcion?: string;
    prompt: string;
    variables?: Record<string, any>;
    motor?: string;
    activo?: boolean;
  }): Promise<{ message: string; prompt: AIPrompt }> => {
    const response = await api.post('/prompts', data);
    return response.data;
  },

  update: async (id: string, data: {
    nombre?: string;
    descripcion?: string;
    prompt?: string;
    variables?: Record<string, any>;
    motor?: string;
    activo?: boolean;
  }): Promise<{ message: string; prompt: AIPrompt }> => {
    const response = await api.put(`/prompts/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/prompts/${id}`);
    return response.data;
  },

  test: async (data: {
    clave: string;
    variables: Record<string, any>;
    motor?: string;
  }): Promise<{ prompt: string }> => {
    const response = await api.post('/prompts/test', data);
    return response.data;
  },

  getCacheStats: async (): Promise<{
    size: number;
    entries: Array<{ key: string; timestamp: number }>;
  }> => {
    const response = await api.get('/prompts/stats/cache');
    return response.data;
  },

  clearCache: async (): Promise<{ message: string }> => {
    const response = await api.post('/prompts/cache/clear');
    return response.data;
  },

  getMotoresDisponibles: async (): Promise<{
    motores: Array<{
      id: string;
      nombre: string;
      descripcion: string;
      requiresConfig: boolean;
      isGlobal: boolean;
      isConfigured: boolean;
      hasCustomConfig?: boolean;
      modelo?: string;
    }>;
    tenantId: string | null;
  }> => {
    const response = await api.get('/prompts/motores-disponibles');
    return response.data;
  }
};

// Funciones de Planes
export const planesApi = {
  getAll: async (): Promise<{ success: boolean; planes: Plan[] }> => {
    const response = await api.get('/planes');
    return response.data;
  },

  getById: async (id: string): Promise<{ success: boolean; plan: Plan }> => {
    const response = await api.get(`/planes/${id}`);
    return response.data;
  },

  create: async (data: {
    codigo: string;
    nombre: string;
    descripcion?: string;
    precio?: number;
    activo?: boolean;
    orden?: number;
  }): Promise<{ success: boolean; plan: Plan; message: string }> => {
    const response = await api.post('/planes', data);
    return response.data;
  },

  update: async (
    id: string,
    data: {
      nombre?: string;
      descripcion?: string;
      precio?: number;
      activo?: boolean;
      orden?: number;
    }
  ): Promise<{ success: boolean; plan: Plan; message: string }> => {
    const response = await api.put(`/planes/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/planes/${id}`);
    return response.data;
  },

  // Features
  getFeatures: async (planId: string): Promise<{ success: boolean; features: PlanFeature[] }> => {
    const response = await api.get(`/planes/${planId}/features`);
    return response.data;
  },

  addFeature: async (
    planId: string,
    data: {
      feature: string;
      config?: Record<string, any>;
    }
  ): Promise<{ success: boolean; feature: PlanFeature; message: string }> => {
    const response = await api.post(`/planes/${planId}/features`, data);
    return response.data;
  },

  updateFeature: async (
    planId: string,
    featureId: string,
    data: {
      config?: Record<string, any>;
    }
  ): Promise<{ success: boolean; feature: PlanFeature; message: string }> => {
    const response = await api.put(`/planes/${planId}/features/${featureId}`, data);
    return response.data;
  },

  deleteFeature: async (
    planId: string,
    featureId: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/planes/${planId}/features/${featureId}`);
    return response.data;
  },

  // Tenant assignment
  assignToTenant: async (
    tenantId: string,
    planId: string
  ): Promise<{ success: boolean; tenant: any; message: string }> => {
    const response = await api.put(`/planes/tenants/${tenantId}/assign`, { planId });
    return response.data;
  },

  // Available features list
  getAvailableFeatures: async (): Promise<{
    success: boolean;
    features: Array<{
      feature: string;
      descripcion: string;
      categoria: string;
    }>;
  }> => {
    const response = await api.get('/planes/features/available');
    return response.data;
  }
};

// Tipos para AI Configs
export interface AIProviderConfig {
  id: string;
  provider: string;
  modelo: string;
  maxRequestsPerDay: number;
  config?: any;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
  active: boolean;
  deprecated?: boolean;
}

export interface AIProvider {
  id: string;
  nombre: string;
  descripcion: string;
  modelosDisponibles: Array<{
    value: string;
    label: string;
  }>;
  requiresApiKey: boolean;
}

export interface AIAvailableModels {
  anthropic: AIModel[];
  gemini: AIModel[];
  openai: AIModel[];
}

// API para configuración de IA
export const aiConfigsApi = {
  getAll: async (): Promise<AIProviderConfig[]> => {
    const response = await api.get('/ai-configs');
    return response.data;
  },

  getById: async (id: string): Promise<AIProviderConfig> => {
    const response = await api.get(`/ai-configs/${id}`);
    return response.data;
  },

  getProviders: async (): Promise<AIProvider[]> => {
    const response = await api.get('/ai-configs/providers');
    return response.data;
  },

  create: async (data: {
    provider: string;
    apiKey?: string;
    modelo?: string;
    maxRequestsPerDay?: number;
    activo?: boolean;
  }): Promise<AIProviderConfig> => {
    const response = await api.post('/ai-configs', data);
    return response.data;
  },

  update: async (id: string, data: {
    modelo?: string;
    maxRequestsPerDay?: number;
    activo?: boolean;
    apiKey?: string;
  }): Promise<AIProviderConfig> => {
    const response = await api.put(`/ai-configs/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/ai-configs/${id}`);
  },

  test: async (provider: string, apiKey: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/ai-configs/test', { provider, apiKey });
    return response.data;
  },

  getAvailableModels: async (): Promise<AIAvailableModels> => {
    const response = await api.get('/ai-configs/available-models');
    return response.data;
  },

  updateModel: async (provider: string, modelo: string): Promise<{
    success: boolean;
    provider: string;
    modelo: string;
    modelName: string;
  }> => {
    const response = await api.patch('/ai-configs/update-model', { provider, modelo });
    return response.data;
  }
};

// Tipos para AI Models CRUD
export interface AIModelData {
  id: string;
  provider: string;
  modelId: string;
  name: string;
  description?: string;
  recommended: boolean;
  active: boolean;
  deprecated: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

// API para gestión de catálogo de modelos
export const aiModelsApi = {
  getAll: async (provider?: string, active?: boolean): Promise<AIModelData[]> => {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    if (active !== undefined) params.append('active', String(active));

    const response = await api.get(`/ai-models?${params.toString()}`);
    return response.data;
  },

  getByProvider: async (): Promise<Record<string, AIModelData[]>> => {
    const response = await api.get('/ai-models/by-provider');
    return response.data;
  },

  getById: async (id: string): Promise<AIModelData> => {
    const response = await api.get(`/ai-models/${id}`);
    return response.data;
  },

  create: async (data: {
    provider: string;
    modelId: string;
    name: string;
    description?: string;
    recommended?: boolean;
    active?: boolean;
    deprecated?: boolean;
    orderIndex?: number;
  }): Promise<AIModelData> => {
    const response = await api.post('/ai-models', data);
    return response.data;
  },

  update: async (id: string, data: {
    modelId?: string;
    name?: string;
    description?: string;
    recommended?: boolean;
    active?: boolean;
    deprecated?: boolean;
    orderIndex?: number;
  }): Promise<AIModelData> => {
    const response = await api.put(`/ai-models/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/ai-models/${id}`);
  },

  toggleRecommended: async (id: string): Promise<AIModelData> => {
    const response = await api.patch(`/ai-models/${id}/toggle-recommended`);
    return response.data;
  }
};

// API para gestión de documentos
export const documentosApi = {
  // Marcar documentos como exportados
  exportar: async (documentoIds: string[]): Promise<{
    success: boolean;
    message: string;
    count: number;
    procesados: number;
    ignorados: number;
    transformados: {
      documentos: number;
      lineas: number;
      impuestos: number;
    };
  }> => {
    const response = await api.post('/documentos/exportar', { documentoIds });
    return response.data;
  },

  // Desmarcar documentos como exportados (revertir a pendiente)
  desmarcarExportados: async (documentoIds: string[]): Promise<{
    success: boolean;
    message: string;
    count: number;
    procesados: number;
    ignorados: number;
  }> => {
    const response = await api.post('/documentos/desmarcar-exportados', { documentoIds });
    return response.data;
  },

  // Aplicar reglas de negocio a documentos pendientes
  aplicarReglas: async (): Promise<{
    success: boolean;
    message: string;
    total: number;
    procesados: number;
    transformados: {
      documentos: number;
      lineas: number;
      impuestos: number;
    };
  }> => {
    const response = await api.post('/documentos/aplicar-reglas');
    return response.data;
  }
};