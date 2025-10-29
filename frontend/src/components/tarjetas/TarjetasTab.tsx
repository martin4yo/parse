'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Search, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { tarjetasApi, tiposTarjetaApi, Tarjeta, TipoTarjeta } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';

const tarjetaSchema = z.object({
  codigo: z
    .string()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(10, 'El código no puede tener más de 10 caracteres')
    .regex(/^[A-Z0-9]+$/, 'Solo letras mayúsculas y números'),
  descripcion: z
    .string()
    .min(1, 'La descripción es requerida')
    .max(100, 'La descripción no puede tener más de 100 caracteres'),
});

const tipoTarjetaSchema = z.object({
  codigo: z
    .string()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(10, 'El código no puede tener más de 10 caracteres')
    .regex(/^[A-Z0-9]+$/, 'Solo letras mayúsculas y números'),
  descripcion: z
    .string()
    .min(3, 'La descripción debe tener al menos 3 caracteres')
    .max(100, 'La descripción no puede tener más de 100 caracteres'),
});

type TarjetaFormData = z.infer<typeof tarjetaSchema>;
type TipoTarjetaFormData = z.infer<typeof tipoTarjetaSchema>;

export default function TarjetasTab() {
  const { confirmDelete } = useConfirmDialog();
  
  // Estados para tarjetas
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [selectedTarjeta, setSelectedTarjeta] = useState<Tarjeta | null>(null);
  const [isLoadingTarjetas, setIsLoadingTarjetas] = useState(true);
  const [searchTermTarjetas, setSearchTermTarjetas] = useState('');
  
  // Estados para tipos de tarjeta
  const [tiposTarjeta, setTiposTarjeta] = useState<TipoTarjeta[]>([]);
  const [isLoadingTipos, setIsLoadingTipos] = useState(false);
  const [searchTermTipos, setSearchTermTipos] = useState('');
  
  // Estados para modales
  const [isTarjetaModalOpen, setIsTarjetaModalOpen] = useState(false);
  const [isTipoModalOpen, setIsTipoModalOpen] = useState(false);
  const [editingTarjeta, setEditingTarjeta] = useState<Tarjeta | null>(null);
  const [editingTipo, setEditingTipo] = useState<TipoTarjeta | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const tarjetaForm = useForm<TarjetaFormData>({
    resolver: zodResolver(tarjetaSchema),
  });

  const tipoForm = useForm<TipoTarjetaFormData>({
    resolver: zodResolver(tipoTarjetaSchema),
  });

  // Cargar tarjetas (maestro)
  const loadTarjetas = async () => {
    try {
      setIsLoadingTarjetas(true);
      const response = await tarjetasApi.getAll();
      setTarjetas(response.tarjetas);
    } catch (error) {
      toast.error('Error al cargar las marcas de tarjetas');
    } finally {
      setIsLoadingTarjetas(false);
    }
  };

  // Cargar tipos de tarjeta (detalle)
  const loadTiposTarjeta = async (tarjetaId: string) => {
    try {
      setIsLoadingTipos(true);
      const response = await tiposTarjetaApi.getAll(tarjetaId);
      setTiposTarjeta(response.tiposTarjeta);
    } catch (error) {
      toast.error('Error al cargar los tipos de tarjeta');
    } finally {
      setIsLoadingTipos(false);
    }
  };

  useEffect(() => {
    loadTarjetas();
  }, []);

  // Seleccionar tarjeta y cargar sus tipos
  const handleSelectTarjeta = (tarjeta: Tarjeta) => {
    setSelectedTarjeta(tarjeta);
    loadTiposTarjeta(tarjeta.id);
  };

  // Modales de tarjetas
  const openTarjetaModal = (tarjeta?: Tarjeta) => {
    if (tarjeta) {
      setEditingTarjeta(tarjeta);
      tarjetaForm.setValue('codigo', tarjeta.codigo);
      tarjetaForm.setValue('descripcion', tarjeta.descripcion);
    } else {
      setEditingTarjeta(null);
      tarjetaForm.reset();
    }
    setIsTarjetaModalOpen(true);
  };

  const closeTarjetaModal = () => {
    setIsTarjetaModalOpen(false);
    setEditingTarjeta(null);
    tarjetaForm.reset();
  };

  // Modales de tipos de tarjeta
  const openTipoModal = (tipo?: TipoTarjeta) => {
    if (tipo) {
      setEditingTipo(tipo);
      tipoForm.setValue('codigo', tipo.codigo);
      tipoForm.setValue('descripcion', tipo.descripcion);
    } else {
      setEditingTipo(null);
      tipoForm.reset();
    }
    setIsTipoModalOpen(true);
  };

  const closeTipoModal = () => {
    setIsTipoModalOpen(false);
    setEditingTipo(null);
    tipoForm.reset();
  };


  // Submit tarjetas
  const onSubmitTarjeta = async (data: TarjetaFormData) => {
    setIsSubmitting(true);
    try {
      if (editingTarjeta) {
        await tarjetasApi.update(editingTarjeta.id, data);
        toast.success('Marca de tarjeta actualizada correctamente');
      } else {
        await tarjetasApi.create(data);
        toast.success('Marca de tarjeta creada correctamente');
      }
      
      await loadTarjetas();
      closeTarjetaModal();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al guardar la marca de tarjeta';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit tipos de tarjeta
  const onSubmitTipo = async (data: TipoTarjetaFormData) => {
    if (!selectedTarjeta) return;
    
    setIsSubmitting(true);
    try {
      if (editingTipo) {
        await tiposTarjetaApi.update(editingTipo.id, data);
        toast.success('Tipo de tarjeta actualizado correctamente');
      } else {
        await tiposTarjetaApi.create({ ...data, tarjetaId: selectedTarjeta.id });
        toast.success('Tipo de tarjeta creado correctamente');
      }
      
      await loadTiposTarjeta(selectedTarjeta.id);
      closeTipoModal();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al guardar el tipo de tarjeta';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handlers
  const handleDeleteTarjeta = async (tarjeta: Tarjeta) => {
    const confirmed = await confirmDelete(`la marca "${tarjeta.descripcion}"`);
    if (confirmed) {
      try {
        await tarjetasApi.delete(tarjeta.id);
        toast.success('Marca de tarjeta eliminada correctamente');
        await loadTarjetas();
        if (selectedTarjeta?.id === tarjeta.id) {
          setSelectedTarjeta(null);
          setTiposTarjeta([]);
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Error al eliminar la marca';
        toast.error(errorMessage);
      }
    }
  };

  const handleDeleteTipo = async (tipo: TipoTarjeta) => {
    if (!selectedTarjeta) return;
    
    const confirmed = await confirmDelete(`el tipo "${tipo.descripcion}"`);
    if (confirmed) {
      try {
        await tiposTarjetaApi.delete(tipo.id);
        toast.success('Tipo de tarjeta eliminado correctamente');
        await loadTiposTarjeta(selectedTarjeta.id);
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Error al eliminar el tipo';
        toast.error(errorMessage);
      }
    }
  };

  // Filtros
  const filteredTarjetas = tarjetas.filter(tarjeta =>
    tarjeta.codigo.toLowerCase().includes(searchTermTarjetas.toLowerCase()) ||
    tarjeta.descripcion.toLowerCase().includes(searchTermTarjetas.toLowerCase())
  );

  const filteredTipos = tiposTarjeta.filter(tipo =>
    tipo.codigo.toLowerCase().includes(searchTermTipos.toLowerCase()) ||
    tipo.descripcion.toLowerCase().includes(searchTermTipos.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-5 h-5 absolute left-3 top-3 text-text-secondary" />
        <input
          type="text"
          placeholder="Buscar marcas de tarjetas..."
          value={searchTermTarjetas}
          onChange={(e) => setSearchTermTarjetas(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Marcas de Tarjetas Table - Left */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-text-primary">Marcas de Tarjetas</h3>
            <Button 
              onClick={() => openTarjetaModal()}
              size="sm"
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Marca</span>
            </Button>
          </div>

          <div className="bg-white rounded-lg border border-border overflow-hidden">
            {isLoadingTarjetas ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">Cargando marcas...</p>
                </div>
              </div>
            ) : filteredTarjetas.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-text-secondary">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{searchTermTarjetas ? 'No se encontraron marcas que coincidan con la búsqueda' : 'No hay marcas registradas'}</p>
                </div>
              </div>
            ) : (
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
                    {filteredTarjetas.map((tarjeta) => (
                      <tr 
                        key={tarjeta.id} 
                        className={`cursor-pointer transition-colors ${
                          selectedTarjeta?.id === tarjeta.id 
                            ? 'bg-primary/10' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => handleSelectTarjeta(tarjeta)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-text-primary">{tarjeta.codigo}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-text-primary">{tarjeta.descripcion}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openTarjetaModal(tarjeta)}
                              className="text-green-600 hover:text-green-700 p-1"
                              title="Editar marca"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTarjeta(tarjeta)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Eliminar marca"
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
            )}
          </div>
        </div>

        {/* Tipos de Tarjeta Table - Right */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-text-primary">
                {selectedTarjeta 
                  ? `Tipos de ${selectedTarjeta.descripcion}`
                  : 'Tipos de Tarjeta'
                }
              </h3>
            </div>
            <Button 
              onClick={() => openTipoModal()}
              size="sm"
              className="flex items-center space-x-2"
              disabled={!selectedTarjeta}
              title={!selectedTarjeta ? 'Selecciona una marca primero' : 'Agregar nuevo tipo'}
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Tipo</span>
            </Button>
          </div>

          <div className="bg-white rounded-lg border border-border overflow-hidden">
            {!selectedTarjeta ? (
              <div className="text-center py-12">
                <div className="text-text-secondary">
                  <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <h4 className="text-lg font-medium mb-2">Selecciona una marca</h4>
                  <p className="text-sm">Selecciona una marca de tarjeta para ver sus tipos</p>
                </div>
              </div>
            ) : isLoadingTipos ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">Cargando tipos...</p>
                </div>
              </div>
            ) : filteredTipos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-text-secondary">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{searchTermTipos ? 'No se encontraron tipos que coincidan con la búsqueda' : 'No hay tipos para esta marca'}</p>
                </div>
              </div>
            ) : (
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
                    {filteredTipos.map((tipo) => (
                      <tr key={tipo.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-text-primary">{tipo.codigo}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-text-primary">{tipo.descripcion}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-1">
                            <button
                              onClick={() => openTipoModal(tipo)}
                              className="text-green-600 hover:text-green-700 p-1"
                              title="Editar tipo"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTipo(tipo)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Eliminar tipo"
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
            )}
          </div>
        </div>
      </div>

      {/* Modal Tarjeta */}
      {isTarjetaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              {editingTarjeta ? 'Editar Marca de Tarjeta' : 'Nueva Marca de Tarjeta'}
            </h2>
            
            <form onSubmit={tarjetaForm.handleSubmit(onSubmitTarjeta)} className="space-y-4">
              <Input
                label="Código *"
                placeholder="VISA"
                error={tarjetaForm.formState.errors.codigo?.message}
                {...tarjetaForm.register('codigo')}
              />
              
              <Input
                label="Descripción *"
                placeholder="Visa"
                error={tarjetaForm.formState.errors.descripcion?.message}
                {...tarjetaForm.register('descripcion')}
              />
              
              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeTarjetaModal}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  className="flex-1"
                >
                  {editingTarjeta ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tipo de Tarjeta */}
      {isTipoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              {editingTipo ? 'Editar Tipo de Tarjeta' : 'Nuevo Tipo de Tarjeta'}
            </h2>
            
            <form onSubmit={tipoForm.handleSubmit(onSubmitTipo)} className="space-y-4">
              <Input
                label="Código *"
                placeholder="CREDIT"
                error={tipoForm.formState.errors.codigo?.message}
                {...tipoForm.register('codigo')}
              />
              
              <Input
                label="Descripción *"
                placeholder="Crédito"
                error={tipoForm.formState.errors.descripcion?.message}
                {...tipoForm.register('descripcion')}
              />
              
              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeTipoModal}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  className="flex-1"
                >
                  {editingTipo ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}