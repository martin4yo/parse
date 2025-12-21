'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, Activity, Pause, Play, BarChart, Webhook, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useCreateMutation, useDeleteMutation, useUpdateMutation } from '@/hooks/useApiMutation';
import OAuthWebhooksPanel from '@/components/api-clients/OAuthWebhooksPanel';

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

interface ClientStats {
  totalRequests: number;
  rateLimitHits: number;
  avgResponseTime: number;
  statusCodes: Array<{ code: number; count: number }>;
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
  const [viewingStats, setViewingStats] = useState<string | null>(null);
  const [clientStats, setClientStats] = useState<ClientStats | null>(null);
  const [expandedWebhooks, setExpandedWebhooks] = useState<string | null>(null);

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

  const loadClientStats = async (clientId: string) => {
    try {
      setViewingStats(clientId);
      const response = await api.get(`/oauth-clients/${clientId}/stats?days=30`);
      setClientStats(response.data.data);
    } catch (error: any) {
      console.error('Error cargando estadísticas:', error);
      toast.error('Error al cargar estadísticas');
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Key className="w-6 h-6 text-palette-dark" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">API Clients (OAuth 2.0)</h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Key className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">API Clients (OAuth 2.0)</h1>
            <p className="text-sm text-text-secondary">Gestiona clientes OAuth para la API pública</p>
          </div>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-primary/90 text-palette-dark"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Info Card */}
      <Card className="mb-6 border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <p className="text-sm text-text-secondary">
            <strong>API Pública:</strong> Los clientes OAuth permiten a sistemas externos acceder a tus documentos procesados
            mediante la API REST pública. Base URL: <code className="px-2 py-1 bg-gray-100 rounded text-xs">{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1</code>
          </p>
        </CardContent>
      </Card>

      {/* Lista de clientes */}
      {clients.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Key className="w-16 h-16 mx-auto text-text-tertiary mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No hay clientes OAuth</h3>
            <p className="text-text-secondary mb-4">Crea tu primer cliente OAuth para comenzar a usar la API pública</p>
            <Button
              onClick={() => setShowModal(true)}
              className="bg-primary hover:bg-primary/90 text-palette-dark"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Primer Cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {clients.map((client) => (
            <Card key={client.id} className={!client.activo ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-text-primary">{client.nombre}</h3>
                      {client.activo ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Activo</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">Inactivo</span>
                      )}
                    </div>

                    {client.descripcion && (
                      <p className="text-sm text-text-secondary mb-3">{client.descripcion}</p>
                    )}

                    {/* Client ID */}
                    <div className="mb-2">
                      <label className="text-xs text-text-tertiary block mb-1">Client ID</label>
                      <div className="flex items-center gap-2">
                        <code className="px-3 py-1.5 bg-gray-50 border rounded text-sm font-mono">
                          {client.clientId}
                        </code>
                        <button
                          onClick={() => handleCopy(client.clientId, 'Client ID')}
                          className="p-1.5 hover:bg-gray-100 rounded"
                        >
                          {copiedItem === 'Client ID' ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-text-tertiary" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Scopes */}
                    <div className="mb-3">
                      <label className="text-xs text-text-tertiary block mb-1">Scopes permitidos</label>
                      <div className="flex flex-wrap gap-1">
                        {client.allowedScopes.map(scope => (
                          <span key={scope} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Estadísticas */}
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                      <div>
                        <div className="text-xs text-text-tertiary">Total Requests</div>
                        <div className="text-lg font-semibold text-text-primary">
                          {client.totalRequests.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-tertiary">Último Uso</div>
                        <div className="text-sm text-text-secondary">
                          {client.ultimoUso
                            ? new Date(client.ultimoUso).toLocaleDateString()
                            : 'Nunca'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-tertiary">Rate Limit</div>
                        <div className="text-sm text-text-secondary">
                          {client.customRateLimit
                            ? `${client.requestsPerMinute}/min`
                            : 'Por defecto'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => setExpandedWebhooks(expandedWebhooks === client.clientId ? null : client.clientId)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="Ver webhooks"
                    >
                      <Webhook className="w-5 h-5 text-text-tertiary" />
                    </button>
                    <button
                      onClick={() => loadClientStats(client.clientId)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="Ver estadísticas"
                    >
                      <BarChart className="w-5 h-5 text-text-tertiary" />
                    </button>
                    <button
                      onClick={() => handleToggleActivo(client)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title={client.activo ? 'Desactivar' : 'Activar'}
                    >
                      {client.activo ? (
                        <Pause className="w-5 h-5 text-orange-600" />
                      ) : (
                        <Play className="w-5 h-5 text-green-600" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(client.clientId)}
                      className="p-2 hover:bg-red-50 rounded"
                      title="Eliminar"
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>

                {/* Panel de Webhooks Expandible */}
                {expandedWebhooks === client.clientId && (
                  <div className="mt-4 pt-4 border-t">
                    <OAuthWebhooksPanel clientId={client.clientId} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                    className="bg-primary hover:bg-primary/90 text-palette-dark"
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
                className="w-full bg-primary hover:bg-primary/90 text-palette-dark"
              >
                Entendido, he guardado el secret
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Estadísticas */}
      {viewingStats && clientStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-text-primary">Estadísticas (últimos 30 días)</h2>
                <button
                  onClick={() => {
                    setViewingStats(null);
                    setClientStats(null);
                  }}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{clientStats.totalRequests}</div>
                  <div className="text-xs text-blue-600">Total Requests</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700">{clientStats.rateLimitHits}</div>
                  <div className="text-xs text-orange-600">Rate Limit Hits</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{Math.round(clientStats.avgResponseTime)}ms</div>
                  <div className="text-xs text-green-600">Avg Response Time</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-text-primary mb-2">Status Codes</h3>
                <div className="space-y-1">
                  {clientStats.statusCodes.map(({ code, count }) => (
                    <div key={code} className="flex items-center justify-between text-sm">
                      <span className={`font-mono ${code >= 400 ? 'text-red-600' : 'text-green-600'}`}>
                        {code}
                      </span>
                      <span className="text-text-secondary">{count} requests</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => {
                  setViewingStats(null);
                  setClientStats(null);
                }}
                className="w-full mt-6 bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cerrar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
