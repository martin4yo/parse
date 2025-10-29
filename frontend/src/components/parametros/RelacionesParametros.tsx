'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { parametrosApi } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface RelacionParametro {
  id?: number;
  campo_padre: string;
  campo_hijo: string;
  descripcion?: string;
  activo: boolean;
}

interface CampoRendicion {
  codigo: string;
  nombre: string;
  grupo: string;
}

export function RelacionesParametros() {
  const [relaciones, setRelaciones] = useState<RelacionParametro[]>([]);
  const [camposRendicion, setCamposRendicion] = useState<CampoRendicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { confirmDelete } = useConfirmDialog();
  const { tenant } = useAuth();
  const [formData, setFormData] = useState<RelacionParametro>({
    campo_padre: '',
    campo_hijo: '',
    descripcion: '',
    activo: true
  });

  const loadInitialData = useCallback(async () => {
    try {
      console.log('🔄 [RelacionesParametros] Cargando datos iniciales...');
      setLoading(true); // Agregar loading state
      // Reset data before loading to prevent stale data
      setRelaciones([]);
      setCamposRendicion([]);

      const [relacionesData, campos] = await Promise.all([
        parametrosApi.getRelaciones(),
        parametrosApi.getCamposRendicion()
      ]);
      console.log('✅ [RelacionesParametros] Datos cargados:', {
        relaciones: relacionesData.length,
        campos: campos.length
      });
      setRelaciones(relacionesData);
      setCamposRendicion(campos);
    } catch (error) {
      console.error('❌ [RelacionesParametros] Error loading initial data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, []); // Sin dependencias porque no usa props ni state

  // Cargar datos iniciales y cuando cambia el tenant
  useEffect(() => {
    console.log('🎯 [RelacionesParametros] Tenant changed or component mounted:', tenant?.id, tenant?.nombre);
    if (tenant?.id) {
      loadInitialData();
    }
  }, [tenant?.id, loadInitialData]);

  const fetchRelaciones = async () => {
    try {
      const data = await parametrosApi.getRelaciones();
      setRelaciones(data);
    } catch (error) {
      console.error('Error fetching relaciones:', error);
      toast.error('Error al cargar las relaciones');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.campo_padre || !formData.campo_hijo) {
      toast.error('Los campos padre e hijo son obligatorios');
      return;
    }

    if (formData.campo_padre === formData.campo_hijo) {
      toast.error('El campo padre no puede ser igual al campo hijo');
      return;
    }

    // Validar relación circular
    const relacionInversa = relaciones.find(
      r => r.campo_padre === formData.campo_hijo && 
           r.campo_hijo === formData.campo_padre &&
           (!editingId || r.id !== editingId)
    );
    
    if (relacionInversa) {
      toast.error(`Ya existe una relación inversa: ${formData.campo_hijo} -> ${formData.campo_padre}. Esto crearía una relación circular.`);
      return;
    }

    try {
      const dataToSend = {
        campo_padre: formData.campo_padre,
        campo_hijo: formData.campo_hijo,
        descripcion: formData.descripcion || undefined,
        activo: formData.activo
      };

      if (editingId) {
        await parametrosApi.updateRelacion(editingId, dataToSend);
        toast.success('Relación actualizada');
      } else {
        await parametrosApi.createRelacion(dataToSend);
        toast.success('Relación creada');
      }
      fetchRelaciones();
      resetForm();
    } catch (error: any) {
      console.error('Error saving relacion:', error);
      toast.error(error.message || 'Error al guardar la relación');
    }
  };

  const handleEdit = (relacion: RelacionParametro) => {
    setFormData(relacion);
    setEditingId(relacion.id || null);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const relacion = relaciones.find(r => r.id === id);
    const confirmed = await confirmDelete(
      `${relacion?.campo_padre} -> ${relacion?.campo_hijo}`
    );
    
    if (!confirmed) {
      return;
    }

    try {
      await parametrosApi.deleteRelacion(id);
      toast.success('Relación eliminada');
      fetchRelaciones();
    } catch (error: any) {
      console.error('Error deleting relacion:', error);
      toast.error(error.message || 'Error al eliminar la relación');
    }
  };

  const resetForm = () => {
    setFormData({
      campo_padre: '',
      campo_hijo: '',
      descripcion: '',
      activo: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-gray-50">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Relaciones entre Campos</h2>
          <p className="text-sm text-text-secondary">
            Define qué campo hijo filtra basado en cada campo padre
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Relación
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingId ? 'Editar Relación' : 'Nueva Relación'}
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
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Campo Padre *
                </label>
                <select
                  value={formData.campo_padre}
                  onChange={(e) => setFormData({ ...formData, campo_padre: e.target.value })}
                  className="input-base"
                  required
                >
                  <option value="">Seleccionar campo padre</option>
                  {Object.entries(
                    camposRendicion.reduce((acc, campo) => {
                      if (!acc[campo.grupo]) acc[campo.grupo] = [];
                      acc[campo.grupo].push(campo);
                      return acc;
                    }, {} as Record<string, CampoRendicion[]>)
                  ).map(([grupo, campos]) => (
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
                  Campo Hijo *
                </label>
                <select
                  value={formData.campo_hijo}
                  onChange={(e) => setFormData({ ...formData, campo_hijo: e.target.value })}
                  className="input-base"
                  required
                >
                  <option value="">Seleccionar campo hijo</option>
                  {Object.entries(
                    camposRendicion.reduce((acc, campo) => {
                      if (!acc[campo.grupo]) acc[campo.grupo] = [];
                      acc[campo.grupo].push(campo);
                      return acc;
                    }, {} as Record<string, CampoRendicion[]>)
                  ).map(([grupo, campos]) => (
                    <optgroup key={grupo} label={grupo}>
                      {campos.map((campo) => (
                        <option 
                          key={campo.codigo} 
                          value={campo.codigo}
                          disabled={campo.codigo === formData.campo_padre}
                        >
                          {campo.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.descripcion || ''}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="input-base"
                  placeholder="Descripción opcional de la relación"
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

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="bg-white rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Campo Padre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Campo Hijo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-border">
                {relaciones.map((relacion) => (
                  <tr key={relacion.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-text-primary">
                      {camposRendicion.find(c => c.codigo === relacion.campo_padre)?.nombre || 
                       relacion.campo_padre.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-primary">
                      {camposRendicion.find(c => c.codigo === relacion.campo_hijo)?.nombre || 
                       relacion.campo_hijo.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary">
                      {relacion.descripcion || '-'}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        relacion.activo 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {relacion.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(relacion)}
                          className="p-1 text-green-600 hover:text-green-700 rounded"
                          title="Editar relación"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(relacion.id!)}
                          className="p-1 text-red-600 hover:text-red-900 rounded"
                          title="Eliminar relación"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {relaciones.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-secondary">
                      No hay relaciones configuradas. Haz clic en "Nueva Relación" para comenzar.
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