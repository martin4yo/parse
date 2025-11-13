'use client';

import { useState, useEffect } from 'react';
import { sugerenciasIAApi, SugerenciaIAStats } from '@/lib/api';
import { Sparkles, TrendingUp, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function AIMetricsWidget() {
  const [stats, setStats] = useState<SugerenciaIAStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await sugerenciasIAApi.stats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading AI stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-purple-200 rounded w-1/2"></div>
          <div className="h-8 bg-purple-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const tasaAprobacion = stats.total > 0
    ? ((stats.aprobadas + stats.aplicadas) / stats.total * 100).toFixed(0)
    : 0;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-purple-500 rounded-lg p-2">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-purple-900">Métricas de IA</h3>
            <p className="text-xs text-purple-700">Clasificaciones automáticas</p>
          </div>
        </div>

        <button
          onClick={() => router.push('/sugerencias-ia')}
          className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
        >
          Ver todas
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 border border-purple-100">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-600 font-medium">Pendientes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.pendientes}</p>
        </div>

        <div className="bg-white rounded-lg p-3 border border-purple-100">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-600 font-medium">Aprobadas</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.aprobadas + stats.aplicadas}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {/* Tasa de Aprobación */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-700 font-medium">Tasa de aprobación</span>
            <span className="text-purple-900 font-bold">{tasaAprobacion}%</span>
          </div>
          <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
              style={{ width: `${tasaAprobacion}%` }}
            />
          </div>
        </div>

        {/* Confianza Promedio */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-700 font-medium flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Confianza promedio
            </span>
            <span className="text-purple-900 font-bold">
              {(parseFloat(stats.promedioConfianza.toString()) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${parseFloat(stats.promedioConfianza.toString()) * 100}%` }}
            />
          </div>
        </div>

        {/* Total Procesado */}
        <div className="pt-2 border-t border-purple-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Total procesado</span>
            <span className="font-semibold text-gray-800">{stats.total} sugerencias</span>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      {stats.pendientes > 0 && (
        <button
          onClick={() => router.push('/sugerencias-ia')}
          className="mt-4 w-full bg-purple-500 hover:bg-purple-600 text-white rounded-lg py-2 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          Revisar {stats.pendientes} sugerencia{stats.pendientes !== 1 ? 's' : ''}
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
