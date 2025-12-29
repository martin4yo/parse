'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Edit, Trash2, Save, X, Search, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { parametrosApi } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface TipoParametro {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  grupo: string;
  orden: number;
  activo: boolean;
  icono?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface FilterState {
  grupo: string;
  activo: string;
  search: string;
}

export function TiposParametro() {
  const { user } = useAuth();
  const isSuperuser = user?.superuser === true;

  const [tipos, setTipos] = useState<TipoParametro[]>([]);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { confirmDelete } = useConfirmDialog();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [formData, setFormData] = useState<TipoParametro>({
    codigo: '',
    nombre: '',
    descripcion: '',
    grupo: '',
    orden: 1,
    activo: true,
    icono: ''
  });

  const [filters, setFilters] = useState<FilterState>({
    grupo: '',
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

  // Cargar tipos
  const loadTipos = useCallback(async () => {
    try {
      setLoading(true);
      const filterParams: { grupo?: string; activo?: boolean; search?: string } = {};

      if (filters.grupo) filterParams.grupo = filters.grupo;
      if (filters.activo !== '') filterParams.activo = filters.activo === 'true';
      if (debouncedSearch) filterParams.search = debouncedSearch;

      const data = await parametrosApi.getTipos(filterParams);
      setTipos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando tipos:', error);
      toast.error('Error al cargar tipos de parámetro');
    } finally {
      setLoading(false);
    }
  }, [filters.grupo, filters.activo, debouncedSearch]);

  // Cargar grupos únicos
  const loadGrupos = useCallback(async () => {
    try {
      const data = await parametrosApi.getTiposGrupos();
      setGrupos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando grupos:', error);
    }
  }, []);

  useEffect(() => {
    loadTipos();
  }, [loadTipos]);

  useEffect(() => {
    loadGrupos();
  }, [loadGrupos]);

  // Agrupar tipos por grupo
  const tiposPorGrupo = tipos.reduce((acc, tipo) => {
    const grupo = tipo.grupo || 'Sin grupo';
    if (!acc[grupo]) {
      acc[grupo] = [];
    }
    acc[grupo].push(tipo);
    return acc;
  }, {} as Record<string, TipoParametro[]>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo || !formData.nombre || !formData.grupo) {
      toast.error('Código, nombre y grupo son obligatorios');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await parametrosApi.updateTipo(editingId, formData);
        toast.success('Tipo actualizado correctamente');
      } else {
        await parametrosApi.createTipo(formData);
        toast.success('Tipo creado correctamente');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        grupo: '',
        orden: 1,
        activo: true,
        icono: ''
      });
      loadTipos();
      loadGrupos();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tipo: TipoParametro) => {
    setFormData({
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || '',
      grupo: tipo.grupo,
      orden: tipo.orden,
      activo: tipo.activo,
      icono: tipo.icono || ''
    });
    setEditingId(tipo.id || null);
    setShowForm(true);
  };

  const handleDelete = async (tipo: TipoParametro) => {
    if (!tipo.id) return;

    const confirmed = await confirmDelete(tipo.nombre);

    if (confirmed) {
      try {
        await parametrosApi.deleteTipo(tipo.id);
        toast.success('Tipo eliminado correctamente');
        loadTipos();
        loadGrupos();
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } } };
        toast.error(err.response?.data?.message || 'Error al eliminar');
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      grupo: '',
      orden: 1,
      activo: true,
      icono: ''
    });
  };

  const clearFilters = () => {
    setFilters({
      grupo: '',
      activo: '',
      search: ''
    });
  };

  if (!isSuperuser) {
    return (
      <div className="p-6 text-center">
        <Tag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Acceso Restringido</h3>
        <p className="text-gray-500">
          Solo los superusuarios pueden gestionar los tipos de parámetros.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)]">
      {/* Header con acciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Tipos de Parámetro</h3>
          <p className="text-sm text-gray-500">Catálogo global de tipos de campos parametrizables</p>
        </div>

        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Tipo
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-3 flex-shrink-0 mt-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por código o nombre..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={filters.grupo}
            onChange={(e) => setFilters(prev => ({ ...prev, grupo: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los grupos</option>
            {grupos.map(grupo => (
              <option key={grupo} value={grupo}>{grupo}</option>
            ))}
          </select>

          <select
            value={filters.activo}
            onChange={(e) => setFilters(prev => ({ ...prev, activo: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>

          {(filters.grupo || filters.activo || filters.search) && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex-shrink-0 mt-4">
          <h4 className="text-md font-medium mb-4">
            {editingId ? 'Editar Tipo' : 'Nuevo Tipo de Parámetro'}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    codigo: e.target.value.toLowerCase().replace(/\s+/g, '_')
                  }))}
                  placeholder="ej: tipo_producto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej: Tipo de Producto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grupo *
                </label>
                <input
                  type="text"
                  value={formData.grupo}
                  onChange={(e) => setFormData(prev => ({ ...prev, grupo: e.target.value }))}
                  placeholder="ej: Contabilidad"
                  list="grupos-list"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
                <datalist id="grupos-list">
                  {grupos.map(grupo => (
                    <option key={grupo} value={grupo} />
                  ))}
                </datalist>
                <p className="text-xs text-gray-500 mt-1">
                  Selecciona uno existente o escribe uno nuevo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.descripcion || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción opcional..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orden
                </label>
                <input
                  type="number"
                  value={formData.orden}
                  onChange={(e) => setFormData(prev => ({ ...prev, orden: parseInt(e.target.value) || 1 }))}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="activo" className="text-sm text-gray-700">
                  Activo
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {editingId ? 'Actualizar' : 'Guardar'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de tipos agrupados - con scroll */}
      <div className="flex-1 overflow-y-auto mt-4 pr-1 min-h-0">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : tipos.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No hay tipos de parámetro</h3>
            <p className="text-gray-500">Crea el primer tipo para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(tiposPorGrupo).map(([grupo, tiposGrupo]) => (
            <div key={grupo} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                <h4 className="font-medium text-gray-700">{grupo}</h4>
              </div>

              <div className="divide-y divide-gray-100">
                {tiposGrupo.map((tipo) => (
                  <div
                    key={tipo.id}
                    className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${!tipo.activo ? 'opacity-50' : ''}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                          {tipo.codigo}
                        </code>
                        <span className="font-medium text-gray-900">{tipo.nombre}</span>
                        {!tipo.activo && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                            Inactivo
                          </span>
                        )}
                      </div>
                      {tipo.descripcion && (
                        <p className="text-sm text-gray-500 mt-1">{tipo.descripcion}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Orden: {tipo.orden}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tipo)}
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(tipo)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 text-center pt-4 flex-shrink-0">
        Los tipos de parámetro son globales y están disponibles para todos los tenants.
        <br />
        Cada tenant puede crear sus propios valores dentro de cada tipo.
      </div>
    </div>
  );
}
