'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Webhook, Plus, Trash2, Eye, EyeOff, Copy, Check, Activity, Pause, Play, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface OAuthWebhook {
  id: string;
  nombre: string;
  url: string;
  secret: string;
  eventos: string[];
  activo: boolean;
  ultimoEnvio: string | null;
  totalEnviado: number;
  totalExitoso: number;
  totalFallido: number;
  createdAt: string;
  updatedAt: string;
}

interface EventoDisponible {
  key: string;
  value: string;
  description: string;
}

interface OAuthWebhooksPanelProps {
  clientId: string;
}

export default function OAuthWebhooksPanel({ clientId }: OAuthWebhooksPanelProps) {
  const [webhooks, setWebhooks] = useState<OAuthWebhook[]>([]);
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

  useEffect(() => {
    loadWebhooks();
    loadEventosDisponibles();
  }, [clientId]);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/oauth-clients/${clientId}/webhooks`);
      setWebhooks(response.data.data || []);
    } catch (error: any) {
      console.error('Error cargando webhooks OAuth:', error);
      toast.error('Error al cargar webhooks');
    } finally {
      setLoading(false);
    }
  };

  const loadEventosDisponibles = async () => {
    try {
      const response = await api.get(`/oauth-clients/${clientId}/webhooks-eventos`);
      setEventosDisponibles(response.data.data || []);
    } catch (error: any) {
      console.error('Error cargando eventos:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre || !formData.url || formData.eventos.length === 0) {
      toast.error('Completa todos los campos y selecciona al menos un evento');
      return;
    }

    try {
      const response = await api.post(`/oauth-clients/${clientId}/webhooks`, formData);
      const newWebhook = response.data.data;

      setShowSecret(newWebhook.id);
      setWebhooks([newWebhook, ...webhooks]);
      setShowModal(false);
      setFormData({ nombre: '', url: '', eventos: [] });
      toast.success('Webhook creado exitosamente. Guarda el secret, no podrás verlo después.');
    } catch (error: any) {
      console.error('Error creando webhook:', error);
      toast.error(error.response?.data?.error || 'Error al crear webhook');
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm('¿Estás seguro de eliminar este webhook?')) {
      return;
    }

    try {
      await api.delete(`/oauth-clients/${clientId}/webhooks/${webhookId}`);
      setWebhooks(webhooks.filter(w => w.id !== webhookId));
      toast.success('Webhook eliminado');
    } catch (error: any) {
      console.error('Error eliminando webhook:', error);
      toast.error('Error al eliminar webhook');
    }
  };

  const handleToggleActivo = async (webhook: OAuthWebhook) => {
    try {
      const response = await api.put(`/oauth-clients/${clientId}/webhooks/${webhook.id}`, {
        activo: !webhook.activo
      });

      setWebhooks(webhooks.map(w =>
        w.id === webhook.id ? response.data.data : w
      ));
      toast.success(webhook.activo ? 'Webhook desactivado' : 'Webhook activado');
    } catch (error: any) {
      console.error('Error actualizando webhook:', error);
      toast.error('Error al actualizar webhook');
    }
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

  const getTasaExito = (webhook: OAuthWebhook) => {
    if (webhook.totalEnviado === 0) return 0;
    return ((webhook.totalExitoso / webhook.totalEnviado) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-text-secondary">Cargando webhooks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-text-secondary" />
          <h3 className="text-lg font-semibold text-text-primary">Webhooks</h3>
          <span className="text-sm text-text-tertiary">({webhooks.length})</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-palette-dark text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Crear Webhook
        </button>
      </div>

      {/* Info Alert */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">Webhooks OAuth - Notificaciones en Tiempo Real</p>
          <p className="text-blue-700">
            Los webhooks te permiten recibir notificaciones HTTP cuando ocurren eventos en la API (documento accedido, exportado, descargado, etc.).
            Debes validar la firma HMAC en cada webhook para verificar su autenticidad.
          </p>
        </div>
      </div>

      {/* Lista de Webhooks */}
      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Webhook className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-gray-900 mb-2">No hay webhooks configurados</h4>
            <p className="text-sm text-gray-600 mb-4">
              Crea un webhook para recibir notificaciones automáticas de eventos
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-palette-dark font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear Webhook
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className={!webhook.activo ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-base font-semibold text-gray-900 truncate">{webhook.nombre}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        webhook.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {webhook.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-medium">URL:</span>
                        <code className="px-2 py-0.5 bg-gray-100 rounded text-xs truncate max-w-md">{webhook.url}</code>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-medium">Secret:</span>
                        {showSecret === webhook.id ? (
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 rounded text-xs font-mono">
                              {webhook.secret}
                            </code>
                            <button
                              onClick={() => handleCopySecret(webhook.secret, webhook.id)}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Copiar secret"
                            >
                              {copiedSecret === webhook.id ? (
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-gray-600" />
                              )}
                            </button>
                            <button
                              onClick={() => setShowSecret(null)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowSecret(webhook.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Eye className="w-3 h-3" />
                            Mostrar
                          </button>
                        )}
                      </div>

                      <div className="flex items-start gap-2 text-gray-600">
                        <span className="font-medium">Eventos:</span>
                        <div className="flex flex-wrap gap-1">
                          {webhook.eventos.map((evento: string) => (
                            <span key={evento} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">
                              {evento}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-gray-600">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Enviados:</span>
                          <span>{webhook.totalEnviado}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Exitosos:</span>
                          <span className="text-green-600">{webhook.totalExitoso}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Fallidos:</span>
                          <span className="text-red-600">{webhook.totalFallido}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Tasa éxito:</span>
                          <span className={Number(getTasaExito(webhook)) >= 95 ? 'text-green-600' : 'text-yellow-600'}>
                            {getTasaExito(webhook)}%
                          </span>
                        </div>
                      </div>

                      {webhook.ultimoEnvio && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="font-medium">Último envío:</span>
                          <span className="text-xs">{new Date(webhook.ultimoEnvio).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
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
              <h2 className="text-xl font-bold text-gray-900 mb-6">Crear Webhook OAuth</h2>

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
                    placeholder="Ej: Webhook ERP Production"
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
                    La URL debe ser accesible desde internet y usar HTTPS en producción
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
                          <div className="text-xs text-gray-600">{evento.description}</div>
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
