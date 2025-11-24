'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Eye,
  CheckSquare,
  Square,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface StagingRecord {
  id: string;
  resourceId: string;
  rawData: any;
  transformedData: any;
  validationStatus: 'VALID' | 'INVALID' | 'PENDING';
  validationErrors: Array<{
    field: string;
    type: string;
    message: string;
  }> | null;
  createdAt: string;
}

export default function StagingPage() {
  const router = useRouter();
  const params = useParams();
  const connectorId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [records, setRecords] = useState<StagingRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [connectorName, setConnectorName] = useState('');

  useEffect(() => {
    loadConnectorInfo();
    loadStagingRecords();
  }, [connectorId, filterStatus]);

  const loadConnectorInfo = async () => {
    try {
      const response = await api.get(`/api-connectors/${connectorId}`);
      setConnectorName(response.data.data.nombre);
    } catch (error: any) {
      console.error('Error cargando conector:', error);
    }
  };

  const loadStagingRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('validationStatus', filterStatus);
      params.append('limit', '100');

      const response = await api.get(`/api-connectors/${connectorId}/staging?${params.toString()}`);
      setRecords(response.data.data);
    } catch (error: any) {
      console.error('Error cargando staging:', error);
      toast.error('Error al cargar registros');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(records.map(r => r.id)));
    }
  };

  const handleSelectRecord = (id: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRecords(newSelected);
  };

  const handleToggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRecords(newExpanded);
  };

  const handleProcessSelected = async () => {
    if (selectedRecords.size === 0) {
      toast.error('Selecciona al menos un registro');
      return;
    }

    const validRecords = records.filter(r =>
      selectedRecords.has(r.id) && r.validationStatus === 'VALID'
    );

    if (validRecords.length === 0) {
      toast.error('Los registros seleccionados no están validados');
      return;
    }

    if (!confirm(`¿Aprobar e importar ${validRecords.length} registro(s)?`)) {
      return;
    }

    try {
      setProcessing(true);
      const response = await api.post(`/api-connectors/${connectorId}/staging/process`, {
        stagingIds: Array.from(selectedRecords)
      });

      const result = response.data.data;
      toast.success(
        `Procesamiento completado: ${result.success} éxitos, ${result.failed} fallos`,
        { duration: 5000 }
      );

      setSelectedRecords(new Set());
      loadStagingRecords();
    } catch (error: any) {
      console.error('Error procesando registros:', error);
      toast.error(error.response?.data?.error || 'Error al procesar registros');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('¿Rechazar este registro?')) {
      return;
    }

    try {
      await api.delete(`/api-connectors/${connectorId}/staging/${id}`);
      toast.success('Registro rechazado');
      loadStagingRecords();
    } catch (error: any) {
      console.error('Error eliminando registro:', error);
      toast.error('Error al rechazar registro');
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      VALID: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: CheckCircle
      },
      INVALID: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: XCircle
      },
      PENDING: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: AlertCircle
      }
    };

    const config = configs[status as keyof typeof configs] || configs.PENDING;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
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
            <h1 className="text-2xl font-bold text-gray-900">Staging - {connectorName}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Revisa y aprueba datos antes de importarlos
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadStagingRecords}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>

            {selectedRecords.size > 0 && (
              <button
                onClick={handleProcessSelected}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Aprobar e Importar ({selectedRecords.size})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex items-center gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="VALID">Válidos</option>
          <option value="INVALID">Inválidos</option>
          <option value="PENDING">Pendientes</option>
        </select>

        {records.length > 0 && (
          <div className="text-sm text-gray-600">
            {records.length} registro(s) en staging
          </div>
        )}
      </div>

      {/* Lista de registros */}
      {records.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay registros en staging
          </h3>
          <p className="text-gray-600">
            Los datos sincronizados aparecerán aquí si el conector requiere validación manual
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
              {selectedRecords.size === records.length ? (
                <CheckSquare className="w-5 h-5 text-blue-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <span className="text-sm font-medium text-gray-700">
              {selectedRecords.size > 0
                ? `${selectedRecords.size} seleccionado(s)`
                : 'Seleccionar todos'
              }
            </span>
          </div>

          {/* Registros */}
          <div className="divide-y divide-gray-200">
            {records.map((record) => (
              <div key={record.id} className="hover:bg-gray-50 transition-colors">
                <div className="px-6 py-4">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleSelectRecord(record.id)}
                      className="mt-1 p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      {selectedRecords.has(record.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {/* Expand/Collapse */}
                    <button
                      onClick={() => handleToggleExpand(record.id)}
                      className="mt-1 p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      {expandedRecords.has(record.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                    </button>

                    {/* Contenido */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(record.validationStatus)}
                          <span className="text-xs text-gray-500">
                            {formatDate(record.createdAt)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Rechazar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Preview de datos */}
                      <div className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-2 rounded">
                        {JSON.stringify(record.transformedData).substring(0, 150)}...
                      </div>

                      {/* Errores de validación */}
                      {record.validationErrors && record.validationErrors.length > 0 && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-red-900 mb-2">
                                Errores de Validación:
                              </h4>
                              <ul className="space-y-1">
                                {record.validationErrors.map((error, idx) => (
                                  <li key={idx} className="text-xs text-red-800">
                                    <span className="font-medium">{error.field}:</span> {error.message}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Datos expandidos */}
                      {expandedRecords.has(record.id) && (
                        <div className="mt-4 space-y-3">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                              Datos Originales (Raw):
                            </h4>
                            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                              {JSON.stringify(record.rawData, null, 2)}
                            </pre>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                              Datos Transformados:
                            </h4>
                            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                              {JSON.stringify(record.transformedData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
