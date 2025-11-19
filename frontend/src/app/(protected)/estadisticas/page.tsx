'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Clock, Zap, Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import toast from 'hot-toast';

interface Stats {
  success: boolean;
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  totalRequests: number;
  patternCacheHits: number;
  cacheHitRate: string;
  breakdown: {
    exactMatchHits: number;
    templateHits: number;
    aiCalls: number;
  };
  estimatedSavings: {
    cost: string;
    time: string;
    costBreakdown: {
      exactMatch: string;
      template: string;
    };
  };
  topPatterns: Array<{
    type: string;
    field: string;
    hits: number;
    confidence: number;
  }>;
  trends: Array<{
    date: string;
    patternsUsed: number;
    totalHits: number;
  }>;
}

export default function EstadisticasPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30); // días

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Nota: Este endpoint requiere API key de la API pública
      // Para uso interno, deberíamos crear un endpoint similar en /api/estadisticas
      // Por ahora, simularemos datos de ejemplo

      // TODO: Crear endpoint interno /api/estadisticas
      // const response = await api.get(`/v1/parse/stats?days=${period}`);
      // setStats(response.data);

      // Datos de ejemplo mientras tanto
      const mockStats: Stats = {
        success: true,
        period: {
          days: period,
          startDate: new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        },
        totalRequests: 150,
        patternCacheHits: 85,
        cacheHitRate: '56.7%',
        breakdown: {
          exactMatchHits: 45,
          templateHits: 40,
          aiCalls: 65
        },
        estimatedSavings: {
          cost: '$0.1875',
          time: '0.25 hours',
          costBreakdown: {
            exactMatch: '$0.1350',
            template: '$0.0525'
          }
        },
        topPatterns: [
          { type: 'extraccion_documento_hash', field: 'datos_extraidos', hits: 45, confidence: 1.0 },
          { type: 'extraccion_proveedor_template', field: 'template_datos', hits: 40, confidence: 0.92 },
          { type: 'cuenta_linea', field: 'cuentaContable', hits: 28, confidence: 0.88 },
          { type: 'tipo_producto', field: 'categoria', hits: 15, confidence: 0.85 },
        ],
        trends: []
      };

      setStats(mockStats);

    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <p className="text-red-600">Error al cargar estadísticas</p>
      </div>
    );
  }

  const cacheHitPercentage = parseFloat(stats.cacheHitRate.replace('%', ''));

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Estadísticas de Patrones
          </h1>
          <p className="text-gray-600 mt-1">
            Últimos {period} días
          </p>
        </div>

        {/* Selector de período */}
        <div className="flex space-x-2">
          <button
            onClick={() => setPeriod(7)}
            className={`px-4 py-2 rounded-lg ${
              period === 7
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            7 días
          </button>
          <button
            onClick={() => setPeriod(30)}
            className={`px-4 py-2 rounded-lg ${
              period === 30
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            30 días
          </button>
          <button
            onClick={() => setPeriod(90)}
            className={`px-4 py-2 rounded-lg ${
              period === 90
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            90 días
          </button>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Requests */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Documentos</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalRequests}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cache Hit Rate */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasa de Cache</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {stats.cacheHitRate}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.patternCacheHits} / {stats.totalRequests}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Savings */}
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ahorro de Costo</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">
                  {stats.estimatedSavings.cost}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ~$0.003 por doc ahorrado
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time Savings */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ahorro de Tiempo</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {stats.estimatedSavings.time}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Procesamiento más rápido
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose de Uso */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Desglose de Procesamiento
            </h3>

            <div className="space-y-4">
              {/* Exact Match */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    📄 Documentos Idénticos (100% ahorro)
                  </span>
                  <span className="text-sm font-bold text-green-600">
                    {stats.breakdown.exactMatchHits}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${(stats.breakdown.exactMatchHits / stats.totalRequests) * 100}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Ahorro: {stats.estimatedSavings.costBreakdown.exactMatch}
                </p>
              </div>

              {/* Template */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    📋 Templates de Proveedor (60% ahorro)
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    {stats.breakdown.templateHits}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${(stats.breakdown.templateHits / stats.totalRequests) * 100}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Ahorro: {stats.estimatedSavings.costBreakdown.template}
                </p>
              </div>

              {/* AI Calls */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    🤖 Llamadas a IA (costo completo)
                  </span>
                  <span className="text-sm font-bold text-gray-600">
                    {stats.breakdown.aiCalls}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gray-600 h-2 rounded-full"
                    style={{
                      width: `${(stats.breakdown.aiCalls / stats.totalRequests) * 100}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Costo: ${(stats.breakdown.aiCalls * 0.003).toFixed(4)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Patterns */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
              Top Patrones Más Usados
            </h3>

            <div className="space-y-3">
              {stats.topPatterns.map((pattern, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {pattern.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      Campo: {pattern.field}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">
                      {pattern.hits} hits
                    </p>
                    <p className="text-xs text-gray-500">
                      {(pattern.confidence * 100).toFixed(0)}% confianza
                    </p>
                  </div>
                </div>
              ))}

              {stats.topPatterns.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay patrones registrados aún
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Información adicional */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">
                Sistema de Aprendizaje de Patrones
              </h4>
              <p className="text-sm text-blue-700">
                El sistema aprende automáticamente de documentos procesados, reduciendo costos de IA
                en <strong>{cacheHitPercentage.toFixed(1)}%</strong> mediante cache inteligente.
                Los patrones mejoran su confianza con cada uso exitoso.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                💡 Tip: Mientras más documentos proceses, mayor será el ahorro progresivo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
