'use client';

import { useState, useEffect } from 'react';
import { FileDown, Search, Edit, CheckSquare, Square, FileText, X, Calendar, Receipt, Save, Plus, Pencil, Trash2, ExternalLink, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { DocumentViewerProvider } from '@/components/shared/DocumentViewerProvider';
import { useDocumentViewer, formatComprobantesEfectivoData } from '@/hooks/useDocumentViewer';

interface DocumentoProcessado {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  fechaProcesamiento: string;
  fechaExtraida?: string;
  importeExtraido?: number;
  cuitExtraido?: string;
  numeroComprobanteExtraido?: string;
  razonSocialExtraida?: string;
  netoGravadoExtraido?: number;
  exentoExtraido?: number;
  impuestosExtraido?: number;
  caeExtraido?: string;
  tipoComprobanteExtraido?: string;
  exportado: boolean;
  fechaExportacion?: string;
  datosExtraidos?: any;
}

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

  // Estados para modal de edición (reutilizando del componente parse)
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDocumentForEdit, setSelectedDocumentForEdit] = useState<DocumentoProcessado | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<'encabezado' | 'items' | 'impuestos'>('encabezado');
  const [documentoLineas, setDocumentoLineas] = useState<any[]>([]);
  const [documentoImpuestos, setDocumentoImpuestos] = useState<any[]>([]);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [loadingImpuestos, setLoadingImpuestos] = useState(false);

  // Estados para modales de items e impuestos
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemFormData, setItemFormData] = useState<any>({});
  const [savingItem, setSavingItem] = useState(false);
  const [showImpuestoModal, setShowImpuestoModal] = useState(false);
  const [selectedImpuesto, setSelectedImpuesto] = useState<any>(null);
  const [impuestoFormData, setImpuestoFormData] = useState<any>({});
  const [savingImpuesto, setSavingImpuesto] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

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
      const response = await api.get('/documentos');
      setDocumentos(response.data.documentos || []);
    } catch (error) {
      console.error('Error loading documentos:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setLoading(false);
    }
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
    const selectable = filtered.filter(doc => !doc.exportado);

    if (selectedDocuments.size === selectable.length && selectable.length > 0) {
      // Deseleccionar todos
      setSelectedDocuments(new Set());
    } else {
      // Seleccionar todos los filtrados que no están exportados
      setSelectedDocuments(new Set(selectable.map(doc => doc.id)));
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
      await api.post('/documentos/exportar', {
        documentoIds: Array.from(selectedDocuments)
      });

      toast.success(`${selectedDocuments.size} documento(s) exportado(s) correctamente`);
      setSelectedDocuments(new Set());
      await loadDocumentos();
    } catch (error: any) {
      console.error('Error exporting documents:', error);
      toast.error(error.response?.data?.error || 'Error al exportar documentos');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenEditModal = async (doc: DocumentoProcessado, readOnly: boolean = false) => {
    setSelectedDocumentForEdit(doc);
    setIsReadOnly(readOnly);

    // Convertir fecha al formato YYYY-MM-DD que espera el input type="date"
    let fechaFormateada = '';
    if (doc.fechaExtraida) {
      try {
        // Si viene en formato ISO (2024-01-15T00:00:00.000Z), extraer solo la fecha
        fechaFormateada = doc.fechaExtraida.split('T')[0];
      } catch (e) {
        fechaFormateada = doc.fechaExtraida;
      }
    }

    setEditFormData({
      fechaExtraida: fechaFormateada,
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
    setActiveTab('encabezado');
    setShowEditModal(true);

    // Cargar líneas e impuestos
    await loadDocumentoLineas(doc.id);
    await loadDocumentoImpuestos(doc.id);
  };

  const loadDocumentoLineas = async (documentoId: string) => {
    try {
      setLoadingLineas(true);
      const response = await api.get(`/documentos/${documentoId}/lineas`);
      setDocumentoLineas(response.data.lineas || []);
    } catch (error) {
      console.error('Error loading lineas:', error);
      setDocumentoLineas([]);
    } finally {
      setLoadingLineas(false);
    }
  };

  const loadDocumentoImpuestos = async (documentoId: string) => {
    try {
      setLoadingImpuestos(true);
      const response = await api.get(`/documentos/${documentoId}/impuestos`);
      setDocumentoImpuestos(response.data.impuestos || []);
    } catch (error) {
      console.error('Error loading impuestos:', error);
      setDocumentoImpuestos([]);
    } finally {
      setLoadingImpuestos(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedDocumentForEdit) return;

    try {
      setSavingEdit(true);

      const netoGravado = parseFloat(editFormData.netoGravadoExtraido) || 0;
      const exento = parseFloat(editFormData.exentoExtraido) || 0;
      const impuestos = parseFloat(editFormData.impuestosExtraido) || 0;
      const importeTotal = parseFloat(editFormData.importeExtraido) || 0;

      if (importeTotal > 0) {
        const sumaComponentes = netoGravado + exento + impuestos;
        const diferencia = Math.abs(sumaComponentes - importeTotal);

        if (diferencia > 0.01) {
          toast.error(`La suma de Neto Gravado + Exento + Impuestos (${sumaComponentes.toFixed(2)}) debe ser igual al Importe Total (${importeTotal.toFixed(2)})`);
          return;
        }
      }

      const dataToSend = {
        ...editFormData,
        fechaExtraida: editFormData.fechaExtraida || null,
        importeExtraido: importeTotal || null,
        netoGravadoExtraido: netoGravado || null,
        exentoExtraido: exento || null,
        impuestosExtraido: impuestos || null
      };

      await api.put(`/documentos/${selectedDocumentForEdit.id}/datos-extraidos`, dataToSend);

      toast.success('Datos actualizados correctamente');
      setShowEditModal(false);
      setSelectedDocumentForEdit(null);
      setEditFormData({});
      await loadDocumentos();
    } catch (error) {
      console.error('Error saving edit:', error);
      toast.error('Error al actualizar los datos');
    } finally {
      setSavingEdit(false);
    }
  };

  const getFilteredDocuments = () => {
    return documentos.filter(doc => {
      // Filtro de búsqueda
      const matchesSearch = !searchTerm ||
        doc.nombreArchivo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.numeroComprobanteExtraido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.cuitExtraido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.razonSocialExtraida?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro de estado
      const matchesStatus =
        filterStatus === 'todos' ||
        (filterStatus === 'pendientes' && !doc.exportado) ||
        (filterStatus === 'exportados' && doc.exportado);

      return matchesSearch && matchesStatus;
    });
  };

  const filteredDocuments = getFilteredDocuments();

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
    // Usar UTC para evitar problemas de timezone
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
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
            {selectedDocuments.size === filteredDocuments.length && filteredDocuments.length > 0 ? (
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

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
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
      </Card>

      {/* Grilla */}
      <Card>
        <CardContent className="p-0">
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

                    return (
                      <tr key={doc.id} className={`hover:bg-gray-50 ${doc.exportado ? 'bg-green-50' : ''}`}>
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
                          <div className="font-medium">
                            {doc.tipoComprobanteExtraido || '-'}
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
                          {doc.exportado ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Exportado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pendiente
                            </span>
                          )}
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
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredDocuments.length)} de {filteredDocuments.length} ítems
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
        </CardContent>
      </Card>

      {/* Modal de Edición/Visualización */}
      {showEditModal && selectedDocumentForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col animate-in fade-in-0 zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-white flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 ${isReadOnly ? 'bg-green-100' : 'bg-palette-yellow'} rounded-lg flex items-center justify-center`}>
                  {isReadOnly ? (
                    <Eye className="w-6 h-6 text-green-600" />
                  ) : (
                    <Edit className="w-6 h-6 text-palette-dark" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    {isReadOnly ? 'Ver Datos Extraídos' : 'Editar Datos Extraídos'}
                  </h2>
                  {isReadOnly && (
                    <p className="text-xs text-gray-500 mt-1">Documento exportado - Solo lectura</p>
                  )}
                </div>
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
                      ? 'border-palette-dark text-palette-dark'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Encabezado
                </button>
                <button
                  onClick={() => setActiveTab('items')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'items'
                      ? 'border-palette-dark text-palette-dark'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Items {documentoLineas.length > 0 && `(${documentoLineas.length})`}
                </button>
                <button
                  onClick={() => setActiveTab('impuestos')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'impuestos'
                      ? 'border-palette-dark text-palette-dark'
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={isReadOnly}
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={isReadOnly}
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="00000-00000000"
                    disabled={isReadOnly}
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="XX-XXXXXXXX-X"
                    disabled={isReadOnly}
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Nombre del emisor"
                    disabled={isReadOnly}
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="0.00"
                    disabled={isReadOnly}
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="0.00"
                    disabled={isReadOnly}
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="0.00"
                    disabled={isReadOnly}
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="0.00"
                    disabled={isReadOnly}
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
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="CAE del comprobante"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
              )}

              {/* TAB: ITEMS */}
              {activeTab === 'items' && (
                <div>
                  {/* Header */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-semibold text-gray-800">Line Items</h3>
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
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {documentoLineas.map((linea) => (
                        <div key={linea.id} className="border border-gray-200 rounded-lg bg-white shadow-sm">
                          {/* Header de la tarjeta */}
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-blue-200">
                            <div className="flex items-center gap-3">
                              <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center">
                                {linea.numero}
                              </span>
                              <h4 className="font-semibold text-gray-900 text-sm">{linea.descripcion}</h4>
                            </div>
                          </div>

                          {/* Contenido principal */}
                          <div className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Cantidad</span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {Number(linea.cantidad).toFixed(2)} {linea.unidad || ''}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Precio Unit.</span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  ${Number(linea.precioUnitario).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Subtotal</span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  ${Number(linea.subtotal).toFixed(2)}
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
                                  ${Number(linea.totalLinea).toFixed(2)}
                                </p>
                              </div>
                            </div>

                            {/* Separador */}
                            <div className="border-t border-gray-200 my-3"></div>

                            {/* Campos contables */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                              <div className="bg-blue-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Tipo Producto</span>
                                <span className="text-gray-800">{linea.tipoProducto || '-'}</span>
                              </div>
                              <div className="bg-blue-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Cód. Producto</span>
                                <span className="text-gray-800">{linea.codigoProducto || '-'}</span>
                              </div>
                              <div className="bg-blue-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Dimensión</span>
                                <span className="text-gray-800">{linea.codigoDimension || '-'}</span>
                              </div>
                              <div className="bg-blue-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Subcuenta</span>
                                <span className="text-gray-800">{linea.subcuenta || '-'}</span>
                              </div>
                              <div className="bg-blue-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Cuenta Contable</span>
                                <span className="text-gray-800">{linea.cuentaContable || '-'}</span>
                              </div>
                              <div className="bg-blue-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Tipo OC</span>
                                <span className="text-gray-800">{linea.tipoOrdenCompra || '-'}</span>
                              </div>
                              <div className="bg-blue-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Orden Compra</span>
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
              {activeTab === 'impuestos' && (
                <div>
                  {/* Header */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-semibold text-gray-800">Impuestos</h3>
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
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {documentoImpuestos.map((impuesto) => (
                        <div key={impuesto.id} className="border border-gray-200 rounded-lg bg-white shadow-sm">
                          {/* Header de la tarjeta */}
                          <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 py-3 border-b border-green-200">
                            <div className="flex items-center gap-3">
                              <span className="bg-green-600 text-white text-xs font-bold rounded px-3 py-1">
                                {impuesto.tipo}
                              </span>
                              <h4 className="font-semibold text-gray-900 text-sm">{impuesto.descripcion}</h4>
                            </div>
                          </div>

                          {/* Contenido principal */}
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Alícuota</span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {impuesto.alicuota ? `${Number(impuesto.alicuota)}%` : '-'}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Base Imponible</span>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {impuesto.baseImponible ? `$${Number(impuesto.baseImponible).toFixed(2)}` : '-'}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Importe</span>
                                <p className="text-lg font-bold text-green-600 mt-1">
                                  ${Number(impuesto.importe).toFixed(2)}
                                </p>
                              </div>
                            </div>

                            {/* Separador */}
                            <div className="border-t border-gray-200 my-3"></div>

                            {/* Campos contables */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div className="bg-green-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Dimensión</span>
                                <span className="text-gray-800">{impuesto.codigoDimension || '-'}</span>
                              </div>
                              <div className="bg-green-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Subcuenta</span>
                                <span className="text-gray-800">{impuesto.subcuenta || '-'}</span>
                              </div>
                              <div className="bg-green-50 p-2 rounded">
                                <span className="font-medium text-gray-600 block mb-1">Cuenta Contable</span>
                                <span className="text-gray-800">{impuesto.cuentaContable || '-'}</span>
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
                onClick={() => setShowEditModal(false)}
                disabled={savingEdit}
              >
                {isReadOnly ? 'Cerrar' : 'Cancelar'}
              </Button>
              {!isReadOnly && (
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de visualización de documentos */}
      <DocumentViewerProvider documentViewer={documentViewer} />
    </div>
  );
}
