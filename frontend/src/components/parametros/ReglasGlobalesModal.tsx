'use client';

import { useState, useEffect } from 'react';
import { X, Check, Settings, Globe, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface ReglaGlobal {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo: string;
  activa: boolean;
  prioridad: number;
  activaEnTenant: boolean;
  prioridadOverride?: number;
  _count?: {
    reglas_ejecuciones: number;
    tenant_reglas_globales: number;
  };
}

interface ReglasGlobalesModalProps {
  onCerrar: () => void;
  onActualizacion: () => void;
}

export default function ReglasGlobalesModal({ onCerrar, onActualizacion }: ReglasGlobalesModalProps) {
  const { tenant, user, isSuperuser } = useAuth();
  const [reglasGlobales, setReglasGlobales] = useState<ReglaGlobal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    // Solo cargar si hay un tenant seleccionado
    if (tenant?.id) {
      cargarReglasGlobales();
    }
  }, [filtroTipo, busqueda, tenant?.id]);

  const cargarReglasGlobales = async () => {
    // Validar que haya un tenant seleccionado
    if (!tenant?.id) {
      toast.error('Debe seleccionar un tenant para gestionar reglas globales');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params: any = {};
      if (filtroTipo) params.tipo = filtroTipo;
      if (busqueda) params.search = busqueda;

      console.log('🌐 [ReglasGlobalesModal] Cargando reglas globales para tenant:', tenant.nombre, tenant.id);

      const response = await api.get('/reglas/globales/disponibles', { params });

      console.log('📋 [ReglasGlobalesModal] Reglas recibidas:', response.data.length);
      console.log('📊 [ReglasGlobalesModal] Estados:', response.data.map((r: ReglaGlobal) => ({
        codigo: r.codigo,
        activaEnTenant: r.activaEnTenant
      })));

      setReglasGlobales(response.data);
    } catch (error) {
      console.error('Error cargando reglas globales:', error);
      toast.error('Error cargando reglas globales');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRegla = async (regla: ReglaGlobal) => {
    if (!tenant?.id) {
      toast.error('Debe seleccionar un tenant');
      return;
    }

    try {
      console.log('🔄 [ReglasGlobalesModal] Toggle regla:', regla.codigo, 'activaEnTenant:', regla.activaEnTenant, 'tenant:', tenant.nombre);

      if (regla.activaEnTenant) {
        console.log('🔴 [ReglasGlobalesModal] Desactivando regla...');
        await api.post(`/reglas/globales/${regla.id}/desactivar`);
        toast.success(`Regla "${regla.nombre}" desactivada para ${tenant.nombre}`);
      } else {
        console.log('🟢 [ReglasGlobalesModal] Activando regla...');
        await api.post(`/reglas/globales/${regla.id}/activar`);
        toast.success(`Regla "${regla.nombre}" activada para ${tenant.nombre}`);
      }

      console.log('✅ [ReglasGlobalesModal] Recargando lista...');
      await cargarReglasGlobales();
      onActualizacion();
    } catch (error: any) {
      console.error('❌ [ReglasGlobalesModal] Error al activar/desactivar regla:', error);
      const mensaje = error.response?.data?.error || 'Error al cambiar estado de la regla';
      toast.error(mensaje);
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'TRANSFORMACION':
        return 'bg-blue-100 text-blue-800';
      case 'VALIDACION':
        return 'bg-yellow-100 text-yellow-800';
      case 'ENRIQUECIMIENTO':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando reglas globales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6 text-gray-700" />
              <h2 className="text-2xl font-semibold text-gray-900">Reglas Globales</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Activa o desactiva reglas globales para este tenant
            </p>
            {tenant && (
              <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                <Building2 className="w-4 h-4" />
                {tenant.nombre}
              </div>
            )}
          </div>
          <button
            onClick={onCerrar}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por código o nombre..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos los tipos</option>
                <option value="TRANSFORMACION">Transformación</option>
                <option value="VALIDACION">Validación</option>
                <option value="ENRIQUECIMIENTO">Enriquecimiento</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de reglas */}
        <div className="flex-1 overflow-y-auto p-6">
          {reglasGlobales.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No se encontraron reglas globales</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reglasGlobales.map((regla) => (
                <div
                  key={regla.id}
                  className={`border rounded-lg p-4 transition-all ${
                    regla.activaEnTenant
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {regla.nombre}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTipoColor(
                            regla.tipo
                          )}`}
                        >
                          {regla.tipo}
                        </span>
                        {regla.activaEnTenant && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <Check className="w-3 h-3 mr-1" />
                            Activa
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Código:</span> {regla.codigo}
                      </p>
                      {regla.descripcion && (
                        <p className="text-sm text-gray-500">{regla.descripcion}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Prioridad: {regla.prioridad}</span>
                        <span>
                          Usada en {regla._count?.tenant_reglas_globales || 0} tenant(s)
                        </span>
                        {regla._count?.reglas_ejecuciones ? (
                          <span>{regla._count.reglas_ejecuciones} ejecuciones</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {regla.activaEnTenant && regla.prioridadOverride && (
                        <button
                          className="p-2 text-gray-500 hover:text-gray-700 rounded"
                          title="Configurar prioridad"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                      <Button
                        variant={regla.activaEnTenant ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => handleToggleRegla(regla)}
                      >
                        {regla.activaEnTenant ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
