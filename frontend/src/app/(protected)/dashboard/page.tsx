'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Upload, CreditCard, FileText, TrendingUp, Home } from 'lucide-react';

interface DashboardStats {
  totalTarjetas: number;
  totalImportaciones: number;
  totalRendiciones: number;
  ultimaImportacion?: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalTarjetas: 0,
    totalImportaciones: 0,
    totalRendiciones: 0,
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
            totalTarjetas: 5,
            totalImportaciones: 12,
            totalRendiciones: 45,
            ultimaImportacion: new Date().toLocaleDateString('es-AR')
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
      title: 'Total Tarjetas',
      value: stats.totalTarjetas,
      icon: CreditCard,
      color: 'text-palette-purple',
      bgColor: 'bg-accent-light/30'
    },
    {
      title: 'Importaciones Resumen',
      value: stats.totalImportaciones,
      icon: Upload,
      color: 'text-palette-dark',
      bgColor: 'bg-palette-cream/50'
    },
    {
      title: 'Rendiciones',
      value: stats.totalRendiciones,
      icon: FileText,
      color: 'text-palette-purple',
      bgColor: 'bg-accent/30'
    },
    {
      title: 'Crecimiento',
      value: '+12%',
      icon: TrendingUp,
      color: 'text-palette-dark',
      bgColor: 'bg-palette-yellow/20'
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
              Resumen de tu sistema de rendiciones
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
                    <div className="w-10 h-10 bg-palette-cream/50 rounded-full flex items-center justify-center">
                      <Upload className="w-5 h-5 text-palette-dark" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        Archivo de resumen importado
                      </p>
                      <p className="text-xs text-text-secondary">
                        Tarjeta ICBCVC - Período 2024-01
                      </p>
                    </div>
                    <span className="text-xs text-text-light">Hace 2 horas</span>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-accent-light/30 rounded-full flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-palette-purple" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        Nueva tarjeta creada
                      </p>
                      <p className="text-xs text-text-secondary">
                        VISA Gold - Activada
                      </p>
                    </div>
                    <span className="text-xs text-text-light">Hace 1 día</span>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-accent/30 rounded-full flex items-center justify-center">
                      <FileText className="w-5 h-5 text-palette-purple" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        Rendición procesada
                      </p>
                      <p className="text-xs text-text-secondary">
                        45 registros procesados correctamente
                      </p>
                    </div>
                    <span className="text-xs text-text-light">Hace 2 días</span>
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
                href="/dkt/importar"
                className="flex items-center p-4 bg-accent-light/30 rounded-lg hover:bg-accent-light/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-palette-dark mr-4" />
                <div>
                  <h3 className="font-medium text-text-primary">Importar Resumen</h3>
                  <span className="text-sm text-text-secondary">
                    Subir nuevo archivo de transacciones
                  </span>
                </div>
              </a>
              
              <a
                href="/tarjetas"
                className="flex items-center p-4 bg-accent/30 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <CreditCard className="w-8 h-8 text-palette-purple mr-4" />
                <div>
                  <h3 className="font-medium text-text-primary">Gestión de Tarjetas</h3>
                  <span className="text-sm text-text-secondary">
                    Administrar tipos de tarjeta
                  </span>
                </div>
              </a>
              
              <a
                href="/rendiciones"
                className="flex items-center p-4 bg-palette-cream/50 rounded-lg hover:bg-palette-cream/70 transition-colors"
              >
                <FileText className="w-8 h-8 text-palette-dark mr-4" />
                <div>
                  <h3 className="font-medium text-text-primary">Ver Rendiciones</h3>
                  <span className="text-sm text-text-secondary">
                    Consultar rendiciones procesadas
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