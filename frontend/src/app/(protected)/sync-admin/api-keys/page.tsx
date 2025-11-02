'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Plus, Key, Trash2, RefreshCw, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Select } from '@/components/ui/Select';
import { useConfirmDialog } from '@/hooks/useConfirm';

interface Tenant {
  id: string;
  nombre: string;
  slug: string;
}

interface ApiKey {
  id: string;
  nombre: string;
  keyPreview: string;
  permisos: {
    sync?: boolean;
    logs?: boolean;
    admin?: boolean;
  };
  activo: boolean;
  ultimoUso: string | null;
  ultimoUsoIp: string | null;
  vecesUtilizada: number;
  expiraEn: string | null;
  createdAt: string;
  tenantId: string;
  tenants: {
    nombre: string;
    slug: string;
  };
}

export default function ApiKeysPage() {
  const { confirm } = useConfirmDialog();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{
    plainKey?: string;
    data?: ApiKey;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    tenantId: '',
    nombre: '',
    permisos: {
      sync: true,
      logs: true,
      admin: false,
    },
    expiraEn: '',
  });

  useEffect(() => {
    fetchApiKeys();
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants?activo=true');
      const data = await response.json();
      if (data.success) {
        setTenants(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sync/api-keys');
      const data = await response.json();

      if (data.success) {
        setApiKeys(data.data);
      } else {
        toast.error('Error al cargar API keys');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tenantId || !formData.nombre) {
      toast.error('Tenant y nombre son requeridos');
      return;
    }

    try {
      const response = await fetch('/api/sync/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setNewKeyData(data.data);
        setIsModalOpen(false);
        fetchApiKeys();
        // Resetear form
        setFormData({
          tenantId: '',
          nombre: '',
          permisos: {
            sync: true,
            logs: true,
            admin: false,
          },
          expiraEn: '',
        });
        toast.success('API key creada exitosamente');
      } else {
        toast.error(data.error || 'Error al crear API key');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear API key');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm(
      '¿Está seguro de eliminar esta API key? Esta acción no se puede deshacer.',
      'Confirmar eliminación',
      'danger'
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/sync/api-keys/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('API key eliminada');
        fetchApiKeys();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar API key');
    }
  };

  const handleToggleActive = async (apiKey: ApiKey) => {
    try {
      const response = await fetch(`/api/sync/api-keys/${apiKey.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activo: !apiKey.activo,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          apiKey.activo ? 'API key deshabilitada' : 'API key habilitada'
        );
        fetchApiKeys();
      } else {
        toast.error(data.error || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar API key');
    }
  };

  const handleRegenerate = async (id: string) => {
    const confirmed = await confirm(
      '¿Está seguro de regenerar esta API key? La clave actual dejará de funcionar inmediatamente.',
      'Regenerar API Key',
      'warning'
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/sync/api-keys/${id}/regenerate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setNewKeyData(data.data);
        fetchApiKeys();
        toast.success('API key regenerada');
      } else {
        toast.error(data.error || 'Error al regenerar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al regenerar API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast.success('Copiado al portapapeles');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Nueva API Key Modal */}
      {newKeyData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-2xl w-full mx-4">
            <CardHeader>
              <CardTitle className="text-green-600 flex items-center gap-2">
                <Check className="h-6 w-6" />
                ¡API Key Creada!
              </CardTitle>
              <CardDescription className="text-red-600 font-semibold">
                ⚠️ Esta es la única vez que verás la clave completa. Guárdala en un lugar seguro.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  API Key
                </label>
                <div className="flex gap-2">
                  <Input
                    value={newKeyData.plainKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={() => copyToClipboard(newKeyData.plainKey!)}
                    variant="outline"
                  >
                    {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Uso en el cliente de sincronización:</strong>
                  <br />
                  <code className="block mt-2 p-2 bg-white rounded">
                    ax-sync-client.exe init --url https://backend.com --tenant {newKeyData.data?.tenantId} --key {newKeyData.plainKey}
                  </code>
                </p>
              </div>
              <Button onClick={() => setNewKeyData(null)} className="w-full">
                Entendido, he guardado la clave
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle>Nueva API Key</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tenant *
                  </label>
                  <Select
                    value={formData.tenantId}
                    onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar tenant</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.nombre} ({tenant.slug})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <Input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                    placeholder="Ej: Servidor Producción"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permisos
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.permisos.sync}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            permisos: { ...formData.permisos, sync: e.target.checked },
                          })
                        }
                        className="mr-2"
                      />
                      <span className="text-sm">Sincronización</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.permisos.logs}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            permisos: { ...formData.permisos, logs: e.target.checked },
                          })
                        }
                        className="mr-2"
                      />
                      <span className="text-sm">Logs</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiración (opcional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={formData.expiraEn}
                    onChange={(e) => setFormData({ ...formData, expiraEn: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Crear API Key
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Card */}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
            <Key className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              API Keys de Sincronización
            </h1>
            <p className="text-text-secondary mt-1">
              Gestiona las claves de API para autenticar los clientes de sincronización
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchApiKeys}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva API Key
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
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No hay API keys configuradas</p>
              <Button onClick={() => setIsModalOpen(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera API Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Key Preview</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Último Uso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">{apiKey.nombre}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{apiKey.tenants.nombre}</div>
                        <div className="text-xs text-gray-500">{apiKey.tenants.slug}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {apiKey.keyPreview}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {apiKey.permisos.sync && (
                          <Badge variant="default" className="text-xs">Sync</Badge>
                        )}
                        {apiKey.permisos.logs && (
                          <Badge variant="default" className="text-xs">Logs</Badge>
                        )}
                        {apiKey.permisos.admin && (
                          <Badge variant="default" className="text-xs">Admin</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {apiKey.ultimoUso ? (
                        <div>
                          <div className="text-sm">
                            {new Date(apiKey.ultimoUso).toLocaleDateString('es-AR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {apiKey.vecesUtilizada} usos
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={apiKey.activo ? 'default' : 'secondary'}>
                        {apiKey.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerate(apiKey.id)}
                          title="Regenerar clave"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(apiKey)}
                          title={apiKey.activo ? 'Deshabilitar' : 'Habilitar'}
                        >
                          {apiKey.activo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(apiKey.id)}
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
    </div>
  );
}
