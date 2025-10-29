'use client';

import { useState, useEffect } from 'react';
import { X, Link, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface RendicionItem {
  id: string;
  rendicionCabeceraId: string;
  resumenTarjeta: {
    fechaTransaccion?: string;
    numeroCupon?: string;
    descripcionCupon?: string;
    importeTransaccion?: number;
  };
}

interface Document {
  id: string;
  fechaExtraida?: string;
  tipoComprobanteExtraido?: string;
  numeroComprobanteExtraido?: string;
  razonSocialExtraida?: string;
  cuitExtraido?: string;
  caeExtraido?: string;
  importeExtraido?: number;
}

interface AssociateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: RendicionItem | null;
  onViewDocument?: (documentId: string) => void;
  onAssociate?: () => void;
}

export const AssociateDocumentModal = ({
  isOpen,
  onClose,
  item,
  onViewDocument,
  onAssociate
}: AssociateDocumentModalProps) => {
  const [unassociatedDocuments, setUnassociatedDocuments] = useState<Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [associatingDocument, setAssociatingDocument] = useState(false);
  const [documentFilters, setDocumentFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
    search: ''
  });

  useEffect(() => {
    if (isOpen && item) {
      loadUnassociatedDocuments();
    }
  }, [isOpen, item]);

  const loadUnassociatedDocuments = async () => {
    if (!item) return;

    try {
      setLoadingDocuments(true);
      // Obtener la rendición para conseguir el userId
      const rendicionResponse = await api.get(`/rendiciones/cabecera/${item.rendicionCabeceraId}`);
      const userId = rendicionResponse.data.userId;

      if (!userId) {
        toast.error('No se pudo obtener el usuario de la rendición');
        return;
      }

      // Obtener documentos sin asociar del usuario
      const response = await api.get(`/documentos/sin-asociar/${userId}`);
      setUnassociatedDocuments(response.data);
    } catch (error) {
      console.error('Error loading unassociated documents:', error);
      toast.error('Error al cargar los comprobantes sin asociar');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const associateDocument = async (documentId: string) => {
    if (!item) return;

    try {
      setAssociatingDocument(true);
      await api.post('/documentos/asociar', {
        documentoId: documentId,
        rendicionItemId: item.id
      });

      toast.success('Comprobante asociado correctamente');

      // Recargar la lista de documentos sin asociar
      await loadUnassociatedDocuments();

      // Notificar al padre
      if (onAssociate) {
        onAssociate();
      }
    } catch (error: any) {
      console.error('Error associating document:', error);
      toast.error(error.response?.data?.error || 'Error al asociar el comprobante');
    } finally {
      setAssociatingDocument(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    if (dateString.length === 6) {
      const day = dateString.substring(0, 2);
      const month = dateString.substring(2, 4);
      const year = '20' + dateString.substring(4, 6);
      return `${day}/${month}/${year}`;
    }
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-AR');
    } catch {
      return dateString;
    }
  };

  // Filtrar documentos según filtros activos
  const filteredDocuments = unassociatedDocuments.filter(doc => {
    // Filtro por fecha desde
    if (documentFilters.fechaDesde && doc.fechaExtraida) {
      const docDate = new Date(doc.fechaExtraida);
      const filterDate = new Date(documentFilters.fechaDesde);
      if (docDate < filterDate) return false;
    }

    // Filtro por fecha hasta
    if (documentFilters.fechaHasta && doc.fechaExtraida) {
      const docDate = new Date(doc.fechaExtraida);
      const filterDate = new Date(documentFilters.fechaHasta);
      if (docDate > filterDate) return false;
    }

    // Filtro por búsqueda
    if (documentFilters.search) {
      const search = documentFilters.search.toLowerCase();
      const searchFields = [
        doc.razonSocialExtraida,
        doc.numeroComprobanteExtraido,
        doc.caeExtraido,
        doc.cuitExtraido
      ].filter(Boolean).map(f => f!.toLowerCase());

      if (!searchFields.some(field => field.includes(search))) {
        return false;
      }
    }

    return true;
  });

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-gray-500 opacity-75" aria-hidden="true"></div>

      <div className="fixed top-[5vh] left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl w-[95vw] max-w-6xl h-[90vh] overflow-hidden">
        {/* Header fijo */}
        <div className="absolute top-0 left-0 right-0 bg-white px-6 py-4 border-b border-gray-200 h-20 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            <Link className="inline w-5 h-5 mr-2 text-blue-500" />
            Asociar Comprobante con Item de Rendición
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Controles de filtro */}
        <div className="absolute top-20 left-0 right-0 px-6 py-4 h-66 overflow-y-auto bg-white">
          {/* Layout en dos columnas */}
          <div className="grid grid-cols-2 gap-6 mb-4">
            {/* Columna izquierda - Controles */}
            <div className="space-y-4">
              {/* Filtros de fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Desde
                  </label>
                  <input
                    type="date"
                    value={documentFilters.fechaDesde}
                    onChange={(e) => {
                      setDocumentFilters(prev => ({ ...prev, fechaDesde: e.target.value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Hasta
                  </label>
                  <input
                    type="date"
                    value={documentFilters.fechaHasta}
                    onChange={(e) => {
                      setDocumentFilters(prev => ({ ...prev, fechaHasta: e.target.value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Columna derecha - Información del item de rendición */}
            <div>
              <div className="p-3 bg-blue-50 rounded-lg h-full">
                <div className="space-y-2 text-sm text-gray-700">
                  <div><strong>Fecha:</strong> {formatDate(item.resumenTarjeta.fechaTransaccion)}</div>
                  <div><strong>Cupón:</strong> {item.resumenTarjeta.numeroCupon}</div>
                  <div><strong>Descripción:</strong> {item.resumenTarjeta.descripcionCupon}</div>
                  <div><strong>Importe:</strong> ${Number(item.resumenTarjeta.importeTransaccion).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar por proveedor, número de comprobante, CAE..."
                value={documentFilters.search}
                onChange={(e) => {
                  setDocumentFilters(prev => ({ ...prev, search: e.target.value }));
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                onClick={() => setDocumentFilters({ fechaDesde: '', fechaHasta: '', search: '' })}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2"
              >
                Limpiar
              </Button>
            </div>
          </div>
        </div>

        {/* Contenido del modal - Lista de comprobantes */}
        <div className="absolute top-[280px] left-0 right-0 bottom-0 overflow-hidden">
          <div className="px-6 py-4 h-full overflow-y-auto">

            {loadingDocuments ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">
                  {documentFilters.search || documentFilters.fechaDesde || documentFilters.fechaHasta
                    ? 'No hay comprobantes que coincidan con los filtros'
                    : 'No hay comprobantes sin asociar disponibles'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha Comprobante
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo Comprobante
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nro Comprobante
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Proveedor
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          CAE
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Importe
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.fechaExtraida ? new Date(doc.fechaExtraida).toLocaleDateString('es-AR') : '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.tipoComprobanteExtraido || '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.numeroComprobanteExtraido || '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">
                                {doc.razonSocialExtraida || '-'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {doc.cuitExtraido || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.caeExtraido || '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <span className="text-sm text-gray-900">
                              ${Number(doc.importeExtraido || 0).toLocaleString('es-AR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-2">
                              {onViewDocument && (
                                <button
                                  className="text-blue-600 hover:text-blue-700 p-1"
                                  title="Ver archivo"
                                  onClick={() => onViewDocument(doc.id)}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => associateDocument(doc.id)}
                                disabled={associatingDocument}
                                className="text-blue-600 hover:text-blue-900 disabled:opacity-50 p-1"
                                title="Asociar con este item"
                              >
                                <Link className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
