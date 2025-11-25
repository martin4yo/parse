'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Webhook, Plus, Trash2, Eye, EyeOff, Copy, Check, Activity, Pause, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useCreateMutation, useDeleteMutation, useUpdateMutation } from '@/hooks/useApiMutation';

interface Webhook {
  id: string;
  nombre: string;
  url: string;
  secret: string;
  eventos: string[];
  activo: boolean;
  ultimoEnvio: string | null;
  createdAt: string;
}

interface EventoDisponible {
  key: string;
  value: string;
  descripcion: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [eventosDisponibles, setEventosDisponibles] = useState<EventoDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    url: '',
    eventos: [] as string[]
  });

  // Mutations
  const createMutation = useCreateMutation<Webhook>({
    successMessage: 'Webhook creado exitosamente',
    onSuccess: (newWebhook) => {
      setShowSecret(newWebhook.id);
      setWebhooks([newWebhook, ...webhooks]);
      setShowModal(false);
      setFormData({ nombre: '', url: '', eventos: [] });
    },
  });

  const deleteMutation = useDeleteMutation({
    successMessage: 'Webhook eliminado',
    confirmMessage: '¿Estás seguro de eliminar este webhook?',
    onSuccess: () => {
      loadWebhooks();
    },
  });

  const toggleMutation = useUpdateMutation<Webhook>({
    showSuccessToast: true,
    onSuccess: (updatedWebhook) => {
      setWebhooks(webhooks.map(w =>
        w.id === updatedWebhook.id ? updatedWebhook : w
      ));
    },
  });

  useEffect(() => {
    loadWebhooks();
    loadEventosDisponibles();
  }, []);

  const loadWebhooks = async () => {
    try {
      const response = await api.get('/webhooks');
      setWebhooks(response.data.data);
    } catch (error: any) {
      console.error('Error cargando webhooks:', error);
      toast.error('Error al cargar webhooks');
    } finally {
      setLoading(false);
    }
  };

  const loadEventosDisponibles = async () => {
    try {
      const response = await api.get('/webhooks/eventos/disponibles');
      setEventosDisponibles(response.data.data);
    } catch (error: any) {
      console.error('Error cargando eventos:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre || !formData.url || formData.eventos.length === 0) {
      toast.error('Completa todos los campos');
      return;
    }

    createMutation.mutate(() => api.post('/webhooks', formData));
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(() => api.delete(`/webhooks/${id}`));
  };

  const handleToggleActivo = (webhook: Webhook) => {
    const message = webhook.activo ? 'Webhook desactivado' : 'Webhook activado';
    toggleMutation.mutate(() =>
      api.put(`/webhooks/${webhook.id}`, { activo: !webhook.activo })
        .then(res => {
          toast.success(message);
          return res;
        })
    );
  };

  const handleCopySecret = (secret: string, id: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(id);
    toast.success('Secret copiado al portapapeles');
    setTimeout(() => setCopiedSecret(null), 2000);
  };

  const toggleEventoSelection = (evento: string) => {
    setFormData(prev => ({
      ...prev,
      eventos: prev.eventos.includes(evento)
        ? prev.eventos.filter(e => e !== evento)
        : [...prev.eventos, evento]
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Webhook className="w-6 h-6 text-palette-dark" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Webhooks</h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">Cargando webhooks...</p>
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
            <Webhook className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Webhooks</h1>
            <p className="text-sm text-text-secondary">Notificaciones automáticas de eventos</p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-palette-dark text-palette-yellow font-medium rounded-lg hover:bg-palette-dark/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Crear Webhook
        </button>
      </div>

      {/* Lista de Webhooks */}
      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Webhook className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay webhooks configurados</h3>
            <p className="text-gray-600 mb-6">
              Los webhooks te permiten recibir notificaciones automáticas cuando ocurren eventos en Parse
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-palette-dark text-palette-yellow font-medium rounded-lg hover:bg-palette-dark/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear tu primer webhook
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{webhook.nombre}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        webhook.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {webhook.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">URL:</span>
                        <code className="px-2 py-1 bg-gray-100 rounded text-xs">{webhook.url}</code>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Secret:</span>
                        {showSecret === webhook.id ? (
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs font-mono">
                              {webhook.secret}
                            </code>
                            <button
                              onClick={() => handleCopySecret(webhook.secret, webhook.id)}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Copiar secret"
                            >
                              {copiedSecret === webhook.id ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                            <button
                              onClick={() => setShowSecret(null)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <EyeOff className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowSecret(webhook.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Eye className="w-3 h-3" />
                            Mostrar
                          </button>
                        )}
                      </div>

                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="font-medium">Eventos:</span>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(webhook.eventos) ? webhook.eventos : JSON.parse(webhook.eventos || '[]')).map((evento: string) => (
                            <span key={evento} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">
                              {evento}
                            </span>
                          ))}
                        </div>
                      </div>

                      {webhook.ultimoEnvio && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Último envío:</span>
                          <span>{new Date(webhook.ultimoEnvio).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.location.href = `/webhooks/${webhook.id}/stats`}
                      className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Ver estadísticas"
                    >
                      <Activity className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleActivo(webhook)}
                      className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title={webhook.activo ? 'Desactivar' : 'Activar'}
                    >
                      {webhook.activo ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(webhook.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Crear Webhook */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Crear Webhook</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ej: Notificaciones a ERP"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL del Webhook
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="https://tu-sistema.com/webhooks/parse"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    La URL debe ser accesible desde internet y usar HTTPS
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Eventos a recibir
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {eventosDisponibles.map((evento) => (
                      <label key={evento.value} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.eventos.includes(evento.value)}
                          onChange={() => toggleEventoSelection(evento.value)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">{evento.value}</div>
                          <div className="text-xs text-gray-600">{evento.descripcion}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {formData.eventos.length === 0 && (
                    <p className="mt-2 text-sm text-red-600">Selecciona al menos un evento</p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-palette-dark text-palette-yellow font-medium rounded-lg hover:bg-palette-dark/90 transition-colors"
                  >
                    Crear Webhook
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setFormData({ nombre: '', url: '', eventos: [] });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
