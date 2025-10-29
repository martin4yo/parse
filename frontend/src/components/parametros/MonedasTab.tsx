'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { monedasApi, Moneda } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';

interface MonedaFormData {
  codigo: string;
  nombre: string;
}

export function MonedasTab() {
  const { confirmDelete } = useConfirmDialog();
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showMonedaModal, setShowMonedaModal] = useState(false);
  const [editingMoneda, setEditingMoneda] = useState<Moneda | null>(null);

  // Form data
  const [monedaForm, setMonedaForm] = useState<MonedaFormData>({
    codigo: '',
    nombre: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchMonedas = async () => {
    try {
      setLoading(true);
      const response = await monedasApi.getAll();
      setMonedas(response.monedas);
    } catch (error) {
      toast.error('Error al cargar monedas');
      console.error('Error loading monedas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonedas();
  }, []);

  const handleCreateMoneda = () => {
    setEditingMoneda(null);
    setMonedaForm({ codigo: '', nombre: '' });
    setFormErrors({});
    setShowMonedaModal(true);
  };

  const handleEditMoneda = (moneda: Moneda) => {
    setEditingMoneda(moneda);
    setMonedaForm({
      codigo: moneda.codigo,
      nombre: moneda.nombre
    });
    setFormErrors({});
    setShowMonedaModal(true);
  };

  const validateMonedaForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!monedaForm.codigo.trim()) {
      errors.codigo = 'El código es requerido';
    }
    if (!monedaForm.nombre.trim()) {
      errors.nombre = 'El nombre es requerido';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleMonedaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateMonedaForm()) {
      return;
    }

    setSubmitting(true);
    try {
      if (editingMoneda) {
        await monedasApi.update(editingMoneda.id, monedaForm);
        toast.success('Moneda actualizada correctamente');
      } else {
        await monedasApi.create(monedaForm);
        toast.success('Moneda creada correctamente');
      }

      setShowMonedaModal(false);
      await fetchMonedas();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al guardar la moneda');
      console.error('Error saving moneda:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMoneda = async (moneda: Moneda) => {
    const confirmed = await confirmDelete(`${moneda.codigo} - ${moneda.nombre}`);
    if (!confirmed) return;

    try {
      await monedasApi.delete(moneda.id);
      toast.success('Moneda eliminada correctamente');
      await fetchMonedas();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al eliminar la moneda');
      console.error('Error deleting moneda:', error);
    }
  };

  const filteredMonedas = monedas.filter(moneda =>
    moneda.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    moneda.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Monedas</h2>
          <p className="text-sm text-text-secondary mt-1">
            Gestiona las monedas disponibles en el sistema
          </p>
        </div>
        <Button onClick={handleCreateMoneda}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Moneda
        </Button>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-lg shadow-sm border border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por código o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center">
                    Cargando...
                  </td>
                </tr>
              ) : filteredMonedas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-text-secondary">
                    {searchTerm ? 'No se encontraron monedas' : 'No hay monedas registradas'}
                  </td>
                </tr>
              ) : (
                filteredMonedas.map((moneda) => (
                  <tr key={moneda.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                      {moneda.codigo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {moneda.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditMoneda(moneda)}
                        className="text-green-600 hover:text-green-700 mr-3"
                      >
                        <Edit className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDeleteMoneda(moneda)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showMonedaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-medium text-text-primary">
                {editingMoneda ? 'Editar Moneda' : 'Nueva Moneda'}
              </h3>
            </div>

            <form onSubmit={handleMonedaSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={monedaForm.codigo}
                  onChange={(e) => setMonedaForm({ ...monedaForm, codigo: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: USD, EUR, ARS"
                  disabled={submitting}
                />
                {formErrors.codigo && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.codigo}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={monedaForm.nombre}
                  onChange={(e) => setMonedaForm({ ...monedaForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: Dólar Estadounidense"
                  disabled={submitting}
                />
                {formErrors.nombre && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.nombre}</p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMonedaModal(false)}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'Guardando...' : editingMoneda ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}