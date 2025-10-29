'use client';

import { useState, useEffect } from 'react';
import { Upload, Link2, FileText, CheckCircle, Clock, AlertCircle, Zap, ExternalLink, LinkIcon, Trash2, FileIcon, Image as ImageIcon, XCircle, Info, Receipt, Edit2, Edit, Unlink, Save, X, Calendar, MessageSquare } from 'lucide-react';
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
  asociados: number;
  pendientes: number;
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
    asociados: 0,
    pendientes: 0,
    conError: 0
  });
  const [documentos, setDocumentos] = useState<DocumentoProcessado[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
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
  
  // Estados para el modal de asociación manual
  const [showManualAssociationModal, setShowManualAssociationModal] = useState(false);
  const [selectedDocumentForAssociation, setSelectedDocumentForAssociation] = useState<DocumentoProcessado | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [manualAssociationData, setManualAssociationData] = useState<any>({
    usuario: null,
    delegadores: [],
    items: []
  });
  const [manualAssociationFilters, setManualAssociationFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
    search: ''
  });
  const [loadingManualAssociationData, setLoadingManualAssociationData] = useState(false);
  const [savingManualAssociation, setSavingManualAssociation] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);

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
  const handleOpenEditModal = (doc: DocumentoProcessado) => {
    setSelectedDocumentForEdit(doc);
    setEditFormData({
      fechaExtraida: doc.fechaExtraida ? new Date(doc.fechaExtraida).toISOString().split('T')[0] : '',
      importeExtraido: doc.importeExtraido ? Number(doc.importeExtraido).toFixed(2) : '',
      cuitExtraido: doc.cuitExtraido || '',
      numeroComprobanteExtraido: doc.numeroComprobanteExtraido || '',
      razonSocialExtraida: doc.razonSocialExtraida || '',
      caeExtraido: doc.caeExtraido || '',
      tipoComprobanteExtraido: doc.tipoComprobanteExtraido || '',
      netoGravadoExtraido: doc.netoGravadoExtraido ? Number(doc.netoGravadoExtraido).toFixed(2) : '',
      exentoExtraido: doc.exentoExtraido ? Number(doc.exentoExtraido).toFixed(2) : '',
      impuestosExtraido: doc.impuestosExtraido ? Number(doc.impuestosExtraido).toFixed(2) : ''
    });
    setShowEditModal(true);
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
      const dataToSend = {
        ...editFormData,
        fechaExtraida: editFormData.fechaExtraida || null,
        importeExtraido: importeTotal || null,
        netoGravadoExtraido: netoGravado || null,
        exentoExtraido: exento || null,
        impuestosExtraido: impuestos || null
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

  // Función para abrir modal de asociación manual
  const handleOpenManualAssociationModal = async (doc: DocumentoProcessado) => {
    setSelectedDocumentForAssociation(doc);
    setShowManualAssociationModal(true);
    setSelectedUserId(''); // Resetear a usuario logueado
    
    // Limpiar todos los filtros incluyendo search
    setManualAssociationFilters({
      fechaDesde: '',
      fechaHasta: '',
      search: ''
    });
    
    // Limpiar también el timer de search si existe
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      setSearchDebounceTimer(null);
    }
    
    // Cargar items pendientes una sola vez
    await loadManualAssociationItems();
  };

  // useEffect para seleccionar automáticamente el primer usuario cuando se carga la data
  useEffect(() => {
    if (manualAssociationData.usuario && !selectedUserId) {
      setSelectedUserId(manualAssociationData.usuario.id);
      loadManualAssociationItems(manualAssociationData.usuario.id);
    }
  }, [manualAssociationData.usuario]);

  // Limpiar timer cuando se cierre el modal
  useEffect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [searchDebounceTimer]);

  // Función para cargar items de asociación manual
  const loadManualAssociationItems = async (userId?: string) => {
    try {
      setLoadingManualAssociationData(true);
      
      const params = new URLSearchParams();
      if (userId) params.append('targetUserId', userId);
      if (manualAssociationFilters.fechaDesde) params.append('fechaDesde', manualAssociationFilters.fechaDesde);
      if (manualAssociationFilters.fechaHasta) params.append('fechaHasta', manualAssociationFilters.fechaHasta);
      if (manualAssociationFilters.search) params.append('search', manualAssociationFilters.search);
      
      const response = await api.get(`/rendiciones/items-pendientes-asociacion?${params.toString()}`);
      
      setManualAssociationData(response.data);
      
      // Si no hay usuario seleccionado, seleccionar el usuario logueado por defecto
      if (!selectedUserId && response.data.usuario) {
        setSelectedUserId(response.data.usuario.id);
      }
    } catch (error) {
      console.error('Error loading manual association items:', error);
      toast.error('Error al cargar items de rendición');
    } finally {
      setLoadingManualAssociationData(false);
    }
  };

  // Función para asociar manualmente
  const handleManualAssociation = async (itemId: string, resumenTarjetaId: string) => {
    if (!selectedDocumentForAssociation) return;
    
    try {
      setSavingManualAssociation(true);
      
      await api.post(`/documentos/${selectedDocumentForAssociation.id}/asociar-manual`, {
        rendicionItemId: itemId,
        resumenTarjetaId: resumenTarjetaId
      });
      
      toast.success('Documento asociado correctamente');
      setShowManualAssociationModal(false);
      
      // Recargar documentos para obtener datos actualizados
      await loadDocumentos();
    } catch (error) {
      console.error('Error in manual association:', error);
      toast.error('Error al asociar documento');
    } finally {
      setSavingManualAssociation(false);
    }
  };

  // Cargar datos reales de la API
  const loadDocumentos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/documentos?includeMetrics=true&tipo=tarjeta');
      
      if (response.data) {
        // Normalizar los datos para usar camelCase
        const normalizedDocumentos = (response.data.documentos || []).map((doc: any) => ({
          ...doc,
          documentosAsociados: doc.documentosAsociados || doc.documentos_asociados || []
        }));
        setDocumentos(normalizedDocumentos);
        setMetrics(response.data.metrics || { subidos: 0, asociados: 0, pendientes: 0, conError: 0 });
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
      
      // Obtener documentos pendientes de asociar
      const pendingDocuments = documentos.filter(doc => 
        doc.estadoProcesamiento === 'completado' && 
        doc.documentosAsociados.length === 0
      );

      if (pendingDocuments.length === 0) {
        toast('No hay documentos pendientes de asociar', { 
          icon: '📋',
          duration: 3000
        });
        return;
      }

      toast.loading('Iniciando asociación automática...', { duration: 2000 });

      // Inicializar progreso
      setAssociationProgress({
        current: 0,
        total: pendingDocuments.length,
        currentDocumentName: '',
        currentCupon: ''
      });

      let totalAsociados = 0;
      let totalErrores = 0;
      let totalSinCoincidencia = 0;

      // Procesar documentos uno a uno
      for (let i = 0; i < pendingDocuments.length; i++) {
        const documento = pendingDocuments[i];
        
        // Actualizar progreso
        setAssociationProgress({
          current: i + 1,
          total: pendingDocuments.length,
          currentDocumentName: '',
          currentCupon: ''
        });

        try {
          // Simular un pequeño delay para que se vea el procesamiento
          await new Promise(resolve => setTimeout(resolve, 800));

          const response = await api.post('/documentos/asociar-automatico-individual', {
            documentoId: documento.id
          });

          if (response.data.success) {
            if (response.data.resultado.estado === 'asociado') {
              totalAsociados++;
              
              // Mostrar el cupón asociado durante un momento
              if (response.data.resultado.numeroCupon) {
                setAssociationProgress(prev => ({
                  ...prev,
                  currentCupon: response.data.resultado.numeroCupon
                }));
                
                // Esperar un poco para mostrar el cupón
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              
              // Actualizar el documento local inmediatamente
              setDocumentos(prev => prev.map(doc => 
                doc.id === documento.id 
                  ? { ...doc, documentosAsociados: [{ id: 'temp' }] } 
                  : doc
              ));
            } else if (response.data.resultado.estado === 'sin_coincidencia') {
              totalSinCoincidencia++;
            } else if (response.data.resultado.estado === 'error') {
              totalErrores++;
            }
          }
        } catch (error) {
          console.error(`Error procesando documento ${documento.id}:`, error);
          totalErrores++;
        }
      }

      // Limpiar progreso
      setAssociationProgress({
        current: 0,
        total: 0,
        currentDocumentName: '',
        currentCupon: ''
      });

      // Mostrar resumen final
      if (totalAsociados > 0) {
        toast.success(
          `Asociación completada: ${totalAsociados} documentos asociados de ${pendingDocuments.length} procesados`
        );
      } else {
        toast(
          `Proceso completado. No se encontraron coincidencias automáticas para ${pendingDocuments.length} documentos`,
          { 
            icon: <Info className="w-8 h-8 text-blue-500" />,
            duration: 4000
          }
        );
      }

      if (totalErrores > 0) {
        toast.error(`${totalErrores} documentos tuvieron errores durante el procesamiento`);
      }

      // Refrescar la grilla para mostrar los cupones asociados
      await loadDocumentos();

    } catch (error) {
      console.error('Error en asociación automática:', error);
      toast.error('Error al ejecutar la asociación automática');
      setProcessingDocuments(new Set());
      setAssociationProgress({
        current: 0,
        total: 0,
        currentDocumentName: '',
        currentCupon: ''
      });
    } finally {
      setProcessingAssociation(false);
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
        case 'asociados':
          statusMatch = doc.documentosAsociados && doc.documentosAsociados.length > 0;
          break;
        case 'pendientes':
          statusMatch = doc.estadoProcesamiento === 'completado' && (!doc.documentosAsociados || doc.documentosAsociados.length === 0);
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
            <Receipt className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Extracción de Datos
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
                  Documentos Asociados
                </p>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {metrics.asociados}
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
                  Pendientes de Asociar
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
              <option value="todos">Todos</option>
              <option value="asociados">Asociados</option>
              <option value="pendientes">Pendientes</option>
              <option value="error">Con Error</option>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CUIT Emisor
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
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cupón
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
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">
                        {doc.razonSocialExtraida || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.cuitExtraido || '-'}
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
                      {total ? formatCurrency(total) : '-'}
                    </td>
                    <td 
                      className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 relative"
                    >
                      {doc.documentosAsociados && doc.documentosAsociados.length > 0 && doc.documentosAsociados[0].resumen_tarjeta ? (
                        <div
                          className="cursor-help text-blue-600 font-medium border-b border-dotted border-blue-400 inline-block"
                          onMouseEnter={(e) => {
                            setHoveredCupon(doc.id);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setCuponTooltipPosition({ 
                              x: rect.left + rect.width / 2, 
                              y: rect.top 
                            });
                          }}
                          onMouseLeave={() => setHoveredCupon(null)}
                        >
                          {doc.documentosAsociados[0].resumen_tarjeta.numeroCupon || '-'}
                        </div>
                      ) : (
                        <span className="text-gray-400">{doc.cuponExtraido || '-'}</span>
                      )}
                      
                      {/* Tooltip del cupón con datos del resumen */}
                      {hoveredCupon === doc.id && doc.documentosAsociados && doc.documentosAsociados.length > 0 && doc.documentosAsociados[0].resumen_tarjeta && (
                        <div 
                          className="fixed z-50 pointer-events-none"
                          style={{
                            left: `${cuponTooltipPosition.x}px`,
                            top: `${cuponTooltipPosition.y - 10}px`,
                            transform: 'translate(-50%, -100%)'
                          }}
                        >
                          <div className="bg-blue-900 text-palette-dark p-4 rounded-lg shadow-xl max-w-sm">
                            <div className="text-xs font-semibold mb-2 text-blue-300">Datos del Resumen</div>
                            
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-blue-400">Cupón:</span>
                                <span className="font-medium ml-2 text-white">{doc.documentosAsociados[0].resumen_tarjeta.numeroCupon}</span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-blue-400">Fecha:</span>
                                <span className="font-medium ml-2 text-white">
                                  {doc.documentosAsociados[0].resumen_tarjeta.fechaTransaccion}
                                </span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-blue-400">Importe:</span>
                                <span className="font-medium ml-2 text-white">
                                  {formatCurrency(doc.documentosAsociados[0].resumen_tarjeta.importeTransaccion)}
                                </span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-blue-400">Tarjeta:</span>
                                <span className="font-medium ml-2 text-white">
                                  {doc.documentosAsociados[0].resumen_tarjeta.numeroTarjeta}
                                </span>
                              </div>
                              
                              {doc.documentosAsociados[0].resumen_tarjeta.titular && (
                                <div className="flex justify-between">
                                  <span className="text-blue-400">Titular:</span>
                                  <span className="font-medium ml-2 text-white">
                                    {doc.documentosAsociados[0].resumen_tarjeta.titular.nombre} {doc.documentosAsociados[0].resumen_tarjeta.titular.apellido}
                                  </span>
                                </div>
                              )}

                              {doc.documentosAsociados[0].resumen_tarjeta.monedaOrigenDescripcion && (
                                <div className="flex justify-between">
                                  <span className="text-blue-400">Moneda:</span>
                                  <span className="font-medium ml-2 text-white">
                                    {doc.documentosAsociados[0].resumen_tarjeta.monedaOrigenDescripcion}
                                  </span>
                                </div>
                              )}

                              {doc.documentosAsociados[0].resumen_tarjeta.descripcionCupon && (
                                <div className="pt-2 border-t border-blue-700">
                                  <span className="text-blue-300">Descripción:</span>
                                  <div className="mt-1 text-blue-200">{doc.documentosAsociados[0].resumen_tarjeta.descripcionCupon}</div>
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.caeExtraido || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-2">
                        {/* Botón de asociar/desasociar - ocupan la misma posición */}
                        <div className="w-6 flex justify-center">
                          {doc.documentosAsociados.length > 0 ? (
                            <button 
                              className="text-orange-500 hover:text-orange-700 p-1"
                              title="Desasociar comprobante"
                              onClick={() => handleDisassociateDocument(doc)}
                            >
                              <Unlink className="w-4 h-4" />
                            </button>
                          ) : doc.estadoProcesamiento === 'completado' ? (
                            <button
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title="Asociar comprobante"
                              onClick={() => handleOpenManualAssociationModal(doc)}
                            >
                              <LinkIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="w-6 h-6"></div> // Espacio reservado invisible
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-white">
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

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-text-secondary mb-2">Documento:</div>
                <div className="text-sm font-medium text-text-primary bg-gray-50 p-2 rounded">
                  {selectedDocumentForEdit.nombreArchivo}
                </div>
              </div>

              {/* Formulario de edición */}
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

                {/* 9. Importe Total */}
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-gray-50">
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

      {/* Modal de Subir Comprobante */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onDocumentProcessed={handleDocumentProcessed}
        allowMultiple={true}
        title="Subir Comprobantes de Tarjeta"
        context="comprobantes"
        tipo="tarjeta"
      />

      {/* Modal de Asociación Manual */}
      {showManualAssociationModal && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-gray-500 opacity-75" aria-hidden="true"></div>
          
          <div className="fixed top-[5vh] left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl w-[95vw] max-w-7xl h-[90vh] overflow-hidden">
              {/* Header fijo */}
              <div className="absolute top-0 left-0 right-0 bg-white px-6 py-4 border-b border-gray-200 h-20 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  <LinkIcon className="inline w-5 h-5 mr-2 text-blue-500" />
                  Asociar Comprobante con Item de Rendición
                </h3>
                <button
                  onClick={() => setShowManualAssociationModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {/* Controles de filtro */}
              <div className="absolute top-20 left-0 right-0 px-6 py-4 h-66 overflow-y-auto bg-white">
                {/* Layout en dos columnas */}
                <div className="grid grid-cols-2 gap-6 mb-4">
                  {/* Columna izquierda - Controles */}
                  <div className="space-y-4">
                    {/* Selector de Usuario */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Usuario
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => {
                          setSelectedUserId(e.target.value);
                          loadManualAssociationItems(e.target.value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {manualAssociationData.usuario && (
                          <option value={manualAssociationData.usuario.id}>
                            {manualAssociationData.usuario.apellido}, {manualAssociationData.usuario.nombre} (Yo)
                          </option>
                        )}
                        {manualAssociationData.delegadores?.map((delegador: any) => (
                          <option key={delegador.id} value={delegador.id}>
                            {delegador.apellido}, {delegador.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Filtros de fechas */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Fecha Desde
                        </label>
                        <input
                          type="date"
                          value={manualAssociationFilters.fechaDesde}
                          onChange={(e) => {
                            setManualAssociationFilters(prev => ({ ...prev, fechaDesde: e.target.value }));
                            setTimeout(() => loadManualAssociationItems(selectedUserId), 100);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Fecha Hasta
                        </label>
                        <input
                          type="date"
                          value={manualAssociationFilters.fechaHasta}
                          onChange={(e) => {
                            setManualAssociationFilters(prev => ({ ...prev, fechaHasta: e.target.value }));
                            setTimeout(() => loadManualAssociationItems(selectedUserId), 100);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Columna derecha - Información del documento */}
                  <div>
                    <div className="p-3 bg-blue-50 rounded-lg h-full">
                      <div className="space-y-2 text-sm text-gray-700">
                        <div><strong>Archivo:</strong> {selectedDocumentForAssociation?.nombreArchivo}</div>
                        {selectedDocumentForAssociation?.razonSocialExtraida && (
                          <div><strong>Razón Social:</strong> {selectedDocumentForAssociation.razonSocialExtraida}</div>
                        )}
                        {selectedDocumentForAssociation?.numeroComprobanteExtraido && (
                          <div><strong>Nro. Comprobante:</strong> {selectedDocumentForAssociation.numeroComprobanteExtraido}</div>
                        )}
                        {selectedDocumentForAssociation?.fechaExtraida && (
                          <div><strong>Fecha:</strong> {new Date(selectedDocumentForAssociation.fechaExtraida).toLocaleDateString('es-AR')}</div>
                        )}
                        {selectedDocumentForAssociation?.importeExtraido && (
                          <div><strong>Importe:</strong> ${Number(selectedDocumentForAssociation.importeExtraido).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Búsqueda */}
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Buscar por cupón, descripción, proveedor, producto..."
                      value={manualAssociationFilters.search}
                      onChange={(e) => {
                        const searchValue = e.target.value;
                        setManualAssociationFilters(prev => ({ ...prev, search: searchValue }));
                        
                        // Limpiar timer anterior
                        if (searchDebounceTimer) {
                          clearTimeout(searchDebounceTimer);
                        }
                        
                        // Crear nuevo timer para debounce (800ms después de dejar de escribir)
                        const newTimer = setTimeout(() => {
                          loadManualAssociationItems(selectedUserId);
                        }, 800);
                        
                        setSearchDebounceTimer(newTimer);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button
                      onClick={() => loadManualAssociationItems(selectedUserId)}
                      disabled={loadingManualAssociationData}
                    >
                      Buscar
                    </Button>
                  </div>
                </div>

                </div>
                
                {/* Grilla de items */}
                <div className="absolute top-[310px] left-0 right-0 bottom-16 px-6 py-4">
                  <div className="h-full border rounded-lg overflow-y-auto">
                  {loadingManualAssociationData ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="mt-2 text-gray-500">Cargando items...</p>
                    </div>
                  ) : manualAssociationData.items?.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cupón
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Descripción
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Importe
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Moneda
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tipo Producto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Código Producto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Proveedor
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acción
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {manualAssociationData.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {parseDDMMYY(item.fecha)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.cupon || '-'}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              <div className="max-w-xs truncate" title={item.descripcion}>
                                {item.descripcion || '-'}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              ${formatNumber(item.importe)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {item.moneda || '-'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.tipoProducto || '-'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.codigoProducto || '-'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.proveedor || '-'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => handleManualAssociation(item.id, item.resumenTarjetaId)}
                                disabled={savingManualAssociation}
                                className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                title="Asociar con este item"
                              >
                                <LinkIcon className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      No se encontraron items de rendición pendientes
                    </div>
                  )}
                  </div>
                </div>
              
              {/* Footer fijo */}
              <div className="absolute bottom-0 left-0 right-0 bg-gray-50 px-6 py-3 border-t border-gray-200 h-16 flex items-center justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowManualAssociationModal(false)}
                  disabled={savingManualAssociation}
                >
                  Cancelar
                </Button>
              </div>
          </div>
        </div>
      )}

      {/* Modal de visualización de documentos */}
      <DocumentViewerProvider documentViewer={documentViewer} />

      </div>
    </div>
  );
}