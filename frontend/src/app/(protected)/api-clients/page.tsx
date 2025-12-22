'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Key, Plus, Trash2, Copy, Check, Pause, Play, BarChart, Webhook, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useCreateMutation, useDeleteMutation, useUpdateMutation } from '@/hooks/useApiMutation';
import OAuthWebhooksPanel from '@/components/api-clients/OAuthWebhooksPanel';
import OAuthDashboard from '@/components/api-clients/OAuthDashboard';

interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret?: string; // Solo disponible al crear
  nombre: string;
  descripcion: string | null;
  allowedScopes: string[];
  activo: boolean;
  ultimoUso: string | null;
  totalRequests: number;
  customRateLimit: boolean;
  requestsPerMinute: number | null;
  requestsPerHour: number | null;
  requestsPerDay: number | null;
  createdAt: string;
  updatedAt: string;
}


const AVAILABLE_SCOPES = [
  { key: 'read:documents', label: 'Leer documentos', description: 'Consultar documentos procesados' },
  { key: 'write:documents', label: 'Escribir documentos', description: 'Marcar documentos como exportados' },
  { key: 'read:files', label: 'Leer archivos', description: 'Descargar archivos originales (PDF/imágenes)' },
];

export default function ApiClientsPage() {
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSecret, setShowSecret] = useState<OAuthClient | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [expandedWebhooks, setExpandedWebhooks] = useState<string | null>(null);
  const [expandedDashboard, setExpandedDashboard] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    allowedScopes: ['read:documents', 'write:documents'] as string[],
    customRateLimit: false,
    requestsPerMinute: 60,
    requestsPerHour: 3000,
    requestsPerDay: 50000
  });

  // Mutations
  const createMutation = useCreateMutation<OAuthClient>({
    successMessage: 'Cliente OAuth creado exitosamente',
    onSuccess: (newClient) => {
      setShowSecret(newClient); // Mostrar modal con el secret
      setClients([newClient, ...clients]);
      setShowModal(false);
      resetForm();
    },
  });

  const deleteMutation = useDeleteMutation({
    successMessage: 'Cliente OAuth eliminado',
    confirmMessage: '¿Estás seguro de eliminar este cliente? Esto revocará todos sus tokens activos.',
    onSuccess: () => {
      loadClients();
    },
  });

  const toggleMutation = useUpdateMutation<OAuthClient>({
    showSuccessToast: true,
    onSuccess: (updatedClient) => {
      setClients(clients.map(c =>
        c.id === updatedClient.id ? updatedClient : c
      ));
    },
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await api.get('/oauth-clients');
      setClients(response.data.data);
    } catch (error: any) {
      console.error('Error cargando clientes OAuth:', error);
      toast.error('Error al cargar clientes OAuth');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      allowedScopes: ['read:documents', 'write:documents'],
      customRateLimit: false,
      requestsPerMinute: 60,
      requestsPerHour: 3000,
      requestsPerDay: 50000
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre || formData.allowedScopes.length === 0) {
      toast.error('El nombre y al menos un scope son requeridos');
      return;
    }

    createMutation.mutate(() => api.post('/oauth-clients', formData));
  };

  const handleDelete = (clientId: string) => {
    deleteMutation.mutate(() => api.delete(`/oauth-clients/${clientId}`));
  };

  const handleToggleActivo = (client: OAuthClient) => {
    const message = client.activo ? 'Cliente desactivado' : 'Cliente activado';
    toggleMutation.mutate(() =>
      api.put(`/oauth-clients/${client.clientId}`, { activo: !client.activo })
        .then(res => {
          toast.success(message);
          return res;
        })
    );
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    toast.success(`${label} copiado al portapapeles`);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const toggleScopeSelection = (scope: string) => {
    setFormData(prev => ({
      ...prev,
      allowedScopes: prev.allowedScopes.includes(scope)
        ? prev.allowedScopes.filter(s => s !== scope)
        : [...prev.allowedScopes, scope]
    }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
            <Key className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">API Clients (OAuth 2.0)</h1>
            <p className="text-text-secondary mt-1">Gestiona clientes OAuth para la API pública de consulta de documentos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadClients}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            onClick={() => setShowModal(true)}
            className="bg-palette-dark hover:bg-sidebar-hover text-palette-yellow"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
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
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No hay clientes OAuth configurados</p>
              <Button
                onClick={() => setShowModal(true)}
                className="mt-4 bg-palette-dark hover:bg-sidebar-hover text-palette-yellow"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Cliente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Último Uso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <>
                    <TableRow key={client.id} className={!client.activo ? 'opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{client.nombre}</div>
                          {client.descripcion && (
                            <div className="text-xs text-gray-500">{client.descripcion}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {client.clientId.substring(0, 20)}...
                          </code>
                          <button
                            onClick={() => handleCopy(client.clientId, client.clientId)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Copiar Client ID"
                          >
                            {copiedItem === client.clientId ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {client.allowedScopes.map(scope => (
                            <Badge key={scope} variant="default" className="text-xs">
                              {scope.replace(':', ': ')}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{client.totalRequests.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">
                            {client.customRateLimit ? `${client.requestsPerMinute}/min` : 'Sin límite custom'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.ultimoUso ? (
                          <div className="text-sm">
                            {new Date(client.ultimoUso).toLocaleDateString('es-AR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-400">Nunca</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={client.activo ? 'default' : 'secondary'}>
                          {client.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedDashboard(expandedDashboard === client.clientId ? null : client.clientId)}
                            title="Dashboard de métricas"
                            className={expandedDashboard === client.clientId ? 'bg-gray-100' : ''}
                          >
                            <BarChart className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedWebhooks(expandedWebhooks === client.clientId ? null : client.clientId)}
                            title="Webhooks"
                            className={expandedWebhooks === client.clientId ? 'bg-gray-100' : ''}
                          >
                            <Webhook className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActivo(client)}
                            title={client.activo ? 'Desactivar' : 'Activar'}
                          >
                            {client.activo ? (
                              <Pause className="h-4 w-4 text-orange-600" />
                            ) : (
                              <Play className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(client.clientId)}
                            className="text-red-600 hover:text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Panel de Dashboard Expandible */}
                    {expandedDashboard === client.clientId && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-gray-50 p-4">
                          <OAuthDashboard clientId={client.clientId} />
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Panel de Webhooks Expandible */}
                    {expandedWebhooks === client.clientId && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-gray-50 p-4">
                          <OAuthWebhooksPanel clientId={client.clientId} />
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

      {/* Modal Crear Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-text-primary mb-4">Nuevo Cliente OAuth</h2>

              <form onSubmit={handleSubmit}>
                {/* Nombre */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ej: Mi Sistema ERP"
                  />
                </div>

                {/* Descripción */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Descripción opcional del cliente"
                    rows={2}
                  />
                </div>

                {/* Scopes */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Scopes permitidos <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {AVAILABLE_SCOPES.map(scope => (
                      <label key={scope.key} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.allowedScopes.includes(scope.key)}
                          onChange={() => toggleScopeSelection(scope.key)}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-sm">{scope.label}</div>
                          <div className="text-xs text-text-tertiary">{scope.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Rate Limiting Personalizado */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.customRateLimit}
                      onChange={(e) => setFormData({ ...formData, customRateLimit: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-text-primary">Configurar rate limit personalizado</span>
                  </label>

                  {formData.customRateLimit && (
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">Por minuto</label>
                        <input
                          type="number"
                          value={formData.requestsPerMinute}
                          onChange={(e) => setFormData({ ...formData, requestsPerMinute: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">Por hora</label>
                        <input
                          type="number"
                          value={formData.requestsPerHour}
                          onChange={(e) => setFormData({ ...formData, requestsPerHour: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">Por día</label>
                        <input
                          type="number"
                          value={formData.requestsPerDay}
                          onChange={(e) => setFormData({ ...formData, requestsPerDay: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Botones */}
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-palette-dark hover:bg-sidebar-hover text-palette-yellow"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Creando...' : 'Crear Cliente'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal mostrar Secret (solo al crear) */}
      {showSecret && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-text-primary mb-2">Cliente OAuth creado exitosamente</h2>
                <p className="text-text-secondary text-sm">
                  ⚠️ <strong>IMPORTANTE:</strong> Guarda el Client Secret en un lugar seguro. No podrás verlo nuevamente.
                </p>
              </div>

              {/* Client ID */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-primary mb-1">Client ID</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 border rounded font-mono text-sm break-all">
                    {showSecret.clientId}
                  </code>
                  <button
                    onClick={() => handleCopy(showSecret.clientId, 'Client ID')}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    {copiedItem === 'Client ID' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Client Secret */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-1">Client Secret</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-yellow-50 border-2 border-yellow-400 rounded font-mono text-sm break-all">
                    {showSecret.clientSecret}
                  </code>
                  <button
                    onClick={() => handleCopy(showSecret.clientSecret!, 'Client Secret')}
                    className="p-2 hover:bg-yellow-100 rounded"
                  >
                    {copiedItem === 'Client Secret' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                onClick={() => setShowSecret(null)}
                className="w-full bg-palette-dark hover:bg-sidebar-hover text-palette-yellow"
              >
                Entendido, he guardado el secret
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
