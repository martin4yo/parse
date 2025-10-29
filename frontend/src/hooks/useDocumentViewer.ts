import { useState } from 'react';
import toast from 'react-hot-toast';

interface UseDocumentViewerOptions {
  // Función para encontrar un documento por ID en la lista actual
  findDocument: (documentId: string) => any;
  // Función para formatear los datos del documento para el modal
  formatItemData?: (documento: any) => any;
}

export function useDocumentViewer({ findDocument, formatItemData }: UseDocumentViewerOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewingDocumentId, setViewingDocumentId] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<any>(null);

  const openViewer = (documentId: string) => {
    console.log('🔍 [useDocumentViewer] openViewer called with documentId:', documentId);

    // Encontrar el documento en la lista actual
    const documento = findDocument(documentId);
    console.log('📄 [useDocumentViewer] Found documento:', documento);

    if (!documento) {
      console.log('❌ [useDocumentViewer] Documento not found');
      toast.error('Documento no encontrado');
      return;
    }

    // Formatear los datos si se proporciona una función de formato
    const itemData = formatItemData ? formatItemData(documento) : documento;
    console.log('📋 [useDocumentViewer] Formatted itemData:', itemData);

    // Abrir el modal
    setViewingDocument(itemData);
    setViewingDocumentId(documentId);
    setIsOpen(true);
  };

  const closeViewer = () => {
    setIsOpen(false);
    setViewingDocumentId(null);
    setViewingDocument(null);
  };

  return {
    // Estados del modal
    isOpen,
    viewingDocumentId,
    viewingDocument,

    // Funciones de control
    openViewer,
    closeViewer
  };
}

// Función helper para formatear datos de comprobantes de efectivo
export const formatComprobantesEfectivoData = (documento: any) => ({
  fechaComprobante: documento.fechaExtraida || documento.fechaProcesamiento,
  tipoComprobante: documento.tipoComprobanteExtraido || 'N/A',
  numeroComprobante: documento.numeroComprobanteExtraido || 'N/A',
  documento: {
    fechaTransaccion: documento.fechaExtraida,
    razonSocialExtraida: documento.razonSocialExtraida,
    importeExtraido: documento.importeExtraido,
    cuitExtraido: documento.cuitExtraido,
    proveedorNombre: documento.razonSocialExtraida,
    observaciones: documento.observaciones
  },
  importeTotal: documento.importeExtraido
});

// Función helper para formatear datos de rendiciones de efectivo
export const formatRendicionEfectivoData = (item: any) => ({
  fechaComprobante: item.documento?.fechaTransaccion || item.fechaComprobante,
  tipoComprobante: item.tipoComprobante || 'N/A',
  numeroComprobante: item.numeroComprobante || 'N/A',
  documento: {
    fechaTransaccion: item.documento?.fechaTransaccion,
    razonSocialExtraida: item.documento?.razonSocialExtraida,
    importeExtraido: item.documento?.importeExtraido,
    cuitExtraido: item.documento?.cuitExtraido,
    proveedorNombre: item.documento?.proveedorNombre || item.documento?.razonSocialExtraida,
    observaciones: item.documento?.observaciones || item.observaciones
  },
  tipoProducto: item.tipoProducto,
  codigoProducto: item.codigoProducto,
  importeTotal: item.documento?.importeExtraido || item.importeTotal
});

// Función helper para formatear datos de rendiciones de tarjeta
export const formatRendicionTarjetaData = (item: any) => ({
  fechaComprobante: item.resumenTarjeta?.fechaTransaccion || item.fechaComprobante,
  tipoComprobante: item.tipoComprobante || 'N/A',
  numeroComprobante: item.numeroComprobante || item.resumenTarjeta?.numeroCupon || 'N/A',
  documento: {
    fechaTransaccion: item.resumenTarjeta?.fechaTransaccion,
    razonSocialExtraida: item.resumenTarjeta?.descripcionCupon,
    importeExtraido: item.resumenTarjeta?.importeTransaccion,
    observaciones: item.observaciones
  },
  tipoProducto: item.tipoProducto,
  codigoProducto: item.codigoProducto,
  importeTotal: item.resumenTarjeta?.importeTransaccion || item.importeTotal
});