'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Play, Eye, AlertCircle, CheckCircle, Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import ReglaModal from './ReglaModal';
import { useAuth } from '@/contexts/AuthContext';

interface ReglaNegocio {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo: string;
  activa: boolean;
  prioridad: number;
  version: number;
  fechaVigencia?: string;
  configuracion: any;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  _count?: {
    ejecuciones: number;
  };
}

interface TipoRegla {
  codigo: string;
  nombre: string;
  descripcion: string;
}

interface Operador {
  codigo: string;
  nombre: string;
  descripcion: string;
}

export default function ReglasNegocioTab() {
  const { tenant } = useAuth();
  const [reglas, setReglas] = useState<ReglaNegocio[]>([]);
  const [tipos, setTipos] = useState<TipoRegla[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [acciones, setAcciones] = useState([]);
  const [tablasLookup, setTablasLookup] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroActiva, setFiltroActiva] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [reglaEditando, setReglaEditando] = useState<ReglaNegocio | null>(null);
  const [modalVisualizacion, setModalVisualizacion] = useState(false);
  const [reglaVisualizando, setReglaVisualizando] = useState<ReglaNegocio | null>(null);

  // Cargar datos iniciales y cuando cambia el tenant
  useEffect(() => {
    console.log('🎯 [ReglasNegocioTab] Tenant changed or component mounted:', tenant?.id, tenant?.nombre);
    if (tenant?.id) {
      cargarDatos();
    }
  }, [tenant?.id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [reglasRes, tiposRes, operadoresRes, accionesRes, tablasRes] = await Promise.all([
        api.get('/reglas', { 
          params: { 
            tipo: filtroTipo || undefined,
            activa: filtroActiva || undefined,
            search: busqueda || undefined
          } 
        }),
        api.get('/reglas/meta/tipos'),
        api.get('/reglas/meta/operadores'),
        api.get('/reglas/meta/acciones'),
        api.get('/reglas/meta/tablas-lookup')
      ]);

      setReglas(reglasRes.data);
      setTipos(tiposRes.data);
      setOperadores(operadoresRes.data);
      setAcciones(accionesRes.data);
      setTablasLookup(tablasRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando reglas de negocio');
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros
  useEffect(() => {
    if (tenant?.id) {
      cargarDatos();
    }
  }, [filtroTipo, filtroActiva, busqueda, tenant?.id]);

  const handleCrearRegla = () => {
    console.log('Creando nueva regla...');
    setReglaEditando(null);
    setModalAbierto(true);
  };

  const handleEditarRegla = (regla: ReglaNegocio) => {
    setReglaEditando(regla);
    setModalAbierto(true);
  };

  const handleGuardarRegla = async (reglaData: any) => {
    try {
      if (reglaEditando) {
        await api.put(`/reglas/${reglaEditando.id}`, reglaData);
        toast.success('Regla actualizada correctamente');
      } else {
        await api.post('/reglas', reglaData);
        toast.success('Regla creada correctamente');
      }
      setModalAbierto(false);
      setReglaEditando(null);
      cargarDatos();
    } catch (error) {
      console.error('Error guardando regla:', error);
      toast.error('Error guardando regla');
    }
  };

  const handleVerRegla = (regla: ReglaNegocio) => {
    setReglaVisualizando(regla);
    setModalVisualizacion(true);
  };

  const handleEliminarRegla = async (regla: ReglaNegocio) => {
    if (!confirm(`¿Estás seguro de eliminar la regla "${regla.nombre}"?`)) {
      return;
    }

    try {
      await api.delete(`/reglas/${regla.id}`);
      toast.success('Regla eliminada correctamente');
      cargarDatos();
    } catch (error) {
      console.error('Error eliminando regla:', error);
      toast.error('Error eliminando regla');
    }
  };

  const handleProbarRegla = async (regla: ReglaNegocio) => {
    // Abrir modal para probar regla con datos de ejemplo
    const datosEjemplo = {
      itemData: {
        rendicionCabeceraId: 'example',
        resumenTarjetaId: 'example'
      },
      resumenData: {
        descripcionCupon: 'COMBUSTIBLE YPF',
        importeTransaccion: 1000
      }
    };

    try {
      const response = await api.post(`/reglas/${regla.id}/test`, datosEjemplo);
      console.log('Resultado de prueba:', response.data);
      toast.success('Regla probada correctamente. Ver consola para detalles.');
    } catch (error) {
      console.error('Error probando regla:', error);
      toast.error('Error probando regla');
    }
  };

  const getTipoNombre = (codigo: string) => {
    return tipos.find(t => t.codigo === codigo)?.nombre || codigo;
  };

  const getEstadoIcon = (regla: ReglaNegocio) => {
    if (!regla.activa) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    if (regla.fechaVigencia && new Date(regla.fechaVigencia) > new Date()) {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getEstadoTexto = (regla: ReglaNegocio) => {
    if (!regla.activa) return 'Inactiva';
    if (regla.fechaVigencia && new Date(regla.fechaVigencia) > new Date()) return 'Programada';
    return 'Activa';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Reglas de Negocio</h2>
          <p className="text-sm text-gray-600">
            Gestiona las reglas que se aplican durante la importación y procesamiento de datos
          </p>
        </div>
        <Button onClick={handleCrearRegla}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Regla
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Búsqueda
            </label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, nombre o descripción..."
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
              {tipos.map(tipo => (
                <option key={tipo.codigo} value={tipo.codigo}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={filtroActiva}
              onChange={(e) => setFiltroActiva(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos los estados</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de reglas */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prioridad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ejecuciones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reglas.map((regla) => (
                <tr key={regla.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getEstadoIcon(regla)}
                      <span className="text-sm text-gray-900">
                        {getEstadoTexto(regla)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {regla.codigo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {regla.nombre}
                      </div>
                      {regla.descripcion && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {regla.descripcion}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getTipoNombre(regla.tipo)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {regla.prioridad}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {regla._count?.ejecuciones || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVerRegla(regla)}
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProbarRegla(regla)}
                        title="Probar regla"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <button
                        onClick={() => handleEditarRegla(regla)}
                        className="p-1 text-green-600 hover:text-green-700 rounded"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEliminarRegla(regla)}
                        className="p-1 text-red-600 hover:text-red-900 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {reglas.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              No se encontraron reglas de negocio
            </div>
          </div>
        )}
      </div>

      {/* Modal de visualización */}
      {modalVisualizacion && reglaVisualizando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Detalles de la Regla</h3>
                <Button
                  variant="ghost"
                  onClick={() => setModalVisualizacion(false)}
                >
                  ×
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Código</label>
                  <div className="text-sm text-gray-900">{reglaVisualizando.codigo}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <div className="text-sm text-gray-900">{reglaVisualizando.nombre}</div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Configuración</label>
                <pre className="mt-1 text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(reglaVisualizando.configuracion, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición/creación */}
      {modalAbierto && (
        <ReglaModal
          regla={reglaEditando}
          tipos={tipos}
          operadores={operadores}
          acciones={acciones}
          tablasLookup={tablasLookup}
          onGuardar={handleGuardarRegla}
          onCerrar={() => {
            setModalAbierto(false);
            setReglaEditando(null);
          }}
        />
      )}
    </div>
  );
}