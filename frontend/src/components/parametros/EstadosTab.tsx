'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CheckCircle, XCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';

interface Estado {
  id: string;
  codigo: string;
  descripcion: string;
  color: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EstadoFormData {
  codigo: string;
  descripcion: string;
  color: string;
  activo: boolean;
}

export default function EstadosTab() {
  const { confirmDelete } = useConfirmDialog();
  const [estados, setEstados] = useState<Estado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingEstado, setEditingEstado] = useState<Estado | null>(null);
  const [formData, setFormData] = useState<EstadoFormData>({
    codigo: '',
    descripcion: '',
    color: '#6B7280',
    activo: true
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Fetch estados
  const fetchEstados = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/estados');
      setEstados(response.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al cargar estados';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstados();
  }, []);

  // Filter estados based on search
  const filteredEstados = estados.filter(estado =>
    estado.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    estado.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle form
  const resetForm = () => {
    setFormData({ codigo: '', descripcion: '', color: '#6B7280', activo: true });
    setFormErrors({});
    setEditingEstado(null);
  };

  const openModal = (estado?: Estado) => {
    if (estado) {
      setEditingEstado(estado);
      setFormData({
        codigo: estado.codigo,
        descripcion: estado.descripcion,
        color: estado.color,
        activo: estado.activo
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.codigo.trim()) {
      errors.codigo = 'El código es requerido';
    } else if (formData.codigo.length > 50) {
      errors.codigo = 'El código no puede exceder 50 caracteres';
    }

    if (!formData.descripcion.trim()) {
      errors.descripcion = 'La descripción es requerida';
    } else if (formData.descripcion.length > 255) {
      errors.descripcion = 'La descripción no puede exceder 255 caracteres';
    }

    if (!formData.color.trim()) {
      errors.color = 'El color es requerido';
    } else if (!/^#[0-9A-F]{6}$/i.test(formData.color)) {
      errors.color = 'El color debe ser un código hexadecimal válido (ej: #FF5733)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingEstado) {
        await api.put(`/estados/${editingEstado.id}`, formData);
        toast.success('Estado actualizado correctamente');
      } else {
        await api.post('/estados', formData);
        toast.success('Estado creado correctamente');
      }

      await fetchEstados();
      closeModal();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al guardar el estado';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (estado: Estado) => {
    const confirmed = await confirmDelete(estado.descripcion);
    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      await api.delete(`/estados/${estado.id}`);
      toast.success('Estado desactivado correctamente');
      await fetchEstados();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al eliminar el estado';
      setError(errorMsg);
      toast.error(errorMsg);
    }
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
          <h2 className="text-xl font-semibold text-text-primary">Estados</h2>
          <p className="text-sm text-text-secondary mt-1">
            Gestiona los estados para las rendiciones de tarjetas
          </p>
        </div>
        <Button 
          onClick={() => openModal()}
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Estado</span>
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3 top-3 text-text-secondary" />
        <input
          type="text"
          placeholder="Buscar por código o descripción..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Estados Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Color
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Fecha Creación
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {filteredEstados.map((estado) => (
                <tr key={estado.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className="font-medium text-sm text-text-primary">{estado.codigo}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-text-primary">{estado.descripcion}</span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: estado.color }}
                        title={estado.color}
                      ></div>
                      <span className="text-text-secondary text-sm">{estado.color}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    {estado.activo ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        <span>Activo</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        <span>Inactivo</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-text-secondary">
                    {new Date(estado.createdAt).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => openModal(estado)}
                        className="p-1 text-green-600 hover:text-green-700 rounded"
                        title="Editar estado"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(estado)}
                        className="p-1 text-red-600 hover:text-red-900 rounded"
                        title="Desactivar estado"
                        disabled={!estado.activo}
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

        {filteredEstados.length === 0 && (
          <div className="text-center py-12">
            <div className="text-text-secondary">
              {searchTerm ? 'No se encontraron estados que coincidan con la búsqueda' : 'No hay estados registrados'}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-3 border-b border-border">
              <h3 className="text-lg font-medium text-text-primary">
                {editingEstado ? 'Editar Estado' : 'Nuevo Estado'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: PENDIENTE"
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
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: Pendiente de rendición"
                  disabled={submitting}
                />
                {formErrors.descripcion && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.descripcion}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 border border-border rounded-lg cursor-pointer"
                    disabled={submitting}
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="#6B7280"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    disabled={submitting}
                  />
                </div>
                {formErrors.color && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.color}</p>
                )}
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary"
                    disabled={submitting}
                  />
                  <span className="text-sm text-text-primary">Activo</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
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
                  {submitting ? 'Guardando...' : (editingEstado ? 'Actualizar' : 'Crear')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}