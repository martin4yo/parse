'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import {
  Monitor,
  RefreshCw,
  Trash2,
  Settings,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/useApiClient';
import { useConfirmDialog } from '@/hooks/useConfirm';

interface SyncClient {
  id: string;
  nombre: string;
  hostname: string | null;
  plataforma: string | null;
  version: string | null;
  estado: string;
  ultimoHeartbeat: string | null;
  ultimaIp: string | null;
  documentosProcesados: number;
  erroresCount: number;
  ultimoError: string | null;
  ultimoDocumento: string | null;
  activo: boolean;
  config: any;
  isOnline: boolean;
  lastSeenAgo: number | null;
  createdAt: string;
}

interface ClientLog {
  id: string;
  nivel: string;
  mensaje: string;
  metadata: any;
  createdAt: string;
}

export default function SyncClientsPage() {
  const { get, put, delete: del } = useApiClient();
  const { confirm } = useConfirmDialog();

  const [clients, setClients] = useState<SyncClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para el panel expandido de logs
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientLogs, setClientLogs] = useState<ClientLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('');

  // Estado para modal de configuración
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<SyncClient | null>(null);
  const [configJson, setConfigJson] = useState('');

  useEffect(() => {
    fetchClients();
    // Refrescar cada 30 segundos
    const interval = setInterval(fetchClients, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchClients = async () => {
    try {
      const data = await get('/api/sync-clients');
      if (data.success) {
        setClients(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientLogs = async (clientId: string) => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (logFilter) params.append('nivel', logFilter);

      const data = await get(`/api/sync-clients/${clientId}/logs?${params}`);
      if (data.success) {
        setClientLogs(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleToggleExpand = async (clientId: string) => {
    if (expandedClient === clientId) {
      setExpandedClient(null);
      setClientLogs([]);
    } else {
      setExpandedClient(clientId);
      await fetchClientLogs(clientId);
    }
  };

  const handleOpenConfig = async (client: SyncClient) => {
    try {
      const data = await get(`/api/sync-clients/${client.id}`);
      if (data.success) {
        setSelectedClient(data.data);
        setConfigJson(JSON.stringify(data.data.config || {}, null, 2));
        setConfigModalOpen(true);
      }
    } catch (error) {
      toast.error('Error al cargar configuración');
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedClient) return;

    try {
      const config = JSON.parse(configJson);
      const data = await put(`/api/sync-clients/${selectedClient.id}`, { config });

      if (data.success) {
        toast.success('Configuración guardada');
        setConfigModalOpen(false);
        fetchClients();
      } else {
        toast.error(data.error || 'Error al guardar');
      }
    } catch (error) {
      toast.error('JSON inválido');
    }
  };

  const handleToggleActive = async (client: SyncClient) => {
    try {
      const data = await put(`/api/sync-clients/${client.id}`, {
        activo: !client.activo
      });

      if (data.success) {
        toast.success(client.activo ? 'Cliente desactivado' : 'Cliente activado');
        fetchClients();
      }
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleDelete = async (client: SyncClient) => {
    const confirmed = await confirm(
      `¿Eliminar cliente "${client.nombre}"?`,
      'Se eliminarán todos los logs asociados. Esta acción no se puede deshacer.'
    );

    if (!confirmed) return;

    try {
      const data = await del(`/api/sync-clients/${client.id}`);
      if (data.success) {
        toast.success('Cliente eliminado');
        fetchClients();
      }
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleClearLogs = async (clientId: string) => {
    const confirmed = await confirm(
      '¿Limpiar logs antiguos?',
      'Se eliminarán los logs de más de 30 días.'
    );

    if (!confirmed) return;

    try {
      const data = await del(`/api/sync-clients/${clientId}/logs?olderThanDays=30`);
      if (data.success) {
        toast.success(`${data.deletedCount} logs eliminados`);
        fetchClientLogs(clientId);
      }
    } catch (error) {
      toast.error('Error al limpiar logs');
    }
  };

  const formatLastSeen = (lastSeenAgo: number | null) => {
    if (lastSeenAgo === null) return 'Nunca';
    if (lastSeenAgo < 60) return 'Hace unos segundos';
    if (lastSeenAgo < 3600) return `Hace ${Math.floor(lastSeenAgo / 60)} min`;
    if (lastSeenAgo < 86400) return `Hace ${Math.floor(lastSeenAgo / 3600)} horas`;
    return `Hace ${Math.floor(lastSeenAgo / 86400)} días`;
  };

  const getLogBadgeColor = (nivel: string) => {
    switch (nivel) {
      case 'error': return 'bg-red-100 text-red-700 border-red-200';
      case 'warn': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'debug': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredClients = clients.filter(client =>
    client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.ultimaIp?.includes(searchTerm)
  );

  // Estadísticas generales
  const stats = {
    total: clients.length,
    online: clients.filter(c => c.isOnline).length,
    offline: clients.filter(c => !c.isOnline).length,
    totalDocs: clients.reduce((sum, c) => sum + c.documentosProcesados, 0),
    totalErrors: clients.reduce((sum, c) => sum + c.erroresCount, 0)
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
            <Monitor className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Sync Clients
            </h1>
            <p className="text-text-secondary">
              Administra los clientes ejecutables que suben documentos automáticamente
            </p>
          </div>
        </div>
        <Button onClick={fetchClients} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refrescar
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-white border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
                  <p className="text-xs text-text-secondary">Clientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats.online}</p>
                  <p className="text-xs text-text-secondary">Online</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats.offline}</p>
                  <p className="text-xs text-text-secondary">Offline</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats.totalDocs.toLocaleString()}</p>
                  <p className="text-xs text-text-secondary">Documentos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats.totalErrors.toLocaleString()}</p>
                  <p className="text-xs text-text-secondary">Errores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <Input
            placeholder="Buscar por nombre, hostname o IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Clients Table */}
        <Card className="bg-white border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-text-secondary">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                Cargando clientes...
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No hay clientes registrados</p>
                <p className="text-sm mt-1">Los clientes aparecerán aquí cuando se conecten</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-text-secondary">Estado</TableHead>
                    <TableHead className="text-text-secondary">Cliente</TableHead>
                    <TableHead className="text-text-secondary">Plataforma</TableHead>
                    <TableHead className="text-text-secondary">Última conexión</TableHead>
                    <TableHead className="text-text-secondary">Documentos</TableHead>
                    <TableHead className="text-text-secondary">Errores</TableHead>
                    <TableHead className="text-text-secondary text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <>
                      <TableRow
                        key={client.id}
                        className="border-border hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleToggleExpand(client.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {client.isOnline ? (
                              <Badge className="bg-green-100 text-green-700 border border-green-200 gap-1">
                                <Wifi className="w-3 h-3" />
                                Online
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-600 border border-gray-200 gap-1">
                                <WifiOff className="w-3 h-3" />
                                Offline
                              </Badge>
                            )}
                            {!client.activo && (
                              <Badge className="bg-red-100 text-red-700 border border-red-200">
                                Desactivado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-text-primary">{client.nombre}</p>
                            <p className="text-xs text-text-secondary">
                              {client.hostname || 'Sin hostname'} • {client.ultimaIp || 'Sin IP'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="text-text-primary">{client.plataforma || '-'}</p>
                            <p className="text-xs text-text-secondary">v{client.version || '?'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-text-secondary">
                            <Clock className="w-3 h-3" />
                            {formatLastSeen(client.lastSeenAgo)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-emerald-600 font-medium">
                            {client.documentosProcesados.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={client.erroresCount > 0 ? 'text-red-600 font-medium' : 'text-text-secondary'}>
                            {client.erroresCount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenConfig(client)}
                              title="Configuración"
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(client)}
                              title={client.activo ? 'Desactivar' : 'Activar'}
                            >
                              {client.activo ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(client)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                            {expandedClient === client.id ? (
                              <ChevronUp className="w-4 h-4 text-text-secondary" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-text-secondary" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Logs Section */}
                      {expandedClient === client.id && (
                        <TableRow className="border-border">
                          <TableCell colSpan={7} className="bg-gray-50 p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-text-primary flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Logs recientes
                                </h4>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={logFilter}
                                    onChange={(e) => {
                                      setLogFilter(e.target.value);
                                      fetchClientLogs(client.id);
                                    }}
                                    className="bg-white border border-border rounded px-2 py-1 text-sm text-text-primary"
                                  >
                                    <option value="">Todos</option>
                                    <option value="error">Errores</option>
                                    <option value="warn">Warnings</option>
                                    <option value="info">Info</option>
                                    <option value="debug">Debug</option>
                                  </select>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchClientLogs(client.id)}
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleClearLogs(client.id)}
                                    className="text-red-500 hover:text-red-600"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>

                              {client.ultimoError && (
                                <div className="bg-red-50 border border-red-200 rounded p-3">
                                  <p className="text-sm text-red-700">
                                    <AlertCircle className="w-4 h-4 inline mr-2" />
                                    Último error: {client.ultimoError}
                                  </p>
                                </div>
                              )}

                              {logsLoading ? (
                                <div className="text-center py-4 text-text-secondary">
                                  <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                                </div>
                              ) : clientLogs.length === 0 ? (
                                <p className="text-text-secondary text-sm text-center py-4">
                                  No hay logs disponibles
                                </p>
                              ) : (
                                <div className="max-h-64 overflow-y-auto space-y-1">
                                  {clientLogs.map((log) => (
                                    <div
                                      key={log.id}
                                      className="flex items-start gap-3 text-sm py-2 px-3 rounded bg-white border border-border hover:bg-gray-50"
                                    >
                                      <Badge className={`${getLogBadgeColor(log.nivel)} text-xs shrink-0`}>
                                        {log.nivel.toUpperCase()}
                                      </Badge>
                                      <span className="text-text-secondary shrink-0 text-xs">
                                        {new Date(log.createdAt).toLocaleString()}
                                      </span>
                                      <span className="text-text-primary flex-1">{log.mensaje}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Config Modal */}
      {configModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-text-primary">
                  Configuración: {selectedClient.nombre}
                </h3>
                <p className="text-sm text-text-secondary">
                  {selectedClient.hostname} • {selectedClient.plataforma}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setConfigModalOpen(false)}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-text-secondary mb-3">
                Edita la configuración JSON del cliente. Los cambios se aplicarán
                cuando el cliente se reconecte.
              </p>
              <textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                className="w-full h-96 bg-gray-50 border border-border rounded p-3 font-mono text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-palette-purple focus:border-transparent"
                spellCheck={false}
              />
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2 bg-gray-50">
              <Button variant="outline" onClick={() => setConfigModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveConfig}>
                Guardar configuración
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
