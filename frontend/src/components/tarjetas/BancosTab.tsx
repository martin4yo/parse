'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Search, Building, ChevronRight, Link, Unlink } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { bancosApi, bancoTipoTarjetaApi, tiposTarjetaApi, Banco, BancoTipoTarjeta, TipoTarjeta } from '@/lib/api';
import { useConfirmDialog } from '@/hooks/useConfirm';

const bancoSchema = z.object({
  codigo: z
    .string()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(10, 'El código no puede tener más de 10 caracteres')
    .regex(/^[A-Z0-9]+$/, 'Solo letras mayúsculas y números'),
  descripcion: z
    .string()
    .min(5, 'La descripción debe tener al menos 5 caracteres')
    .max(100, 'La descripción no puede tener más de 100 caracteres'),
});

type BancoFormData = z.infer<typeof bancoSchema>;

export default function BancosTab() {
  const { confirmDelete, confirm } = useConfirmDialog();
  
  // Estados para bancos (maestro)
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [selectedBanco, setSelectedBanco] = useState<Banco | null>(null);
  const [isLoadingBancos, setIsLoadingBancos] = useState(true);
  const [searchTermBancos, setSearchTermBancos] = useState('');
  
  // Estados para tipos asociados (detalle)
  const [asociaciones, setAsociaciones] = useState<BancoTipoTarjeta[]>([]);
  const [tiposDisponibles, setTiposDisponibles] = useState<TipoTarjeta[]>([]);
  const [isLoadingAsociaciones, setIsLoadingAsociaciones] = useState(false);
  const [isLoadingTiposDisponibles, setIsLoadingTiposDisponibles] = useState(false);
  const [searchTermTipos, setSearchTermTipos] = useState('');
  
  // Estados removidos - ya no usamos paginado
  
  // Estados para modales
  const [isBancoModalOpen, setIsBancoModalOpen] = useState(false);
  const [isAsociarModalOpen, setIsAsociarModalOpen] = useState(false);
  const [editingBanco, setEditingBanco] = useState<Banco | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);

  // Forms
  const bancoForm = useForm<BancoFormData>({
    resolver: zodResolver(bancoSchema),
  });

  // Cargar bancos (maestro)
  const loadBancos = async () => {
    try {
      setIsLoadingBancos(true);
      const response = await bancosApi.getAll();
      setBancos(response.bancos);
    } catch (error) {
      toast.error('Error al cargar los bancos');
    } finally {
      setIsLoadingBancos(false);
    }
  };

  // Cargar asociaciones (detalle)
  const loadAsociaciones = async (bancoId: string) => {
    try {
      setIsLoadingAsociaciones(true);
      const response = await bancoTipoTarjetaApi.getAll(bancoId);
      setAsociaciones(response.asociaciones);
    } catch (error) {
      toast.error('Error al cargar las asociaciones');
    } finally {
      setIsLoadingAsociaciones(false);
    }
  };

  // Cargar tipos disponibles para asociar
  const loadTiposDisponibles = async (bancoId: string) => {
    try {
      setIsLoadingTiposDisponibles(true);
      const response = await bancoTipoTarjetaApi.getTiposDisponibles(bancoId);
      console.log('🔍 Tipos disponibles recibidos:', response.tiposDisponibles);
      console.log('🔍 Primer tipo:', response.tiposDisponibles[0]);
      setTiposDisponibles(response.tiposDisponibles);
    } catch (error) {
      toast.error('Error al cargar los tipos disponibles');
    } finally {
      setIsLoadingTiposDisponibles(false);
    }
  };

  useEffect(() => {
    loadBancos();
  }, []);

  // Seleccionar banco y cargar sus asociaciones
  const handleSelectBanco = (banco: Banco) => {
    setSelectedBanco(banco);
    loadAsociaciones(banco.id);
  };

  // Modales de bancos
  const openBancoModal = (banco?: Banco) => {
    if (banco) {
      setEditingBanco(banco);
      bancoForm.setValue('codigo', banco.codigo);
      bancoForm.setValue('descripcion', banco.descripcion);
    } else {
      setEditingBanco(null);
      bancoForm.reset();
    }
    setIsBancoModalOpen(true);
  };

  const closeBancoModal = () => {
    setIsBancoModalOpen(false);
    setEditingBanco(null);
    bancoForm.reset();
  };

  // Modal de asociar tipos
  const openAsociarModal = async () => {
    if (!selectedBanco) {
      toast.error('Selecciona un banco primero');
      return;
    }

    setSelectedTipos([]);
    await loadTiposDisponibles(selectedBanco.id);
    setIsAsociarModalOpen(true);
  };

  const closeAsociarModal = () => {
    setIsAsociarModalOpen(false);
    setSelectedTipos([]);
    setTiposDisponibles([]);
  };

  // Submit bancos
  const onSubmitBanco = async (data: BancoFormData) => {
    setIsSubmitting(true);
    try {
      if (editingBanco) {
        await bancosApi.update(editingBanco.id, data);
        toast.success('Banco actualizado correctamente');
      } else {
        await bancosApi.create(data);
        toast.success('Banco creado correctamente');
      }
      
      await loadBancos();
      closeBancoModal();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al guardar el banco';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Asociar tipos
  const onSubmitAsociaciones = async () => {
    if (!selectedBanco || selectedTipos.length === 0) return;

    setIsSubmitting(true);
    try {
      await bancoTipoTarjetaApi.createMultiple(selectedBanco.id, selectedTipos);
      toast.success(`${selectedTipos.length} tipos asociados correctamente`);
      
      await loadAsociaciones(selectedBanco.id);
      closeAsociarModal();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al asociar los tipos';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handlers
  const handleDeleteBanco = async (banco: Banco) => {
    const confirmed = await confirmDelete(`el banco "${banco.descripcion}"`);
    if (confirmed) {
      try {
        await bancosApi.delete(banco.id);
        toast.success('Banco eliminado correctamente');
        
        // Si era el seleccionado, limpiar selección
        if (selectedBanco?.id === banco.id) {
          setSelectedBanco(null);
          setAsociaciones([]);
        }
        
        await loadBancos();
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Error al eliminar el banco';
        toast.error(errorMessage);
      }
    }
  };

  const handleDesasociarTipo = async (asociacion: BancoTipoTarjeta) => {
    const tipoNombre = `${asociacion.tipoTarjeta?.tarjeta?.descripcion} ${asociacion.tipoTarjeta?.descripcion}`;
    
    const confirmed = await confirm(`¿Estás seguro de que quieres desasociar "${tipoNombre}" de este banco?`);

    if (confirmed) {
      try {
        await bancoTipoTarjetaApi.delete(asociacion.id);
        toast.success('Tipo desasociado correctamente');
        
        if (selectedBanco) {
          await loadAsociaciones(selectedBanco.id);
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Error al desasociar el tipo';
        toast.error(errorMessage);
      }
    }
  };

  // Toggle selection de tipos
  const toggleTipoSelection = (tipoId: string) => {
    setSelectedTipos(prev => 
      prev.includes(tipoId) 
        ? prev.filter(id => id !== tipoId)
        : [...prev, tipoId]
    );
  };

  // Filtros y paginado
  const filteredBancos = bancos.filter(banco =>
    banco.codigo.toLowerCase().includes(searchTermBancos.toLowerCase()) ||
    banco.descripcion.toLowerCase().includes(searchTermBancos.toLowerCase())
  );

  // Ya no usamos paginado - mostramos todos los bancos filtrados

  const filteredAsociaciones = asociaciones.filter(asociacion => {
    const tipoTexto = `${asociacion.tipoTarjeta?.tarjeta?.descripcion} ${asociacion.tipoTarjeta?.descripcion}`.toLowerCase();
    return tipoTexto.includes(searchTermTipos.toLowerCase());
  });

  return (
    <div className="h-full overflow-hidden">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-5 h-5 absolute left-3 top-3 text-text-secondary" />
          <input
            type="text"
            placeholder="Buscar bancos..."
            value={searchTermBancos}
            onChange={(e) => setSearchTermBancos(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Two column layout - más espacio para bancos */}
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-6 items-start">
        {/* Bancos Table - Left */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-text-primary">Bancos</h3>
            <Button
              onClick={() => openBancoModal()}
              size="sm"
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Banco</span>
            </Button>
          </div>

          <div className="bg-white rounded-lg border border-border overflow-hidden flex flex-col h-[500px]">
            {isLoadingBancos ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">Cargando bancos...</p>
                </div>
              </div>
            ) : filteredBancos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-text-secondary">
                  <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{searchTermBancos ? 'No se encontraron bancos que coincidan con la búsqueda' : 'No hay bancos registrados'}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto overflow-y-auto flex-1">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-border sticky top-0 z-10">
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
                      {filteredBancos.map((banco) => (
                        <tr 
                          key={banco.id} 
                          className={`cursor-pointer transition-colors ${
                            selectedBanco?.id === banco.id 
                              ? 'bg-blue-50' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleSelectBanco(banco)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-text-primary">{banco.codigo}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-text-primary">{banco.descripcion}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openBancoModal(banco);
                                }}
                                className="text-green-600 hover:text-green-700 p-1"
                                title="Editar banco"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBanco(banco);
                                }}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="Eliminar banco"
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
                
                {/* Pagination Controls - Estilo de rendiciones */}
                {filteredBancos.length > 0 && (
                  <div className="bg-gray-50 border-t border-border px-6 py-3">
                    <div className="text-sm text-text-secondary text-center">
                      Total: {filteredBancos.length} {filteredBancos.length === 1 ? 'banco' : 'bancos'}
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          </div>

          {/* Tipos Asociados Table - Right */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-text-primary">
                  {selectedBanco
                    ? `Tipos Asociados a ${selectedBanco.descripcion}`
                    : 'Tipos de Tarjeta Asociados'
                  }
                </h3>
              </div>
              <Button
                onClick={openAsociarModal}
                size="sm"
                className="flex items-center space-x-2"
                disabled={!selectedBanco}
                title={!selectedBanco ? 'Selecciona un banco primero' : 'Asociar tipos de tarjeta'}
              >
                <Link className="w-4 h-4" />
                <span>Asociar Tipos</span>
              </Button>
            </div>

            <div className="bg-white rounded-lg border border-border overflow-hidden flex flex-col h-[500px]">
            {!selectedBanco ? (
              <div className="text-center py-12">
                <div className="text-text-secondary">
                  <Building className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <h4 className="text-lg font-medium mb-2">Selecciona un banco</h4>
                  <p className="text-sm">Selecciona un banco para ver sus tipos asociados</p>
                </div>
              </div>
            ) : isLoadingAsociaciones ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">Cargando asociaciones...</p>
                </div>
              </div>
            ) : filteredAsociaciones.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-text-secondary">
                  <Link className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{searchTermTipos ? 'No se encontraron tipos que coincidan con la búsqueda' : 'No hay tipos asociados a este banco'}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto overflow-y-auto flex-1">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-border sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Marca
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-border">
                      {filteredAsociaciones.map((asociacion) => (
                        <tr key={asociacion.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-text-primary">
                              {asociacion.tipoTarjeta?.tarjeta?.descripcion}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-text-primary">{asociacion.tipoTarjeta?.descripcion}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-1">
                              <button
                                onClick={() => handleDesasociarTipo(asociacion)}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="Desasociar tipo"
                              >
                                <Unlink className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer con total */}
                {filteredAsociaciones.length > 0 && (
                  <div className="bg-gray-50 border-t border-border px-6 py-3">
                    <div className="text-sm text-text-secondary text-center">
                      Total: {filteredAsociaciones.length} {filteredAsociaciones.length === 1 ? 'tipo asociado' : 'tipos asociados'}
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Banco */}
      {isBancoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              {editingBanco ? 'Editar Banco' : 'Nuevo Banco'}
            </h2>
            
            <form onSubmit={bancoForm.handleSubmit(onSubmitBanco)} className="space-y-4">
              <Input
                label="Código *"
                placeholder="SANTANDER"
                error={bancoForm.formState.errors.codigo?.message}
                {...bancoForm.register('codigo')}
              />
              
              <Input
                label="Descripción *"
                placeholder="Banco Santander"
                error={bancoForm.formState.errors.descripcion?.message}
                {...bancoForm.register('descripcion')}
              />
              
              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeBancoModal}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  className="flex-1"
                >
                  {editingBanco ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asociar Tipos */}
      {isAsociarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              Asociar Tipos de Tarjeta al Banco
            </h2>
            
            {isLoadingTiposDisponibles ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-text-secondary">Cargando tipos disponibles...</p>
                </div>
              </div>
            ) : tiposDisponibles.length === 0 ? (
              <div className="text-center py-8">
                <Link className="w-12 h-12 text-text-light mx-auto mb-4" />
                <p className="text-text-secondary">
                  No hay tipos de tarjeta disponibles para asociar
                </p>
              </div>
            ) : (
              <>
                <p className="text-text-secondary mb-4">
                  Selecciona los tipos de tarjeta que deseas asociar al banco:
                </p>
                
                <div className="max-h-96 overflow-y-auto mb-6 border border-border rounded-lg p-4">
                  <div className="space-y-2">
                    {tiposDisponibles.map((tipo) => (
                      <label
                        key={tipo.id}
                        className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTipos.includes(tipo.id)}
                          onChange={() => toggleTipoSelection(tipo.id)}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <h3 className="font-medium text-text-primary">
                            {tipo.tarjeta?.descripcion} - {tipo.descripcion}
                          </h3>
                          <p className="text-sm text-text-secondary">
                            {tipo.tarjeta?.codigo} / {tipo.codigo}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-text-secondary">
                    {selectedTipos.length} tipos seleccionados
                  </p>
                </div>
              </>
            )}
            
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={closeAsociarModal}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={onSubmitAsociaciones}
                loading={isSubmitting}
                disabled={selectedTipos.length === 0 || isLoadingTiposDisponibles}
                className="flex-1"
              >
                Asociar ({selectedTipos.length})
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }