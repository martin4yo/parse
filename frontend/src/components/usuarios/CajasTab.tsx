'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Wallet, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { userCajasApi, cajasApi, type UserCaja, type Caja, type User } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';

interface CajasTabProps {
  selectedUser: User | null;
}

export default function CajasTab({ selectedUser }: CajasTabProps) {
  const { confirmDelete } = useConfirmDialog();
  const [userCajas, setUserCajas] = useState<UserCaja[]>([]);
  const [availableCajas, setAvailableCajas] = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Form data
  const [selectedCajaId, setSelectedCajaId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUserCajas = async () => {
    if (!selectedUser?.id) return;

    try {
      setLoading(true);
      const response = await userCajasApi.getByUser(selectedUser.id);
      setUserCajas(response.userCajas);
    } catch (error) {
      toast.error('Error al cargar cajas del usuario');
      console.error('Error loading user cajas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCajas = async () => {
    try {
      const response = await userCajasApi.getAvailableCajas();
      setAvailableCajas(response.cajas);
    } catch (error) {
      toast.error('Error al cargar cajas disponibles');
      console.error('Error loading available cajas:', error);
    }
  };

  useEffect(() => {
    if (selectedUser?.id) {
      fetchUserCajas();
      fetchAvailableCajas();
    }
  }, [selectedUser?.id]);

  const handleAssignCaja = () => {
    setSelectedCajaId('');
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser?.id || !selectedCajaId) {
      toast.error('Debe seleccionar una caja');
      return;
    }

    setSubmitting(true);
    try {
      await userCajasApi.create({
        userId: selectedUser.id,
        cajaId: selectedCajaId
      });

      toast.success('Caja asignada correctamente');
      setShowAssignModal(false);
      await fetchUserCajas();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al asignar la caja');
      console.error('Error assigning caja:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignCaja = async (userCaja: UserCaja) => {
    const cajaName = userCaja.caja ? `${userCaja.caja.codigo} - ${userCaja.caja.nombre}` : 'Caja';
    const confirmed = await confirmDelete(cajaName);
    if (!confirmed) return;

    try {
      await userCajasApi.delete(userCaja.id);
      toast.success('Caja desasignada correctamente');
      await fetchUserCajas();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al desasignar la caja');
      console.error('Error unassigning caja:', error);
    }
  };

  const filteredUserCajas = userCajas.filter(userCaja => {
    if (!userCaja.caja) return false;
    return (
      userCaja.caja.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userCaja.caja.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (userCaja.caja.descripcion && userCaja.caja.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const getUnassignedCajas = () => {
    const assignedCajaIds = userCajas.map(uc => uc.cajaId);
    return availableCajas.filter(caja => !assignedCajaIds.includes(caja.id));
  };

  if (!selectedUser) {
    return (
      <div className="text-center py-12">
        <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-text-secondary">Selecciona un usuario para gestionar sus cajas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-text-primary">
            Cajas asignadas a {selectedUser.nombre} {selectedUser.apellido}
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            Gestiona las cajas de dinero que puede utilizar este usuario
          </p>
        </div>
        <Button onClick={handleAssignCaja} disabled={getUnassignedCajas().length === 0}>
          <Plus className="w-4 h-4 mr-2" />
          Asignar Caja
        </Button>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-lg shadow-sm border border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por código, nombre o descripción..."
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
                  Fondo Fijo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    Cargando...
                  </td>
                </tr>
              ) : filteredUserCajas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-text-secondary">
                    {searchTerm ? 'No se encontraron cajas asignadas' : 'No hay cajas asignadas a este usuario'}
                  </td>
                </tr>
              ) : (
                filteredUserCajas.map((userCaja) => (
                  <tr key={userCaja.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                      {userCaja.caja?.codigo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {userCaja.caja?.nombre}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {userCaja.caja?.descripcion || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {userCaja.caja?.moneda?.codigo} - {userCaja.caja?.moneda?.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {userCaja.caja?.fondoFijo ? (
                        <CheckCircle className="w-5 h-5 text-green-500 inline" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400 inline" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleUnassignCaja(userCaja)}
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

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-medium text-text-primary">
                Asignar Caja a {selectedUser.nombre} {selectedUser.apellido}
              </h3>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Caja *
                </label>
                <select
                  value={selectedCajaId}
                  onChange={(e) => setSelectedCajaId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={submitting}
                  required
                >
                  <option value="">Seleccionar caja</option>
                  {getUnassignedCajas().map((caja) => (
                    <option key={caja.id} value={caja.id}>
                      {caja.codigo} - {caja.nombre}
                      {caja.fondoFijo && ' (Fondo Fijo)'}
                      {caja.moneda && ` - ${caja.moneda.codigo}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAssignModal(false)}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'Asignando...' : 'Asignar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}