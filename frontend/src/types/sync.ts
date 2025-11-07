// Tipos para el sistema de sincronización

export interface PhaseConfig {
  enabled: boolean;
  ejecutarEn: 'origen' | 'destino';
  sql: string;
}

export interface ProcessConfig {
  query: string;
  tablaTemporal?: string;
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface TableSchema {
  columns: SchemaColumn[];
  primaryKey?: string | string[];
}

export interface TablaSubida {
  nombre: string;
  primaryKey: string;
  incremental: boolean;
  campoFecha?: string;
  pre_process?: PhaseConfig;
  process: ProcessConfig;
  post_process?: PhaseConfig;
}

export interface TablaBajada {
  nombre: string;
  primaryKey: string;
  schema: TableSchema;
  pre_process?: PhaseConfig;
  process: ProcessConfig;
  post_process?: PhaseConfig;
  tipoCampo?: string;
}

export interface ConfiguracionTablas {
  tablasSubida: TablaSubida[];
  tablasBajada: TablaBajada[];
}

export interface SyncConfiguration {
  id: string;
  tenantId: string;
  sqlServerHost: string;
  sqlServerPort: number;
  sqlServerDatabase: string;
  sqlServerUser: string;
  sqlServerPassword: string;
  configuracionTablas: ConfiguracionTablas;
  version: number;
  ultimaModificacion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    nombre: string;
    cuit: string;
    slug: string;
  };
}

export interface SyncLog {
  id: string;
  tenantId: string;
  configId: string | null;
  direccion: 'upload' | 'download';
  tabla: string;
  fase: 'pre_process' | 'process' | 'post_process' | null;
  ejecutadoEn: 'origen' | 'destino' | null;
  estado: 'exitoso' | 'error' | 'parcial';
  registrosAfectados: number | null;
  mensaje: string | null;
  errorDetalle: string | null;
  duracionMs: number | null;
  metadatos: any | null;
  fechaInicio: string;
  fechaFin: string | null;
  createdAt: string;
  tenant?: {
    nombre: string;
  };
}

export interface SyncStats {
  porEstado: Array<{
    estado: string;
    _count: {
      id: number;
    };
  }>;
  porTabla: Array<{
    tabla: string;
    direccion: string;
    _count: {
      id: number;
    };
    _sum: {
      registrosAfectados: number | null;
    };
    _avg: {
      duracionMs: number | null;
    };
  }>;
  ultimaSincronizacion: SyncLog | null;
}

// Tipos para tenants
export interface Tenant {
  id: string;
  slug: string;
  nombre: string;
  cuit: string;
  razonSocial?: string;
  email?: string;
  plan: string;
  activo: boolean;
  esDefault: boolean;
}

// Tipos para formularios
export interface SyncConfigFormData {
  tenantId: string;
  sqlServerHost: string;
  sqlServerPort: number;
  sqlServerDatabase: string;
  sqlServerUser: string;
  sqlServerPassword: string;
  configuracionTablas: ConfiguracionTablas;
  activo: boolean;
}
