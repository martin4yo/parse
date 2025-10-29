'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Trash2, Plus, User as UserIcon, UserCheck } from 'lucide-react';
import { usuariosAutorizantesApi, usersApi, type UsuarioAutorizante, type User } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/hooks/useConfirm';

interface AutorizantesTabProps {
  userId: string;
  userName: string;
}

export default function AutorizantesTab({ userId, userName }: AutorizantesTabProps) {
  const { confirmDelete } = useConfirmDialog();
  const [autorizantes, setAutorizantes] = useState<UsuarioAutorizante[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedAutorizanteId, setSelectedAutorizanteId] = useState('');

  const fetchAutorizantes = async () => {
    try {
      setLoading(true);
      const response = await usuariosAutorizantesApi.getByUserId(userId);
      setAutorizantes(response.autorizantes);
    } catch (error) {
      toast.error('Error al cargar autorizantes');
      console.error('Error loading autorizantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await usersApi.getAll();
      // Filtrar el usuario actual y los que ya son autorizantes
      const currentAutorizantesIds = autorizantes.map(a => a.autorizanteId);
      const filtered = response.users.filter(user => 
        user.id !== userId && !currentAutorizantesIds.includes(user.id)
      );
      setAvailableUsers(filtered);
    } catch (error) {
      toast.error('Error al cargar usuarios disponibles');
      console.error('Error loading available users:', error);
    }
  };

  useEffect(() => {
    fetchAutorizantes();
  }, [userId]);

  useEffect(() => {
    if (showModal) {
      fetchAvailableUsers();
    }
  }, [showModal, autorizantes]);

  const handleAddAutorizante = async () => {
    if (!selectedAutorizanteId) return;

    try {
      await usuariosAutorizantesApi.create({
        usuarioId: userId,
        autorizanteId: selectedAutorizanteId
      });
      
      toast.success('Autorizante agregado correctamente');
      setShowModal(false);
      setSelectedAutorizanteId('');
      fetchAutorizantes();
    } catch (error) {
      toast.error('Error al agregar autorizante');
      console.error('Error adding autorizante:', error);
    }
  };

  const handleDeleteAutorizante = async (autorizanteId: string, autorizanteName: string) => {
    const confirmed = await confirmDelete(autorizanteName);
    if (!confirmed) {
      return;
    }

    try {
      await usuariosAutorizantesApi.delete(autorizanteId);
      toast.success('Autorizante removido correctamente');
      fetchAutorizantes();
    } catch (error) {
      toast.error('Error al remover autorizante');
      console.error('Error deleting autorizante:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-secondary">Cargando autorizantes...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-border flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            Autorizantes de {userName}
          </h3>
          <p className="text-sm text-text-secondary">
            Usuarios que pueden autorizar las rendiciones de este usuario
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          size="sm"
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Autorizante</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {autorizantes.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-text-secondary">
              <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No hay autorizantes asignados a este usuario</p>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Autorizante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Fecha Agregado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {autorizantes.map((autorizante) => (
                <tr key={autorizante.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-text-primary">
                        {autorizante.autorizante.apellido}, {autorizante.autorizante.nombre}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-text-secondary">
                      {autorizante.autorizante.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-text-secondary">
                      {new Date(autorizante.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleDeleteAutorizante(autorizante.id, `${autorizante.autorizante.apellido}, ${autorizante.autorizante.nombre}`)}
                      className="text-red-600 hover:text-red-900 p-1 rounded"
                      title="Remover autorizante"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal para agregar autorizante */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                Agregar Autorizante
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Seleccionar Usuario Autorizante
                </label>
                <select
                  value={selectedAutorizanteId}
                  onChange={(e) => setSelectedAutorizanteId(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                >
                  <option value="">Seleccionar usuario...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.apellido}, {user.nombre} - {user.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddAutorizante}
                  disabled={!selectedAutorizanteId}
                  className="flex-1"
                >
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}