'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Trash2, Plus, User } from 'lucide-react';
import { CreditCardIcon } from '@/components/ui/CreditCardIcon';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { delegacionesApi, type Delegacion } from '@/lib/api';
import toast from 'react-hot-toast';
import DelegacionEditModal from './DelegacionEditModal';


interface DelegacionesTabProps {
  userId: string;
  userName: string;
}

export default function DelegacionesTab({ userId, userName }: DelegacionesTabProps) {
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { confirmDelete } = useConfirmDialog();
  

  const fetchDelegaciones = async () => {
    try {
      setLoading(true);
      const delegaciones = await delegacionesApi.getByUserId(userId);
      setDelegaciones(delegaciones);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar delegaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchDelegaciones();
    }
  }, [userId]);

  const handleDelete = async (delegacionId: string) => {
    const delegacion = delegaciones.find(d => d.id === delegacionId);
    const cardNumber = delegacion ? formatCardNumber(delegacion.tarjetaCredito.numeroTarjeta) : 'esta tarjeta';
    
    const confirmed = await confirmDelete(`la delegación de la tarjeta ${cardNumber}`);
    if (!confirmed) {
      return;
    }

    try {
      // Para eliminar, simplemente actualizamos sin esa tarjeta
      const tarjetasRestantes = delegaciones
        .filter(d => d.id !== delegacionId)
        .map(d => d.tarjetaCreditoId);

      await delegacionesApi.update(userId, tarjetasRestantes);
      toast.success('Delegación eliminada correctamente');
      fetchDelegaciones();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar la delegación');
    }
  };

  const handleModalSuccess = () => {
    setModalOpen(false);
    fetchDelegaciones();
  };

  const formatCardNumber = (numero: string) => {
    return numero.replace(/(.{4})/g, '$1 ').trim();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Cargando delegaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-border flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            Delegaciones de {userName}
          </h3>
          <p className="text-sm text-text-secondary">
            Tarjetas de otros usuarios que este usuario puede rendir
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          size="sm"
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Delegación</span>
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {delegaciones.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-text-secondary">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No hay delegaciones asignadas a este usuario</p>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Tarjeta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Marca
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Propietario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {delegaciones.map((delegacion) => (
                <tr key={delegacion.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <CreditCardIcon 
                        brand={delegacion.tarjetaCredito.marcaTarjeta}
                        size="sm"
                      />
                      <span className="font-mono text-sm text-text-primary">
                        {formatCardNumber(delegacion.tarjetaCredito.numeroTarjeta)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="secondary" className="text-xs">
                      {delegacion.tarjetaCredito.marcaTarjeta}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-text-primary">
                      {delegacion.tarjetaCredito.user.apellido}, {delegacion.tarjetaCredito.user.nombre}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-text-secondary">
                      {delegacion.tarjetaCredito.user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleDelete(delegacion.id)}
                      className="text-red-600 hover:text-red-900 p-1 rounded"
                      title="Eliminar delegación"
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

      <DelegacionEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={userId}
        onSuccess={handleModalSuccess}
        delegacionesActuales={delegaciones}
      />
    </div>
  );
}