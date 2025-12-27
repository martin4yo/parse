'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Edit, Trash2, Save, X, Search, Filter, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { parametrosApi } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { useLoadOnTenantChange } from '@/hooks/useTenantRefresh';
import toast from 'react-hot-toast';

interface ParametroMaestro {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo_campo: string;
  valor_padre?: string;
  orden: number;
  activo: boolean;
  parametros_json?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

interface CampoRendicion {
  codigo: string;
  nombre: string;
  grupo: string;
}

interface FilterState {
  campo_rendicion: string;
  valor_padre: string;
  activo: string;
  search: string;
}

interface Relacion {
  id: number;
  campo_padre: string;
  campo_hijo: string;
  descripcion?: string;
  activo: boolean;
}

export function ParametrosMaestros() {
  const [parametros, setParametros] = useState<ParametroMaestro[]>([]);
  const [camposRendicion, setCamposRendicion] = useState<CampoRendicion[]>([]);
  const [valoresPadreModal, setValoresPadreModal] = useState<string[]>([]);
  const [valoresPadreFiltro, setValoresPadreFiltro] = useState<string[]>([]);
  const [relaciones, setRelaciones] = useState<Relacion[]>([]);
  const [campopadreDetectado, setCampoPadreDetectado] = useState<string | null>(null);
  const [campoPadreModal, setCampoPadreModal] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [editingJsonId, setEditingJsonId] = useState<number | null>(null);
  const [jsonParameters, setJsonParameters] = useState<Array<{campo: string, valor: string}>>([]);
  const { confirmDelete } = useConfirmDialog();
  const [formData, setFormData] = useState<ParametroMaestro>({
    codigo: '',
    nombre: '',
    descripcion: '',
    tipo_campo: '',
    valor_padre: '',
    orden: 1,
    activo: true
  });

  const [filters, setFilters] = useState<FilterState>({
    campo_rendicion: '',
    valor_padre: '', // Mantenemos para compatibilidad pero no lo usamos para filtrar automáticamente
    activo: '',
    search: ''
  });

  // Debounce para el search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [filters.search]);

  // Fetch cuando cambian los filtros (usando debouncedSearch en lugar de filters.search)
  useEffect(() => {
    fetchParametros();
  }, [filters.campo_rendicion, filters.valor_padre, filters.activo, debouncedSearch]);

  useEffect(() => {
    // Detectar si el campo seleccionado tiene un campo padre y cargar sus valores
    if (filters.campo_rendicion) {
      // Buscar si este campo tiene un padre definido en las relaciones
      const relacion = relaciones.find(r => r.campo_hijo === filters.campo_rendicion);
      if (relacion) {
        setCampoPadreDetectado(relacion.campo_padre);
        loadValoresPadreFiltro(filters.campo_rendicion);
      } else {
        setCampoPadreDetectado(null);
        setValoresPadreFiltro([]);
        setFilters(prev => ({ ...prev, valor_padre: '' }));
      }
    } else {
      setCampoPadreDetectado(null);
      setValoresPadreFiltro([]);
      setFilters(prev => ({ ...prev, valor_padre: '' }));
    }
  }, [filters.campo_rendicion, relaciones]);

  const loadInitialData = useCallback(async () => {
    try {
      const [campos, relacionesData] = await Promise.all([
        parametrosApi.getCamposRendicion(),
        parametrosApi.getRelaciones()
      ]);

      setCamposRendicion(campos);
      setRelaciones(relacionesData);
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Error al cargar los campos');
    }
  }, []); // Sin dependencias porque no usa props ni state

  // Hook que automáticamente refresca datos cuando cambia el tenant
  useLoadOnTenantChange(loadInitialData);


  const loadValoresPadreParaModal = async (campo: string) => {
    try {
      const relacion = relaciones.find(r => r.campo_hijo === campo);
      if (relacion) {
        setCampoPadreModal(relacion.campo_padre);
        // Cargar todos los valores del campo padre
        const response = await parametrosApi.getMaestros({
          tipo_campo: relacion.campo_padre,
          activo: true,
          limit: 1000
        });
        const valores = Array.isArray(response) ? response : response.data || [];
        const codigosValores = valores.map((v: any) => v.codigo);
        setValoresPadreModal(codigosValores);
      } else {
        setCampoPadreModal(null);
        setValoresPadreModal([]);
      }
    } catch (error) {
      console.error('Error loading valores padre para modal:', error);
      setCampoPadreModal(null);
      setValoresPadreModal([]);
    }
  };

  const loadValoresPadreFiltro = async (campo: string) => {
    try {
      // Obtener todos los valores padre únicos para este tipo de campo específico
      const response = await parametrosApi.getMaestros({
        tipo_campo: campo,
        limit: 1000
      });
      const parametrosDelCampo = Array.isArray(response) ? response : response.data || [];
      // Extraer valores padre únicos, excluyendo nulls y vacíos
      const valoresUnicos = Array.from(new Set(
        parametrosDelCampo
          .map((p: any) => p.valor_padre)
          .filter((valor: any) => valor && valor.trim() !== '')
      )).sort() as string[];
      setValoresPadreFiltro(valoresUnicos);
    } catch (error) {
      console.error('Error loading valores padre para filtro:', error);
      setValoresPadreFiltro([]);
    }
  };

  const fetchParametros = async () => {
    try {
      // Solo mostrar loading completo en la carga inicial
      if (initialLoading) {
        // Ya está en true
      } else {
        setFiltering(true);
      }

      const filterParams = {
        ...(filters.campo_rendicion && { tipo_campo: filters.campo_rendicion }),
        // Incluir valor_padre solo si el usuario lo seleccionó manualmente
        ...(filters.valor_padre && valoresPadreFiltro.includes(filters.valor_padre) && { valor_padre: filters.valor_padre }),
        ...(filters.activo && { activo: filters.activo === 'true' }),
        ...(debouncedSearch && { search: debouncedSearch }),
        limit: 1000 // Get all for now
      };

      const response = await parametrosApi.getMaestros(filterParams);
      const data = Array.isArray(response) ? response : response.data || [];
      setParametros(data);
    } catch (error) {
      console.error('Error fetching parametros maestros:', error);
      toast.error('Error al cargar los parámetros');
    } finally {
      setInitialLoading(false);
      setFiltering(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.codigo || !formData.nombre || !formData.tipo_campo) {
      toast.error('Código, nombre y tipo de campo son obligatorios');
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        valor_padre: formData.valor_padre || undefined
      };

      if (editingId) {
        await parametrosApi.updateMaestro(editingId, dataToSend);
        toast.success('Parámetro actualizado');
      } else {
        await parametrosApi.createMaestro(dataToSend);
        toast.success('Parámetro creado');
      }
      fetchParametros();
      resetForm();
    } catch (error: any) {
      console.error('Error saving parametro:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Error al guardar el parámetro';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (parametro: ParametroMaestro) => {
    setFormData({
      ...parametro,
      valor_padre: parametro.valor_padre || '',
      tipo_campo: filters.campo_rendicion // Mantener el campo del filtro actual
    });
    setEditingId(parametro.id || null);
    setShowForm(true);
    
    // Cargar valores padre si es necesario basado en el filtro actual
    if (campopadreDetectado) {
      loadValoresPadreParaModal(filters.campo_rendicion);
    }
  };

  const handleDelete = async (id: number) => {
    const parametro = parametros.find(p => p.id === id);
    const confirmed = await confirmDelete(parametro?.nombre || parametro?.codigo);
    
    if (!confirmed) {
      return;
    }

    try {
      await parametrosApi.deleteMaestro(id);
      toast.success('Parámetro eliminado');
      fetchParametros();
    } catch (error: any) {
      console.error('Error deleting parametro:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Error al eliminar el parámetro';
      toast.error(errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      tipo_campo: filters.campo_rendicion, // Mantener el campo del filtro
      valor_padre: '',
      orden: 1,
      activo: true
    });
    setEditingId(null);
    setShowForm(false);
    setCampoPadreModal(null);
    setValoresPadreModal([]);
  };

  const clearFilters = () => {
    setFilters({
      campo_rendicion: '',
      valor_padre: '',
      activo: '',
      search: ''
    });
  };

  const handleEditJson = (parametro: ParametroMaestro) => {
    setEditingJsonId(parametro.id || null);
    
    // Convertir el objeto JSON a array para la grilla
    const jsonArray = parametro.parametros_json ? 
      Object.entries(parametro.parametros_json).map(([campo, valor]) => ({ campo, valor })) : 
      [];
    
    setJsonParameters(jsonArray);
    setShowJsonModal(true);
  };

  const handleJsonParameterChange = (index: number, field: 'campo' | 'valor', value: string) => {
    const newParameters = [...jsonParameters];
    newParameters[index][field] = value;
    setJsonParameters(newParameters);
  };

  const addJsonParameter = () => {
    setJsonParameters([...jsonParameters, { campo: '', valor: '' }]);
  };

  const removeJsonParameter = (index: number) => {
    const newParameters = jsonParameters.filter((_, i) => i !== index);
    setJsonParameters(newParameters);
  };

  const saveJsonParameters = async () => {
    if (!editingJsonId) return;

    try {
      // Convertir array a objeto JSON
      const jsonObject = jsonParameters.reduce((acc, param) => {
        if (param.campo && param.valor) {
          acc[param.campo] = param.valor;
        }
        return acc;
      }, {} as Record<string, string>);

      await parametrosApi.updateMaestro(editingJsonId, { 
        parametros_json: Object.keys(jsonObject).length > 0 ? jsonObject : null 
      });
      
      toast.success('Parámetros JSON actualizados');
      fetchParametros();
      resetJsonModal();
    } catch (error: any) {
      console.error('Error saving JSON parameters:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Error al guardar los parámetros JSON';
      toast.error(errorMessage);
    }
  };

  const resetJsonModal = () => {
    setShowJsonModal(false);
    setEditingJsonId(null);
    setJsonParameters([]);
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Group campos by grupo for better UX
  const camposByGrupo = camposRendicion.reduce((acc, campo) => {
    if (!acc[campo.grupo]) acc[campo.grupo] = [];
    acc[campo.grupo].push(campo);
    return acc;
  }, {} as Record<string, CampoRendicion[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-gray-50">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Parámetros Maestros</h2>
          <p className="text-sm text-text-secondary">
            Gestiona los valores de los parámetros del sistema
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <Button
            onClick={() => {
              if (!filters.campo_rendicion) {
                toast.error('Primero seleccione un campo de rendición');
                return;
              }
              // Establecer el campo de rendición del filtro actual
              setFormData(prev => ({ ...prev, tipo_campo: filters.campo_rendicion }));
              // Cargar valores padre si es necesario
              if (campopadreDetectado) {
                loadValoresPadreParaModal(filters.campo_rendicion);
              }
              setShowForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Parámetro
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Buscar
            </label>
            <div className="relative">
              {filtering ? (
                <Loader2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 animate-spin" />
              ) : (
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              )}
              <input
                ref={searchInputRef}
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Código o nombre..."
                className="input-base pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Campo de Rendición *
            </label>
            <select
              value={filters.campo_rendicion}
              onChange={(e) => setFilters({ ...filters, campo_rendicion: e.target.value, valor_padre: '' })}
              className="input-base"
            >
              <option value="">Seleccionar campo...</option>
              {Object.entries(camposByGrupo).map(([grupo, campos]) => (
                <optgroup key={grupo} label={grupo}>
                  {campos.map((campo) => (
                    <option key={campo.codigo} value={campo.codigo}>
                      {campo.nombre}
                    </option>
                  ))}    
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Campo Padre
            </label>
            <input
              type="text"
              value={campopadreDetectado ? campopadreDetectado.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : ''}
              className="input-base bg-gray-50"
              placeholder={!filters.campo_rendicion ? 'Seleccione un campo primero' : 'Sin campo padre'}
              readOnly
              disabled={!filters.campo_rendicion}
            />
            {campopadreDetectado && (
              <p className="text-xs text-text-secondary mt-1">
                Este campo depende de {campopadreDetectado.replace('_', ' ')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Valor Padre
            </label>
            <select
              value={filters.valor_padre}
              onChange={(e) => setFilters({ ...filters, valor_padre: e.target.value })}
              className="input-base"
              disabled={!campopadreDetectado || valoresPadreFiltro.length === 0}
            >
              <option value="">Todos</option>
              {valoresPadreFiltro.map((valor) => (
                <option key={valor} value={valor}>{valor}</option>
              ))}
            </select>
            {campopadreDetectado && valoresPadreFiltro.length === 0 && (
              <p className="text-xs text-text-secondary mt-1">
                No hay valores padre para filtrar
              </p>
            )}
            {!campopadreDetectado && (
              <p className="text-xs text-text-secondary mt-1">
                Este campo no tiene padre
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Estado
            </label>
            <select
              value={filters.activo}
              onChange={(e) => setFilters({ ...filters, activo: e.target.value })}
              className="input-base"
            >
              <option value="">Todos</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>
        <div className="flex justify-between mt-4">
          <div className="text-sm text-text-secondary">
            {filters.campo_rendicion ? (
              <>
                Mostrando parámetros para: <strong>{camposRendicion.find(c => c.codigo === filters.campo_rendicion)?.nombre}</strong>
                {campopadreDetectado && (
                  <> (depende de <strong>{campopadreDetectado.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>)</>
                )}
                {filters.valor_padre && (
                  <> - Filtrado por valor padre: <strong>{filters.valor_padre}</strong></>
                )}
              </>
            ) : (
              'Selecciona un campo de rendición para ver los parámetros'
            )}
          </div>
          <Button variant="outline" onClick={clearFilters}>
            <X className="w-4 h-4 mr-2" />
            Limpiar Filtros
          </Button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingId ? 'Editar Parámetro' : 'Nuevo Parámetro'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetForm}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="input-base"
                    placeholder="Ej: VISA_CREDIT"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Orden
                  </label>
                  <input
                    type="number"
                    value={formData.orden}
                    onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 1 })}
                    className="input-base"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="input-base"
                  placeholder="Ej: Visa Crédito"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Campo de Rendición
                </label>
                <input
                  type="text"
                  value={camposRendicion.find(c => c.codigo === formData.tipo_campo)?.nombre || ''}
                  className="input-base bg-gray-50"
                  readOnly
                  disabled
                />
                <input
                  type="hidden"
                  value={formData.tipo_campo}
                />
              </div>

              {campoPadreModal ? (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Valor Padre ({campoPadreModal.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}) *
                  </label>
                  <select
                    value={formData.valor_padre || ''}
                    onChange={(e) => setFormData({ ...formData, valor_padre: e.target.value })}
                    className="input-base"
                    required
                  >
                    <option value="">Seleccionar valor padre...</option>
                    {valoresPadreModal.map((valor) => (
                      <option key={valor} value={valor}>{valor}</option>
                    ))}
                  </select>
                  <p className="text-xs text-text-secondary mt-1">
                    Este campo depende del campo {campoPadreModal.replace('_', ' ')}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Valor Padre
                  </label>
                  <input
                    type="text"
                    value={formData.valor_padre || ''}
                    onChange={(e) => setFormData({ ...formData, valor_padre: e.target.value })}
                    className="input-base"
                    placeholder="Valor del padre que filtra este parámetro (opcional)"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Solo necesario si este parámetro depende de otro
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion || ''}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="input-base"
                  rows={3}
                  placeholder="Descripción opcional del parámetro"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="activo" className="text-sm text-text-primary">
                  Activo
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editingId ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JSON Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Configuración JSON - Parámetros
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetJsonModal}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-text-secondary mb-4">
                Configura pares clave-valor que se almacenarán en formato JSON para este parámetro.
              </div>

              {/* Grilla de parámetros JSON */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Nombre del Campo
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-border">
                    {jsonParameters.map((param, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={param.campo}
                            onChange={(e) => handleJsonParameterChange(index, 'campo', e.target.value)}
                            className="input-base w-full"
                            placeholder="ej: configuracion_especial"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={param.valor}
                            onChange={(e) => handleJsonParameterChange(index, 'valor', e.target.value)}
                            className="input-base w-full"
                            placeholder="ej: valor_personalizado"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeJsonParameter(index)}
                            className="text-danger hover:text-danger-hover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {jsonParameters.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-text-secondary">
                          <div className="mb-4">
                            <Settings className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm">No hay parámetros JSON configurados</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={addJsonParameter}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Parámetro
                </Button>

                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={resetJsonModal}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={saveJsonParameters}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Configuración
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="bg-white rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Tipo Campo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Valor Padre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Orden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    JSON Config
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-border">
                {parametros.map((parametro) => (
                  <tr key={parametro.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-text-primary">
                      {parametro.codigo}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-primary">
                      {parametro.nombre}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-secondary">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {parametro.tipo_campo.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-secondary">
                      {parametro.valor_padre || '-'}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-secondary">
                      {parametro.orden}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        parametro.activo 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {parametro.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-secondary">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          parametro.parametros_json && Object.keys(parametro.parametros_json).length > 0
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {parametro.parametros_json && Object.keys(parametro.parametros_json).length > 0
                            ? `${Object.keys(parametro.parametros_json).length} campos`
                            : 'Sin config'
                          }
                        </span>
                        <button
                          onClick={() => handleEditJson(parametro)}
                          className="p-1 text-blue-600 hover:text-blue-700 rounded"
                          title="Editar configuración JSON"
                        >
                          <Settings className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(parametro)}
                          className="p-1 text-green-600 hover:text-green-700 rounded"
                          title="Editar parámetro"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(parametro.id!)}
                          className="p-1 text-red-600 hover:text-red-900 rounded"
                          title="Eliminar parámetro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {parametros.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
                      {!filters.campo_rendicion ? (
                        <>
                          <div className="mb-4">
                            <Filter className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-lg font-medium">Selecciona un campo de rendición</p>
                            <p className="text-sm">Elige un campo de la tabla rendicion_tarjeta para ver sus parámetros</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mb-4">
                            <Plus className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-lg font-medium">No hay parámetros configurados</p>
                            <p className="text-sm">para el campo: <strong>{camposRendicion.find(c => c.codigo === filters.campo_rendicion)?.nombre}</strong></p>
                          </div>
                          <Button onClick={() => {
                            // Establecer el campo de rendición del filtro actual
                            setFormData(prev => ({ ...prev, tipo_campo: filters.campo_rendicion }));
                            // Cargar valores padre si es necesario
                            if (campopadreDetectado) {
                              loadValoresPadreParaModal(filters.campo_rendicion);
                            }
                            setShowForm(true);
                          }} className="mt-4">
                            <Plus className="w-4 h-4 mr-2" />
                            Crear Primer Parámetro
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}