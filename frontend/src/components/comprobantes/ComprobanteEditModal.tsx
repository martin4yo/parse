'use client';

import React from 'react';
import { X, Edit, Calendar, Receipt, Plus, Pencil, Trash2, Grid3x3, CheckCircle, AlertCircle, ShieldAlert, FileText, Save } from 'lucide-react';
// Missing import: Save';
// Missing import: FileText';
// Missing import: ShieldAlert';
import { Button } from '@/components/ui/Button';
import { useComprobanteEdit } from '@/hooks/useComprobanteEdit';
import { ValidationErrorIcon } from './ValidationErrorIcon';
import { DistribucionesModal } from './DistribucionesModal';
import { SmartSelector } from '@/components/rendiciones/SmartSelector';
import { api, parametrosApi, ParametroMaestro } from '@/lib/api';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { DocumentoProcessado } from '@/types/documento';


interface ComprobanteEditModalProps {
  isOpen: boolean;
  documento: DocumentoProcessado | null;
  onClose: () => void;
  onSave: (updatedDoc: DocumentoProcessado) => void;
  readOnly?: boolean;
}

export const ComprobanteEditModal: React.FC<ComprobanteEditModalProps> = ({
  isOpen,
  documento,
  onClose,
  onSave,
  readOnly = false
}) => {
  const { confirmDelete } = useConfirmDialog();

  // Hook de edición de comprobante
  const comprobanteEdit = useComprobanteEdit({
    onSaveSuccess: (updatedDoc) => {
      onSave(updatedDoc as any);
    },
    readOnly
  });

  // Estado para SmartSelector
  const [showSmartSelector, setShowSmartSelector] = useState(false);
  const [smartSelectorConfig, setSmartSelectorConfig] = useState<{
    fieldType: string;
    currentValue: string;
    parentValue?: string;
    entityType: 'item' | 'impuesto';
    entityId: string;
    fieldName: string;
    position: { x: number; y: number };
  } | null>(null);

  // Abrir modal cuando cambia el documento
  React.useEffect(() => {
    if (isOpen && documento) {
      comprobanteEdit.openEditModal(documento as any);
    }
  }, [isOpen, documento?.id]);

  // Función para manejar click en campos editables (SmartSelector)
  const handleFieldClick = (
    event: React.MouseEvent,
    fieldType: string,
    currentValue: string,
    entityType: 'item' | 'impuesto',
    entityId: string,
    fieldName: string,
    parentValue?: string
  ) => {
    if (readOnly) return; // No abrir en modo readOnly

    event.preventDefault();
    const rect = (event.target as HTMLElement).getBoundingClientRect();

    setSmartSelectorConfig({
      fieldType,
      currentValue,
      parentValue,
      entityType,
      entityId,
      fieldName,
      position: { x: rect.left, y: rect.bottom + window.scrollY }
    });
    setShowSmartSelector(true);
  };

  // Función para manejar selección del SmartSelector
  const handleSmartSelectorSelect = async (codigo: string, nombre: string) => {
    if (!smartSelectorConfig) return;

    const { entityType, entityId, fieldName } = smartSelectorConfig;

    try {
      if (entityType === 'item') {
        // Actualizar línea
        const updates: any = { [fieldName]: codigo };
        await api.put(`/documentos/lineas/${entityId}`, updates);

        // Recargar líneas
        await comprobanteEdit.loadDocumentoLineas(comprobanteEdit.selectedDocument!.id);

        toast.success(`${fieldName} actualizado`);
      } else if (entityType === 'impuesto') {
        // Actualizar impuesto
        const updates: any = { [fieldName]: codigo };
        await api.put(`/documentos/impuestos/${entityId}`, updates);

        // Recargar impuestos
        await comprobanteEdit.loadDocumentoImpuestos(comprobanteEdit.selectedDocument!.id);

        toast.success(`${fieldName} actualizado`);
      }
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Error al actualizar el campo');
    } finally {
      setShowSmartSelector(false);
      setSmartSelectorConfig(null);
    }
  };

  // Función para contar errores por sección
  const getErrorCountBySection = (section: 'documento' | 'lineas' | 'impuestos'): { total: number; bloqueantes: number; errores: number } => {
    if (!comprobanteEdit.selectedDocument?.validationErrors?.errors) return { total: 0, bloqueantes: 0, errores: 0 };

    const sectionErrors = comprobanteEdit.selectedDocument.validationErrors.errors.filter((err: any) => {
      if (section === 'documento') {
        return err.origen === 'documento';
      } else if (section === 'lineas') {
        return err.origen?.startsWith('linea');
      } else if (section === 'impuestos') {
        return err.origen?.startsWith('impuesto');
      }
      return false;
    });

    return {
      total: sectionErrors.length,
      bloqueantes: sectionErrors.filter((e: any) => e.severidad === 'BLOQUEANTE').length,
      errores: sectionErrors.filter((e: any) => e.severidad === 'ERROR').length
    };
  };

  // Función para guardar
  const handleSave = async () => {
    const success = await comprobanteEdit.saveEdit();
    if (success) {
      onClose();
      comprobanteEdit.closeEditModal();
    }
  };

  // Función para eliminar impuesto
  const handleDeleteImpuesto = async (impuestoId: string) => {
    if (!comprobanteEdit.selectedDocument) return;
    const confirmed = await confirmDelete('este impuesto');
    if (!confirmed) return;
    await comprobanteEdit.handleDeleteImpuesto(impuestoId);
  };

  // Función para eliminar línea
  const handleDeleteLinea = async (lineaId: string) => {
    if (!comprobanteEdit.selectedDocument) return;
    const confirmed = await confirmDelete('esta línea');
    if (!confirmed) return;
    await comprobanteEdit.handleDeleteLinea(lineaId);
  };

  // Helper para formatear números
  const formatNumber = (num: number) => {
    return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!isOpen || !comprobanteEdit.selectedDocument) return null;

  return (
    <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col animate-in fade-in-0 zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-white flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 ${readOnly ? 'bg-gray-400' : 'bg-palette-yellow'} rounded-lg flex items-center justify-center`}>
                  <Edit className="w-6 h-6 text-palette-dark" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    {readOnly ? 'Ver Datos Extraídos' : 'Editar Datos Extraídos'}
                  </h2>
                  {readOnly && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      Solo lectura
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onClose()}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Información del Documento */}
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <div className="text-sm text-text-secondary mb-1">Documento:</div>
              <div className="text-sm font-medium text-text-primary bg-gray-50 p-2 rounded">
                {comprobanteEdit.selectedDocument.nombreArchivo}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 flex-shrink-0">
              <nav className="flex px-6" aria-label="Tabs">
                <button
                  onClick={() => comprobanteEdit.setActiveTab('encabezado')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    comprobanteEdit.activeTab === 'encabezado'
                      ? 'border-palette-dark text-palette-dark'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    Encabezado
                    {(() => {
                      const errorCount = getErrorCountBySection('documento');
                      if (errorCount.total > 0) {
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            errorCount.bloqueantes > 0
                              ? 'bg-red-100 text-red-700'
                              : errorCount.errores > 0
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {errorCount.total}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </button>
                <button
                  onClick={() => comprobanteEdit.setActiveTab('items')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    comprobanteEdit.activeTab === 'items'
                      ? 'border-palette-dark text-palette-dark'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    Items {comprobanteEdit.documentoLineas.length > 0 && `(${comprobanteEdit.documentoLineas.length})`}
                    {(() => {
                      const errorCount = getErrorCountBySection('lineas');
                      if (errorCount.total > 0) {
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            errorCount.bloqueantes > 0
                              ? 'bg-red-100 text-red-700'
                              : errorCount.errores > 0
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {errorCount.total}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </button>
                <button
                  onClick={() => comprobanteEdit.setActiveTab('impuestos')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    comprobanteEdit.activeTab === 'impuestos'
                      ? 'border-palette-dark text-palette-dark'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    Impuestos {comprobanteEdit.documentoImpuestos.length > 0 && `(${comprobanteEdit.documentoImpuestos.length})`}
                    {(() => {
                      const errorCount = getErrorCountBySection('impuestos');
                      if (errorCount.total > 0) {
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            errorCount.bloqueantes > 0
                              ? 'bg-red-100 text-red-700'
                              : errorCount.errores > 0
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {errorCount.total}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </button>
              </nav>
            </div>

            {/* Tab Content - Área de scroll fija */}
            <div className="overflow-y-auto p-6" style={{ height: '500px' }}>
              {/* TAB: ENCABEZADO */}
              {comprobanteEdit.activeTab === 'encabezado' && (
                <div>
                  <div className="grid grid-cols-2 gap-4">
                {/* 1. Fecha */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Fecha
                    <ValidationErrorIcon fieldName="fecha" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <input
                    type="date"
                    value={comprobanteEdit.editFormData.fechaExtraida || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, fechaExtraida: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={readOnly}
                  />
                </div>

                {/* 2. Tipo de Comprobante */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Tipo de Comprobante
                    <ValidationErrorIcon fieldName="tipoComprobante" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <select
                    value={comprobanteEdit.editFormData.tipoComprobanteExtraido || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, tipoComprobanteExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={readOnly}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="FACTURA A">FACTURA A</option>
                    <option value="FACTURA B">FACTURA B</option>
                    <option value="FACTURA C">FACTURA C</option>
                    <option value="TICKET">TICKET</option>
                    <option value="NOTA DE CREDITO">NOTA DE CREDITO</option>
                    <option value="NOTA DE DEBITO">NOTA DE DEBITO</option>
                    <option value="RECIBO">RECIBO</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>

                {/* 3. Número de Comprobante */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Número de Comprobante
                    <ValidationErrorIcon fieldName="numeroComprobante" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.editFormData.numeroComprobanteExtraido || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, numeroComprobanteExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="00000-00000000"
                    disabled={readOnly}
                  />
                </div>

                {/* 4. CUIT */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    CUIT
                    <ValidationErrorIcon fieldName="cuit" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.editFormData.cuitExtraido || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, cuitExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="XX-XXXXXXXX-X"
                    disabled={readOnly}
                  />
                </div>

                {/* 5. Razón Social */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Razón Social
                    <ValidationErrorIcon fieldName="razonSocial" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.editFormData.razonSocialExtraida || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, razonSocialExtraida: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Nombre del emisor"
                    disabled={readOnly}
                  />
                </div>

                {/* 5.1 Código de Proveedor */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Código de Proveedor
                    <ValidationErrorIcon fieldName="codigoProveedor" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <select
                    value={comprobanteEdit.editFormData.codigoProveedor || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, codigoProveedor: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={readOnly}
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {comprobanteEdit.proveedores.map((proveedor) => (
                      <option key={proveedor.id} value={proveedor.codigo}>
                        {proveedor.nombre} ({proveedor.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Neto Gravado */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Neto Gravado
                    <ValidationErrorIcon fieldName="netoGravado" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.editFormData.netoGravadoExtraido || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, netoGravadoExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                    disabled={readOnly}
                  />
                </div>

                {/* 7. Exento */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Exento
                    <ValidationErrorIcon fieldName="exento" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.editFormData.exentoExtraido || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, exentoExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                    disabled={readOnly}
                  />
                </div>

                {/* 8. Impuestos */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Impuestos
                    <ValidationErrorIcon fieldName="impuestos" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.editFormData.impuestosExtraido || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, impuestosExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                    disabled={readOnly}
                  />
                </div>

                {/* 9. Descuento/Recargo */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Descuento/Recargo
                    <ValidationErrorIcon fieldName="descuento" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={comprobanteEdit.editFormData.descuentoGlobalExtraido || ''}
                      onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, descuentoGlobalExtraido: e.target.value })}
                      className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                      placeholder="0.00"
                      disabled={readOnly}
                    />
                    <select
                      value={comprobanteEdit.editFormData.descuentoGlobalTipo || ''}
                      onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, descuentoGlobalTipo: e.target.value })}
                      className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      disabled={readOnly}
                    >
                      <option value="">-</option>
                      <option value="DESCUENTO">Desc.</option>
                      <option value="RECARGO">Rec.</option>
                    </select>
                  </div>
                </div>

                {/* 10. Moneda */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Moneda
                    <ValidationErrorIcon fieldName="moneda" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <select
                    value={comprobanteEdit.editFormData.monedaExtraida || 'ARS'}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, monedaExtraida: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={readOnly}
                  >
                    <option value="ARS">ARS (Pesos Argentinos)</option>
                    <option value="USD">USD (Dólares)</option>
                  </select>
                </div>

                {/* 11. Importe Total */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    <Receipt className="w-4 h-4 inline mr-1" />
                    Importe Total
                    <ValidationErrorIcon fieldName="importe" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.editFormData.importeExtraido || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, importeExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                    disabled={readOnly}
                  />
                </div>

                {/* 10. CAE */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    CAE
                    <ValidationErrorIcon fieldName="cae" origen="documento"  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.editFormData.caeExtraido || ''}
                    onChange={(e) => comprobanteEdit.setEditFormData({ ...comprobanteEdit.editFormData, caeExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="CAE del comprobante"
                    disabled={readOnly}
                  />
                </div>
              </div>

                {/* Errores sin campo específico */}
                {(() => {
                  const allDocErrors = comprobanteEdit.selectedDocument?.validationErrors?.errors?.filter((err: any) => err.origen === 'documento') || [];
                  const fieldNames = ['fecha', 'tipoComprobante', 'numeroComprobante', 'cuit', 'razonSocial', 'codigoProveedor', 'netoGravado', 'exento', 'impuestos', 'descuento', 'moneda', 'importe', 'cae'];

                  // Filtrar errores que no matchean con ningún campo específico
                  const unassignedErrors = allDocErrors.filter((err: any) => {
                    const contextoLower = (err.contexto || '').toLowerCase();
                    const mensajeLower = ((err.mensaje || err.message) || '').toLowerCase();

                    return !fieldNames.some(fieldName =>
                      contextoLower.includes(fieldName.toLowerCase()) ||
                      mensajeLower.includes(fieldName.toLowerCase())
                    );
                  });

                  if (unassignedErrors.length === 0) return null;

                  return (
                    <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-red-800 mb-2">Errores de Validación del Documento</h4>
                          <div className="space-y-2">
                            {unassignedErrors.map((err: any, idx: number) => (
                              <div key={idx} className="text-sm">
                                <div className="font-medium text-red-700">
                                  {err.severidad === 'BLOQUEANTE' ? '🚫' : err.severidad === 'ERROR' ? '⚠️' : '⚡'} {err.regla || 'Validación'}
                                </div>
                                <div className="text-red-600 ml-5">{err.mensaje || err.message}</div>
                                {err.contexto && (
                                  <div className="text-xs text-red-500 ml-5 italic">Contexto: {err.contexto}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Sección de Dimensiones y Subcuentas */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Dimensiones y Subcuentas del Documento</h3>
                    {!readOnly && (
                    <Button
                      onClick={() => {
                        comprobanteEdit.setDistribucionesEntidad({
                          tipo: 'documento',
                          id: comprobanteEdit.selectedDocument!.id,
                          total: parseFloat(comprobanteEdit.editFormData.importeExtraido || '0'),
                          codigo: comprobanteEdit.editFormData.tipoComprobanteExtraido || '',
                          nombre: comprobanteEdit.editFormData.numeroComprobanteExtraido || ''
                        });
                        comprobanteEdit.setShowDistribucionesModal(true);
                      }}
                      className="bg-palette-dark hover:bg-palette-dark/90 text-palette-yellow"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Editar Dimensiones
                    </Button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Define dimensiones y comprobanteEdit.subcuentas que se aplicarán a nivel del documento completo.
                    Esto es útil para asignar centros de costo, proyectos u otras dimensiones contables al comprobante entero.
                  </p>
                </div>
              </div>
              )}

              {/* TAB: ITEMS */}
              {comprobanteEdit.activeTab === 'items' && (
                <div>
                  {/* Header con botón de agregar */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-semibold text-gray-800">Line Items</h3>
                    {!readOnly && (
                      <Button
                        onClick={() => (() => {
                        comprobanteEdit.setSelectedItem(null);
                        comprobanteEdit.setItemFormData({});
                        comprobanteEdit.setShowItemModal(true);
                      })()}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Agregar Item
                      </Button>
                    )}
                  </div>

                  {/* Grilla de items */}
                  {comprobanteEdit.loadingLineas ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="mt-2">Cargando items...</p>
                    </div>
                  ) : comprobanteEdit.documentoLineas.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No hay items cargados</p>
                      <p className="text-sm mt-1">Haz clic en "Agregar Item" para comenzar</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {comprobanteEdit.documentoLineas.map((linea, lineaIndex) => (
                        <div key={linea.id} className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                          {/* Header de la tarjeta */}
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-blue-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center">
                                {linea.numero}
                              </span>
                              <h4 className="font-semibold text-gray-900 text-sm truncate" title={linea.descripcion}>
                                {linea.descripcion}
                              </h4>
                            </div>
                            {!readOnly && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => (() => {
                      comprobanteEdit.setSelectedItem(linea);
                      comprobanteEdit.setItemFormData(linea || {});
                      comprobanteEdit.setShowItemModal(true);
                    })()}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-200 p-1.5 rounded transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteLinea(linea.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1.5 rounded transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            )}
                          </div>

                          {/* Contenido principal */}
                          <div className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Cód. Original</span>
                                <p className="text-sm font-semibold text-palette-purple mt-1">
                                  {linea.codigoProductoOriginal || '-'}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Cantidad</span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {formatNumber(Number(linea.cantidad))} {linea.unidad || ''}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Precio Unit.</span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  ${formatNumber(Number(linea.precioUnitario))}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Subtotal</span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  ${formatNumber(Number(linea.subtotal))}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">IVA</span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {linea.alicuotaIva ? `${Number(linea.alicuotaIva)}%` : '-'}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Total Línea</span>
                                <p className="text-lg font-bold text-blue-600 mt-1">
                                  ${formatNumber(Number(linea.totalLinea))}
                                </p>
                              </div>
                            </div>

                            {/* Separador */}
                            <div className="border-t border-gray-200 my-3"></div>

                            {/* Campos contables */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                              <div
                                className="bg-blue-50 p-2 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                                onClick={(e) => handleFieldClick(e, 'tipo_producto', linea.tipoProducto || '', 'item', linea.id, 'tipoProducto')}
                                title="Click para editar"
                              >
                                <span className="font-medium text-gray-600 block mb-1 flex items-center">
                                  Tipo Producto
                                  <ValidationErrorIcon fieldName="tipoProducto" entityId={linea.id}  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                                </span>
                                <span className="text-gray-800 truncate block" title={linea.tipoProducto && linea.tipoProductoNombre ? `${linea.tipoProducto} - ${linea.tipoProductoNombre}` : linea.tipoProducto || '-'}>
                                  {linea.tipoProducto ? `${linea.tipoProducto}${linea.tipoProductoNombre ? ` - ${linea.tipoProductoNombre}` : ''}` : '-'}
                                </span>
                              </div>
                              <div
                                className="bg-blue-50 p-2 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                                onClick={(e) => handleFieldClick(e, 'codigo_producto', linea.codigoProducto || '', 'item', linea.id, 'codigoProducto', linea.tipoProducto)}
                                title="Click para editar"
                              >
                                <span className="font-medium text-gray-600 block mb-1 flex items-center">
                                  Cód. Producto
                                  <ValidationErrorIcon fieldName="codigoProducto" entityId={linea.id}  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                                </span>
                                <span className="text-gray-800 truncate block" title={linea.codigoProducto && linea.codigoProductoNombre ? `${linea.codigoProducto} - ${linea.codigoProductoNombre}` : linea.codigoProducto || '-'}>
                                  {linea.codigoProducto ? `${linea.codigoProducto}${linea.codigoProductoNombre ? ` - ${linea.codigoProductoNombre}` : ''}` : '-'}
                                </span>
                              </div>
                              <div
                                className="bg-blue-50 p-2 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                                onClick={(e) => handleFieldClick(e, 'cuenta_contable', linea.cuentaContable || '', 'item', linea.id, 'cuentaContable')}
                                title="Click para editar"
                              >
                                <span className="font-medium text-gray-600 block mb-1 flex items-center">
                                  Cuenta Contable
                                  <ValidationErrorIcon fieldName="cuentaContable" entityId={linea.id}  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                                </span>
                                <span className="text-gray-800 truncate block" title={linea.cuentaContable && linea.cuentaContableNombre ? `${linea.cuentaContable} - ${linea.cuentaContableNombre}` : linea.cuentaContable || '-'}>
                                  {linea.cuentaContable ? `${linea.cuentaContable}${linea.cuentaContableNombre ? ` - ${linea.cuentaContableNombre}` : ''}` : '-'}
                                </span>
                              </div>
                              <div
                                className={`p-2 rounded transition-colors border ${
                                  readOnly ? '' : 'cursor-pointer'
                                } ${
                                  comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'valid'
                                    ? `bg-green-50 ${readOnly ? '' : 'hover:bg-green-100'} border-green-300`
                                    : comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'invalid'
                                    ? `bg-yellow-50 ${readOnly ? '' : 'hover:bg-yellow-100'} border-yellow-300`
                                    : `bg-orange-50 ${readOnly ? '' : 'hover:bg-orange-100'} border-orange-300`
                                }`}
                                onClick={readOnly ? undefined : () => {
                                  comprobanteEdit.setDistribucionesEntidad({
                                    tipo: 'linea',
                                    id: linea.id,
                                    total: parseFloat(linea.subtotal || 0),
                                    codigo: linea.codigoProducto || '',
                                    nombre: linea.descripcion || ''
                                  });
                                  comprobanteEdit.setShowDistribucionesModal(true);
                                }}
                                title={
                                  comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'valid'
                                    ? 'Distribuciones correctas'
                                    : comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'invalid'
                                    ? 'Error en suma de distribuciones'
                                    : 'Sin distribuciones configuradas'
                                }
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'valid' ? (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    ) : comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'invalid' ? (
                                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                                    ) : (
                                      <AlertCircle className="w-4 h-4 text-orange-600" />
                                    )}
                                    <span className="font-medium text-gray-600 block">Dimensiones</span>
                                  </div>
                                  <Grid3x3 className="w-4 h-4 text-gray-500" />
                                </div>
                                <span className={`text-xs mt-1 block ${
                                  comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'valid'
                                    ? 'text-green-700'
                                    : comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'invalid'
                                    ? 'text-yellow-700'
                                    : 'text-orange-700'
                                }`}>
                                  {comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'valid'
                                    ? 'Configuradas correctamente'
                                    : comprobanteEdit.distribucionesStatus[`linea-${linea.id}`] === 'invalid'
                                    ? 'Error en suma'
                                    : 'No configuradas'}
                                </span>
                              </div>
                              <div
                                className="bg-blue-50 p-2 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                                onClick={(e) => handleFieldClick(e, 'tipo_orden_compra', linea.tipoOrdenCompra || '', 'item', linea.id, 'tipoOrdenCompra')}
                                title="Click para editar"
                              >
                                <span className="font-medium text-gray-600 block mb-1 flex items-center">
                                  Tipo OC
                                  <ValidationErrorIcon fieldName="tipoOrdenCompra" entityId={linea.id}  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                                </span>
                                <span className="text-gray-800 truncate block" title={linea.tipoOrdenCompra && linea.tipoOrdenCompraNombre ? `${linea.tipoOrdenCompra} - ${linea.tipoOrdenCompraNombre}` : linea.tipoOrdenCompra || '-'}>
                                  {linea.tipoOrdenCompra ? `${linea.tipoOrdenCompra}${linea.tipoOrdenCompraNombre ? ` - ${linea.tipoOrdenCompraNombre}` : ''}` : '-'}
                                </span>
                              </div>
                              <div
                                className="bg-blue-50 p-2 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                                onClick={(e) => handleFieldClick(e, 'texto_libre', linea.ordenCompra || '', 'item', linea.id, 'ordenCompra')}
                                title="Click para editar"
                              >
                                <span className="font-medium text-gray-600 block mb-1 flex items-center">
                                  Orden Compra
                                  <ValidationErrorIcon fieldName="ordenCompra" entityId={linea.id}  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                                </span>
                                <span className="text-gray-800">{linea.ordenCompra || '-'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: IMPUESTOS */}
              {comprobanteEdit.activeTab === 'impuestos' && (
                <div>
                  {/* Header con botón de agregar */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-semibold text-gray-800">Impuestos</h3>
                    {!readOnly && (
                    <Button
                      onClick={() => (() => {
                      comprobanteEdit.setSelectedImpuesto(null);
                      comprobanteEdit.setImpuestoFormData({});
                      comprobanteEdit.setShowImpuestoModal(true);
                    })()}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar Impuesto
                    </Button>
                    )}
                  </div>

                  {/* Grilla de impuestos */}
                  {comprobanteEdit.loadingImpuestos ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="mt-2">Cargando impuestos...</p>
                    </div>
                  ) : comprobanteEdit.documentoImpuestos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No hay impuestos cargados</p>
                      <p className="text-sm mt-1">Haz clic en "Agregar Impuesto" para comenzar</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {comprobanteEdit.documentoImpuestos.map((impuesto, index) => (
                        <div key={impuesto.id} className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                          {/* Header de la tarjeta */}
                          <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 py-3 border-b border-green-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="bg-green-600 text-white text-xs font-bold rounded px-3 py-1">
                                {impuesto.tipo}
                              </span>
                              <h4 className="font-semibold text-gray-900 text-sm truncate" title={impuesto.descripcion}>
                                {impuesto.descripcion}
                              </h4>
                            </div>
                            {!readOnly && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => (() => {
                      comprobanteEdit.setSelectedImpuesto(impuesto);
                      comprobanteEdit.setImpuestoFormData(impuesto || {});
                      comprobanteEdit.setShowImpuestoModal(true);
                    })()}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-200 p-1.5 rounded transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteImpuesto(impuesto.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1.5 rounded transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            )}
                          </div>

                          {/* Contenido principal */}
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase flex items-center">
                                  Alícuota
                                  <ValidationErrorIcon fieldName="alicuota" entityId={impuesto.id}  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                                </span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {impuesto.alicuota ? `${Number(impuesto.alicuota)}%` : '-'}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase flex items-center">
                                  Base Imponible
                                  <ValidationErrorIcon fieldName="baseImponible" entityId={impuesto.id}  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                                </span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {impuesto.baseImponible ? `$${Number(impuesto.baseImponible).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase flex items-center">
                                  Importe
                                  <ValidationErrorIcon fieldName="importe" entityId={impuesto.id}  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                                </span>
                                <p className="text-lg font-bold text-green-600 mt-1">
                                  ${Number(impuesto.importe).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>

                            {/* Separador */}
                            <div className="border-t border-gray-200 my-3"></div>

                            {/* Campos contables */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div
                                className="bg-green-50 p-2 rounded cursor-pointer hover:bg-green-100 transition-colors"
                                onClick={(e) => handleFieldClick(e, 'cuenta_contable', impuesto.cuentaContable || '', 'impuesto', impuesto.id, 'cuentaContable')}
                                title="Click para editar"
                              >
                                <span className="font-medium text-gray-600 block mb-1 flex items-center">
                                  Cuenta Contable
                                  <ValidationErrorIcon fieldName="cuentaContable" entityId={impuesto.id}  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors} />
                                </span>
                                <span className="text-gray-800 truncate block" title={impuesto.cuentaContable && impuesto.cuentaContableNombre ? `${impuesto.cuentaContable} - ${impuesto.cuentaContableNombre}` : impuesto.cuentaContable || '-'}>
                                  {impuesto.cuentaContable ? `${impuesto.cuentaContable}${impuesto.cuentaContableNombre ? ` - ${impuesto.cuentaContableNombre}` : ''}` : '-'}
                                </span>
                              </div>
                              <div
                                className={`p-2 rounded transition-colors border ${
                                  readOnly ? '' : 'cursor-pointer'
                                } ${
                                  comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'valid'
                                    ? `bg-green-50 ${readOnly ? '' : 'hover:bg-green-100'} border-green-300`
                                    : comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'invalid'
                                    ? `bg-yellow-50 ${readOnly ? '' : 'hover:bg-yellow-100'} border-yellow-300`
                                    : `bg-orange-50 ${readOnly ? '' : 'hover:bg-orange-100'} border-orange-300`
                                }`}
                                onClick={readOnly ? undefined : () => {
                                  comprobanteEdit.setDistribucionesEntidad({
                                    tipo: 'impuesto',
                                    id: impuesto.id,
                                    total: parseFloat(impuesto.importe || 0),
                                    codigo: impuesto.tipo || '',
                                    nombre: impuesto.descripcion || ''
                                  });
                                  comprobanteEdit.setShowDistribucionesModal(true);
                                }}
                                title={
                                  comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'valid'
                                    ? 'Distribuciones correctas'
                                    : comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'invalid'
                                    ? 'Error en suma de distribuciones'
                                    : 'Sin distribuciones configuradas'
                                }
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'valid' ? (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    ) : comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'invalid' ? (
                                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                                    ) : (
                                      <AlertCircle className="w-4 h-4 text-orange-600" />
                                    )}
                                    <span className="font-medium text-gray-600 block">Dimensiones</span>
                                  </div>
                                  <Grid3x3 className="w-4 h-4 text-gray-500" />
                                </div>
                                <span className={`text-xs mt-1 block ${
                                  comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'valid'
                                    ? 'text-green-700'
                                    : comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'invalid'
                                    ? 'text-yellow-700'
                                    : 'text-orange-700'
                                }`}>
                                  {comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'valid'
                                    ? 'Configuradas correctamente'
                                    : comprobanteEdit.distribucionesStatus[`impuesto-${impuesto.id}`] === 'invalid'
                                    ? 'Error en suma'
                                    : 'No configuradas'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer - Visible en todos los tabs */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-gray-50 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => onClose()}
                disabled={comprobanteEdit.savingEdit}
              >
                Cancelar
              </Button>
              {!readOnly && (
                <Button
                  onClick={handleSave}
                  disabled={comprobanteEdit.savingEdit}
                  className="bg-palette-dark hover:bg-palette-dark/90 text-palette-yellow"
                >
                  {comprobanteEdit.savingEdit ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

      {/* Modal para agregar/editar Item */}
      {comprobanteEdit.showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                {comprobanteEdit.selectedItem ? 'Editar Item' : 'Agregar Item'}
              </h2>
              <button
                onClick={() => comprobanteEdit.setShowItemModal(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.itemFormData.descripcion || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-dark"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.itemFormData.cantidad || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, cantidad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-dark"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Precio Unitario
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.itemFormData.precio_unitario || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, precio_unitario: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-dark"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Total
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.itemFormData.total || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, total: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-dark"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <Button
                variant="secondary"
                onClick={() => comprobanteEdit.setShowItemModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (comprobanteEdit.selectedItem) {
                    // Editar
                    await api.put(`/documentos/${comprobanteEdit.selectedDocument!.id}/lineas/${comprobanteEdit.selectedItem.id}`, comprobanteEdit.itemFormData);
                  } else {
                    // Crear
                    await api.post(`/documentos/${comprobanteEdit.selectedDocument!.id}/lineas`, comprobanteEdit.itemFormData);
                  }
                  await comprobanteEdit.loadDocumentoLineas(comprobanteEdit.selectedDocument!.id);
                  comprobanteEdit.setShowItemModal(false);
                  toast.success(comprobanteEdit.selectedItem ? 'Item actualizado' : 'Item agregado');
                }}
              >
                {comprobanteEdit.selectedItem ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar/editar Impuesto */}
      {comprobanteEdit.showImpuestoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                {comprobanteEdit.selectedImpuesto ? 'Editar Impuesto' : 'Agregar Impuesto'}
              </h2>
              <button
                onClick={() => comprobanteEdit.setShowImpuestoModal(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Tipo de Impuesto
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.impuestoFormData.tipo_impuesto || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, tipo_impuesto: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-dark"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Alícuota (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.impuestoFormData.alicuota || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, alicuota: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-dark"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Base Imponible
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.impuestoFormData.base_imponible || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, base_imponible: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-dark"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Importe
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.impuestoFormData.importe || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, importe: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-dark"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <Button
                variant="secondary"
                onClick={() => comprobanteEdit.setShowImpuestoModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (comprobanteEdit.selectedImpuesto) {
                    // Editar
                    await api.put(`/documentos/${comprobanteEdit.selectedDocument!.id}/impuestos/${comprobanteEdit.selectedImpuesto.id}`, comprobanteEdit.impuestoFormData);
                  } else {
                    // Crear
                    await api.post(`/documentos/${comprobanteEdit.selectedDocument!.id}/impuestos`, comprobanteEdit.impuestoFormData);
                  }
                  await comprobanteEdit.loadDocumentoImpuestos(comprobanteEdit.selectedDocument!.id);
                  comprobanteEdit.setShowImpuestoModal(false);
                  toast.success(comprobanteEdit.selectedImpuesto ? 'Impuesto actualizado' : 'Impuesto agregado');
                }}
              >
                {comprobanteEdit.selectedImpuesto ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Dimensiones */}
      {comprobanteEdit.showDistribucionesModal && comprobanteEdit.distribucionesEntidad && (
        <DistribucionesModal
          isOpen={comprobanteEdit.showDistribucionesModal}
          onClose={() => {
            comprobanteEdit.setShowDistribucionesModal(false);
            comprobanteEdit.setDistribucionesEntidad(null);
          }}
          tipo={comprobanteEdit.distribucionesEntidad.tipo}
          entidadId={comprobanteEdit.distribucionesEntidad.id}
          totalEntidad={comprobanteEdit.distribucionesEntidad.total}
          codigo={comprobanteEdit.distribucionesEntidad.codigo}
          nombre={comprobanteEdit.distribucionesEntidad.nombre}
          onSave={async () => {
            // Recargar datos según el tipo de entidad
            if (comprobanteEdit.distribucionesEntidad?.tipo === 'linea') {
              await comprobanteEdit.loadDocumentoLineas(comprobanteEdit.selectedDocument!.id);
            } else if (comprobanteEdit.distribucionesEntidad?.tipo === 'impuesto') {
              await comprobanteEdit.loadDocumentoImpuestos(comprobanteEdit.selectedDocument!.id);
            }
            // Para tipo 'documento' no hay que recargar líneas ni impuestos

            // Recargar estado de distribuciones
            const lineas = await api.get(`/documentos/${comprobanteEdit.selectedDocument!.id}/lineas`).then(r => r.data.lineas || []);
            const impuestos = await api.get(`/documentos/${comprobanteEdit.selectedDocument!.id}/impuestos`).then(r => r.data.impuestos || []);
            await comprobanteEdit.loadDistribucionesStatus(lineas, impuestos);

            toast.success('Dimensiones guardadas correctamente');
          }}
        />
      )}

      {/* SmartSelector para selección inteligente de parámetros */}
      {showSmartSelector && smartSelectorConfig && (
        <SmartSelector
          value={smartSelectorConfig.currentValue}
          fieldType={smartSelectorConfig.fieldType}
          parentValue={smartSelectorConfig.parentValue}
          onSelect={handleSmartSelectorSelect}
          onClose={() => setShowSmartSelector(false)}
          position={smartSelectorConfig.position}
        />
      )}
    </>
  );
};
