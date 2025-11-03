'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FileText, CheckCircle, Clock, Download, Home, Sparkles, Settings, FileUp } from 'lucide-react';

interface DashboardStats {
  totalDocumentos: number;
  documentosProcesados: number;
  documentosPendientes: number;
  documentosExportados: number;
  ultimoProcesamiento?: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalDocumentos: 0,
    documentosProcesados: 0,
    documentosPendientes: 0,
    documentosExportados: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simular carga de estadísticas
    // TODO: Implementar llamadas reales a la API
    const loadStats = async () => {
      try {
        // Aquí irían las llamadas a la API para obtener estadísticas
        setTimeout(() => {
          setStats({
            totalDocumentos: 87,
            documentosProcesados: 68,
            documentosPendientes: 19,
            documentosExportados: 52,
            ultimoProcesamiento: new Date().toLocaleDateString('es-AR')
          });
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error loading stats:', error);
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  const statCards = [
    {
      title: 'Total Documentos',
      value: stats.totalDocumentos,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Procesados con IA',
      value: stats.documentosProcesados,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Pendientes',
      value: stats.documentosPendientes,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      title: 'Exportados',
      value: stats.documentosExportados,
      icon: Download,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ];

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
              ¡Bienvenido, {user?.nombre}!
            </h1>
            <p className="text-text-secondary mt-1">
              Procesamiento inteligente de documentos con IA
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          
          return (
            <Card key={index} hover>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-secondary">
                      {stat.title}
                    </p>
                    <div className="text-2xl font-bold text-text-primary mt-1">
                      {isLoading ? (
                        <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                      ) : (
                        stat.value
                      )}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                // Skeleton loading
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        Factura procesada con IA
                      </p>
                      <p className="text-xs text-text-secondary">
                        Factura A #0001-00012345 - Extraída correctamente
                      </p>
                    </div>
                    <span className="text-xs text-text-light">Hace 2 horas</span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Download className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        Documentos exportados
                      </p>
                      <p className="text-xs text-text-secondary">
                        15 comprobantes exportados a Excel
                      </p>
                    </div>
                    <span className="text-xs text-text-light">Hace 5 horas</span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        Prompt de IA actualizado
                      </p>
                      <p className="text-xs text-text-secondary">
                        Prompt "Extracción Facturas" mejorado
                      </p>
                    </div>
                    <span className="text-xs text-text-light">Hace 1 día</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acceso Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a
                href="/parse"
                className="flex items-center p-4 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <FileUp className="w-8 h-8 text-blue-600 mr-4" />
                <div>
                  <h3 className="font-medium text-text-primary">Procesar Documentos</h3>
                  <span className="text-sm text-text-secondary">
                    Cargar y extraer datos con IA
                  </span>
                </div>
              </a>

              <a
                href="/exportar"
                className="flex items-center p-4 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
              >
                <Download className="w-8 h-8 text-purple-600 mr-4" />
                <div>
                  <h3 className="font-medium text-text-primary">Exportar Datos</h3>
                  <span className="text-sm text-text-secondary">
                    Generar archivos de exportación
                  </span>
                </div>
              </a>

              <a
                href="/prompts-ia"
                className="flex items-center p-4 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
              >
                <Sparkles className="w-8 h-8 text-amber-600 mr-4" />
                <div>
                  <h3 className="font-medium text-text-primary">Prompts de IA</h3>
                  <span className="text-sm text-text-secondary">
                    Configurar prompts de extracción
                  </span>
                </div>
              </a>

              <a
                href="/ia-config"
                className="flex items-center p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Settings className="w-8 h-8 text-gray-600 mr-4" />
                <div>
                  <h3 className="font-medium text-text-primary">Configuración IA</h3>
                  <span className="text-sm text-text-secondary">
                    Gestionar modelos y API keys
                  </span>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}