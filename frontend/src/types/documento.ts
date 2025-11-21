export interface DocumentoProcessado {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  rutaArchivo?: string;
  fechaProcesamiento: string;
  estadoProcesamiento: string;
  fechaExtraida?: string;
  importeExtraido?: number;
  cuitExtraido?: string;
  numeroComprobanteExtraido?: string;
  razonSocialExtraida?: string;
  tipo?: string;
  netoGravadoExtraido?: number;
  exentoExtraido?: number;
  impuestosExtraido?: number;
  descuentoGlobalExtraido?: number;
  descuentoGlobalTipo?: string;
  codigoProveedor?: string;
  monedaExtraida?: string;
  cuponExtraido?: string;
  caeExtraido?: string;
  tipoComprobanteExtraido?: string;
  observaciones?: string;
  exportado?: boolean;
  reglasAplicadas?: boolean;
  fechaReglasAplicadas?: string;
  validationErrors?: {
    errors: any[];
    summary: {
      total: number;
      bloqueantes: number;
      errores: number;
      warnings: number;
    };
    timestamp: string;
  };
  datosExtraidos?: any;
}
