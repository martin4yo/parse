'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Plus, Edit, Trash2, RefreshCw, Database, Eye } from 'lucide-react';
import { SyncConfiguration } from '@/types/sync';
import { toast } from 'sonner';

export default function SyncAdminPage() {
  const router = useRouter();
  const [configurations, setConfigurations] = useState<SyncConfiguration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sync/configurations');
      const data = await response.json();

      if (data.success) {
        setConfigurations(data.data);
      } else {
        toast.error('Error al cargar configuraciones');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta configuración?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sync/configurations/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Configuración eliminada');
        fetchConfigurations();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar configuración');
    }
  };

  const handleToggleActive = async (config: SyncConfiguration) => {
    try {
      const response = await fetch(`/api/sync/configurations/${config.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activo: !config.activo,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          config.activo ? 'Sincronización deshabilitada' : 'Sincronización habilitada'
        );
        fetchConfigurations();
      } else {
        toast.error(data.error || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar configuración');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
            <Database className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Administración de Sincronización
            </h1>
            <p className="text-text-secondary mt-1">
              Configura la sincronización bidireccional entre SQL Server y PostgreSQL
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchConfigurations}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => router.push('/sync-admin/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Configuración
          </Button>
        </div>
      </div>

      {/* Content Card */}
      <Card>
        <CardContent className="!p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : configurations.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay configuraciones
              </h3>
              <p className="text-gray-500 mb-4">
                Crea tu primera configuración de sincronización
              </p>
              <Button onClick={() => router.push('/sync-admin/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Configuración
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>SQL Server</TableHead>
                  <TableHead>Base de Datos</TableHead>
                  <TableHead>Tablas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última Modificación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configurations.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{config.tenant?.nombre}</p>
                        <p className="text-sm text-gray-500">{config.tenant?.cuit}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {config.sqlServerHost}:{config.sqlServerPort}
                    </TableCell>
                    <TableCell>{config.sqlServerDatabase}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          ↑ {config.configuracionTablas?.tablasSubida?.length || 0}
                        </Badge>
                        <Badge variant="outline">
                          ↓ {config.configuracionTablas?.tablasBajada?.length || 0}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.activo ? 'default' : 'secondary'}>
                        {config.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(config.updatedAt).toLocaleDateString('es-AR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/sync-admin/${config.id}/edit`)}
                          title="Editar configuración"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/sync-admin/sync-logs?tenant=${config.tenantId}`)}
                          title="Ver logs"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(config)}
                          title={config.activo ? 'Deshabilitar' : 'Habilitar'}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(config.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tarjeta de acceso rápido a logs */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Acceso Rápido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => router.push('/sync-admin/sync-logs')}
            >
              <Database className="h-4 w-4 mr-2" />
              Ver Todos los Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
