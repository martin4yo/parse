'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  RefreshCw,
  FileText,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  FileSearch,
  Save,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/useApiClient';

interface ParseLog {
  id: string;
  operacion: string;
  nombreArchivo: string | null;
  tipoArchivo: string | null;
  tamanoBytes: number | null;
  estado: string;
  modeloIA: string | null;
  confianza: number | null;
  tipoDocumento: string | null;
  documentoId: string | null;
  itemsExtraidos: number | null;
  impuestosExtraidos: number | null;
  reglasAplicadas: number;
  duracionMs: number | null;
  duracionIAMs: number | null;
  errorTipo: string | null;
  errorMensaje: string | null;
  errorStack: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Stats {
  total: number;
  completados: number;
  errores: number;
  tasaExito: number;
  promedioMs: number;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function ParseLogsPage() {
  const { get } = useApiClient();
  const [logs, setLogs] = useState<ParseLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Filtros
  const [estado, setEstado] = useState('');
  const [operacion, setOperacion] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (estado) params.append('estado', estado);
      if (operacion) params.append('operacion', operacion);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const data = await get(`/api/sync/api-keys/parse-logs?${params}`);

      if (data.success) {
        setLogs(data.logs);
        setStats(data.stats);
        setPagination(data.pagination);
      } else {
        toast.error('Error al cargar logs');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [get, estado, operacion, limit, offset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'completado':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      case 'procesando':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Procesando
          </Badge>
        );
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const getOperacionIcon = (operacion: string) => {
    switch (operacion) {
      case 'parse':
        return <FileSearch className="w-4 h-4 text-blue-500" />;
      case 'save':
        return <Save className="w-4 h-4 text-green-500" />;
      case 'full':
        return <Layers className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (pagination?.hasMore) {
      setOffset(offset + limit);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Logs de Parse API
          </h1>
          <p className="text-gray-500">
            Monitoreo de procesamiento de documentos via API
          </p>
        </div>
        <Button onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Procesados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.completados}</div>
              <p className="text-xs text-muted-foreground">Exitosos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{stats.errores}</div>
              <p className="text-xs text-muted-foreground">Errores</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{stats.tasaExito}%</div>
              <p className="text-xs text-muted-foreground">Tasa de Exito</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatDuration(stats.promedioMs)}</div>
              <p className="text-xs text-muted-foreground">Tiempo Promedio</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => { setEstado(v); setOffset(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="procesando">Procesando</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operacion</Label>
              <Select value={operacion} onValueChange={(v) => { setOperacion(v); setOffset(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las operaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="parse">Parse (solo lectura)</SelectItem>
                  <SelectItem value="save">Save (guardar)</SelectItem>
                  <SelectItem value="full">Full (parse + reglas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Registros por pagina</Label>
              <Select value={limit.toString()} onValueChange={(v) => { setLimit(parseInt(v)); setOffset(0); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEstado('');
                  setOperacion('');
                  setOffset(0);
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Historial de Procesamiento
            {pagination && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({pagination.total} registros)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Op</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Modelo IA</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Duracion</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    <p className="text-gray-500 mt-2">Cargando logs...</p>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <FileText className="w-8 h-8 mx-auto text-gray-300" />
                    <p className="text-gray-500 mt-2">No hay logs de procesamiento</p>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <>
                    <TableRow
                      key={log.id}
                      className={`cursor-pointer hover:bg-gray-50 ${expandedLog === log.id ? 'bg-gray-50' : ''}`}
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      <TableCell>
                        <div className="flex items-center" title={log.operacion}>
                          {getOperacionIcon(log.operacion)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[200px]" title={log.nombreArchivo || ''}>
                            {log.nombreArchivo || '-'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatBytes(log.tamanoBytes)} | {log.tipoArchivo || '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getEstadoBadge(log.estado)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{log.modeloIA || '-'}</span>
                          {log.confianza && (
                            <span className="text-xs text-gray-500">
                              Confianza: {(Number(log.confianza) * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {log.itemsExtraidos !== null ? (
                          <span className="text-sm">
                            {log.itemsExtraidos} items
                            {log.impuestosExtraidos ? `, ${log.impuestosExtraidos} imp.` : ''}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-sm">
                            {formatDuration(log.duracionMs)}
                          </span>
                          {log.duracionIAMs && (
                            <span className="text-xs text-gray-500">
                              IA: {formatDuration(log.duracionIAMs)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(log.createdAt).toLocaleDateString('es-AR')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleTimeString('es-AR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {expandedLog === log.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Fila expandida con detalles */}
                    {expandedLog === log.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-gray-50 p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">ID:</span>
                              <p className="font-mono text-xs">{log.id}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Tipo Documento:</span>
                              <p>{log.tipoDocumento || '-'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Documento ID:</span>
                              <p className="font-mono text-xs">{log.documentoId || '-'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Reglas Aplicadas:</span>
                              <p>{log.reglasAplicadas}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">IP:</span>
                              <p className="font-mono text-xs">{log.ipAddress || '-'}</p>
                            </div>
                            <div className="col-span-3">
                              <span className="text-gray-500">User Agent:</span>
                              <p className="text-xs truncate">{log.userAgent || '-'}</p>
                            </div>

                            {log.estado === 'error' && (
                              <div className="col-span-4 mt-2 p-3 bg-red-50 rounded border border-red-200">
                                <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                                  <AlertTriangle className="w-4 h-4" />
                                  {log.errorTipo || 'Error'}
                                </div>
                                <p className="text-red-600 text-sm">{log.errorMensaje}</p>
                                {log.errorStack && (
                                  <pre className="mt-2 text-xs text-red-500 overflow-auto max-h-32 bg-red-100 p-2 rounded">
                                    {log.errorStack}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>

          {/* Paginacion */}
          {pagination && pagination.total > limit && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Mostrando {offset + 1} - {Math.min(offset + logs.length, pagination.total)} de {pagination.total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={offset === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!pagination.hasMore}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
