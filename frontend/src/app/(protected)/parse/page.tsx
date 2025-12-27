'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, Link2, FileText, CheckCircle, Check, Clock, AlertCircle, Zap, ExternalLink, LinkIcon, Trash2, FileIcon, Image as ImageIcon, XCircle, Info, Receipt, Edit2, Edit, Unlink, Save, X, Calendar, MessageSquare, ScanText, Plus, Pencil, Sparkles, RotateCcw, Grid3x3, AlertTriangle, AlertOctagon, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal';
import { DocumentViewerProvider } from '@/components/shared/DocumentViewerProvider';
import { useDocumentViewer, formatComprobantesEfectivoData } from '@/hooks/useDocumentViewer';
import { api, parametrosApi, ParametroMaestro } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { useApiMutation, useDeleteMutation, useUpdateMutation } from '@/hooks/useApiMutation';
import { SmartSelector } from '@/components/rendiciones/SmartSelector';
import { DistribucionesModal } from '@/components/comprobantes/DistribucionesModal';
import { useComprobanteEdit } from '@/hooks/useComprobanteEdit';
import { ValidationErrorIcon } from '@/components/comprobantes/ValidationErrorIcon';
import { ComprobanteEditModal } from '@/components/comprobantes/ComprobanteEditModal';
import { DocumentoProcessado } from '@/types/documento';

interface DashboardMetrics {
  subidos: number;
  pendientes: number;
  exportados: number;
  conError: number;
  asociados?: number;
}


