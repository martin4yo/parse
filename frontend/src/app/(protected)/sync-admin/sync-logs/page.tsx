'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Database,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { SyncLog, SyncStats } from '@/types/sync';
import { toast } from 'sonner';

export default function SyncLogsPage() {
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [tenantId, setTenantId] = useState(searchParams.get('tenant') || '');
  const [tabla, setTabla] = useState('');
  const [estado, setEstado] = useState('');
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    fetchLogs();
    if (tenantId) {
      fetchStats();
    }
  }, [tenantId, tabla, estado, limit]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (tenantId) params.append('tenantId', tenantId);
      if (tabla) params.append('tabla', tabla);
      if (estado) params.append('estado', estado);
      params.append('limit', limit.toString());

      const response = await fetch(`/api/sync/logs?${params}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data);
      } else {
        toast.error('Error al cargar logs');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/sync/stats/${tenantId}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error al cargar stats:', error);
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'exitoso':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Exitoso
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case 'parcial':
        return (
          <Badge variant="secondary">
            <AlertCircle className="h-3 w-3 mr-1" />
            Parcial
          </Badge>
        );
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const getDireccionIcon = (direccion: string) => {
    return direccion === 'upload' ? (
      <ArrowUp className="h-4 w-4 text-blue-500" />
    ) : (
      <ArrowDown className="h-4 w-4 text-green-500" />
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Sincronizaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.porEstado.reduce((sum, e) => sum + e._count.id, 0)}
              </div>
              <p className="text-xs text-gray-500">Últimos 30 días</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Tasa de Éxito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {(() => {
                  const total = stats.porEstado.reduce(
                    (sum, e) => sum + e._count.id,
                    0
                  );
                  const exitosos =
                    stats.porEstado.find((e) => e.estado === 'exitoso')?._count
                      .id || 0;
                  return total > 0 ? ((exitosos / total) * 100).toFixed(1) : 0;
                })()}
                %
              </div>
              <p className="text-xs text-gray-500">
                {stats.porEstado.find((e) => e.estado === 'exitoso')?._count.id || 0}{' '}
                exitosos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Última Sincronización
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {stats.ultimaSincronizacion ? (
                  <>
                    <p className="font-medium">
                      {stats.ultimaSincronizacion.tabla}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(
                        stats.ultimaSincronizacion.createdAt
                      ).toLocaleString('es-AR')}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500">Sin sincronizaciones</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros y Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Database className="h-6 w-6" />
                Logs de Sincronización
              </CardTitle>
              <CardDescription>
                Historial de ejecuciones de sincronización
              </CardDescription>
            </div>
            <Button onClick={fetchLogs} variant="outline" disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-gray-50">
            <div>
              <Label htmlFor="tenantFilter">Tenant ID</Label>
              <Input
                id="tenantFilter"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Filtrar por tenant"
              />
            </div>

            <div>
              <Label htmlFor="tablaFilter">Tabla</Label>
              <Input
                id="tablaFilter"
                value={tabla}
                onChange={(e) => setTabla(e.target.value)}
                placeholder="Filtrar por tabla"
              />
            </div>

            <div>
              <Label htmlFor="estadoFilter">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="exitoso">Exitoso</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="limitFilter">Límite</Label>
              <Select
                value={limit.toString()}
                onValueChange={(v) => setLimit(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabla de Logs */}
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay logs
              </h3>
              <p className="text-gray-500">
                No se encontraron registros con los filtros aplicados
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Tabla</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.createdAt).toLocaleString('es-AR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {log.tenant?.nombre || log.tenantId}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{log.tabla}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getDireccionIcon(log.direccion)}
                          <span className="text-sm capitalize">
                            {log.direccion}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.fase && (
                          <Badge variant="outline" className="text-xs">
                            {log.fase}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getEstadoBadge(log.estado)}</TableCell>
                      <TableCell className="text-right">
                        {log.registrosAfectados !== null
                          ? log.registrosAfectados.toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {log.duracionMs !== null
                          ? `${log.duracionMs}ms`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm">
                          {log.mensaje || '-'}
                        </div>
                        {log.errorDetalle && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs truncate">
                            {log.errorDetalle}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
