'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { atributosApi, valoresAtributoApi, userAtributosApi } from '@/lib/api';

interface Atributo {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
}

interface ValorAtributo {
  id: string;
  atributoId: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
}

interface UserAtributo {
  id: string;
  userId: string;
  valorAtributoId: string;
  valorAtributo?: ValorAtributo & {
    atributo: Atributo;
  };
}

interface UserAtributosManagerProps {
  userId: string;
}

export function UserAtributosManager({ userId }: UserAtributosManagerProps) {
  const [userAtributos, setUserAtributos] = useState<UserAtributo[]>([]);
  const [atributos, setAtributos] = useState<Atributo[]>([]);
  const [valores, setValores] = useState<ValorAtributo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAtributoId, setSelectedAtributoId] = useState('');
  const [selectedValorId, setSelectedValorId] = useState('');

  useEffect(() => {
    if (userId) {
      loadUserAtributos();
      loadAtributos();
    }
  }, [userId]);

  const loadUserAtributos = async () => {
    try {
      const data = await userAtributosApi.getByUserId(userId);
      setUserAtributos(Array.isArray(data.userAtributos) ? data.userAtributos : []);
    } catch (error) {
      console.error('Error loading user atributos:', error);
      setUserAtributos([]);
    }
  };

  const loadAtributos = async () => {
    try {
      const data = await atributosApi.getAll();
      setAtributos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading atributos:', error);
      setAtributos([]);
    }
  };

  const loadValores = async (atributoId: string) => {
    try {
      const data = await valoresAtributoApi.getAll();
      const filtered = Array.isArray(data)
        ? data.filter((v: ValorAtributo) => v.atributoId === atributoId && v.activo)
        : [];
      setValores(filtered);
    } catch (error) {
      console.error('Error loading valores:', error);
      setValores([]);
    }
  };

  const handleAtributoChange = (atributoId: string) => {
    setSelectedAtributoId(atributoId);
    setSelectedValorId('');
    if (atributoId) {
      loadValores(atributoId);
    } else {
      setValores([]);
    }
  };

  const handleAdd = async () => {
    if (!selectedValorId) return;

    setLoading(true);
    try {
      await userAtributosApi.create({
        userId,
        valorAtributoId: selectedValorId
      });

      await loadUserAtributos();
      setShowAddForm(false);
      setSelectedAtributoId('');
      setSelectedValorId('');
      setValores([]);
    } catch (error) {
      console.error('Error adding atributo:', error);
      alert('Error al asignar atributo');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este atributo del usuario?')) return;

    setLoading(true);
    try {
      await userAtributosApi.delete(id);
      await loadUserAtributos();
    } catch (error) {
      console.error('Error deleting atributo:', error);
      alert('Error al eliminar atributo');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableAtributos = () => {
    const assignedAtributoIds = new Set(
      userAtributos.filter(ua => ua.valorAtributo).map(ua => ua.valorAtributo!.atributo.id)
    );
    return atributos.filter(a => !assignedAtributoIds.has(a.id) && a.activo);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Atributos del Usuario
        </h3>
        {!showAddForm && getAvailableAtributos().length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            disabled={loading}
          >
            <Plus className="w-4 h-4 mr-1" />
            Asignar Atributo
          </Button>
        )}
      </div>

      {/* Formulario para agregar */}
      {showAddForm && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Atributo
              </label>
              <select
                value={selectedAtributoId}
                onChange={(e) => handleAtributoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={loading}
              >
                <option value="">Seleccionar...</option>
                {getAvailableAtributos().map((atributo) => (
                  <option key={atributo.id} value={atributo.id}>
                    {atributo.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Valor
              </label>
              <select
                value={selectedValorId}
                onChange={(e) => setSelectedValorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={!selectedAtributoId || loading}
              >
                <option value="">Seleccionar...</option>
                {valores.map((valor) => (
                  <option key={valor.id} value={valor.id}>
                    {valor.descripcion}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!selectedValorId || loading}
            >
              Agregar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setSelectedAtributoId('');
                setSelectedValorId('');
                setValores([]);
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de atributos asignados */}
      <div className="space-y-2">
        {userAtributos.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No hay atributos asignados
          </p>
        ) : (
          userAtributos.filter(ua => ua.valorAtributo).map((ua) => (
            <div
              key={ua.id}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-palette-purple/30 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {ua.valorAtributo!.atributo.descripcion}
                </p>
                <p className="text-xs text-gray-600">
                  {ua.valorAtributo!.descripcion}
                </p>
              </div>
              <button
                onClick={() => handleDelete(ua.id)}
                disabled={loading}
                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                title="Eliminar atributo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
