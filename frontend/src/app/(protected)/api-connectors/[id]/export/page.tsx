'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Upload,
  CheckSquare,
  Square,
  RefreshCw,
  FileText,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  Eye,
  History
} from 'lucide-react';

interface Documento {
  id: string;
  numeroComprobante: string;
  fechaComprobante: string;
  totalComprobante: number;
  tipoComprobante: string;
  proveedor: {
    razonSocial: string;
    cuit: string;
  };
}

interface ExportLog {
  id: string;
  status: string;
  exportedAt: string;
  sentData: any;
  responseData: any;
  errorMessage?: string;
}

export default function ExportPage() {
  const router = useRouter();
  const params = useParams();
  const connectorId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [connectorName, setConnectorName] = useState('');
  const [pendingDocuments, setPendingDocuments] = useState<Documento[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportLog[]>([]);

  useEffect(() => {
    loadConnectorInfo();
    loadPendingDocuments();
  }, [connectorId]);

  const loadConnectorInfo = async () => {
    try {
      const response = await api.get(`/api-connectors/${connectorId}`);
      setConnectorName(response.data.data.nombre);
    } catch (error: any) {
      console.error('Error cargando conector:', error);
      toast.error('Error al cargar información del conector');
    }
  };

  const loadPendingDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api-connectors/${connectorId}/pending-exports`, {
        params: { limit: 100 }
      });
      setPendingDocuments(response.data.data);
    } catch (error: any) {
      console.error('Error cargando documentos:', error);
      toast.error('Error al cargar documentos pendientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === pendingDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(pendingDocuments.map(d => d.id)));
    }
  };

  const handleSelectDocument = (id: string) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDocuments(newSelected);
  };

  const handleExportSelected = async () => {
    if (selectedDocuments.size === 0) {
      toast.error('Selecciona al menos un documento');
      return;
    }

    if (!confirm(`¿Exportar ${selectedDocuments.size} documento(s)?`)) {
      return;
    }

    try {
      setExporting(true);

      // Exportar cada documento seleccionado
      const results = {
        success: 0,
        failed: 0
      };

      for (const documentoId of Array.from(selectedDocuments)) {
        try {
          await api.post(`/api-connectors/${connectorId}/export-document/${documentoId}`);
          results.success++;
        } catch (error) {
          results.failed++;
        }
      }

      if (results.failed === 0) {
        toast.success(`${results.success} documento(s) exportado(s) exitosamente`);
      } else {
        toast.error(`${results.success} éxitos, ${results.failed} fallos`);
      }

      setSelectedDocuments(new Set());
      loadPendingDocuments();

    } catch (error: any) {
      console.error('Error exportando documentos:', error);
      toast.error('Error al exportar documentos');
    } finally {
      setExporting(false);
    }
  };

  const handleExecutePush = async () => {
    if (!confirm('¿Ejecutar exportación automática de todos los documentos pendientes?')) {
      return;
    }

    try {
      setExporting(true);

      const response = await api.post(`/api-connectors/${connectorId}/execute-push`, {
        forceAll: false,
        limit: 100
      });

      const result = response.data.data;

      toast.success(
        `Exportación completada: ${result.success} éxitos, ${result.failed} fallos`,
        { duration: 5000 }
      );

      loadPendingDocuments();

    } catch (error: any) {
      console.error('Error ejecutando PUSH:', error);
      toast.error(error.response?.data?.error || 'Error al ejecutar exportación');
    } finally {
      setExporting(false);
    }
  };

  const handleViewHistory = async (documentoId: string) => {
    try {
      const response = await api.get(
        `/api-connectors/${connectorId}/document-export-history/${documentoId}`
      );
      setExportHistory(response.data.data);
      setShowHistory(documentoId);
    } catch (error: any) {
      console.error('Error cargando historial:', error);
      toast.error('Error al cargar historial de exportación');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/api-connectors')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Conectores
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exportación - {connectorName}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Exporta documentos hacia el sistema externo
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadPendingDocuments}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>

            {selectedDocuments.size > 0 ? (
              <button
                onClick={handleExportSelected}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Exportar Seleccionados ({selectedDocuments.size})
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleExecutePush}
                disabled={exporting || pendingDocuments.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Exportar Todos Pendientes
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Documentos Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{pendingDocuments.length}</p>
            </div>
            <FileText className="w-10 h-10 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Seleccionados</p>
              <p className="text-2xl font-bold text-purple-600">{selectedDocuments.size}</p>
            </div>
            <CheckSquare className="w-10 h-10 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total a Exportar</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  pendingDocuments
                    .filter(d => selectedDocuments.has(d.id))
                    .reduce((sum, d) => sum + (d.totalComprobante || 0), 0)
                )}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Documentos */}
      {pendingDocuments.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay documentos pendientes de exportar
          </h3>
          <p className="text-gray-600">
            Todos los documentos han sido exportados exitosamente
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Header con select all */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
            <button
              onClick={handleSelectAll}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {selectedDocuments.size === pendingDocuments.length ? (
                <CheckSquare className="w-5 h-5 text-purple-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <span className="text-sm font-medium text-gray-700">
              {selectedDocuments.size > 0
                ? `${selectedDocuments.size} seleccionado(s)`
                : 'Seleccionar todos'
              }
            </span>
          </div>

          {/* Lista de documentos */}
          <div className="divide-y divide-gray-200">
            {pendingDocuments.map((doc) => (
              <div
                key={doc.id}
                className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                  selectedDocuments.has(doc.id) ? 'bg-purple-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleSelectDocument(doc.id)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    {selectedDocuments.has(doc.id) ? (
                      <CheckSquare className="w-5 h-5 text-purple-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* Info del documento */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Comprobante</p>
                      <p className="font-medium text-gray-900">{doc.tipoComprobante}</p>
                      <p className="text-sm text-gray-600">{doc.numeroComprobante}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Proveedor</p>
                      <p className="text-sm font-medium text-gray-900">{doc.proveedor.razonSocial}</p>
                      <p className="text-xs text-gray-600">{doc.proveedor.cuit}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Fecha</p>
                      <p className="text-sm text-gray-900">{formatDate(doc.fechaComprobante)}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(doc.totalComprobante || 0)}
                      </p>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleViewHistory(doc.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Ver historial de exportación"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de historial */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Historial de Exportación
              </h3>
              <button
                onClick={() => setShowHistory(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {exportHistory.length === 0 ? (
                <p className="text-center text-gray-600">
                  Este documento nunca ha sido exportado
                </p>
              ) : (
                <div className="space-y-4">
                  {exportHistory.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg border ${
                        log.status === 'SUCCESS'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <span className="font-medium">
                            {log.status === 'SUCCESS' ? 'Éxito' : 'Fallo'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-600">
                          {formatDate(log.exportedAt)}
                        </span>
                      </div>

                      {log.errorMessage && (
                        <p className="text-sm text-red-800 mt-2">
                          Error: {log.errorMessage}
                        </p>
                      )}

                      {log.responseData && (
                        <details className="mt-3">
                          <summary className="text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                            Ver respuesta del servidor
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                            {JSON.stringify(
                              typeof log.responseData === 'string'
                                ? JSON.parse(log.responseData)
                                : log.responseData,
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
