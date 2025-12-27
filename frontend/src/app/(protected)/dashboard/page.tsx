'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { api } from '@/lib/api';
import {
  FileText,
  CheckCircle,
  Clock,
  Download,
  Home,
  TrendingUp,
  AlertCircle,
  FileCheck,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface DashboardStats {
  totalDocumentos: number;
  documentosProcesados: number;
  documentosPendientes: number;
  documentosExportados: number;
  documentosConErrores: number;
  tasaExito: number;
  promedioExtraccionMs: number;
  documentosHoy: number;
  documentosSemana: number;
  tendenciaSemanal: number;
}

interface RecentActivity {
  id: string;
  tipo: 'procesado' | 'exportado' | 'error' | 'subido';
  descripcion: string;
  detalle: string;
  fecha: string;
}

interface DocumentoPorTipo {
  tipo: string;
  cantidad: number;
  porcentaje: number;
}

interface DocumentosPorDia {
  fecha: string;
  cantidad: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [documentosPorTipo, setDocumentosPorTipo] = useState<DocumentoPorTipo[]>([]);
  const [documentosPorDia, setDocumentosPorDia] = useState<DocumentosPorDia[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Cargar estadisticas generales
      const [statsRes, docsRes] = await Promise.all([
        api.get('/documentos/stats').catch(() => ({ data: null })),
        api.get('/documentos?limit=100').catch(() => ({ data: { documentos: [] } }))
      ]);

      const documentos = docsRes.data?.documentos || [];

      // Calcular estadisticas desde los documentos
      const total = documentos.length;
      const procesados = documentos.filter((d: any) => d.estadoProcesamiento === 'COMPLETADO').length;
      const pendientes = documentos.filter((d: any) => !d.exportado && d.estadoProcesamiento === 'COMPLETADO').length;
      const exportados = documentos.filter((d: any) => d.exportado).length;
      const conErrores = documentos.filter((d: any) => d.estadoProcesamiento === 'ERROR').length;

      // Documentos de hoy y semana
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - 7);

      const docsHoy = documentos.filter((d: any) => new Date(d.fechaProcesamiento) >= hoy).length;
      const docsSemana = documentos.filter((d: any) => new Date(d.fechaProcesamiento) >= inicioSemana).length;

      // Semana anterior para tendencia
      const inicioSemanaAnterior = new Date(inicioSemana);
      inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 7);
      const docsSemanaAnterior = documentos.filter((d: any) => {
        const fecha = new Date(d.fechaProcesamiento);
        return fecha >= inicioSemanaAnterior && fecha < inicioSemana;
      }).length;

      const tendencia = docsSemanaAnterior > 0
        ? Math.round(((docsSemana - docsSemanaAnterior) / docsSemanaAnterior) * 100)
        : 0;

      setStats({
        totalDocumentos: total,
        documentosProcesados: procesados,
        documentosPendientes: pendientes,
        documentosExportados: exportados,
        documentosConErrores: conErrores,
        tasaExito: total > 0 ? Math.round((procesados / total) * 100) : 0,
        promedioExtraccionMs: 0,
        documentosHoy: docsHoy,
        documentosSemana: docsSemana,
        tendenciaSemanal: tendencia
      });

      // Actividad reciente (ultimos 10 documentos)
      const actividadReciente: RecentActivity[] = documentos
        .sort((a: any, b: any) => new Date(b.fechaProcesamiento).getTime() - new Date(a.fechaProcesamiento).getTime())
        .slice(0, 8)
        .map((doc: any) => ({
          id: doc.id,
          tipo: doc.estadoProcesamiento === 'ERROR' ? 'error' :
                doc.exportado ? 'exportado' : 'procesado',
          descripcion: doc.estadoProcesamiento === 'ERROR' ? 'Error en procesamiento' :
                       doc.exportado ? 'Documento exportado' : 'Documento procesado',
          detalle: `${doc.tipoComprobanteExtraido || 'Documento'} - ${doc.razonSocialExtraida || doc.nombreArchivo}`,
          fecha: doc.fechaProcesamiento
        }));

      setRecentActivity(actividadReciente);

      // Documentos por tipo
      const tiposCount: Record<string, number> = {};
      documentos.forEach((doc: any) => {
        const tipo = doc.tipoComprobanteExtraido || 'Sin clasificar';
        tiposCount[tipo] = (tiposCount[tipo] || 0) + 1;
      });

      const tiposArray = Object.entries(tiposCount)
        .map(([tipo, cantidad]) => ({
          tipo,
          cantidad,
          porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0
        }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

      setDocumentosPorTipo(tiposArray);

      // Documentos por dia (ultimos 7 dias)
      const diasMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        const key = fecha.toISOString().split('T')[0];
        diasMap[key] = 0;
      }

      documentos.forEach((doc: any) => {
        const fecha = new Date(doc.fechaProcesamiento).toISOString().split('T')[0];
        if (diasMap[fecha] !== undefined) {
          diasMap[fecha]++;
        }
      });

      const diasArray = Object.entries(diasMap).map(([fecha, cantidad]) => ({
        fecha,
        cantidad
      }));

      setDocumentosPorDia(diasArray);

    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    return `Hace ${diffDays} dias`;
  };

  const getActivityIcon = (tipo: string) => {
    switch (tipo) {
      case 'procesado':
        return { icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600' };
      case 'exportado':
        return { icon: Download, bg: 'bg-purple-100', color: 'text-purple-600' };
      case 'error':
        return { icon: AlertCircle, bg: 'bg-red-100', color: 'text-red-600' };
      default:
        return { icon: FileText, bg: 'bg-blue-100', color: 'text-blue-600' };
    }
  };

  const tipoColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500'
  ];

  const maxDocs = Math.max(...documentosPorDia.map(d => d.cantidad), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
            <Home className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Bienvenido, {user?.nombre}
            </h1>
            <p className="text-text-secondary mt-1">
              Resumen de actividad y metricas
            </p>
          </div>
        </div>
        <div className="text-sm text-text-light">
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hover>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Documentos</p>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {isLoading ? <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" /> : stats?.totalDocumentos || 0}
                </div>
                <p className="text-xs text-text-light mt-1">
                  {stats?.documentosHoy || 0} hoy
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Tasa de Exito</p>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {isLoading ? <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" /> : `${stats?.tasaExito || 0}%`}
                </div>
                <p className="text-xs text-text-light mt-1">
                  {stats?.documentosConErrores || 0} con errores
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-100">
                <FileCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Pendientes Export</p>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {isLoading ? <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" /> : stats?.documentosPendientes || 0}
                </div>
                <p className="text-xs text-text-light mt-1">
                  {stats?.documentosExportados || 0} exportados
                </p>
              </div>
              <div className="p-3 rounded-lg bg-orange-100">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Esta Semana</p>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {isLoading ? <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" /> : stats?.documentosSemana || 0}
                </div>
                <div className="flex items-center mt-1">
                  {(stats?.tendenciaSemanal || 0) >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 text-green-600 mr-1" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-red-600 mr-1" />
                  )}
                  <span className={`text-xs ${(stats?.tendenciaSemanal || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(stats?.tendenciaSemanal || 0)}% vs semana anterior
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-purple-100">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafico de documentos por dia */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <CardTitle>Documentos Procesados (7 dias)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div>
                {/* Area del grafico - altura fija 140px */}
                <div className="flex items-end justify-between gap-3 px-2" style={{ height: '140px' }}>
                  {documentosPorDia.map((dia, index) => {
                    const barHeight = maxDocs > 0 ? Math.max((dia.cantidad / maxDocs) * 120, 4) : 4;

                    return (
                      <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
                        <span className="text-xs text-gray-600 mb-1 font-medium">{dia.cantidad}</span>
                        <div
                          className="w-full bg-blue-500 rounded-t-md transition-all duration-500 hover:bg-blue-600 cursor-pointer"
                          style={{ height: `${barHeight}px` }}
                          title={`${dia.fecha}: ${dia.cantidad} documentos`}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* Labels de dias */}
                <div className="flex justify-between gap-3 px-2 pt-2 border-t border-gray-100 mt-2">
                  {documentosPorDia.map((dia, index) => {
                    const fecha = new Date(dia.fecha);
                    const diaSemana = fecha.toLocaleDateString('es-AR', { weekday: 'short' });
                    return (
                      <div key={index} className="flex-1 text-center">
                        <span className="text-xs text-gray-500 capitalize">{diaSemana}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribucion por tipo */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-600" />
              <CardTitle>Distribucion por Tipo</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : documentosPorTipo.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-500">
                Sin documentos procesados
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {documentosPorTipo.map((tipo, index) => (
                  <div key={tipo.tipo} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${tipoColors[index % tipoColors.length]}`} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 truncate max-w-[150px]">{tipo.tipo}</span>
                        <span className="text-gray-500">{tipo.cantidad} ({tipo.porcentaje}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${tipoColors[index % tipoColors.length]} transition-all duration-500`}
                          style={{ width: `${tipo.porcentaje}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-600" />
            <CardTitle>Actividad Reciente</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-1/3" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No hay actividad reciente</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentActivity.map((activity) => {
                const { icon: Icon, bg, color } = getActivityIcon(activity.tipo);
                return (
                  <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-10 h-10 ${bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {activity.descripcion}
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {activity.detalle}
                      </p>
                    </div>
                    <span className="text-xs text-text-light whitespace-nowrap">
                      {formatTimeAgo(activity.fecha)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
