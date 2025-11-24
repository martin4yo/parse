'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  Plus,
  Settings,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  RefreshCw,
  Database,
  Upload,
  Download,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Eye
} from 'lucide-react';

interface ApiConnector {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  direction: 'PULL' | 'PUSH' | 'BIDIRECTIONAL';
  baseUrl: string;
  authType: string;
  lastPullSync: string | null;
  lastPullStatus: string | null;
  lastPushSync: string | null;
  lastPushStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ApiConnectorsPage() {
  const router = useRouter();
  const [connectors, setConnectors] = useState<ApiConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDirection, setFilterDirection] = useState<string>('');
  const [filterActivo, setFilterActivo] = useState<string>('');
  const [executingPull, setExecutingPull] = useState<string | null>(null);

  useEffect(() => {
    loadConnectors();
  }, [filterDirection, filterActivo]);

  const loadConnectors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterDirection) params.append('direction', filterDirection);
      if (filterActivo) params.append('activo', filterActivo);

      const response = await api.get(`/api-connectors?${params.toString()}`);
      setConnectors(response.data.data);
    } catch (error: any) {
      console.error('Error cargando conectores:', error);
      toast.error('Error al cargar conectores');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActivo = async (id: string, activo: boolean) => {
    try {
      await api.put(`/api-connectors/${id}`, { activo: !activo });
      toast.success(activo ? 'Conector desactivado' : 'Conector activado');
      loadConnectors();
    } catch (error: any) {
      console.error('Error actualizando conector:', error);
      toast.error('Error al actualizar conector');
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar el conector "${nombre}"?`)) {
      return;
    }

    try {
      await api.delete(`/api-connectors/${id}`);
      toast.success('Conector eliminado');
      loadConnectors();
    } catch (error: any) {
      console.error('Error eliminando conector:', error);
      toast.error('Error al eliminar conector');
    }
  };

  const handleExecutePull = async (id: string, nombre: string) => {
    if (!confirm(`¿Ejecutar sincronización PULL para "${nombre}"?`)) {
      return;
    }

    try {
      setExecutingPull(id);
      const response = await api.post(`/api-connectors/${id}/pull`, {});
      const result = response.data.data;

      toast.success(
        `PULL completado: ${result.importedRecords} importados, ${result.failedRecords} fallidos`,
        { duration: 5000 }
      );

      loadConnectors();
    } catch (error: any) {
      console.error('Error ejecutando PULL:', error);
      toast.error(error.response?.data?.error || 'Error al ejecutar PULL');
    } finally {
      setExecutingPull(null);
    }
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'PULL':
        return <Download className="w-4 h-4" />;
      case 'PUSH':
        return <Upload className="w-4 h-4" />;
      case 'BIDIRECTIONAL':
        return <ArrowLeftRight className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const getDirectionBadge = (direction: string) => {
    const colors = {
      PULL: 'bg-blue-100 text-blue-800',
      PUSH: 'bg-green-100 text-green-800',
      BIDIRECTIONAL: 'bg-purple-100 text-purple-800'
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${colors[direction as keyof typeof colors]}`}>
        {getDirectionIcon(direction)}
        {direction}
      </span>
    );
  };

  const getStatusIcon = (status: string | null) => {
    if (!status) return <Clock className="w-4 h-4 text-gray-400" />;

    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'PARTIAL':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
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
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Conectores API
            </h1>
            <p className="text-text-secondary mt-1">
              Sincronización bidireccional con sistemas externos via APIs REST
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadConnectors}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => router.push('/api-connectors/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Conector
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex items-center gap-4">
        <select
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todas las direcciones</option>
          <option value="PULL">PULL (Importación)</option>
          <option value="PUSH">PUSH (Exportación)</option>
          <option value="BIDIRECTIONAL">BIDIRECTIONAL</option>
        </select>

        <select
          value={filterActivo}
          onChange={(e) => setFilterActivo(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Lista de conectores */}
      {connectors.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay conectores configurados
          </h3>
          <p className="text-gray-600 mb-6">
            Crea tu primer conector para sincronizar datos con sistemas externos
          </p>
          <Button onClick={() => router.push('/api-connectors/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Conector
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {connectors.map((connector) => (
            <div
              key={connector.id}
              className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {connector.nombre}
                      </h3>
                      {getDirectionBadge(connector.direction)}
                      {connector.activo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                          <Pause className="w-3 h-3" />
                          Inactivo
                        </span>
                      )}
                    </div>

                    {connector.descripcion && (
                      <p className="text-sm text-gray-600 mb-3">
                        {connector.descripcion}
                      </p>
                    )}

                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        <span className="font-mono text-xs">{connector.baseUrl}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        <span>{connector.authType}</span>
                      </div>
                    </div>

                    {/* Estado de sincronizaciones */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      {(connector.direction === 'PULL' || connector.direction === 'BIDIRECTIONAL') && (
                        <div className="flex items-center gap-2 text-sm">
                          <Download className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-700">Último PULL:</span>
                          {getStatusIcon(connector.lastPullStatus)}
                          <span className="text-gray-600">
                            {formatDate(connector.lastPullSync)}
                          </span>
                        </div>
                      )}

                      {(connector.direction === 'PUSH' || connector.direction === 'BIDIRECTIONAL') && (
                        <div className="flex items-center gap-2 text-sm">
                          <Upload className="w-4 h-4 text-green-600" />
                          <span className="text-gray-700">Último PUSH:</span>
                          {getStatusIcon(connector.lastPushStatus)}
                          <span className="text-gray-600">
                            {formatDate(connector.lastPushSync)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 ml-6">
                    {(connector.direction === 'PULL' || connector.direction === 'BIDIRECTIONAL') && connector.activo && (
                      <button
                        onClick={() => handleExecutePull(connector.id, connector.nombre)}
                        disabled={executingPull === connector.id}
                        className="inline-flex items-center gap-2 px-3 py-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Ejecutar PULL ahora"
                      >
                        {executingPull === connector.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        {executingPull === connector.id ? 'Ejecutando...' : 'PULL'}
                      </button>
                    )}

                    {(connector.direction === 'PUSH' || connector.direction === 'BIDIRECTIONAL') && connector.activo && (
                      <button
                        onClick={() => router.push(`/api-connectors/${connector.id}/export`)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                        title="Exportar documentos (PUSH)"
                      >
                        <Upload className="w-4 h-4" />
                        Exportar
                      </button>
                    )}

                    <button
                      onClick={() => router.push(`/api-connectors/${connector.id}/staging`)}
                      className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Ver staging"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => router.push(`/api-connectors/${connector.id}/edit`)}
                      className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar configuración"
                    >
                      <Settings className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleActivo(connector.id, connector.activo)}
                      className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title={connector.activo ? 'Desactivar' : 'Activar'}
                    >
                      {connector.activo ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(connector.id, connector.nombre)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
