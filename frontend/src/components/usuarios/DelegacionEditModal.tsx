'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { usersApi, userTarjetasCreditoApi, delegacionesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface TarjetaCredito {
  id: string;
  numeroTarjeta: string;
  marcaTarjeta: string;
  user?: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  };
}

interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  tarjetasCredito?: TarjetaCredito[];
}

interface Delegacion {
  id: string;
  usuarioId: string;
  tarjetaCreditoId: string;
  tarjetaCredito: TarjetaCredito;
}

interface DelegacionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  delegacionesActuales: Delegacion[];
}

export default function DelegacionEditModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
  delegacionesActuales
}: DelegacionEditModalProps) {
  const [availableUsers, setAvailableUsers] = useState<Usuario[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTarjetaId, setSelectedTarjetaId] = useState('');
  const [userTarjetas, setUserTarjetas] = useState<TarjetaCredito[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTarjetas, setLoadingTarjetas] = useState(false);

  const fetchAvailableUsers = async () => {
    try {
      setLoading(true);
      const response = await usersApi.getAll();
      
      // Obtener los IDs de usuarios que ya tienen delegaciones
      const usuariosConDelegaciones = delegacionesActuales
        .filter(d => d.tarjetaCredito.user)
        .map(d => d.tarjetaCredito.user!.id);
      
      // Filtrar usuarios: excluir el usuario actual y los que ya tienen delegaciones
      const filtered = response.users.filter(user => 
        user.id !== userId && 
        !usuariosConDelegaciones.includes(user.id)
      );
      
      setAvailableUsers(filtered);
    } catch (error) {
      toast.error('Error al cargar usuarios disponibles');
      console.error('Error loading available users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAvailableUsers();
      setSelectedUserId('');
      setSelectedTarjetaId('');
    }
  }, [isOpen, delegacionesActuales]);

  const fetchUserTarjetas = async (selectedUserIdValue: string) => {
    if (!selectedUserIdValue) {
      setUserTarjetas([]);
      return;
    }

    try {
      setLoadingTarjetas(true);
      const response = await userTarjetasCreditoApi.getByUserId(selectedUserIdValue);
      setUserTarjetas(response.tarjetas || []);
    } catch (error) {
      console.error('Error loading user tarjetas:', error);
      setUserTarjetas([]);
      toast.error('Error al cargar tarjetas del usuario');
    } finally {
      setLoadingTarjetas(false);
    }
  };

  const handleUserSelect = (selectedUserIdValue: string) => {
    setSelectedUserId(selectedUserIdValue);
    setSelectedTarjetaId(''); // Reset tarjeta selection when user changes
    fetchUserTarjetas(selectedUserIdValue);
  };

  const handleAddDelegacion = async () => {
    if (!selectedTarjetaId) return;

    try {
      setLoading(true);
      
      // Agregar la nueva tarjeta a las delegaciones existentes
      const tarjetasActuales = delegacionesActuales.map(d => d.tarjetaCreditoId);
      const nuevasTarjetas = [...tarjetasActuales, selectedTarjetaId];

      await delegacionesApi.update(userId, nuevasTarjetas);

      toast.success('Delegación agregada correctamente');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Error al agregar delegación');
      console.error('Error adding delegacion:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary">
            Agregar Delegación
          </h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Seleccionar Usuario
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => handleUserSelect(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              disabled={loading}
            >
              <option value="">Seleccionar usuario...</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.apellido}, {user.nombre} - {user.email}
                </option>
              ))}
            </select>
          </div>

          {selectedUserId && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Seleccionar Tarjeta
              </label>
              <select
                value={selectedTarjetaId}
                onChange={(e) => setSelectedTarjetaId(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                disabled={loadingTarjetas}
              >
                <option value="">
                  {loadingTarjetas ? 'Cargando tarjetas...' : 'Seleccionar tarjeta...'}
                </option>
                {userTarjetas.map((tarjeta) => (
                  <option key={tarjeta.id} value={tarjeta.id}>
                    {tarjeta.marcaTarjeta} - **** **** **** {tarjeta.numeroTarjeta.slice(-4)}
                  </option>
                ))}
              </select>
              {selectedUserId && !loadingTarjetas && userTarjetas.length === 0 && (
                <p className="text-sm text-text-secondary mt-1">
                  Este usuario no tiene tarjetas de crédito registradas
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddDelegacion}
              disabled={loading || !selectedTarjetaId}
              className="flex-1"
            >
              {loading ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}