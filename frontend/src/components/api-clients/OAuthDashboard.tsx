'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { BarChart3, TrendingUp, Clock, AlertTriangle, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
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

interface DashboardMetrics {
  clientId: string;
  nombre: string;
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalRequests: number;
    rateLimitHits: number;
    avgResponseTime: number;
    errorCount: number;
    errorRate: string;
  };
  charts: {
    requestsByDay: Array<{ date: string; count: number }>;
    requestsByHour: Array<{ hour: number; count: number }>;
    latencyByDay: Array<{ date: string; avgLatency: number; minLatency: number; maxLatency: number }>;
    rateLimitByDay: Array<{ date: string; count: number }>;
    statusCodes: Array<{ category: string; code: number; count: number }>;
    topEndpoints: Array<{ endpoint: string; count: number }>;
    errorsByEndpoint: Array<{ endpoint: string; count: number }>;
  };
}

interface OAuthDashboardProps {
  clientId: string;
}

const STATUS_COLORS: Record<string, string> = {
  success: '#10b981',       // green-500
  redirect: '#3b82f6',      // blue-500
  client_error: '#f59e0b',  // amber-500
  server_error: '#ef4444',  // red-500
  unknown: '#6b7280'        // gray-500
};

const STATUS_LABELS: Record<string, string> = {
  success: 'Éxito (2xx)',
  redirect: 'Redirección (3xx)',
  client_error: 'Error Cliente (4xx)',
  server_error: 'Error Servidor (5xx)',
  unknown: 'Desconocido'
};

export default function OAuthDashboard({ clientId }: OAuthDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadMetrics();
  }, [clientId, days]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/oauth-clients/${clientId}/dashboard?days=${days}`);
      setMetrics(response.data.data);
    } catch (error: any) {
      console.error('Error cargando métricas:', error);
      toast.error('Error al cargar métricas del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });
  };

  const exportToCSV = () => {
    if (!metrics) return;

    // Crear CSV con todas las métricas
    const csvLines = [
      // Header
      'Tipo,Fecha/Hora,Valor,Extra',
      // Requests por día
      ...metrics.charts.requestsByDay.map(item =>
        `Requests por día,${item.date},${item.count},`
      ),
      // Latencia
      ...metrics.charts.latencyByDay.map(item =>
        `Latencia promedio,${item.date},${item.avgLatency},min:${item.minLatency}|max:${item.maxLatency}`
      ),
      // Top endpoints
      ...metrics.charts.topEndpoints.map(item =>
        `Top endpoint,${item.endpoint},${item.count},`
      )
    ];

    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${clientId}-${days}days.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-text-secondary">Cargando dashboard...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600">No se pudieron cargar las métricas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-text-secondary" />
          <h3 className="text-lg font-semibold text-text-primary">Dashboard de Métricas</h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector de período */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-tertiary" />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={365}>Último año</option>
            </select>
          </div>

          {/* Botón exportar */}
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wide">Total Requests</p>
                <p className="text-2xl font-bold text-text-primary mt-1">
                  {metrics.summary.totalRequests.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wide">Latencia Promedio</p>
                <p className="text-2xl font-bold text-text-primary mt-1">
                  {metrics.summary.avgResponseTime}ms
                </p>
              </div>
              <Clock className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wide">Tasa de Error</p>
                <p className="text-2xl font-bold text-text-primary mt-1">
                  {metrics.summary.errorRate}%
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {metrics.summary.errorCount} errores
                </p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${Number(metrics.summary.errorRate) > 5 ? 'text-red-500' : 'text-yellow-500'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wide">Rate Limit Hits</p>
                <p className="text-2xl font-bold text-text-primary mt-1">
                  {metrics.summary.rateLimitHits}
                </p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${metrics.summary.rateLimitHits > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests por día */}
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Requests por Día</h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics.charts.requestsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                  labelFormatter={(value) => formatDate(value as string)}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Requests"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Requests por hora */}
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Distribución por Hora del Día</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.charts.requestsByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                  tickFormatter={(hour) => `${hour}h`}
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                  labelFormatter={(hour) => `Hora ${hour}:00`}
                />
                <Bar dataKey="count" fill="#10b981" name="Requests" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Latencia promedio */}
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Latencia por Día</h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics.charts.latencyByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                  labelFormatter={(value) => formatDate(value as string)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgLatency"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 3 }}
                  name="Promedio (ms)"
                />
                <Line
                  type="monotone"
                  dataKey="minLatency"
                  stroke="#10b981"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Mínimo (ms)"
                />
                <Line
                  type="monotone"
                  dataKey="maxLatency"
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Máximo (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status codes */}
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Distribución de Status Codes</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={metrics.charts.statusCodes}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry: any) => `${STATUS_LABELS[entry.category]}: ${entry.count}`}
                  labelLine={{ stroke: '#6b7280' }}
                >
                  {metrics.charts.statusCodes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.category]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                  formatter={(value: any, name?: string) => [value, name ? (STATUS_LABELS[name] || name) : '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top endpoints */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-4">Top 10 Endpoints Más Usados</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={metrics.charts.topEndpoints}
              layout="vertical"
              margin={{ left: 150 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis
                type="category"
                dataKey="endpoint"
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                width={140}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="count" fill="#f59e0b" name="Requests" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Errores por endpoint (si hay errores) */}
      {metrics.charts.errorsByEndpoint.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Endpoints con Errores
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Endpoint</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-700">Errores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {metrics.charts.errorsByEndpoint.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{item.endpoint}</td>
                      <td className="px-4 py-2 text-right text-red-600 font-medium">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate limit hits por día (si hay hits) */}
      {metrics.charts.rateLimitByDay.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Rate Limit Hits por Día
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics.charts.rateLimitByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                  labelFormatter={(value) => formatDate(value as string)}
                />
                <Bar dataKey="count" fill="#f97316" name="Hits" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