export default function ComprobantesPage() {
  const { confirmDelete } = useConfirmDialog();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    subidos: 0,
    pendientes: 0,
    exportados: 0,
    conError: 0
  });
  const [documentos, setDocumentos] = useState<DocumentoProcessado[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pendientes');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [processingAssociation, setProcessingAssociation] = useState(false);
  const [forzarReprocesamiento, setForzarReprocesamiento] = useState(false);
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set());
  const [associationProgress, setAssociationProgress] = useState({
    current: 0,
    total: 0,
    currentDocumentName: '',
    currentCupon: '',
    // Estadísticas de reglas
    reglasAplicadas: 0,
    documentosTransformados: 0,
    lineasTransformadas: 0,
    impuestosTransformados: 0,
    errores: 0
  });
  const [processingComplete, setProcessingComplete] = useState(false);
  const [closeCountdown, setCloseCountdown] = useState(10);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [hoveredCupon, setHoveredCupon] = useState<string | null>(null);
  const [cuponTooltipPosition, setCuponTooltipPosition] = useState({ x: 0, y: 0 });
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [selectedDocumentForObservation, setSelectedDocumentForObservation] = useState<DocumentoProcessado | null>(null);
  const [observationText, setObservationText] = useState('');
  const [savingObservation, setSavingObservation] = useState(false);

  // Estado para selección múltiple
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);

  // Hook para el DocumentViewer
  const documentViewer = useDocumentViewer({
    findDocument: (documentId: string) => documentos.find(doc => doc.id === documentId),
    formatItemData: formatComprobantesEfectivoData
  });

  // Hook para edición de comprobantes (reemplaza todos los estados anteriores)
  const comprobanteEdit = useComprobanteEdit({
    onSaveSuccess: (updatedDoc) => {
      // Actualizar documento en la lista local
      setDocumentos(prev => prev.map(doc =>
        doc.id === updatedDoc.id ? updatedDoc as DocumentoProcessado : doc
      ));
    }
  });

  // Estado local para controlar visibilidad del modal
  const [showEditModal, setShowEditModal] = useState(false);

  // Estados para SmartSelector
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

  // ========== MUTATIONS ==========

  const deleteDocumentMutation = useDeleteMutation({
    skipConfirm: true, // Handler already has custom confirm dialog
    successMessage: 'Documento eliminado correctamente',
    onSuccess: () => loadDocumentos(),
  });

  const saveObservationMutation = useUpdateMutation({
    successMessage: 'Observación guardada correctamente',
    onSuccess: () => {
      setShowObservationModal(false);
      setSelectedDocumentForObservation(null);
      setObservationText('');
    },
  });

  const saveItemMutation = useApiMutation({
    showSuccessToast: false, // Custom toast based on create/update
    onSuccess: async () => {
      if (comprobanteEdit.selectedDocument) {
        await comprobanteEdit.loadDocumentoLineas(comprobanteEdit.selectedDocument.id);
      }
      comprobanteEdit.setShowItemModal(false);
      comprobanteEdit.setSelectedItem(null);
      comprobanteEdit.setItemFormData({});
    },
  });

  const deleteItemMutation = useDeleteMutation({
    skipConfirm: true, // Handler already has custom confirmDelete dialog
    successMessage: 'Item eliminado correctamente',
    onSuccess: async () => {
      if (comprobanteEdit.selectedDocument) {
        await comprobanteEdit.loadDocumentoLineas(comprobanteEdit.selectedDocument.id);
      }
    },
  });

  const saveImpuestoMutation = useApiMutation({
    showSuccessToast: false, // Custom toast based on create/update
    onSuccess: async () => {
      if (comprobanteEdit.selectedDocument) {
        await comprobanteEdit.loadDocumentoImpuestos(comprobanteEdit.selectedDocument.id);
      }
      comprobanteEdit.setShowImpuestoModal(false);
      comprobanteEdit.setSelectedImpuesto(null);
      comprobanteEdit.setImpuestoFormData({});
    },
  });

  const disassociateDocumentMutation = useApiMutation({
    successMessage: 'Comprobante desasociado correctamente',
    showSuccessToast: true,
  });

  const smartSelectorUpdateMutation = useApiMutation({
    showSuccessToast: false, // Custom message
    onSuccess: async () => {
      setShowSmartSelector(false);
      setSmartSelectorConfig(null);
    },
  });

  const desmarcarReglasMutation = useApiMutation({
    successMessage: 'Documento desmarcado. Se reprocesará con las reglas.',
    onSuccess: () => loadDocumentos(),
  });

  // Función para abrir el archivo
  const handleViewDocument = (documentId: string) => {
    // Use the document viewer hook
    documentViewer.openViewer(documentId);
  };

  // Función para eliminar documento
  const handleDeleteDocument = async (documentId: string, nombreArchivo: string) => {
    const confirmed = await confirmDelete(nombreArchivo);
    if (!confirmed) return;

    deleteDocumentMutation.mutate(() => api.delete(`/documentos/${documentId}`));
  };

  // Funciones para selección múltiple
  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = paginatedDocumentos.map(doc => doc.id);
    const allSelected = visibleIds.every(id => selectedDocuments.has(id));

    if (allSelected) {
      // Deseleccionar todos los visibles
      setSelectedDocuments(prev => {
        const newSet = new Set(prev);
        visibleIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      // Seleccionar todos los visibles
      setSelectedDocuments(prev => {
        const newSet = new Set(prev);
        visibleIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedDocuments.size === 0) return;

    const confirmed = await confirmDelete(`${selectedDocuments.size} documento(s) seleccionado(s)`);
    if (!confirmed) return;

    setDeletingSelected(true);

    try {
      const deletePromises = Array.from(selectedDocuments).map(id =>
        api.delete(`/documentos/${id}`)
      );

      await Promise.all(deletePromises);

      toast.success(`${selectedDocuments.size} documento(s) eliminado(s) correctamente`);
      setSelectedDocuments(new Set());
      await loadDocumentos();
    } catch (error) {
      console.error('Error eliminando documentos:', error);
      toast.error('Error al eliminar algunos documentos');
    } finally {
      setDeletingSelected(false);
    }
  };

  // Función para abrir modal de observaciones
  const handleOpenObservationModal = (doc: DocumentoProcessado) => {
    setSelectedDocumentForObservation(doc);
    setObservationText(doc.observaciones || '');
    setShowObservationModal(true);
  };

  // Función para guardar observación
  const handleSaveObservation = () => {
    if (!selectedDocumentForObservation) return;

    setSavingObservation(true);

    saveObservationMutation.mutate(async () => {
      const response = await api.put(`/documentos/${selectedDocumentForObservation.id}/observaciones`, {
        observaciones: observationText.trim() || null
      });

      // Actualizar el documento local
      setDocumentos(prev => prev.map(doc =>
        doc.id === selectedDocumentForObservation.id
          ? { ...doc, observaciones: observationText.trim() || undefined }
          : doc
      ));

      setSavingObservation(false);
      return response;
    });
  };

  // Función para abrir modal de edición (ahora usa el hook)
  const handleOpenEditModal = async (doc: DocumentoProcessado) => {
    await comprobanteEdit.openEditModal(doc);
    setShowEditModal(true);
  };

  // Función para guardar cambios de edición (ahora usa el hook)
  const handleSaveEdit = async () => {
    const success = await comprobanteEdit.saveEdit();
    if (success) {
      setShowEditModal(false);
      comprobanteEdit.closeEditModal();
    }
  };

  // ========== FUNCIONES PARA VALIDACIÓN DE ERRORES ==========

  /**
   * Cuenta errores por sección (mantenida local, específica de UI)
   */
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

  // ========== FUNCIONES PARA LÍNEAS (ITEMS) ==========

  // Función auxiliar para enriquecer códigos con nombres
  // enrichWithNames - Ahora en useComprobanteEdit hook

  // loadDocumentoLineas - Ahora en useComprobanteEdit hook

  // validateDistribuciones - Ahora en useComprobanteEdit hook

  // loadDistribucionesStatus - Ahora en useComprobanteEdit hook

  const handleOpenItemModal = async (item: any = null) => {
    comprobanteEdit.setSelectedItem(item);

    // Cargar tipos de producto, códigos de dimensión y tipos de orden de compra
    try {
      const [responseTipos, responseDimensiones, responseTiposOC] = await Promise.all([
        parametrosApi.getPorCampo('tipo_producto'),
        parametrosApi.getPorCampo('codigo_dimension'),
        parametrosApi.getPorCampo('tipo_orden_compra')
      ]);
      comprobanteEdit.setTiposProducto(responseTipos.parametros);
      comprobanteEdit.setCodigosDimension(responseDimensiones.parametros);
      comprobanteEdit.setTiposOrdenCompra(responseTiposOC.parametros);
    } catch (error) {
      console.error('Error loading parametros:', error);
    }

    if (item) {
      // Edición
      comprobanteEdit.setItemFormData({
        numero: item.numero,
        descripcion: item.descripcion || '',
        tipoProducto: item.tipoProducto || '',
        codigoProducto: item.codigoProducto || '',
        cantidad: item.cantidad ? Number(item.cantidad).toString() : '',
        unidad: item.unidad || '',
        precioUnitario: item.precioUnitario ? Number(item.precioUnitario).toString() : '',
        subtotal: item.subtotal ? Number(item.subtotal).toString() : '',
        alicuotaIva: item.alicuotaIva ? Number(item.alicuotaIva).toString() : '',
        importeIva: item.importeIva ? Number(item.importeIva).toString() : '',
        totalLinea: item.totalLinea ? Number(item.totalLinea).toString() : '',
        codigoDimension: item.codigoDimension || '',
        subcuenta: item.subcuenta || '',
        cuentaContable: item.cuentaContable || '',
        tipoOrdenCompra: item.tipoOrdenCompra || '',
        ordenCompra: item.ordenCompra || ''
      });

      // Si tiene tipo de producto, cargar códigos de producto filtrados
      if (item.tipoProducto) {
        try {
          const response = await parametrosApi.getPorCampo('codigo_producto', item.tipoProducto);
          comprobanteEdit.setCodigosProducto(response.parametros);
        } catch (error) {
          console.error('Error loading codigos producto:', error);
        }
      }

      // Si tiene código de dimensión, cargar comprobanteEdit.subcuentas filtradas
      if (item.codigoDimension) {
        try {
          const response = await parametrosApi.getPorCampo('subcuenta', item.codigoDimension);
          comprobanteEdit.setSubcuentas(response.parametros);
        } catch (error) {
          console.error('Error loading comprobanteEdit.subcuentas:', error);
        }
      }

      // Si tiene subcuenta, cargar cuentas contables (sin filtro, cuenta_contable no tiene padre)
      if (item.subcuenta) {
        try {
          const response = await parametrosApi.getPorCampo('cuenta_contable');
          comprobanteEdit.setCuentasContables(response.parametros);
        } catch (error) {
          console.error('Error loading cuentas contables:', error);
        }
      }
    } else {
      // Nuevo item
      const nextNumero = comprobanteEdit.documentoLineas.length > 0
        ? Math.max(...comprobanteEdit.documentoLineas.map(l => l.numero)) + 1
        : 1;
      comprobanteEdit.setItemFormData({
        numero: nextNumero,
        descripcion: '',
        tipoProducto: '',
        codigoProducto: '',
        cantidad: '',
        unidad: 'un',
        precioUnitario: '',
        subtotal: '',
        alicuotaIva: '21',
        importeIva: '',
        totalLinea: '',
        codigoDimension: '',
        subcuenta: '',
        cuentaContable: '',
        tipoOrdenCompra: '',
        ordenCompra: ''
      });
    }
    comprobanteEdit.setShowItemModal(true);
  };

  // Función para manejar cambio de tipo de producto (cascada)
  const handleTipoProductoChange = async (tipoProducto: string) => {
    comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, tipoProducto, codigoProducto: '' });

    if (tipoProducto) {
      try {
        const response = await parametrosApi.getPorCampo('codigo_producto', tipoProducto);
        comprobanteEdit.setCodigosProducto(response.parametros);
      } catch (error) {
        console.error('Error loading codigos producto:', error);
        comprobanteEdit.setCodigosProducto([]);
      }
    } else {
      comprobanteEdit.setCodigosProducto([]);
    }
  };

  // Función para manejar cambio de código de dimensión (cascada)
  const handleCodigoDimensionChange = async (codigoDimension: string) => {
    comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, codigoDimension, subcuenta: '', cuentaContable: '' });

    if (codigoDimension) {
      try {
        const response = await parametrosApi.getPorCampo('subcuenta', codigoDimension);
        comprobanteEdit.setSubcuentas(response.parametros);
      } catch (error) {
        console.error('Error loading comprobanteEdit.subcuentas:', error);
        comprobanteEdit.setSubcuentas([]);
      }
    } else {
      comprobanteEdit.setSubcuentas([]);
      comprobanteEdit.setCuentasContables([]);
    }
  };

  // Función para manejar cambio de subcuenta (cascada)
  const handleSubcuentaChange = async (subcuenta: string) => {
    comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, subcuenta, cuentaContable: '' });

    if (subcuenta) {
      try {
        // cuenta_contable no tiene padre, se muestran todas
        const response = await parametrosApi.getPorCampo('cuenta_contable');
        comprobanteEdit.setCuentasContables(response.parametros);
      } catch (error) {
        console.error('Error loading cuentas contables:', error);
        comprobanteEdit.setCuentasContables([]);
      }
    } else {
      comprobanteEdit.setCuentasContables([]);
    }
  };

  const handleSaveItem = () => {
    if (!comprobanteEdit.selectedDocument) return;

    comprobanteEdit.setSavingItem(true);

    const dataToSend = {
      numero: parseInt(comprobanteEdit.itemFormData.numero),
      descripcion: comprobanteEdit.itemFormData.descripcion,
      codigoProducto: comprobanteEdit.itemFormData.codigoProducto || null,
      cantidad: parseFloat(comprobanteEdit.itemFormData.cantidad) || 0,
      unidad: comprobanteEdit.itemFormData.unidad || null,
      precioUnitario: parseFloat(comprobanteEdit.itemFormData.precioUnitario) || 0,
      subtotal: parseFloat(comprobanteEdit.itemFormData.subtotal) || 0,
      alicuotaIva: comprobanteEdit.itemFormData.alicuotaIva ? parseFloat(comprobanteEdit.itemFormData.alicuotaIva) : null,
      importeIva: comprobanteEdit.itemFormData.importeIva ? parseFloat(comprobanteEdit.itemFormData.importeIva) : null,
      totalLinea: parseFloat(comprobanteEdit.itemFormData.totalLinea) || 0,
      tipoProducto: comprobanteEdit.itemFormData.tipoProducto || null,
      codigoDimension: comprobanteEdit.itemFormData.codigoDimension || null,
      subcuenta: comprobanteEdit.itemFormData.subcuenta || null,
      cuentaContable: comprobanteEdit.itemFormData.cuentaContable || null,
      tipoOrdenCompra: comprobanteEdit.itemFormData.tipoOrdenCompra || null,
      ordenCompra: comprobanteEdit.itemFormData.ordenCompra || null
    };

    saveItemMutation.mutate(async () => {
      if (comprobanteEdit.selectedItem) {
        // Actualizar
        const response = await api.put(`/documentos/lineas/${comprobanteEdit.selectedItem.id}`, dataToSend);
        toast.success('Item actualizado correctamente');
        comprobanteEdit.setSavingItem(false);
        return response;
      } else {
        // Crear
        const response = await api.post(`/documentos/${comprobanteEdit.selectedDocument!.id}/lineas`, dataToSend);
        toast.success('Item agregado correctamente');
        comprobanteEdit.setSavingItem(false);
        return response;
      }
    });
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!comprobanteEdit.selectedDocument) return;

    const confirmed = await confirmDelete('este item');
    if (!confirmed) return;

    deleteItemMutation.mutate(() => api.delete(`/documentos/lineas/${itemId}`));
  };

  // ========== FUNCIONES PARA IMPUESTOS ==========

  // loadDocumentoImpuestos - Ahora en useComprobanteEdit hook

  const handleOpenImpuestoModal = async (impuesto: any = null) => {
    comprobanteEdit.setSelectedImpuesto(impuesto);

    // Cargar códigos de dimensión y cuentas contables
    try {
      const [responseDimensiones, responseCuentas] = await Promise.all([
        parametrosApi.getPorCampo('codigo_dimension'),
        parametrosApi.getPorCampo('cuenta_contable')
      ]);
      comprobanteEdit.setCodigosDimension(responseDimensiones.parametros);
      comprobanteEdit.setCuentasContables(responseCuentas.parametros);
    } catch (error) {
      console.error('Error loading parametros:', error);
    }

    if (impuesto) {
      // Edición
      comprobanteEdit.setImpuestoFormData({
        tipo: impuesto.tipo || '',
        descripcion: impuesto.descripcion || '',
        alicuota: impuesto.alicuota ? Number(impuesto.alicuota).toString() : '',
        baseImponible: impuesto.baseImponible ? Number(impuesto.baseImponible).toString() : '',
        importe: impuesto.importe ? Number(impuesto.importe).toString() : '',
        codigoDimension: impuesto.codigoDimension || '',
        subcuenta: impuesto.subcuenta || '',
        cuentaContable: impuesto.cuentaContable || ''
      });

      // Si tiene código de dimensión, cargar comprobanteEdit.subcuentas filtradas
      if (impuesto.codigoDimension) {
        try {
          const response = await parametrosApi.getPorCampo('subcuenta', impuesto.codigoDimension);
          comprobanteEdit.setSubcuentas(response.parametros);
        } catch (error) {
          console.error('Error loading comprobanteEdit.subcuentas:', error);
        }
      }
    } else {
      // Nuevo impuesto
      comprobanteEdit.setImpuestoFormData({
        tipo: 'IVA',
        descripcion: '',
        alicuota: '21',
        baseImponible: '',
        importe: '',
        codigoDimension: '',
        subcuenta: '',
        cuentaContable: ''
      });
    }
    comprobanteEdit.setShowImpuestoModal(true);
  };

  // Funciones de cascada para modal de impuestos
  const handleCodigoDimensionChangeImpuesto = async (codigoDimension: string) => {
    comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, codigoDimension, subcuenta: '', cuentaContable: '' });

    if (codigoDimension) {
      try {
        const response = await parametrosApi.getPorCampo('subcuenta', codigoDimension);
        comprobanteEdit.setSubcuentas(response.parametros);
      } catch (error) {
        console.error('Error loading comprobanteEdit.subcuentas:', error);
        comprobanteEdit.setSubcuentas([]);
      }
    } else {
      comprobanteEdit.setSubcuentas([]);
      comprobanteEdit.setCuentasContables([]);
    }
  };

  const handleSubcuentaChangeImpuesto = (subcuenta: string) => {
    // cuenta_contable es independiente, no se limpia al cambiar subcuenta
    comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, subcuenta });
  };

  const handleSaveImpuesto = () => {
    if (!comprobanteEdit.selectedDocument) return;

    comprobanteEdit.setSavingImpuesto(true);

    const dataToSend = {
      tipo: comprobanteEdit.impuestoFormData.tipo,
      descripcion: comprobanteEdit.impuestoFormData.descripcion,
      alicuota: comprobanteEdit.impuestoFormData.alicuota ? parseFloat(comprobanteEdit.impuestoFormData.alicuota) : null,
      baseImponible: comprobanteEdit.impuestoFormData.baseImponible ? parseFloat(comprobanteEdit.impuestoFormData.baseImponible) : null,
      importe: parseFloat(comprobanteEdit.impuestoFormData.importe) || 0,
      codigoDimension: comprobanteEdit.impuestoFormData.codigoDimension || null,
      subcuenta: comprobanteEdit.impuestoFormData.subcuenta || null,
      cuentaContable: comprobanteEdit.impuestoFormData.cuentaContable || null
    };

    saveImpuestoMutation.mutate(async () => {
      if (comprobanteEdit.selectedImpuesto) {
        // Actualizar
        const response = await api.put(`/documentos/impuestos/${comprobanteEdit.selectedImpuesto.id}`, dataToSend);
        toast.success('Impuesto actualizado correctamente');
        comprobanteEdit.setSavingImpuesto(false);
        return response;
      } else {
        // Crear
        const response = await api.post(`/documentos/${comprobanteEdit.selectedDocument!.id}/impuestos`, dataToSend);
        toast.success('Impuesto agregado correctamente');
        comprobanteEdit.setSavingImpuesto(false);
        return response;
      }
    });
  };

  const handleDeleteImpuesto = async (impuestoId: string) => {
    if (!comprobanteEdit.selectedDocument) return;

    const confirmed = await confirmDelete('este impuesto');
    if (!confirmed) return;

    await comprobanteEdit.handleDeleteImpuesto(impuestoId);
  };

  // Función para desasociar comprobante
  const handleDisassociateDocument = async (doc: DocumentoProcessado) => {
    const confirmed = await confirmDelete(
      `la asociación del comprobante "${doc.nombreArchivo}"`
    );
    if (!confirmed) return;

    disassociateDocumentMutation.mutate(async () => {
      const response = await api.post(`/documentos/${doc.id}/desasociar`);

      // Actualizar el documento local
      setDocumentos(prev => prev.map(d =>
        d.id === doc.id
          ? { ...d, documentosAsociados: [] }
          : d
      ));

      // Actualizar métricas
      setMetrics(prev => ({
        ...prev,
        asociados: Math.max(0, (prev.asociados || 0) - 1),
        pendientes: prev.pendientes + 1
      }));

      return response;
    });
  };

  // Funciones para SmartSelector
  const handleFieldClick = (
    e: React.MouseEvent,
    fieldType: string,
    currentValue: string,
    entityType: 'item' | 'impuesto',
    entityId: string,
    fieldName: string,
    parentValue?: string
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setSmartSelectorConfig({
      fieldType,
      currentValue,
      parentValue,
      entityType,
      entityId,
      fieldName,
      position: { x: rect.left, y: rect.bottom + 5 }
    });
    setShowSmartSelector(true);
  };

  const handleSmartSelectorSelect = (codigo: string, nombre: string) => {
    if (!smartSelectorConfig) return;

    const { entityType, entityId, fieldName } = smartSelectorConfig;

    smartSelectorUpdateMutation.mutate(async () => {
      const endpoint = entityType === 'item'
        ? `/documentos/lineas/${entityId}`
        : `/documentos/impuestos/${entityId}`;

      const response = await api.put(endpoint, { [fieldName]: codigo });

      // Actualizar la lista local
      if (entityType === 'item') {
        await comprobanteEdit.loadDocumentoLineas(comprobanteEdit.selectedDocument!.id);
      } else {
        await comprobanteEdit.loadDocumentoImpuestos(comprobanteEdit.selectedDocument!.id);
      }

      toast.success(`${fieldName} actualizado correctamente`);
      return response;
    });
  };

  const handleSmartSelectorClose = () => {
    setShowSmartSelector(false);
    setSmartSelectorConfig(null);
  };

  // Cargar datos reales de la API
  const loadDocumentos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/documentos?includeMetrics=true');
      
      if (response.data) {
        // Normalizar los datos para usar camelCase
        const normalizedDocumentos = (response.data.documentos || []).map((doc: any) => ({
          ...doc,
          documentosAsociados: doc.documentosAsociados || doc.documentos_asociados || []
        }));
        setDocumentos(normalizedDocumentos);

        // Calcular métricas basadas en el campo exportado
        const totalSubidos = normalizedDocumentos.length;
        const totalExportados = normalizedDocumentos.filter((doc: any) => doc.exportado).length;
        const totalPendientes = normalizedDocumentos.filter((doc: any) => !doc.exportado).length;
        const totalConError = normalizedDocumentos.filter((doc: any) => doc.estadoProcesamiento === 'error').length;

        setMetrics({
          subidos: totalSubidos,
          pendientes: totalPendientes,
          exportados: totalExportados,
          conError: totalConError
        });
      }
    } catch (error) {
      console.error('Error cargando documentos:', error);
      toast.error('Error al cargar los documentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocumentos();
  }, []);

  // Limpiar selección cuando cambian los filtros o la página
  useEffect(() => {
    setSelectedDocuments(new Set());
  }, [filterStatus, searchTerm, currentPage]);

  const handleDocumentProcessed = (documento: any) => {
    setUploadModalOpen(false);
    // Recargar los datos para obtener la información más actualizada
    loadDocumentos();
    toast.success('Documento procesado correctamente');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completado':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'procesando':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completado':
        return 'Completado';
      case 'procesando':
        return 'Procesando';
      case 'error':
        return 'Error';
      default:
        return 'Desconocido';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    // Usar fecha local en lugar de UTC
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  // Función para parsear fecha DDMMYY a formato legible
  const parseDDMMYY = (fechaStr: string | null | undefined): string => {
    if (!fechaStr || fechaStr.length !== 6) return '-';
    
    try {
      const dd = parseInt(fechaStr.substr(0, 2));
      const mm = parseInt(fechaStr.substr(2, 2));
      const yy = parseInt(fechaStr.substr(4, 2));
      
      // Asumir que años 00-29 son 2000-2029, años 30-99 son 1930-1999
      const year = yy <= 29 ? 2000 + yy : 1900 + yy;
      
      const date = new Date(year, mm - 1, dd);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${day}-${month}-${year}`;
    } catch {
      return '-';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  // Función para formatear importe sin símbolo de moneda
  const formatNumber = (amount: number | string) => {
    const num = Number(amount || 0);
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Función para desmarcar que se aplicaron reglas a un documento
  const handleDesmarcarReglas = (documentoId: string) => {
    desmarcarReglasMutation.mutate(() => api.post(`/documentos/${documentoId}/desmarcar-reglas`));
  };

  // Función para cerrar el modal de procesamiento
  const handleCloseProcessingModal = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setProcessingAssociation(false);
    setProcessingComplete(false);
    setCloseCountdown(10);
    setAssociationProgress({
      current: 0,
      total: 0,
      currentDocumentName: '',
      currentCupon: '',
      reglasAplicadas: 0,
      documentosTransformados: 0,
      lineasTransformadas: 0,
      impuestosTransformados: 0,
      errores: 0
    });
  };

  // Función para ejecutar asociación automática con SSE
  const handleAutoAssociation = async () => {
    try {
      setProcessingAssociation(true);
      setProcessingComplete(false);
      setAssociationProgress({
        current: 0,
        total: 0,
        currentDocumentName: '',
        currentCupon: '',
        reglasAplicadas: 0,
        documentosTransformados: 0,
        lineasTransformadas: 0,
        impuestosTransformados: 0,
        errores: 0
      });

      // Obtener documentos pendientes (completados y no exportados)
      const pendingDocuments = documentos.filter(doc =>
        doc.estadoProcesamiento === 'completado' &&
        !doc.exportado
      );

      if (pendingDocuments.length === 0) {
        toast('No hay documentos pendientes para aplicar reglas', {
          icon: <Info className="h-5 w-5" />,
          duration: 3000
        });
        setProcessingAssociation(false);
        return;
      }

      // Conectar a SSE (token por query param porque EventSource no soporta headers custom)
      const token = localStorage.getItem('token');

      if (!token) {
        toast.error('Token de autenticación no encontrado');
        setProcessingAssociation(false);
        return;
      }

      const eventSource = new EventSource(
        `${process.env.NEXT_PUBLIC_API_URL}/api/documentos/aplicar-reglas/stream?token=${token}&forzarReprocesamiento=${forzarReprocesamiento}`
      );

      // Acumular errores para mostrar resumen al final
      const erroresAcumulados: string[] = [];

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'start':
            // No mostrar toast - el modal ya indica que está procesando
            break;

          case 'info':
            if (data.total) {
              setAssociationProgress(prev => ({ ...prev, total: data.total }));
            }
            break;

          case 'progress':
            setAssociationProgress(prev => ({
              ...prev,
              current: data.current,
              total: data.total,
              currentDocumentName: data.documentName,
              currentCupon: ''
            }));
            break;

          case 'document-processed':
            // Actualizar estadísticas en tiempo real
            setAssociationProgress(prev => ({
              ...prev,
              reglasAplicadas: prev.reglasAplicadas + (data.reglas || 0),
              documentosTransformados: prev.documentosTransformados + (data.reglas > 0 ? 1 : 0)
            }));
            break;

          case 'error':
            // Acumular errores para mostrar resumen al final
            erroresAcumulados.push(`${data.documentName}: ${data.error}`);
            setAssociationProgress(prev => ({
              ...prev,
              errores: prev.errores + 1
            }));
            break;

          case 'complete':
            eventSource.close();

            // Actualizar estadísticas finales
            setAssociationProgress(prev => ({
              ...prev,
              lineasTransformadas: data.transformados?.lineas || 0,
              impuestosTransformados: data.transformados?.impuestos || 0
            }));

            // Marcar como completado (no cerrar modal aún)
            setProcessingComplete(true);

            // Refrescar la grilla
            loadDocumentos();

            // Iniciar countdown de 10 segundos
            setCloseCountdown(10);
            countdownIntervalRef.current = setInterval(() => {
              setCloseCountdown(prev => {
                if (prev <= 1) {
                  // Cerrar modal
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                  }
                  handleCloseProcessingModal();
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
            break;
        }
      };

      eventSource.onerror = (error) => {
        console.error('Error en SSE:', error);
        eventSource.close();
        setProcessingAssociation(false);
        toast.error('Error al aplicar reglas de completado');
        setAssociationProgress({
          current: 0,
          total: 0,
          currentDocumentName: '',
          currentCupon: '',
          reglasAplicadas: 0,
          documentosTransformados: 0,
          lineasTransformadas: 0,
          impuestosTransformados: 0,
          errores: 0
        });
      };

    } catch (error) {
      console.error('Error aplicando reglas:', error);
      toast.error('Error al aplicar reglas de completado');
      setProcessingAssociation(false);
      setAssociationProgress({
        current: 0,
        total: 0,
        currentDocumentName: '',
        currentCupon: '',
        reglasAplicadas: 0,
        documentosTransformados: 0,
        lineasTransformadas: 0,
        impuestosTransformados: 0,
        errores: 0
      });
    }
  };

  // Filtrar documentos según los criterios
  const filteredDocumentos = documentos.filter(doc => {
    // Filtro por término de búsqueda
    const searchMatch = !searchTerm || 
      doc.nombreArchivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.cuitExtraido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.razonSocialExtraida?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.numeroComprobanteExtraido?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro por estado
    let statusMatch = true;
    if (filterStatus !== 'todos') {
      switch (filterStatus) {
        case 'pendientes':
          statusMatch = !doc.exportado;
          break;
        case 'exportados':
          statusMatch = doc.exportado === true;
          break;
        case 'error':
          statusMatch = doc.estadoProcesamiento === 'error';
          break;
        case 'con_errores':
          statusMatch = !!(doc.validationErrors && doc.validationErrors.summary && doc.validationErrors.summary.total > 0);
          break;
        default:
          statusMatch = true;
      }
    }

    return searchMatch && statusMatch;
  });

  // Paginación
  const totalPages = Math.ceil(filteredDocumentos.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedDocumentos = filteredDocumentos.slice(startIndex, endIndex);

  // Reset página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, rowsPerPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <ScanText className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Comprobantes
            </h1>
            <p className="text-text-secondary">
              Procesamiento y extracción de información de comprobantes
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">

      {/* Dashboard de métricas con botones a los lados */}
      <div className="flex items-center gap-8 mb-8">
        {/* Botón izquierdo */}
        <div className="flex-shrink-0 ml-8">
          <button
            className="h-36 w-36 rounded-full bg-primary hover:bg-primary/90 shadow-lg flex flex-col items-center justify-center text-palette-dark transition-colors"
            onClick={() => setUploadModalOpen(true)}
          >
            <Upload className="w-10 h-10 mb-2" />
            <span className="text-sm font-medium text-center leading-tight">Subir<br/>Comprobante</span>
          </button>
        </div>

        {/* Dashboard central */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card hover>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  Documentos Subidos
                </p>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {metrics.subidos}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  Pendientes
                </p>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {metrics.pendientes}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-orange-50">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  Exportados
                </p>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {metrics.exportados}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-50">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  Con Errores
                </p>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {metrics.conError}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-50">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Botón derecho - Solo mostrar para tarjeta */}
        {(
        <div className="flex-shrink-0 mr-8">
          <div className="flex flex-col items-center gap-3">
            {/* Botón circular */}
            <button
              onClick={handleAutoAssociation}
              disabled={processingAssociation}
              className={`h-36 w-36 rounded-full shadow-lg flex flex-col items-center justify-center text-palette-dark transition-colors ${
                processingAssociation
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {processingAssociation ? (
                <>
                  <Clock className="w-10 h-10 mb-2 animate-spin" />
                  <span className="text-sm font-medium text-center leading-tight">Procesando...</span>
                </>
              ) : (
                <>
                  <Zap className="w-10 h-10 mb-2" />
                  <span className="text-sm font-medium text-center leading-tight">Aplicar<br/>Reglas</span>
                </>
              )}
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por nombre de archivo, CUIT, razón social..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 items-center">
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="todos">Mostrar Todos</option>
              <option value="pendientes">Pendientes</option>
              <option value="exportados">Exportados</option>
              <option value="con_errores">Con Errores</option>
            </select>

            {/* Switch para forzar reprocesamiento */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-700">Reprocesar todos</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={forzarReprocesamiento}
                  onChange={(e) => setForzarReprocesamiento(e.target.checked)}
                  disabled={processingAssociation}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${
                  forzarReprocesamiento ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    forzarReprocesamiento ? 'translate-x-4' : ''
                  }`}></div>
                </div>
              </div>
            </label>
          </div>
        </div>
      </Card>

      {/* Grilla de documentos */}
      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-text-primary">Documentos Procesados</h2>

              {/* Botón eliminar seleccionados */}
              {selectedDocuments.size > 0 && (
                <Button
                  onClick={handleDeleteSelected}
                  disabled={deletingSelected}
                  variant="danger"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {deletingSelected ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Eliminar ({selectedDocuments.size})
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Barra de progreso de asociación automática */}
            {associationProgress.total > 0 && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-sm text-gray-600">
                    Procesando {associationProgress.current} de {associationProgress.total}
                    {associationProgress.currentCupon && (
                      <span className="ml-2 text-green-600 font-medium">
                        → Cupón: {associationProgress.currentCupon}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-64 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(associationProgress.current / associationProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {Math.round((associationProgress.current / associationProgress.total) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    checked={paginatedDocumentos.length > 0 && paginatedDocumentos.every(doc => selectedDocuments.has(doc.id))}
                    onChange={toggleSelectAll}
                    title="Seleccionar todos"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Comprobante
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo Comprobante
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Razón Social
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gravado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Exento
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Impuestos
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Desc./Rec.
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Moneda
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CAE
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedDocumentos.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-4 text-center text-gray-500">
                    {documentos.length === 0 ?
                      'No hay documentos procesados. ¡Sube tu primer comprobante!' :
                      'No se encontraron documentos que coincidan con los filtros.'}
                  </td>
                </tr>
              ) : (
                paginatedDocumentos.map((doc) => {
                // Usar impuestos extraídos si están disponibles, sino calcular (Total - Gravado - Exento)
                const gravado = doc.netoGravadoExtraido || 0;
                const exento = doc.exentoExtraido || 0;
                const total = doc.importeExtraido || 0;
                const impuestos = doc.impuestosExtraido || (total - gravado - exento);

                return (
                  <tr key={doc.id} className={`hover:bg-gray-50 ${selectedDocuments.has(doc.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-2 py-4 text-center w-10">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        checked={selectedDocuments.has(doc.id)}
                        onChange={() => toggleDocumentSelection(doc.id)}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.fechaExtraida ? formatDate(doc.fechaExtraida) : '-'}
                    </td>
                    <td 
                      className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 relative cursor-help"
                      onMouseEnter={(e) => {
                        setHoveredDoc(doc.id);
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPosition({ 
                          x: rect.left + rect.width / 2, 
                          y: rect.top 
                        });
                      }}
                      onMouseLeave={() => setHoveredDoc(null)}
                    >
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {doc.datosExtraidos?.tipoComprobante || 'N/D'}
                          {doc.validationErrors && doc.validationErrors.summary.total > 0 && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                doc.validationErrors.summary.bloqueantes > 0
                                  ? 'bg-red-100 text-red-800'
                                  : doc.validationErrors.summary.errores > 0
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                              title={`${doc.validationErrors.summary.total} validación(es) fallida(s)`}
                            >
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {doc.validationErrors.summary.total}
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500 border-b border-dotted border-gray-400 inline-block">
                          {doc.numeroComprobanteExtraido || '-'}
                        </div>
                      </div>
                      
                      {/* Tooltip personalizado */}
                      {hoveredDoc === doc.id && (
                        <div 
                          className="fixed z-50 pointer-events-none"
                          style={{
                            left: `${tooltipPosition.x}px`,
                            top: `${tooltipPosition.y - 10}px`,
                            transform: 'translate(-50%, -100%)'
                          }}
                        >
                          <div className="bg-blue-900 text-palette-dark p-4 rounded-lg shadow-xl max-w-sm">
                            <div className="text-xs font-semibold mb-2 text-blue-300">Detalles del Documento</div>
                            
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Archivo:</span>
                                <span className="font-medium ml-2 text-white">{doc.nombreArchivo}</span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-gray-400">Tipo:</span>
                                <span className="font-medium ml-2 text-white flex items-center gap-1">
                                  {doc.tipoArchivo === 'pdf' ? (
                                    <><FileText className="w-3 h-3" /> PDF</>
                                  ) : (
                                    <><ImageIcon className="w-3 h-3" /> Imagen</>
                                  )}
                                </span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-gray-400">Procesado:</span>
                                <span className="font-medium ml-2 text-white">
                                  {new Date(doc.fechaProcesamiento).toLocaleString('es-AR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-gray-400">Estado:</span>
                                <span className="font-medium ml-2 text-white flex items-center gap-1">
                                  {doc.estadoProcesamiento === 'completado' ? (
                                    <><CheckCircle className="w-3 h-3 text-green-400" /> Completado</>
                                  ) : doc.estadoProcesamiento === 'error' ? (
                                    <><XCircle className="w-3 h-3 text-red-400" /> Error</>
                                  ) : (
                                    <><Clock className="w-3 h-3 text-yellow-400 animate-spin" /> Procesando</>
                                  )}
                                </span>
                              </div>
                              
                              
                              {doc.caeExtraido && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">CAE:</span>
                                  <span className="font-medium ml-2 text-white">{doc.caeExtraido}</span>
                                </div>
                              )}
                              
                              {doc.observaciones && (
                                <div className="pt-2 border-t border-gray-700">
                                  <span className="text-yellow-300">Observaciones:</span>
                                  <div className="mt-1 text-gray-300">{doc.observaciones}</div>
                                </div>
                              )}

                              {doc.validationErrors && doc.validationErrors.summary.total > 0 && (
                                <div className="pt-2 border-t border-red-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-4 h-4 text-red-400" />
                                    <span className="text-red-300 font-semibold">Errores de Validación</span>
                                  </div>
                                  <div className="space-y-1 text-xs">
                                    {doc.validationErrors.summary.bloqueantes > 0 && (
                                      <div className="text-red-300">
                                        🚫 {doc.validationErrors.summary.bloqueantes} bloqueante(s)
                                      </div>
                                    )}
                                    {doc.validationErrors.summary.errores > 0 && (
                                      <div className="text-orange-300">
                                        ⚠️ {doc.validationErrors.summary.errores} error(es)
                                      </div>
                                    )}
                                    {doc.validationErrors.summary.warnings > 0 && (
                                      <div className="text-yellow-300">
                                        ⚡ {doc.validationErrors.summary.warnings} advertencia(s)
                                      </div>
                                    )}
                                    {doc.validationErrors.errors.slice(0, 3).map((err: any, idx: number) => (
                                      <div key={idx} className="mt-2 pl-2 border-l-2 border-red-500">
                                        <div className="text-red-200 font-medium">{err.regla || 'Regla'}</div>
                                        <div className="text-gray-300">{err.mensaje || err.message}</div>
                                        {err.contexto && (
                                          <div className="text-gray-400 text-xs mt-0.5">
                                            Contexto: {err.contexto}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {doc.validationErrors.errors.length > 3 && (
                                      <div className="text-gray-400 text-xs italic mt-1">
                                        ...y {doc.validationErrors.errors.length - 3} más
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Flecha del tooltip */}
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-blue-900"></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="font-medium">
                        {doc.razonSocialExtraida || '-'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {doc.cuitExtraido || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {gravado ? formatCurrency(gravado) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {exento ? formatCurrency(exento) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {impuestos > 0 ? formatCurrency(impuestos) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {doc.descuentoGlobalExtraido ? (
                        <span className={doc.descuentoGlobalExtraido < 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(Math.abs(doc.descuentoGlobalExtraido))}
                          <span className="text-xs ml-1">
                            {doc.descuentoGlobalTipo === 'DESCUENTO' ? '(D)' : doc.descuentoGlobalTipo === 'RECARGO' ? '(R)' : ''}
                          </span>
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        doc.monedaExtraida === 'USD' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {doc.monedaExtraida || 'ARS'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {total ? formatCurrency(total) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.caeExtraido || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-2">
                        {/* Botón de desmarcar reglas aplicadas */}
                        <div className="w-6 flex justify-center">
                          {doc.reglasAplicadas ? (
                            <button
                              onClick={() => handleDesmarcarReglas(doc.id)}
                              className="text-purple-500 hover:text-purple-700 p-1"
                              title="Desmarcar para reprocesar"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="w-6 h-6"></div>
                          )}
                        </div>

                        {/* Botón de ver archivo - siempre presente */}
                        <div className="w-6 flex justify-center">
                          <button
                            className="text-gray-500 hover:text-gray-700 p-1"
                            title="Ver archivo"
                            onClick={() => handleViewDocument(doc.id)}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Botón de editar campos extraídos - siempre presente */}
                        <div className="w-6 flex justify-center">
                          <button
                            className="text-green-600 hover:text-green-700 p-1"
                            title="Editar datos extraídos"
                            onClick={() => handleOpenEditModal(doc)}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Botón de observaciones - siempre presente */}
                        <div className="w-6 flex justify-center">
                          <button
                            className="text-orange-600 hover:text-orange-700 p-1"
                            title="Agregar observación"
                            onClick={() => handleOpenObservationModal(doc)}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Botón de eliminar */}
                        <div className="w-6 flex justify-center">
                          {true ? (
                            <button
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Eliminar documento"
                              onClick={() => handleDeleteDocument(doc.id, doc.nombreArchivo)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="w-6 h-6"></div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700">Filas por página:</label>
                <select
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700 ml-4">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, filteredDocumentos.length)} de {filteredDocumentos.length} ítems
                </span>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  
                  {/* Números de página */}
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNum
                            ? 'z-10 bg-primary border-primary text-palette-dark'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Modal de Edición de Datos Extraídos */}
      <ComprobanteEditModal
        isOpen={showEditModal}
        documento={comprobanteEdit.selectedDocument}
        onClose={() => setShowEditModal(false)}
        onSave={(updatedDoc) => {
          setDocumentos(prev => prev.map(doc =>
            doc.id === updatedDoc.id ? updatedDoc as DocumentoProcessado : doc
          ));
          setShowEditModal(false);
        }}
      />

      {/* Modal de Observaciones */}
      {showObservationModal && selectedDocumentForObservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in fade-in-0 zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center space-x-3">
                <Info className="w-6 h-6 text-blue-500" />
                <h2 className="text-lg font-semibold text-text-primary">
                  Observaciones del Comprobante
                </h2>
              </div>
              <button
                onClick={() => setShowObservationModal(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-text-secondary mb-2">Documento:</div>
                <div className="text-sm font-medium text-text-primary bg-gray-50 p-2 rounded">
                  {selectedDocumentForObservation.nombreArchivo}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Observación o aclaración
                </label>
                <textarea
                  value={observationText}
                  onChange={(e) => setObservationText(e.target.value)}
                  placeholder="Ingrese cualquier observación o aclaración sobre este comprobante..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={4}
                  disabled={savingObservation}
                />
                <div className="text-xs text-text-secondary mt-1">
                  Máximo 500 caracteres ({observationText.length}/500)
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-gray-50">
              <Button
                variant="outline"
                onClick={() => setShowObservationModal(false)}
                disabled={savingObservation}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveObservation}
                disabled={savingObservation || observationText.length > 500}
                className="bg-palette-dark hover:bg-palette-dark/90 text-white"
              >
                {savingObservation ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición/Creación de Item */}
      {comprobanteEdit.showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {comprobanteEdit.selectedItem ? 'Editar Item' : 'Agregar Item'}
                </h2>
              </div>
              <button
                onClick={() => {
                  comprobanteEdit.setShowItemModal(false);
                  comprobanteEdit.setSelectedItem(null);
                  comprobanteEdit.setItemFormData({});
                }}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Número */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Número de Línea
                  </label>
                  <input
                    type="number"
                    value={comprobanteEdit.itemFormData.numero || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, numero: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="1"
                  />
                </div>

                {/* Código Producto */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Código Producto
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.itemFormData.codigoProducto || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, codigoProducto: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="COD123"
                  />
                </div>

                {/* Descripción */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Descripción *
                  </label>
                  <textarea
                    value={comprobanteEdit.itemFormData.descripcion || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Descripción del producto o servicio"
                    rows={2}
                  />
                </div>

                {/* Cantidad */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={comprobanteEdit.itemFormData.cantidad || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, cantidad: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="1.00"
                  />
                </div>

                {/* Unidad */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Unidad
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.itemFormData.unidad || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, unidad: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="un, kg, m, hs"
                  />
                </div>

                {/* Precio Unitario */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Precio Unitario *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={comprobanteEdit.itemFormData.precioUnitario || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, precioUnitario: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.0000"
                  />
                </div>

                {/* Subtotal */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Subtotal *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.itemFormData.subtotal || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, subtotal: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* Alícuota IVA */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Alícuota IVA (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.itemFormData.alicuotaIva || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, alicuotaIva: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="21.00"
                  />
                </div>

                {/* Importe IVA */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Importe IVA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.itemFormData.importeIva || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, importeIva: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* Total Línea */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Total Línea *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.itemFormData.totalLinea || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, totalLinea: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* Separador para campos contables */}
                <div className="col-span-2 border-t border-gray-300 pt-4 mt-2"></div>

                {/* Tipo de Producto */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Tipo de Producto
                  </label>
                  <select
                    value={comprobanteEdit.itemFormData.tipoProducto || ''}
                    onChange={(e) => handleTipoProductoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Seleccionar tipo...</option>
                    {comprobanteEdit.tiposProducto.map((tipo) => (
                      <option key={tipo.id} value={tipo.codigo}>
                        {tipo.nombre} ({tipo.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Código de Producto */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Código de Producto
                  </label>
                  <select
                    value={comprobanteEdit.itemFormData.codigoProducto || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, codigoProducto: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={!comprobanteEdit.itemFormData.tipoProducto}
                  >
                    <option value="">Seleccionar código...</option>
                    {comprobanteEdit.codigosProducto.map((codigo) => (
                      <option key={codigo.id} value={codigo.codigo}>
                        {codigo.nombre} ({codigo.codigo})
                      </option>
                    ))}
                  </select>
                  {!comprobanteEdit.itemFormData.tipoProducto && (
                    <p className="text-xs text-gray-500 mt-1">Primero selecciona un tipo de producto</p>
                  )}
                </div>

                {/* Código de Dimensión */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Código de Dimensión
                  </label>
                  <select
                    value={comprobanteEdit.itemFormData.codigoDimension || ''}
                    onChange={(e) => handleCodigoDimensionChange(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Seleccionar dimensión...</option>
                    {comprobanteEdit.codigosDimension.map((dim) => (
                      <option key={dim.id} value={dim.codigo}>
                        {dim.nombre} ({dim.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subcuenta */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Subcuenta
                  </label>
                  <select
                    value={comprobanteEdit.itemFormData.subcuenta || ''}
                    onChange={(e) => handleSubcuentaChange(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={!comprobanteEdit.itemFormData.codigoDimension}
                  >
                    <option value="">Seleccionar subcuenta...</option>
                    {comprobanteEdit.subcuentas.map((sub) => (
                      <option key={sub.id} value={sub.codigo}>
                        {sub.nombre} ({sub.codigo})
                      </option>
                    ))}
                  </select>
                  {!comprobanteEdit.itemFormData.codigoDimension && (
                    <p className="text-xs text-gray-500 mt-1">Primero selecciona un código de dimensión</p>
                  )}
                </div>

                {/* Cuenta Contable */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Cuenta Contable
                  </label>
                  <select
                    value={comprobanteEdit.itemFormData.cuentaContable || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, cuentaContable: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={!comprobanteEdit.itemFormData.subcuenta}
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {comprobanteEdit.cuentasContables.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.codigo}>
                        {cuenta.nombre} ({cuenta.codigo})
                      </option>
                    ))}
                  </select>
                  {!comprobanteEdit.itemFormData.subcuenta && (
                    <p className="text-xs text-gray-500 mt-1">Primero selecciona una subcuenta</p>
                  )}
                </div>

                {/* Tipo de Orden de Compra */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Tipo de Orden de Compra
                  </label>
                  <select
                    value={comprobanteEdit.itemFormData.tipoOrdenCompra || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, tipoOrdenCompra: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Seleccionar tipo OC...</option>
                    {comprobanteEdit.tiposOrdenCompra.map((tipo) => (
                      <option key={tipo.id} value={tipo.codigo}>
                        {tipo.nombre} ({tipo.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Orden de Compra */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Orden de Compra
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.itemFormData.ordenCompra || ''}
                    onChange={(e) => comprobanteEdit.setItemFormData({ ...comprobanteEdit.itemFormData, ordenCompra: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Número de OC"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-gray-50">
              <Button
                variant="outline"
                onClick={() => {
                  comprobanteEdit.setShowItemModal(false);
                  comprobanteEdit.setSelectedItem(null);
                  comprobanteEdit.setItemFormData({});
                }}
                disabled={comprobanteEdit.savingItem}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveItem}
                disabled={comprobanteEdit.savingItem}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {comprobanteEdit.savingItem ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {comprobanteEdit.selectedItem ? 'Actualizar' : 'Crear'} Item
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición/Creación de Impuesto */}
      {comprobanteEdit.showImpuestoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center space-x-3">
                <Receipt className="w-6 h-6 text-purple-600" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {comprobanteEdit.selectedImpuesto ? 'Editar Impuesto' : 'Agregar Impuesto'}
                </h2>
              </div>
              <button
                onClick={() => {
                  comprobanteEdit.setShowImpuestoModal(false);
                  comprobanteEdit.setSelectedImpuesto(null);
                  comprobanteEdit.setImpuestoFormData({});
                }}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Tipo */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Tipo *
                  </label>
                  <select
                    value={comprobanteEdit.impuestoFormData.tipo || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="IVA">IVA</option>
                    <option value="Percepción">Percepción</option>
                    <option value="Retención">Retención</option>
                    <option value="Impuesto Interno">Impuesto Interno</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                {/* Alícuota */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Alícuota (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.impuestoFormData.alicuota || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, alicuota: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="21.00"
                  />
                </div>

                {/* Descripción */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Descripción *
                  </label>
                  <input
                    type="text"
                    value={comprobanteEdit.impuestoFormData.descripcion || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="IVA 21%, Percepción IIBB, etc."
                  />
                </div>

                {/* Base Imponible */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Base Imponible
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.impuestoFormData.baseImponible || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, baseImponible: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* Importe */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Importe *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comprobanteEdit.impuestoFormData.importe || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, importe: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* Separador para campos contables */}
                <div className="col-span-2 border-t border-gray-300 pt-4 mt-2"></div>

                {/* Código de Dimensión */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Código de Dimensión
                  </label>
                  <select
                    value={comprobanteEdit.impuestoFormData.codigoDimension || ''}
                    onChange={(e) => handleCodigoDimensionChangeImpuesto(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Seleccionar dimensión...</option>
                    {comprobanteEdit.codigosDimension.map((dim) => (
                      <option key={dim.id} value={dim.codigo}>
                        {dim.nombre} ({dim.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subcuenta */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Subcuenta
                  </label>
                  <select
                    value={comprobanteEdit.impuestoFormData.subcuenta || ''}
                    onChange={(e) => handleSubcuentaChangeImpuesto(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={!comprobanteEdit.impuestoFormData.codigoDimension}
                  >
                    <option value="">Seleccionar subcuenta...</option>
                    {comprobanteEdit.subcuentas.map((sub) => (
                      <option key={sub.id} value={sub.codigo}>
                        {sub.nombre} ({sub.codigo})
                      </option>
                    ))}
                  </select>
                  {!comprobanteEdit.impuestoFormData.codigoDimension && (
                    <p className="text-xs text-gray-500 mt-1">Primero selecciona un código de dimensión</p>
                  )}
                </div>

                {/* Cuenta Contable */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Cuenta Contable
                  </label>
                  <select
                    value={comprobanteEdit.impuestoFormData.cuentaContable || ''}
                    onChange={(e) => comprobanteEdit.setImpuestoFormData({ ...comprobanteEdit.impuestoFormData, cuentaContable: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {comprobanteEdit.cuentasContables.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.codigo}>
                        {cuenta.nombre} ({cuenta.codigo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-gray-50">
              <Button
                variant="outline"
                onClick={() => {
                  comprobanteEdit.setShowImpuestoModal(false);
                  comprobanteEdit.setSelectedImpuesto(null);
                  comprobanteEdit.setImpuestoFormData({});
                }}
                disabled={comprobanteEdit.savingImpuesto}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveImpuesto}
                disabled={comprobanteEdit.savingImpuesto}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {comprobanteEdit.savingImpuesto ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {comprobanteEdit.selectedImpuesto ? 'Actualizar' : 'Crear'} Impuesto
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Subir Comprobante */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onDocumentProcessed={handleDocumentProcessed}
        allowMultiple={true}
        title="Subir Comprobantes"
        context="comprobantes"
        tipo="tarjeta"
      />

      {/* Modal de Asociación Manual */}
      {/* Modal de visualización de documentos */}
      <DocumentViewerProvider documentViewer={documentViewer} />

      {/* Overlay de procesamiento de reglas */}
      {processingAssociation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop con desenfoque */}
          <div className="absolute inset-0 bg-palette-dark/40 backdrop-blur-sm"></div>

          {/* Contenedor del indicador */}
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center space-y-6 min-w-[450px] max-w-[500px]">
            {/* Indicador de estado: Spinner durante procesamiento, Checkmark al completar */}
            <div className="relative">
              {processingComplete ? (
                <>
                  {/* Checkmark verde de éxito */}
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-12 h-12 text-green-600" />
                  </div>
                </>
              ) : (
                <>
                  {/* Spinner animado durante procesamiento */}
                  <div className="w-24 h-24 border-4 border-palette-pink/30 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-24 h-24 border-4 border-palette-purple rounded-full border-t-transparent animate-spin"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <Zap className="w-10 h-10 text-palette-purple animate-pulse" />
                  </div>
                </>
              )}
            </div>

            {/* Texto de estado */}
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-palette-dark">
                {processingComplete ? 'Proceso Completado' : 'Aplicando Reglas de Negocio'}
              </h3>
              <p className="text-sm text-gray-600">
                {processingComplete
                  ? 'Se procesaron todos los documentos'
                  : 'Procesando documentos y aplicando transformaciones...'}
              </p>
            </div>

            {/* Barra de progreso con documento actual */}
            {associationProgress.total > 0 && (
              <div className="w-full space-y-4">
                {/* Información del documento actual (solo durante procesamiento) */}
                {!processingComplete && associationProgress.currentDocumentName && (
                  <div className="bg-palette-cream/30 border border-palette-cream rounded-lg p-3">
                    <p className="text-xs text-palette-dark/60 font-medium mb-1">Procesando:</p>
                    <p className="text-sm text-palette-dark font-semibold truncate">
                      {associationProgress.currentDocumentName}
                    </p>
                  </div>
                )}

                {/* Progreso numérico */}
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-palette-dark">
                    {associationProgress.current} de {associationProgress.total} documentos
                  </span>
                  <span className="text-2xl font-bold text-palette-purple">
                    {Math.round((associationProgress.current / associationProgress.total) * 100)}%
                  </span>
                </div>

                {/* Barra de progreso */}
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${(associationProgress.current / associationProgress.total) * 100}%`,
                        background: processingComplete
                          ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
                          : 'linear-gradient(90deg, #8E6AAA 0%, #F1ABB5 100%)'
                      }}
                    >
                      {!processingComplete && (
                        <div className="h-full w-full bg-white/20 animate-pulse"></div>
                      )}
                    </div>
                  </div>

                  {/* Indicador de pulso en el extremo (solo durante procesamiento) */}
                  {!processingComplete && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-palette-purple rounded-full shadow-lg transition-all duration-500"
                      style={{
                        left: `calc(${(associationProgress.current / associationProgress.total) * 100}% - 8px)`
                      }}
                    >
                      <div className="absolute inset-0 bg-palette-purple rounded-full animate-ping opacity-75"></div>
                    </div>
                  )}
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-green-600">
                      {associationProgress.reglasAplicadas}
                    </p>
                    <p className="text-xs text-green-600/70">Reglas aplicadas</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-blue-600">
                      {associationProgress.documentosTransformados}
                    </p>
                    <p className="text-xs text-blue-600/70">Docs modificados</p>
                  </div>
                  <div className={`rounded-lg p-2 text-center ${
                    associationProgress.errores > 0
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <p className={`text-lg font-bold ${
                      associationProgress.errores > 0 ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {associationProgress.errores}
                    </p>
                    <p className={`text-xs ${
                      associationProgress.errores > 0 ? 'text-red-600/70' : 'text-gray-400'
                    }`}>Errores</p>
                  </div>
                </div>

                {/* Detalle adicional cuando está completo */}
                {processingComplete && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Detalle de transformaciones:</p>
                    <div className="flex justify-around text-center">
                      <div>
                        <p className="text-sm font-bold text-gray-700">{associationProgress.documentosTransformados}</p>
                        <p className="text-xs text-gray-500">Documentos</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-700">{associationProgress.lineasTransformadas}</p>
                        <p className="text-xs text-gray-500">Líneas</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-700">{associationProgress.impuestosTransformados}</p>
                        <p className="text-xs text-gray-500">Impuestos</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botón de cerrar con countdown (solo cuando está completo) */}
                {processingComplete && (
                  <button
                    onClick={handleCloseProcessingModal}
                    className="w-full mt-4 py-3 px-4 bg-palette-purple hover:bg-palette-purple/90 text-white font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>Cerrar</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
                      {closeCountdown}s
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SmartSelector para edición de campos */}
      {showSmartSelector && smartSelectorConfig && (
        <SmartSelector
          value={smartSelectorConfig.currentValue}
          fieldType={smartSelectorConfig.fieldType}
          parentValue={smartSelectorConfig.parentValue}
          onSelect={handleSmartSelectorSelect}
          onClose={handleSmartSelectorClose}
          position={smartSelectorConfig.position}
        />
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

      </div>
    </div>
  );
}