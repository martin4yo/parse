'use client';

import { useState, useEffect } from 'react';
import { FileDown, Search, Edit, CheckSquare, Square, FileText, X, Calendar, Receipt, Save, Plus, Pencil, Trash2, ExternalLink, Eye, AlertCircle, AlertTriangle, XCircle, Info, ShieldAlert, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { DocumentoProcessado } from '@/types/documento';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { useComprobanteEdit } from '@/hooks/useComprobanteEdit';
import { DocumentViewerProvider } from '@/components/shared/DocumentViewerProvider';
import { useDocumentViewer, formatComprobantesEfectivoData } from '@/hooks/useDocumentViewer';
import { ComprobanteEditModal } from '@/components/comprobantes/ComprobanteEditModal';



export default function ExportarPage() {
  const { confirm } = useConfirmDialog();
  const [documentos, setDocumentos] = useState<DocumentoProcessado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pendientes');
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Hook para el DocumentViewer
  const documentViewer = useDocumentViewer({
    findDocument: (documentId: string) => documentos.find(doc => doc.id === documentId),
    formatItemData: formatComprobantesEfectivoData
  });

  // Hook para edición de comprobantes
  const comprobanteEdit = useComprobanteEdit({
    onSaveSuccess: (updatedDoc) => {
      setDocumentos(prev => prev.map(doc =>
        doc.id === updatedDoc.id ? updatedDoc as DocumentoProcessado : doc
      ));
    }
  });

  // Estado para controlar el modal de edición
  const [showEditModal, setShowEditModal] = useState(false);

  // Estados para modal de edición (reutilizando del componente parse)

  // Estados para modales de items e impuestos

  // Estados para modal de validación
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [documentsWithErrors, setDocumentsWithErrors] = useState<Map<string, any>>(new Map());
    const [forceExportWarnings, setForceExportWarnings] = useState(false); // Nuevo: para exportar con warnings

  useEffect(() => {
    loadDocumentos();
  }, []);

  // Función para abrir el archivo
  const handleViewDocument = (documentId: string) => {
    documentViewer.openViewer(documentId);
  };

  const loadDocumentos = async () => {
    try {
      setLoading(true);
      // Sin filtro de tipo: muestra TODOS los documentos (tarjeta, efectivo, etc)
      // includeMetrics=true agrega validationErrors a cada documento
      const response = await api.get('/documentos?includeMetrics=true');
      setDocumentos(response.data.documentos || []);
    } catch (error) {
      console.error('Error loading documentos:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  };

  
  // Función para filtrar documentos según criterios
  const getFilteredDocuments = () => {
    return documentos.filter((doc: DocumentoProcessado) => {
      // Filtrar por término de búsqueda
      const matchesSearch = !searchTerm ||
        doc.nombreArchivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.razonSocialExtraida?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.numeroComprobanteExtraido?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtrar por estado
      const matchesStatus =
        filterStatus === 'todos' ||
        (filterStatus === 'pendientes' && !doc.exportado) ||
        (filterStatus === 'exportados' && doc.exportado);

      return matchesSearch && matchesStatus;
    });
  };

const handleSelectDocument = (documentId: string) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId);
    } else {
      newSelected.add(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSelectAll = () => {
    const filtered = getFilteredDocuments();
    // Filtrar solo los documentos no exportados (que se pueden seleccionar)
    const selectable = filtered.filter((doc: DocumentoProcessado) => !doc.exportado);

    if (selectedDocuments.size === selectable.length && selectable.length > 0) {
      // Deseleccionar todos
      setSelectedDocuments(new Set());
    } else {
      // Seleccionar todos los filtrados que no están exportados
      setSelectedDocuments(new Set(selectable.map((doc: DocumentoProcessado) => doc.id)));
    }
  };

  const handleExport = async () => {
    if (selectedDocuments.size === 0) {
      toast.error('Debe seleccionar al menos un documento para exportar');
      return;
    }

    const confirmed = await confirm(
      `¿Está seguro que desea exportar ${selectedDocuments.size} comprobante(s)? Esta acción los marcará como exportados.`,
      '¿Exportar documentos?',
      'warning'
    );

    if (!confirmed) return;

    try {
      setExporting(true);
      const response = await api.post('/documentos/exportar', {
        documentoIds: Array.from(selectedDocuments)
      });

      // Verificar si hay validaciones
      if (response.data.validaciones && response.data.validaciones.documentosConErrores > 0) {
        const detalles = response.data.validaciones.detalles;
        setValidationErrors(detalles);
        setShowValidationModal(true);

        // Guardar documentos con errores en el Map
        const errorsMap = new Map();
        detalles.forEach((docError: any) => {
          errorsMap.set(docError.documentoId, docError);
        });
        setDocumentsWithErrors(errorsMap);

        // Toast con resumen
        const { totalWarnings, totalErrors } = response.data.validaciones;
        toast(`Exportado con ${totalWarnings} warning(s) y ${totalErrors} error(es) de validación`, {
          icon: '⚠️',
          duration: 5000,
        });
      } else {
        toast.success(response.data.message || `${selectedDocuments.size} documento(s) exportado(s) correctamente`);
      }

      setSelectedDocuments(new Set());
      await loadDocumentos();
    } catch (error: any) {
      console.error('Error exporting documents:', error);

      // Si es un error de validaciones bloqueantes
      if (error.response?.data?.validationErrors) {
        const validationErrors = error.response.data.validationErrors;
        setValidationErrors(validationErrors);
        setShowValidationModal(true);

        // Guardar documentos con errores en el Map
        const errorsMap = new Map();
        validationErrors.forEach((docError: any) => {
          errorsMap.set(docError.documentoId, docError);
        });
        setDocumentsWithErrors(errorsMap);

        toast.error('Existen validaciones bloqueantes que impiden la exportación');
      } else {
        toast.error(error.response?.data?.error || 'Error al exportar documentos');
      }
    } finally {
      setExporting(false);
    }
  };

  const handleOpenEditModal = async (doc: DocumentoProcessado, readOnly: boolean = false) => {
    await comprobanteEdit.openEditModal(doc);
    setShowEditModal(true);
    // TODO: Implementar readOnly mode si es necesario
  };

  

  

  const handleSaveEdit = async () => {
    const success = await comprobanteEdit.saveEdit();
    if (success) {
      setShowEditModal(false);
      comprobanteEdit.closeEditModal();
      await loadDocumentos();
    }
  };

  // Abrir modal de edición desde error de validación
  const handleEditFromValidation = async (docError: any, fieldToHighlight: string | null = null) => {
    const doc = documentos.find(d => d.id === docError.documentoId);
    if (!doc) {
      toast.error('Documento no encontrado');
      return;
    }

    // Cerrar modal de validaciones
    setShowValidationModal(false);

    // Abrir modal de edición
    await handleOpenEditModal(doc, false);

    // TODO: Implementar highlight de campos si es necesario

    toast.success('Documento abierto para edición', { icon: '📝' });
  };

  const getFilteredDocumentsForDisplay = () => {
    return getFilteredDocuments();
  };

  const filteredDocuments = getFilteredDocumentsForDisplay();

  // Paginación
  const totalPages = Math.ceil(filteredDocuments.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Reset página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <>
      <DocumentViewerProvider documentViewer={documentViewer} />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
              <FileDown className="w-6 h-6 text-palette-dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Exportar Documentos
              </h1>
              <p className="text-text-secondary mt-1">
                Gestiona y exporta tus documentos procesados
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleSelectAll}
              variant="outline"
              disabled={filteredDocuments.length === 0}
            >
              {selectedDocuments.size === filteredDocuments.filter((doc: DocumentoProcessado) => !doc.exportado).length && filteredDocuments.filter((doc: DocumentoProcessado) => !doc.exportado).length > 0 ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Deseleccionar Todos
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Seleccionar Todos
                </>
              )}
            </Button>
            <Button
              onClick={handleExport}
              disabled={selectedDocuments.size === 0 || exporting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exportando...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportar Datos ({selectedDocuments.size})
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filtros y Grilla */}
        <Card>
          {/* Filtros */}
          <CardContent className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              {/* Search box */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, número, CUIT o razón social..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Combo estado */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="todos">Mostrar Todos</option>
                <option value="pendientes">Pendientes</option>
                <option value="exportados">Exportados</option>
              </select>
            </div>
          </CardContent>

          {/* Grilla */}
          <div className="p-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando documentos...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No se encontraron documentos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sel.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo / Número
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Razón Social / CUIT
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
                        CAE
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedDocuments.map((doc) => {
                      const gravado = doc.netoGravadoExtraido || 0;
                      const exento = doc.exentoExtraido || 0;
                      const total = doc.importeExtraido || 0;
                      const impuestos = doc.impuestosExtraido || (total - gravado - exento);
                      const hasValidationErrors = documentsWithErrors.has(doc.id);
                      const docErrors = hasValidationErrors ? documentsWithErrors.get(doc.id) : null;

                      return (
                        <tr key={doc.id} className={`hover:bg-gray-50 ${doc.exportado ? 'bg-green-50' : ''} ${hasValidationErrors ? 'bg-red-50 border-l-4 border-l-red-500' : ''}`}>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            {!doc.exportado ? (
                              <button
                                onClick={() => handleSelectDocument(doc.id)}
                                className="text-gray-600 hover:text-green-600"
                              >
                                {selectedDocuments.has(doc.id) ? (
                                  <CheckSquare className="w-5 h-5 text-green-600" />
                                ) : (
                                  <Square className="w-5 h-5" />
                                )}
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.fechaExtraida ? formatDate(doc.fechaExtraida) : '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            <div className="font-medium flex items-center gap-2">
                              {doc.tipoComprobanteExtraido || '-'}
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
                            <div className="text-xs text-gray-500">
                              {doc.numeroComprobanteExtraido || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            <div className="font-medium">
                              {doc.razonSocialExtraida || '-'}
                            </div>
                            <div className="text-xs text-gray-500">
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
                            {total ? formatCurrency(total) : '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.caeExtraido || '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex flex-col items-center space-y-1">
                              {doc.exportado ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Exportado
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Pendiente
                                </span>
                              )}
                              {hasValidationErrors && docErrors && (
                                <div className="flex items-center space-x-1">
                                  {docErrors.summary.bloqueantes > 0 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white" title="Errores bloqueantes">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      {docErrors.summary.bloqueantes}
                                    </span>
                                  )}
                                  {docErrors.summary.errores > 0 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-600 text-white" title="Errores">
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      {docErrors.summary.errores}
                                    </span>
                                  )}
                                  {docErrors.summary.warnings > 0 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-600 text-white" title="Advertencias">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      {docErrors.summary.warnings}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleViewDocument(doc.id)}
                                className="text-gray-500 hover:text-gray-700 p-1"
                                title="Ver archivo"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              {doc.exportado ? (
                                <button
                                  onClick={() => handleOpenEditModal(doc, true)}
                                  className="text-green-600 hover:text-green-800 p-1"
                                  title="Ver datos (solo lectura)"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenEditModal(doc, false)}
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación */}
            {!loading && filteredDocuments.length > 0 && (
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
                    <div>
                      <p className="text-sm text-gray-700">
                        Mostrando <span className="font-medium">{startIndex + 1}</span> a <span className="font-medium">{Math.min(endIndex, filteredDocuments.length)}</span> de{' '}
                        <span className="font-medium">{filteredDocuments.length}</span> resultados
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <span className="text-sm text-gray-700">
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Modal de Edición - Usando ComprobanteEditModal */}
        <ComprobanteEditModal
          isOpen={showEditModal}
          documento={comprobanteEdit.selectedDocument}
          onClose={() => {
            setShowEditModal(false);
            comprobanteEdit.closeEditModal();
          }}
          onSave={async (updatedDoc) => {
            setDocumentos(prev => prev.map(doc =>
              doc.id === updatedDoc.id ? updatedDoc as DocumentoProcessado : doc
            ));
            setShowEditModal(false);
            comprobanteEdit.closeEditModal();
            await loadDocumentos();
          }}
          readOnly={false}
        />
      </div>
    </>
  );
}
