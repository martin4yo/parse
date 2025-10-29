'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Wallet, CheckCircle, XCircle, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { cajasApi, monedasApi, Caja, Moneda } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { useAuth } from '@/contexts/AuthContext';

interface CajaFormData {
  codigo: string;
  nombre: string;
  descripcion: string;
  fondoFijo: boolean;
  monedaId: string;
  color: string;
  limite: string;
}

export function CajasTab() {
  const { confirmDelete } = useConfirmDialog();
  const { tenant } = useAuth();
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showCajaModal, setShowCajaModal] = useState(false);
  const [editingCaja, setEditingCaja] = useState<Caja | null>(null);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [selectedCajaForUsers, setSelectedCajaForUsers] = useState<Caja | null>(null);
  const [cajaUsers, setCajaUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [cajasWithUsers, setCajasWithUsers] = useState<Set<string>>(new Set());

  // Form data
  const [cajaForm, setCajaForm] = useState<CajaFormData>({
    codigo: '',
    nombre: '',
    descripcion: '',
    fondoFijo: false,
    monedaId: '',
    color: '#FCE5B7',
    limite: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchCajas = async () => {
    try {
      setLoading(true);
      const response = await cajasApi.getAll();
      setCajas(response.cajas);

      // Verificar qué cajas tienen usuarios asignados
      const cajasConUsuarios = new Set<string>();
      for (const caja of response.cajas) {
        try {
          const usersResponse = await cajasApi.getUsers(caja.id);
          if (usersResponse.users && usersResponse.users.length > 0) {
            cajasConUsuarios.add(caja.id);
          }
        } catch (error) {
          // Si hay error al obtener usuarios, asumir que no tiene usuarios
          console.warn(`Error checking users for caja ${caja.id}:`, error);
        }
      }
      setCajasWithUsers(cajasConUsuarios);
    } catch (error) {
      toast.error('Error al cargar cajas');
      console.error('Error loading cajas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonedas = async () => {
    try {
      const response = await monedasApi.getAll();
      setMonedas(response.monedas);
    } catch (error) {
      toast.error('Error al cargar monedas');
      console.error('Error loading monedas:', error);
    }
  };

  useEffect(() => {
    if (tenant?.id) {
      fetchCajas();
      fetchMonedas();
    }
  }, [tenant?.id]);

  const handleCreateCaja = () => {
    setEditingCaja(null);
    setCajaForm({
      codigo: '',
      nombre: '',
      descripcion: '',
      fondoFijo: false,
      monedaId: '',
      color: '#FCE5B7',
      limite: ''
    });
    setFormErrors({});
    setShowCajaModal(true);
  };

  const handleEditCaja = (caja: Caja) => {
    setEditingCaja(caja);
    setCajaForm({
      codigo: caja.codigo,
      nombre: caja.nombre,
      descripcion: caja.descripcion || '',
      fondoFijo: caja.fondoFijo,
      monedaId: caja.monedaId,
      color: caja.color || '#FCE5B7',
      limite: caja.limite ? caja.limite.toString() : ''
    });
    setFormErrors({});
    setShowCajaModal(true);
  };

  const validateCajaForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!cajaForm.codigo.trim()) {
      errors.codigo = 'El código es requerido';
    }
    if (!cajaForm.nombre.trim()) {
      errors.nombre = 'El nombre es requerido';
    }
    if (!cajaForm.monedaId) {
      errors.monedaId = 'La moneda es requerida';
    }

    // Validar límite para fondos fijos
    if (cajaForm.fondoFijo) {
      if (!cajaForm.limite || cajaForm.limite.trim() === '') {
        errors.limite = 'El límite es requerido para fondos fijos';
      } else {
        const limiteNum = parseFloat(cajaForm.limite);
        if (isNaN(limiteNum) || limiteNum <= 0) {
          errors.limite = 'El límite debe ser un número mayor a 0';
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCajaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCajaForm()) {
      return;
    }

    setSubmitting(true);
    try {
      // Preparar datos para enviar, convirtiendo límite a número si existe
      const dataToSend = {
        ...cajaForm,
        limite: cajaForm.fondoFijo && cajaForm.limite ? parseFloat(cajaForm.limite) : undefined
      };

      if (editingCaja) {
        await cajasApi.update(editingCaja.id, dataToSend);
        toast.success('Caja actualizada correctamente');
      } else {
        await cajasApi.create(dataToSend);
        toast.success('Caja creada correctamente');
      }

      setShowCajaModal(false);
      await fetchCajas();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al guardar la caja');
      console.error('Error saving caja:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCaja = async (caja: Caja) => {
    const confirmed = await confirmDelete(`${caja.codigo} - ${caja.nombre}`);
    if (!confirmed) return;

    try {
      await cajasApi.delete(caja.id);
      toast.success('Caja eliminada correctamente');
      await fetchCajas();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al eliminar la caja');
      console.error('Error deleting caja:', error);
    }
  };

  const handleViewUsers = async (caja: Caja) => {
    setSelectedCajaForUsers(caja);
    setShowUsersModal(true);
    setLoadingUsers(true);

    try {
      const response = await cajasApi.getUsers(caja.id);
      const users = response.users || [];
      setCajaUsers(users);

      // Actualizar el estado de cajas con usuarios
      const newCajasWithUsers = new Set(cajasWithUsers);
      if (users.length > 0) {
        newCajasWithUsers.add(caja.id);
      } else {
        newCajasWithUsers.delete(caja.id);
      }
      setCajasWithUsers(newCajasWithUsers);
    } catch (error: any) {
      toast.error('Error al cargar los usuarios de la caja');
      console.error('Error loading caja users:', error);
      setCajaUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const filteredCajas = cajas.filter(caja =>
    caja.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caja.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (caja.descripcion && caja.descripcion.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (caja.moneda?.codigo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (caja.moneda?.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Cajas</h2>
          <p className="text-sm text-text-secondary mt-1">
            Gestiona las cajas de dinero y fondos fijos del sistema
          </p>
        </div>
        <Button onClick={handleCreateCaja}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Caja
        </Button>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-lg shadow-sm border border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por código, nombre, descripción o moneda..."
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
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Moneda
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Color
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Fondo Fijo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Límite
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    Cargando...
                  </td>
                </tr>
              ) : filteredCajas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-text-secondary">
                    {searchTerm ? 'No se encontraron cajas' : 'No hay cajas registradas'}
                  </td>
                </tr>
              ) : (
                filteredCajas.map((caja) => (
                  <tr key={caja.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                      {caja.codigo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {caja.nombre}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {caja.descripcion || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {caja.moneda?.codigo} - {caja.moneda?.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <div
                          className="w-6 h-6 rounded border border-gray-300"
                          style={{ backgroundColor: caja.color || '#FCE5B7' }}
                        ></div>
                        <span className="text-xs text-text-secondary font-mono">
                          {caja.color || '#FCE5B7'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {caja.fondoFijo ? (
                        <CheckCircle className="w-5 h-5 text-green-500 inline" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400 inline" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-text-primary">
                      {caja.fondoFijo && caja.limite ? (
                        <span className="text-blue-600 font-semibold">
                          {new Intl.NumberFormat('es-AR', {
                            style: 'currency',
                            currency: caja.moneda?.codigo || 'ARS',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(caja.limite)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {cajasWithUsers.has(caja.id) && (
                        <button
                          onClick={() => handleViewUsers(caja)}
                          className="text-blue-600 hover:text-blue-700 mr-3"
                          title="Ver usuarios asignados"
                        >
                          <Users className="w-4 h-4 inline" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditCaja(caja)}
                        className="text-green-600 hover:text-green-700 mr-3"
                      >
                        <Edit className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDeleteCaja(caja)}
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
      {showCajaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-medium text-text-primary">
                {editingCaja ? 'Editar Caja' : 'Nueva Caja'}
              </h3>
            </div>

            <form onSubmit={handleCajaSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={cajaForm.codigo}
                  onChange={(e) => setCajaForm({ ...cajaForm, codigo: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: CAJA_CENTRAL"
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
                  value={cajaForm.nombre}
                  onChange={(e) => setCajaForm({ ...cajaForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: Caja Central"
                  disabled={submitting}
                />
                {formErrors.nombre && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.nombre}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={cajaForm.descripcion}
                  onChange={(e) => setCajaForm({ ...cajaForm, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Descripción opcional"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Moneda *
                </label>
                <select
                  value={cajaForm.monedaId}
                  onChange={(e) => setCajaForm({ ...cajaForm, monedaId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={submitting}
                >
                  <option value="">Seleccionar moneda</option>
                  {monedas.map((moneda) => (
                    <option key={moneda.id} value={moneda.id}>
                      {moneda.codigo} - {moneda.nombre}
                    </option>
                  ))}
                </select>
                {formErrors.monedaId && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.monedaId}</p>
                )}
              </div>

              {/* Campo de color */}
              <div>
                <label htmlFor="color" className="block text-sm font-medium text-text-primary mb-1">
                  Color de la tarjeta
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    id="color"
                    value={cajaForm.color}
                    onChange={(e) => setCajaForm({ ...cajaForm, color: e.target.value })}
                    className="h-10 w-20 border border-gray-300 rounded-md"
                    disabled={submitting}
                  />
                  <input
                    type="text"
                    value={cajaForm.color}
                    onChange={(e) => setCajaForm({ ...cajaForm, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="#FCE5B7"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="fondoFijo"
                  checked={cajaForm.fondoFijo}
                  onChange={(e) => setCajaForm({ ...cajaForm, fondoFijo: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  disabled={submitting}
                />
                <label htmlFor="fondoFijo" className="ml-2 text-sm font-medium text-text-primary">
                  Es fondo fijo
                </label>
              </div>

              {/* Campo límite - solo visible para fondos fijos */}
              {cajaForm.fondoFijo && (
                <div>
                  <label htmlFor="limite" className="block text-sm font-medium text-text-primary mb-2">
                    Límite <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="limite"
                    step="0.01"
                    min="0"
                    value={cajaForm.limite}
                    onChange={(e) => setCajaForm({ ...cajaForm, limite: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                    disabled={submitting}
                    required={cajaForm.fondoFijo}
                  />
                  {formErrors.limite && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.limite}</p>
                  )}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCajaModal(false)}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'Guardando...' : editingCaja ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de usuarios de la caja */}
      {showUsersModal && selectedCajaForUsers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-medium text-text-primary">
                Usuarios asignados a {selectedCajaForUsers.nombre}
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Código: {selectedCajaForUsers.codigo}
              </p>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              {loadingUsers ? (
                <div className="text-center py-8">
                  <div className="text-text-secondary">Cargando usuarios...</div>
                </div>
              ) : cajaUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-text-secondary">No hay usuarios asignados a esta caja</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cajaUsers.map((user: any) => (
                    <div
                      key={user.id}
                      className="flex items-center p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {user.nombre?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-text-primary">
                          {user.nombre} {user.apellido}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {user.email}
                        </p>
                      </div>
                      <div className="text-xs text-text-secondary">
                        Usuario
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border">
              <Button
                onClick={() => {
                  setShowUsersModal(false);
                  setSelectedCajaForUsers(null);
                  setCajaUsers([]);
                }}
                variant="outline"
                className="w-full"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}