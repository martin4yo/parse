export interface RendicionItem {
  id: string;
  rendicionCabeceraId: string;
  resumenTarjetaId: string;
  tipoComprobante?: string;
  numeroComprobante?: string;
  fechaComprobante?: string;
  proveedorId?: string;
  cuitProveedor?: string;
  tipoProducto?: string;
  codigoProducto?: string;
  netoGravado?: number;
  exento?: number;
  moneda?: string;
  codigoDimension?: string;
  subcuenta?: string;
  observaciones?: string;
  cuentaContable?: string;
  cargaManual: boolean;
  rechazo: boolean;
  motivoRechazo?: string;
  patente?: string;
  km?: string;
  tipoOrdenCompra?: string;
  ordenCompra?: string;
  resumenTarjeta: {
    fechaTransaccion?: string;
    numeroCupon?: string;
    descripcionCupon?: string;
    importeTransaccion?: number;
  };
}

export interface BulkUpdateRequest {
  numeroTarjeta: string;
  periodo: string;
  userId: string;
  changes: {
    modified: Array<{
      id: string;
      fields: Partial<RendicionItem>;
    }>;
    new: Array<{
      tempId: string;
      fields: Partial<RendicionItem>;
    }>;
    deleted: string[];
  };
}

export interface BulkUpdateResponse {
  success: boolean;
  message?: string;
  results?: {
    modified: number;
    created: number;
    deleted: number;
  };
  errors?: Array<{
    type: 'modified' | 'new' | 'deleted';
    id: string;
    error: string;
  }>;
}