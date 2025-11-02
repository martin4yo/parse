'use client';

import { useState, useEffect } from 'react';
import { Upload, Link2, FileText, CheckCircle, Clock, AlertCircle, Zap, ExternalLink, LinkIcon, Trash2, FileIcon, Image as ImageIcon, XCircle, Info, Receipt, Edit2, Edit, Unlink, Save, X, Calendar, MessageSquare, ScanText, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal';
import { DocumentViewerProvider } from '@/components/shared/DocumentViewerProvider';
import { useDocumentViewer, formatComprobantesEfectivoData } from '@/hooks/useDocumentViewer';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/hooks/useConfirm';

interface DashboardMetrics {
  subidos: number;
  pendientes: number;
  exportados: number;
  conError: number;
}

interface DocumentoProcessado {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  rutaArchivo?: string;
  fechaProcesamiento: string;
  estadoProcesamiento: string;
  fechaExtraida?: string;
  importeExtraido?: number;
  cuitExtraido?: string;
  numeroComprobanteExtraido?: string;
  razonSocialExtraida?: string;
  tipo?: string;
  netoGravadoExtraido?: number;
  exentoExtraido?: number;
  impuestosExtraido?: number;
  descuentoGlobalExtraido?: number;
  descuentoGlobalTipo?: string;
  monedaExtraida?: string;
  cuponExtraido?: string;
  caeExtraido?: string;
  tipoComprobanteExtraido?: string;
  observaciones?: string;
  documentosAsociados: any[];
  datosExtraidos?: any;
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
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set());
  const [associationProgress, setAssociationProgress] = useState({
    current: 0,
    total: 0,
    currentDocumentName: '',
    currentCupon: ''
  });
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [hoveredCupon, setHoveredCupon] = useState<string | null>(null);
  const [cuponTooltipPosition, setCuponTooltipPosition] = useState({ x: 0, y: 0 });
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [selectedDocumentForObservation, setSelectedDocumentForObservation] = useState<DocumentoProcessado | null>(null);
  const [observationText, setObservationText] = useState('');
  const [savingObservation, setSavingObservation] = useState(false);

  // Hook para el DocumentViewer
  const documentViewer = useDocumentViewer({
    findDocument: (documentId: string) => documentos.find(doc => doc.id === documentId),
    formatItemData: formatComprobantesEfectivoData
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDocumentForEdit, setSelectedDocumentForEdit] = useState<DocumentoProcessado | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados para tabs del modal de edición
  const [activeTab, setActiveTab] = useState<'encabezado' | 'items' | 'impuestos'>('encabezado');
  const [documentoLineas, setDocumentoLineas] = useState<any[]>([]);
  const [documentoImpuestos, setDocumentoImpuestos] = useState<any[]>([]);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [loadingImpuestos, setLoadingImpuestos] = useState(false);

  // Estados para modal de edición de item
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemFormData, setItemFormData] = useState<any>({});
  const [savingItem, setSavingItem] = useState(false);

  // Estados para modal de edición de impuesto
  const [showImpuestoModal, setShowImpuestoModal] = useState(false);
  const [selectedImpuesto, setSelectedImpuesto] = useState<any>(null);
  const [impuestoFormData, setImpuestoFormData] = useState<any>({});
  const [savingImpuesto, setSavingImpuesto] = useState(false);

  // Función para abrir el archivo
  const handleViewDocument = (documentId: string) => {
    // Use the document viewer hook
    documentViewer.openViewer(documentId);
  };

  // Función para eliminar documento
  const handleDeleteDocument = async (documentId: string, nombreArchivo: string) => {
    const confirmed = await confirmDelete(nombreArchivo);
    if (!confirmed) return;
    
    try {
      await api.delete(`/documentos/${documentId}`);
      toast.success('Documento eliminado correctamente');
      // Recargar documentos
      loadDocumentos();
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      toast.error('Error al eliminar el documento');
    }
  };

  // Función para abrir modal de observaciones
  const handleOpenObservationModal = (doc: DocumentoProcessado) => {
    setSelectedDocumentForObservation(doc);
    setObservationText(doc.observaciones || '');
    setShowObservationModal(true);
  };

  // Función para guardar observación
  const handleSaveObservation = async () => {
    if (!selectedDocumentForObservation) return;
    
    try {
      setSavingObservation(true);
      await api.put(`/documentos/${selectedDocumentForObservation.id}/observaciones`, {
        observaciones: observationText.trim() || null
      });
      
      // Actualizar el documento local
      setDocumentos(prev => prev.map(doc => 
        doc.id === selectedDocumentForObservation.id 
          ? { ...doc, observaciones: observationText.trim() || undefined }
          : doc
      ));
      
      toast.success('Observación guardada correctamente');
      setShowObservationModal(false);
      setSelectedDocumentForObservation(null);
      setObservationText('');
    } catch (error) {
      console.error('Error saving observation:', error);
      toast.error('Error al guardar la observación');
    } finally {
      setSavingObservation(false);
    }
  };

  // Función para abrir modal de edición
  const handleOpenEditModal = async (doc: DocumentoProcessado) => {
    setSelectedDocumentForEdit(doc);
    setEditFormData({
      fechaExtraida: doc.fechaExtraida || '',
      importeExtraido: doc.importeExtraido ? Number(doc.importeExtraido).toFixed(2) : '',
      cuitExtraido: doc.cuitExtraido || '',
      numeroComprobanteExtraido: doc.numeroComprobanteExtraido || '',
      razonSocialExtraida: doc.razonSocialExtraida || '',
      caeExtraido: doc.caeExtraido || '',
      tipoComprobanteExtraido: doc.tipoComprobanteExtraido || '',
      netoGravadoExtraido: doc.netoGravadoExtraido ? Number(doc.netoGravadoExtraido).toFixed(2) : '',
      exentoExtraido: doc.exentoExtraido ? Number(doc.exentoExtraido).toFixed(2) : '',
      impuestosExtraido: doc.impuestosExtraido ? Number(doc.impuestosExtraido).toFixed(2) : '',
      descuentoGlobalExtraido: doc.descuentoGlobalExtraido ? Number(doc.descuentoGlobalExtraido).toFixed(2) : '',
      descuentoGlobalTipo: doc.descuentoGlobalTipo || ''
    });
    setActiveTab('encabezado');
    setShowEditModal(true);

    // Cargar líneas e impuestos
    await loadDocumentoLineas(doc.id);
    await loadDocumentoImpuestos(doc.id);
  };

  // Función para guardar cambios de edición
  const handleSaveEdit = async () => {
    if (!selectedDocumentForEdit) return;
    
    try {
      setSavingEdit(true);
      
      // Validar suma de importes si hay valores
      const netoGravado = parseFloat(editFormData.netoGravadoExtraido) || 0;
      const exento = parseFloat(editFormData.exentoExtraido) || 0;
      const impuestos = parseFloat(editFormData.impuestosExtraido) || 0;
      const importeTotal = parseFloat(editFormData.importeExtraido) || 0;
      
      // Solo validar si hay un importe total definido
      if (importeTotal > 0) {
        const sumaComponentes = netoGravado + exento + impuestos;
        const diferencia = Math.abs(sumaComponentes - importeTotal);
        
        // Tolerancia de 0.01 para errores de redondeo
        if (diferencia > 0.01) {
          toast.error(`La suma de Neto Gravado + Exento + Impuestos (${sumaComponentes.toFixed(2)}) debe ser igual al Importe Total (${importeTotal.toFixed(2)})`);
          return;
        }
      }
      
      // Preparar datos para enviar
      const descuentoGlobal = editFormData.descuentoGlobalExtraido ? parseFloat(editFormData.descuentoGlobalExtraido) : null;
      const dataToSend = {
        ...editFormData,
        fechaExtraida: editFormData.fechaExtraida || null,
        importeExtraido: importeTotal || null,
        netoGravadoExtraido: netoGravado || null,
        exentoExtraido: exento || null,
        impuestosExtraido: impuestos || null,
        descuentoGlobalExtraido: descuentoGlobal,
        descuentoGlobalTipo: editFormData.descuentoGlobalTipo || null
      };
      
      await api.put(`/documentos/${selectedDocumentForEdit.id}/datos-extraidos`, dataToSend);
      
      // Actualizar el documento local
      setDocumentos(prev => prev.map(doc => 
        doc.id === selectedDocumentForEdit.id 
          ? { 
              ...doc, 
              ...dataToSend,
              datosExtraidos: {
                ...doc.datosExtraidos,
                tipoComprobante: dataToSend.tipoComprobanteExtraido,
                netoGravado: dataToSend.netoGravadoExtraido,
                exento: dataToSend.exentoExtraido,
                impuestos: dataToSend.impuestosExtraido
              }
            }
          : doc
      ));
      
      toast.success('Datos actualizados correctamente');
      setShowEditModal(false);
      setSelectedDocumentForEdit(null);
      setEditFormData({});
    } catch (error) {
      console.error('Error saving edit:', error);
      toast.error('Error al actualizar los datos');
    } finally {
      setSavingEdit(false);
    }
  };

  // ========== FUNCIONES PARA LÍNEAS (ITEMS) ==========

  const loadDocumentoLineas = async (documentoId: string) => {
    try {
      setLoadingLineas(true);
      const response = await api.get(`/documentos/${documentoId}/lineas`);
      setDocumentoLineas(response.data.lineas || []);
    } catch (error) {
      console.error('Error loading lineas:', error);
      toast.error('Error al cargar items del documento');
      setDocumentoLineas([]);
    } finally {
      setLoadingLineas(false);
    }
  };

  const handleOpenItemModal = (item: any = null) => {
    setSelectedItem(item);
    if (item) {
      // Edición
      setItemFormData({
        numero: item.numero,
        descripcion: item.descripcion || '',
        codigoProducto: item.codigoProducto || '',
        cantidad: item.cantidad ? Number(item.cantidad).toString() : '',
        unidad: item.unidad || '',
        precioUnitario: item.precioUnitario ? Number(item.precioUnitario).toString() : '',
        subtotal: item.subtotal ? Number(item.subtotal).toString() : '',
        alicuotaIva: item.alicuotaIva ? Number(item.alicuotaIva).toString() : '',
        importeIva: item.importeIva ? Number(item.importeIva).toString() : '',
        totalLinea: item.totalLinea ? Number(item.totalLinea).toString() : ''
      });
    } else {
      // Nuevo item
      const nextNumero = documentoLineas.length > 0
        ? Math.max(...documentoLineas.map(l => l.numero)) + 1
        : 1;
      setItemFormData({
        numero: nextNumero,
        descripcion: '',
        codigoProducto: '',
        cantidad: '',
        unidad: 'un',
        precioUnitario: '',
        subtotal: '',
        alicuotaIva: '21',
        importeIva: '',
        totalLinea: ''
      });
    }
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!selectedDocumentForEdit) return;

    try {
      setSavingItem(true);

      const dataToSend = {
        numero: parseInt(itemFormData.numero),
        descripcion: itemFormData.descripcion,
        codigoProducto: itemFormData.codigoProducto || null,
        cantidad: parseFloat(itemFormData.cantidad) || 0,
        unidad: itemFormData.unidad || null,
        precioUnitario: parseFloat(itemFormData.precioUnitario) || 0,
        subtotal: parseFloat(itemFormData.subtotal) || 0,
        alicuotaIva: itemFormData.alicuotaIva ? parseFloat(itemFormData.alicuotaIva) : null,
        importeIva: itemFormData.importeIva ? parseFloat(itemFormData.importeIva) : null,
        totalLinea: parseFloat(itemFormData.totalLinea) || 0
      };

      if (selectedItem) {
        // Actualizar
        await api.put(`/documentos/lineas/${selectedItem.id}`, dataToSend);
        toast.success('Item actualizado correctamente');
      } else {
        // Crear
        await api.post(`/documentos/${selectedDocumentForEdit.id}/lineas`, dataToSend);
        toast.success('Item agregado correctamente');
      }

      // Recargar líneas
      await loadDocumentoLineas(selectedDocumentForEdit.id);
      setShowItemModal(false);
      setSelectedItem(null);
      setItemFormData({});
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error('Error al guardar el item');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedDocumentForEdit) return;

    const confirmed = await confirmDelete('este item');
    if (!confirmed) return;

    try {
      await api.delete(`/documentos/lineas/${itemId}`);
      toast.success('Item eliminado correctamente');
      await loadDocumentoLineas(selectedDocumentForEdit.id);
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Error al eliminar el item');
    }
  };

  // ========== FUNCIONES PARA IMPUESTOS ==========

  const loadDocumentoImpuestos = async (documentoId: string) => {
    try {
      setLoadingImpuestos(true);
      const response = await api.get(`/documentos/${documentoId}/impuestos`);
      setDocumentoImpuestos(response.data.impuestos || []);
    } catch (error) {
      console.error('Error loading impuestos:', error);
      toast.error('Error al cargar impuestos del documento');
      setDocumentoImpuestos([]);
    } finally {
      setLoadingImpuestos(false);
    }
  };

  const handleOpenImpuestoModal = (impuesto: any = null) => {
    setSelectedImpuesto(impuesto);
    if (impuesto) {
      // Edición
      setImpuestoFormData({
        tipo: impuesto.tipo || '',
        descripcion: impuesto.descripcion || '',
        alicuota: impuesto.alicuota ? Number(impuesto.alicuota).toString() : '',
        baseImponible: impuesto.baseImponible ? Number(impuesto.baseImponible).toString() : '',
        importe: impuesto.importe ? Number(impuesto.importe).toString() : ''
      });
    } else {
      // Nuevo impuesto
      setImpuestoFormData({
        tipo: 'IVA',
        descripcion: '',
        alicuota: '21',
        baseImponible: '',
        importe: ''
      });
    }
    setShowImpuestoModal(true);
  };

  const handleSaveImpuesto = async () => {
    if (!selectedDocumentForEdit) return;

    try {
      setSavingImpuesto(true);

      const dataToSend = {
        tipo: impuestoFormData.tipo,
        descripcion: impuestoFormData.descripcion,
        alicuota: impuestoFormData.alicuota ? parseFloat(impuestoFormData.alicuota) : null,
        baseImponible: impuestoFormData.baseImponible ? parseFloat(impuestoFormData.baseImponible) : null,
        importe: parseFloat(impuestoFormData.importe) || 0
      };

      if (selectedImpuesto) {
        // Actualizar
        await api.put(`/documentos/impuestos/${selectedImpuesto.id}`, dataToSend);
        toast.success('Impuesto actualizado correctamente');
      } else {
        // Crear
        await api.post(`/documentos/${selectedDocumentForEdit.id}/impuestos`, dataToSend);
        toast.success('Impuesto agregado correctamente');
      }

      // Recargar impuestos
      await loadDocumentoImpuestos(selectedDocumentForEdit.id);
      setShowImpuestoModal(false);
      setSelectedImpuesto(null);
      setImpuestoFormData({});
    } catch (error) {
      console.error('Error saving impuesto:', error);
      toast.error('Error al guardar el impuesto');
    } finally {
      setSavingImpuesto(false);
    }
  };

  const handleDeleteImpuesto = async (impuestoId: string) => {
    if (!selectedDocumentForEdit) return;

    const confirmed = await confirmDelete('este impuesto');
    if (!confirmed) return;

    try {
      await api.delete(`/documentos/impuestos/${impuestoId}`);
      toast.success('Impuesto eliminado correctamente');
      await loadDocumentoImpuestos(selectedDocumentForEdit.id);
    } catch (error) {
      console.error('Error deleting impuesto:', error);
      toast.error('Error al eliminar el impuesto');
    }
  };

  // Función para desasociar comprobante
  const handleDisassociateDocument = async (doc: DocumentoProcessado) => {
    const confirmed = await confirmDelete(
      `la asociación del comprobante "${doc.nombreArchivo}" con el cupón ${doc.documentosAsociados[0]?.resumen_tarjeta?.numeroCupon || 'N/A'}`
    );
    if (!confirmed) return;

    try {
      await api.post(`/documentos/${doc.id}/desasociar`);
      
      // Actualizar el documento local
      setDocumentos(prev => prev.map(d => 
        d.id === doc.id 
          ? { ...d, documentosAsociados: [] }
          : d
      ));
      
      // Actualizar métricas
      setMetrics(prev => ({
        ...prev,
        asociados: Math.max(0, prev.asociados - 1),
        pendientes: prev.pendientes + 1
      }));
      
      toast.success('Comprobante desasociado correctamente');
    } catch (error) {
      console.error('Error disassociating document:', error);
      toast.error('Error al desasociar el comprobante');
    }
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
    return `${day}-${month}-${year}`;
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

  // Función para ejecutar asociación automática
  const handleAutoAssociation = async () => {
    try {
      setProcessingAssociation(true);

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
        return;
      }

      toast.loading('Aplicando reglas de completado...', { duration: 2000 });

      const response = await api.post('/documentos/aplicar-reglas');

      if (response.data.success) {
        const { total, procesados, transformados } = response.data;

        if (transformados > 0) {
          toast.success(
            `Reglas aplicadas: ${transformados} de ${procesados} documentos transformados`
          );
        } else {
          toast(
            `Se procesaron ${procesados} documentos. No se aplicaron transformaciones.`,
            {
              icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
              duration: 4000
            }
          );
        }

        // Refrescar la grilla para mostrar los cambios
        await loadDocumentos();
      }

    } catch (error) {
      console.error('Error aplicando reglas:', error);
      toast.error('Error al aplicar reglas de completado');
    } finally {
      setProcessingAssociation(false);
      setAssociationProgress({
        current: 0,
        total: 0,
        currentDocumentName: '',
        currentCupon: ''
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
          <div className="flex gap-2">
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="todos">Mostrar Todos</option>
              <option value="pendientes">Pendientes</option>
              <option value="exportados">Exportados</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Grilla de documentos */}
      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Documentos Procesados</h2>
            
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
                  <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
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
                  <tr key={doc.id} className="hover:bg-gray-50">
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
                        <div className="font-medium">
                          {doc.datosExtraidos?.tipoComprobante || 'N/D'}
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
                        {/* Botón de desasociar */}
                        <div className="w-6 flex justify-center">
                          {doc.documentosAsociados.length > 0 && (
                            <button
                              className="text-orange-500 hover:text-orange-700 p-1"
                              title="Desasociar comprobante"
                              onClick={() => handleDisassociateDocument(doc)}
                            >
                              <Unlink className="w-4 h-4" />
                            </button>
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
                        
                        {/* Botón de eliminar - solo para documentos no asociados */}
                        <div className="w-6 flex justify-center">
                          {doc.documentosAsociados.length === 0 ? (
                            <button 
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Eliminar documento"
                              onClick={() => handleDeleteDocument(doc.id, doc.nombreArchivo)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="w-6 h-6"></div> // Espacio reservado invisible
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
      {showEditModal && selectedDocumentForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col animate-in fade-in-0 zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-white flex-shrink-0">
              <div className="flex items-center space-x-3">
                <Edit className="w-6 h-6 text-green-600" />
                <h2 className="text-lg font-semibold text-text-primary">
                  Editar Datos Extraídos
                </h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Información del Documento */}
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <div className="text-sm text-text-secondary mb-1">Documento:</div>
              <div className="text-sm font-medium text-text-primary bg-gray-50 p-2 rounded">
                {selectedDocumentForEdit.nombreArchivo}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 flex-shrink-0">
              <nav className="flex px-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('encabezado')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'encabezado'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Encabezado
                </button>
                <button
                  onClick={() => setActiveTab('items')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'items'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Items {documentoLineas.length > 0 && `(${documentoLineas.length})`}
                </button>
                <button
                  onClick={() => setActiveTab('impuestos')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'impuestos'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Impuestos {documentoImpuestos.length > 0 && `(${documentoImpuestos.length})`}
                </button>
              </nav>
            </div>

            {/* Tab Content - Área de scroll fija */}
            <div className="overflow-y-auto p-6" style={{ height: '500px' }}>
              {/* TAB: ENCABEZADO */}
              {activeTab === 'encabezado' && (
                <div className="grid grid-cols-2 gap-4">
                {/* 1. Fecha */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={editFormData.fechaExtraida || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, fechaExtraida: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* 2. Tipo de Comprobante */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Tipo de Comprobante
                  </label>
                  <select
                    value={editFormData.tipoComprobanteExtraido || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, tipoComprobanteExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                  </label>
                  <input
                    type="text"
                    value={editFormData.numeroComprobanteExtraido || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, numeroComprobanteExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="00000-00000000"
                  />
                </div>

                {/* 4. CUIT */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    CUIT
                  </label>
                  <input
                    type="text"
                    value={editFormData.cuitExtraido || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, cuitExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="XX-XXXXXXXX-X"
                  />
                </div>

                {/* 5. Razón Social */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    value={editFormData.razonSocialExtraida || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, razonSocialExtraida: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Nombre del emisor"
                  />
                </div>

                {/* 6. Neto Gravado */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Neto Gravado
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.netoGravadoExtraido || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, netoGravadoExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* 7. Exento */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Exento
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.exentoExtraido || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, exentoExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* 8. Impuestos */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Impuestos
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.impuestosExtraido || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, impuestosExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* 9. Descuento/Recargo */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Descuento/Recargo
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData.descuentoGlobalExtraido || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, descuentoGlobalExtraido: e.target.value })}
                      className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                      placeholder="0.00"
                    />
                    <select
                      value={editFormData.descuentoGlobalTipo || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, descuentoGlobalTipo: e.target.value })}
                      className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                  </label>
                  <select
                    value={editFormData.monedaExtraida || 'ARS'}
                    onChange={(e) => setEditFormData({ ...editFormData, monedaExtraida: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.importeExtraido || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, importeExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* 10. CAE */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    CAE
                  </label>
                  <input
                    type="text"
                    value={editFormData.caeExtraido || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, caeExtraido: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="CAE del comprobante"
                  />
                </div>
              </div>
              )}

              {/* TAB: ITEMS */}
              {activeTab === 'items' && (
                <div>
                  {/* Header con botón de agregar */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-semibold text-gray-800">Line Items</h3>
                    <Button
                      onClick={() => handleOpenItemModal()}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar Item
                    </Button>
                  </div>

                  {/* Grilla de items */}
                  {loadingLineas ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="mt-2">Cargando items...</p>
                    </div>
                  ) : documentoLineas.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No hay items cargados</p>
                      <p className="text-sm mt-1">Haz clic en "Agregar Item" para comenzar</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cant.</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">P. Unit.</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">IVA</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {documentoLineas.map((linea) => (
                            <tr key={linea.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-sm text-gray-900">{linea.numero}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                <div className="max-w-xs truncate" title={linea.descripcion}>
                                  {linea.descripcion}
                                </div>
                                {linea.codigoProducto && (
                                  <div className="text-xs text-gray-500">Cód: {linea.codigoProducto}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                {Number(linea.cantidad).toFixed(2)} {linea.unidad || ''}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                ${Number(linea.precioUnitario).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                ${Number(linea.subtotal).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                {linea.alicuotaIva ? `${Number(linea.alicuotaIva)}%` : '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">
                                ${Number(linea.totalLinea).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-sm text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => handleOpenItemModal(linea)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Editar"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(linea.id)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Eliminar"
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
              )}

              {/* TAB: IMPUESTOS */}
              {activeTab === 'impuestos' && (
                <div>
                  {/* Header con botón de agregar */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-semibold text-gray-800">Impuestos</h3>
                    <Button
                      onClick={() => handleOpenImpuestoModal()}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar Impuesto
                    </Button>
                  </div>

                  {/* Grilla de impuestos */}
                  {loadingImpuestos ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="mt-2">Cargando impuestos...</p>
                    </div>
                  ) : documentoImpuestos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No hay impuestos cargados</p>
                      <p className="text-sm mt-1">Haz clic en "Agregar Impuesto" para comenzar</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Alícuota</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Base Imp.</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Importe</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {documentoImpuestos.map((impuesto) => (
                            <tr key={impuesto.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-sm text-gray-900 font-medium">{impuesto.tipo}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                <div className="max-w-xs truncate" title={impuesto.descripcion}>
                                  {impuesto.descripcion}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                {impuesto.alicuota ? `${Number(impuesto.alicuota)}%` : '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                {impuesto.baseImponible ? `$${Number(impuesto.baseImponible).toFixed(2)}` : '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">
                                ${Number(impuesto.importe).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-sm text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => handleOpenImpuestoModal(impuesto)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Editar"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteImpuesto(impuesto.id)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Eliminar"
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
              )}
            </div>

            {/* Footer - Visible en todos los tabs */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-gray-50 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                disabled={savingEdit}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="bg-palette-dark hover:bg-palette-dark/90 text-palette-yellow"
              >
                {savingEdit ? (
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
            </div>
          </div>
        </div>
      )}

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
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {selectedItem ? 'Editar Item' : 'Agregar Item'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setSelectedItem(null);
                  setItemFormData({});
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
                    value={itemFormData.numero || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, numero: e.target.value })}
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
                    value={itemFormData.codigoProducto || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, codigoProducto: e.target.value })}
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
                    value={itemFormData.descripcion || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, descripcion: e.target.value })}
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
                    value={itemFormData.cantidad || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, cantidad: e.target.value })}
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
                    value={itemFormData.unidad || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, unidad: e.target.value })}
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
                    value={itemFormData.precioUnitario || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, precioUnitario: e.target.value })}
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
                    value={itemFormData.subtotal || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, subtotal: e.target.value })}
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
                    value={itemFormData.alicuotaIva || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, alicuotaIva: e.target.value })}
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
                    value={itemFormData.importeIva || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, importeIva: e.target.value })}
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
                    value={itemFormData.totalLinea || ''}
                    onChange={(e) => setItemFormData({ ...itemFormData, totalLinea: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-gray-50">
              <Button
                variant="outline"
                onClick={() => {
                  setShowItemModal(false);
                  setSelectedItem(null);
                  setItemFormData({});
                }}
                disabled={savingItem}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveItem}
                disabled={savingItem}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {savingItem ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {selectedItem ? 'Actualizar' : 'Crear'} Item
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición/Creación de Impuesto */}
      {showImpuestoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center space-x-3">
                <Receipt className="w-6 h-6 text-purple-600" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {selectedImpuesto ? 'Editar Impuesto' : 'Agregar Impuesto'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowImpuestoModal(false);
                  setSelectedImpuesto(null);
                  setImpuestoFormData({});
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
                    value={impuestoFormData.tipo || ''}
                    onChange={(e) => setImpuestoFormData({ ...impuestoFormData, tipo: e.target.value })}
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
                    value={impuestoFormData.alicuota || ''}
                    onChange={(e) => setImpuestoFormData({ ...impuestoFormData, alicuota: e.target.value })}
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
                    value={impuestoFormData.descripcion || ''}
                    onChange={(e) => setImpuestoFormData({ ...impuestoFormData, descripcion: e.target.value })}
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
                    value={impuestoFormData.baseImponible || ''}
                    onChange={(e) => setImpuestoFormData({ ...impuestoFormData, baseImponible: e.target.value })}
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
                    value={impuestoFormData.importe || ''}
                    onChange={(e) => setImpuestoFormData({ ...impuestoFormData, importe: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-gray-50">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImpuestoModal(false);
                  setSelectedImpuesto(null);
                  setImpuestoFormData({});
                }}
                disabled={savingImpuesto}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveImpuesto}
                disabled={savingImpuesto}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {savingImpuesto ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {selectedImpuesto ? 'Actualizar' : 'Crear'} Impuesto
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

      </div>
    </div>
  );
}