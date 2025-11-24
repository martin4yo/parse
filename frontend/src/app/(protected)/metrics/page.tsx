'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Activity, FileText, Webhook, RefreshCw, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface OverviewMetrics {
  documentos: {
    total: number;
    procesados: number;
    errores: number;
    exportados: number;
    tasaExito: string;
  };
  sincronizacion: {
    pullJobs: number;
    pushJobs: number;
    total: number;
  };
  webhooks: {
    total: number;
    exitosos: number;
    fallidos: number;
    tasaExito: string;
  };
  periodo: {
    desde: string;
    hasta: string;
    dias: number;
  };
}

interface DocumentMetrics {
  porDia: Array<{
    fecha: string;
    total: number;
    completados: number;
    errores: number;
  }>;
  porTipo: Array<{
    tipo: string;
    count: number;
  }>;
  topErrores: Array<{
    errorMessage: string;
    count: number;
  }>;
}

interface WebhookMetrics {
  webhooks: Array<{
    webhookId: string;
    nombre: string;
    activo: boolean;
    total: number;
    exitosos: number;
    fallidos: number;
    tasaExito: string;
  }>;
  porDia: Array<{
    fecha: string;
    total: number;
    exitosos: number;
    fallidos: number;
  }>;
  porEvento: Array<{
    evento: string;
    count: number;
  }>;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function MetricsPage() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [documentMetrics, setDocumentMetrics] = useState<DocumentMetrics | null>(null);
  const [webhookMetrics, setWebhookMetrics] = useState<WebhookMetrics | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [days]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [overviewRes, docRes, webhookRes] = await Promise.all([
        api.get(`/metrics/overview?days=${days}`),
        api.get(`/metrics/documentos?days=${days}`),
        api.get(`/metrics/webhooks?days=${days}`)
      ]);

      setOverview(overviewRes.data.data);
      setDocumentMetrics(docRes.data.data);
      setWebhookMetrics(webhookRes.data.data);
    } catch (error: any) {
      console.error('Error cargando métricas:', error);
      toast.error('Error al cargar métricas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-purple-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Métricas</h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-purple-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Métricas</h1>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>

          <button
            onClick={loadMetrics}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-gray-900 font-medium rounded-lg hover:bg-yellow-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Documentos Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div className={`flex items-center gap-1 text-sm ${
                parseFloat(overview.documentos.tasaExito) >= 90 ? 'text-green-600' : 'text-red-600'
              }`}>
                {parseFloat(overview.documentos.tasaExito) >= 90 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {overview.documentos.tasaExito}%
              </div>
            </div>
            <h3 className="text-gray-600 text-sm mb-2">Documentos Procesados</h3>
            <p className="text-3xl font-bold text-gray-900 mb-4">{overview.documentos.total}</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Exitosos:</span>
                <span className="font-medium text-green-600">{overview.documentos.procesados}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Errores:</span>
                <span className="font-medium text-red-600">{overview.documentos.errores}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Exportados:</span>
                <span className="font-medium text-blue-600">{overview.documentos.exportados}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sincronización Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <RefreshCw className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm mb-2">Sincronizaciones</h3>
            <p className="text-3xl font-bold text-gray-900 mb-4">{overview.sincronizacion.total}</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">PULL (Importación):</span>
                <span className="font-medium text-blue-600">{overview.sincronizacion.pullJobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">PUSH (Exportación):</span>
                <span className="font-medium text-purple-600">{overview.sincronizacion.pushJobs}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhooks Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Webhook className="w-5 h-5 text-orange-600" />
              </div>
              <div className={`flex items-center gap-1 text-sm ${
                parseFloat(overview.webhooks.tasaExito) >= 90 ? 'text-green-600' : 'text-red-600'
              }`}>
                {parseFloat(overview.webhooks.tasaExito) >= 90 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {overview.webhooks.tasaExito}%
              </div>
            </div>
            <h3 className="text-gray-600 text-sm mb-2">Webhooks Enviados</h3>
            <p className="text-3xl font-bold text-gray-900 mb-4">{overview.webhooks.total}</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Exitosos:</span>
                <span className="font-medium text-green-600">{overview.webhooks.exitosos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fallidos:</span>
                <span className="font-medium text-red-600">{overview.webhooks.fallidos}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documentos Charts */}
      {documentMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Documentos por Día */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentos por Día</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={documentMetrics.porDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" />
                  <Line type="monotone" dataKey="completados" stroke="#10b981" name="Completados" />
                  <Line type="monotone" dataKey="errores" stroke="#ef4444" name="Errores" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Documentos por Tipo */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentos por Tipo</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={documentMetrics.porTipo}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => `${entry.tipo}: ${entry.count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {documentMetrics.porTipo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Errores */}
      {documentMetrics && documentMetrics.topErrores.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Errores Más Frecuentes</h3>
            <div className="space-y-3">
              {documentMetrics.topErrores.slice(0, 5).map((error, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-700 flex-1">{error.errorMessage}</span>
                  <span className="text-sm font-medium text-red-600 ml-4">{error.count} veces</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhooks Charts */}
      {webhookMetrics && webhookMetrics.porEvento.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Webhooks por Día */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhooks por Día</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={webhookMetrics.porDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="exitosos" fill="#10b981" name="Exitosos" />
                  <Bar dataKey="fallidos" fill="#ef4444" name="Fallidos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Webhooks por Evento */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhooks por Evento</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={webhookMetrics.porEvento}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="evento" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Webhooks Status */}
      {webhookMetrics && webhookMetrics.webhooks.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Webhooks</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Webhook</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Exitosos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fallidos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tasa Éxito</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {webhookMetrics.webhooks.map((webhook) => (
                    <tr key={webhook.webhookId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {webhook.nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          webhook.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {webhook.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{webhook.total}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">{webhook.exitosos}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">{webhook.fallidos}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={`font-medium ${
                          parseFloat(webhook.tasaExito) >= 90 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {webhook.tasaExito}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
