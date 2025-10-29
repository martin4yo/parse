'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { atributosApi, valoresAtributoApi, Atributo, ValorAtributo } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { useAuth } from '@/contexts/AuthContext';

interface AtributoFormData {
  codigo: string;
  descripcion: string;
}

interface ValorFormData {
  codigo: string;
  descripcion: string;
  atributoId: string;
}

export default function AtributosTab() {
  const { confirmDelete } = useConfirmDialog();
  const { tenant } = useAuth();
  const [atributos, setAtributos] = useState<Atributo[]>([]);
  const [valoresAtributo, setValoresAtributo] = useState<ValorAtributo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAtributo, setSelectedAtributo] = useState<Atributo | null>(null);
  
  // Modal states
  const [showAtributoModal, setShowAtributoModal] = useState(false);
  const [showValorModal, setShowValorModal] = useState(false);
  const [editingAtributo, setEditingAtributo] = useState<Atributo | null>(null);
  const [editingValor, setEditingValor] = useState<ValorAtributo | null>(null);
  
  // Form data
  const [atributoForm, setAtributoForm] = useState<AtributoFormData>({
    codigo: '',
    descripcion: ''
  });
  const [valorForm, setValorForm] = useState<ValorFormData>({
    codigo: '',
    descripcion: '',
    atributoId: ''
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchAtributos = async () => {
    try {
      const response = await atributosApi.getAll();
      setAtributos(response.atributos || []);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al cargar atributos';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const fetchValoresAtributo = async () => {
    try {
      const response = await valoresAtributoApi.getAll();
      setValoresAtributo(response.valoresAtributo || []);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al cargar valores de atributo';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchAtributos(), fetchValoresAtributo()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🎯 [AtributosTab] Tenant changed or component mounted:', tenant?.id, tenant?.nombre);
    if (tenant?.id) {
      fetchData();
    }
  }, [tenant?.id]);

  // Filter data based on search
  const filteredAtributos = atributos?.filter(atributo =>
    atributo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    atributo.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Filter valores based on selected atributo - only show values if an atributo is selected
  const filteredValores = selectedAtributo 
    ? (valoresAtributo?.filter(valor => valor.atributoId === selectedAtributo.id) || [])
    : [];

  // Form handlers
  const resetAtributoForm = () => {
    setAtributoForm({ codigo: '', descripcion: '' });
    setFormErrors({});
    setEditingAtributo(null);
  };

  const resetValorForm = () => {
    setValorForm({ 
      codigo: '', 
      descripcion: '', 
      atributoId: selectedAtributo ? selectedAtributo.id.toString() : ''
    });
    setFormErrors({});
    setEditingValor(null);
  };

  const openAtributoModal = (atributo?: Atributo) => {
    if (atributo) {
      setEditingAtributo(atributo);
      setAtributoForm({
        codigo: atributo.codigo,
        descripcion: atributo.descripcion
      });
    } else {
      resetAtributoForm();
    }
    setShowAtributoModal(true);
  };

  const openValorModal = (valor?: ValorAtributo) => {
    if (valor) {
      setEditingValor(valor);
      setValorForm({
        codigo: valor.codigo,
        descripcion: valor.descripcion,
        atributoId: valor.atributoId.toString()
      });
    } else {
      resetValorForm();
    }
    setShowValorModal(true);
  };

  const closeAtributoModal = () => {
    setShowAtributoModal(false);
    resetAtributoForm();
  };

  const closeValorModal = () => {
    setShowValorModal(false);
    resetValorForm();
  };

  const validateAtributoForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!atributoForm.codigo.trim()) {
      errors.codigo = 'El código es requerido';
    }

    if (!atributoForm.descripcion.trim()) {
      errors.descripcion = 'La descripción es requerida';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateValorForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!valorForm.codigo.trim()) {
      errors.codigo = 'El código es requerido';
    }

    if (!valorForm.descripcion.trim()) {
      errors.descripcion = 'La descripción es requerida';
    }

    if (!valorForm.atributoId) {
      errors.atributoId = 'Debe seleccionar un atributo';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAtributoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAtributoForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingAtributo) {
        await atributosApi.update(editingAtributo.id, atributoForm);
        toast.success('Atributo actualizado correctamente');
      } else {
        await atributosApi.create(atributoForm);
        toast.success('Atributo creado correctamente');
      }

      await fetchAtributos();
      closeAtributoModal();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al guardar el atributo';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleValorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateValorForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const dataToSubmit = {
        ...valorForm
      };

      console.log('Data being submitted:', dataToSubmit);

      if (editingValor) {
        await valoresAtributoApi.update(editingValor.id, dataToSubmit);
        toast.success('Valor actualizado correctamente');
      } else {
        await valoresAtributoApi.create(dataToSubmit);
        toast.success('Valor creado correctamente');
      }

      await fetchValoresAtributo();
      closeValorModal();
    } catch (err: any) {
      console.error('Full error object:', err);
      console.error('Error response data:', err.response?.data);
      const errorMsg = err.response?.data?.error || err.message || 'Error al guardar el valor';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (type: 'atributo' | 'valor', item: Atributo | ValorAtributo) => {
    const itemName = type === 'atributo' ? (item as Atributo).descripcion : (item as ValorAtributo).descripcion;
    const confirmed = await confirmDelete(itemName);
    if (!confirmed) return;

    try {
      setError(null);
      
      if (type === 'atributo') {
        await atributosApi.delete(item.id);
        toast.success('Atributo eliminado correctamente');
        await fetchAtributos();
        // Si se elimina el atributo seleccionado, deseleccionarlo
        if (selectedAtributo && selectedAtributo.id === item.id) {
          setSelectedAtributo(null);
        }
      } else {
        await valoresAtributoApi.delete(item.id);
        toast.success('Valor eliminado correctamente');
        if (selectedAtributo) {
          await fetchValoresAtributo();
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al eliminar';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };


  const handleAtributoSelect = (atributo: Atributo) => {
    setSelectedAtributo(selectedAtributo?.id === atributo.id ? null : atributo);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Atributos</h2>
          <p className="text-sm text-text-secondary mt-1">
            Gestiona los atributos y sus valores. Selecciona un atributo para ver sus valores.
          </p>
        </div>
      </div>


      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-5 h-5 absolute left-3 top-3 text-text-secondary" />
        <input
          type="text"
          placeholder="Buscar atributos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Atributos Table - Left */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-text-primary">Atributos</h3>
            <Button 
              onClick={() => openAtributoModal()}
              size="sm"
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo</span>
            </Button>
          </div>

          <div className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-border">
                  {filteredAtributos.map((atributo) => (
                    <tr 
                      key={atributo.id} 
                      className={`cursor-pointer transition-colors ${
                        selectedAtributo?.id === atributo.id 
                          ? 'bg-primary/10 border-l-4 border-primary' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleAtributoSelect(atributo)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-sm text-text-primary">{atributo.codigo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-primary">{atributo.descripcion}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAtributoModal(atributo);
                            }}
                            className="p-1 text-green-600 hover:text-green-700 rounded"
                            title="Editar atributo"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete('atributo', atributo);
                            }}
                            className="p-1 text-red-600 hover:text-red-900 rounded"
                            title="Eliminar atributo"
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

            {filteredAtributos.length === 0 && (
              <div className="text-center py-12">
                <div className="text-text-secondary">
                  {searchTerm ? 'No se encontraron atributos que coincidan con la búsqueda' : 'No hay atributos registrados'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Valores Table - Right */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-text-primary">
                {selectedAtributo 
                  ? `Valores del Atributo ${selectedAtributo.descripcion}`
                  : 'Valores de Atributos'
                }
              </h3>
            </div>
            <Button 
              onClick={() => openValorModal()}
              size="sm"
              className="flex items-center space-x-2"
              disabled={!selectedAtributo}
              title={!selectedAtributo ? 'Selecciona un atributo primero' : 'Agregar nuevo valor'}
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo</span>
            </Button>
          </div>

          <div className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-border">
                  {filteredValores.map((valor) => (
                    <tr key={valor.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-sm text-text-primary">{valor.codigo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-primary">{valor.descripcion}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-1">
                          <button
                            onClick={() => openValorModal(valor)}
                            className="p-1 text-green-600 hover:text-green-700 rounded"
                            title="Editar valor"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('valor', valor)}
                            className="p-1 text-red-600 hover:text-red-900 rounded"
                            title="Eliminar valor"
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

            {filteredValores.length === 0 && (
              <div className="text-center py-12">
                <div className="text-text-secondary">
                  {!selectedAtributo 
                    ? 'Seleccione un atributo' 
                    : 'No hay valores para este atributo'
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Atributo Modal */}
      {showAtributoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-medium text-text-primary">
                {editingAtributo ? 'Editar Atributo' : 'Nuevo Atributo'}
              </h3>
            </div>

            <form onSubmit={handleAtributoSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={atributoForm.codigo}
                  onChange={(e) => setAtributoForm({ ...atributoForm, codigo: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: CATEGORIA"
                  disabled={submitting}
                />
                {formErrors.codigo && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.codigo}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Descripción *
                </label>
                <input
                  type="text"
                  value={atributoForm.descripcion}
                  onChange={(e) => setAtributoForm({ ...atributoForm, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: Categoría del producto"
                  disabled={submitting}
                />
                {formErrors.descripcion && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.descripcion}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeAtributoModal}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? 'Guardando...' : (editingAtributo ? 'Actualizar' : 'Crear')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Valor Modal */}
      {showValorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-medium text-text-primary">
                {editingValor ? 'Editar Valor' : 'Nuevo Valor'}
              </h3>
            </div>

            <form onSubmit={handleValorSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={valorForm.codigo}
                  onChange={(e) => setValorForm({ ...valorForm, codigo: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: ELECTRONICO"
                  disabled={submitting}
                />
                {formErrors.codigo && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.codigo}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Descripción *
                </label>
                <input
                  type="text"
                  value={valorForm.descripcion}
                  onChange={(e) => setValorForm({ ...valorForm, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: Productos electrónicos"
                  disabled={submitting}
                />
                {formErrors.descripcion && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.descripcion}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Atributo *
                </label>
                <select
                  value={valorForm.atributoId}
                  onChange={(e) => setValorForm({ ...valorForm, atributoId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
                  disabled={submitting || (selectedAtributo && !editingValor) || false}
                >
                  <option value="">Seleccione un atributo</option>
                  {atributos.map((atributo) => (
                    <option key={atributo.id} value={atributo.id.toString()}>
                      {atributo.descripcion}
                    </option>
                  ))}
                </select>
                {formErrors.atributoId && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.atributoId}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeValorModal}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? 'Guardando...' : (editingValor ? 'Actualizar' : 'Crear')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}