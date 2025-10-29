'use client';

import { useState, useEffect } from 'react';
import { X, Download, FileText, Calendar, DollarSign, User, Hash, AlertCircle, ExternalLink, Loader2, ChevronDown, ChevronUp, Package, Receipt, Edit2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string;
  itemData?: any;
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  documentId,
  itemData
}: DocumentViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Nuevos states para line items e impuestos
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [impuestos, setImpuestos] = useState<any[]>([]);
  const [loadingLineItems, setLoadingLineItems] = useState(false);
  const [loadingImpuestos, setLoadingImpuestos] = useState(false);
  const [showLineItems, setShowLineItems] = useState(false);
  const [showImpuestos, setShowImpuestos] = useState(false);

  // Estados para edición
  const [editingLineItem, setEditingLineItem] = useState<any | null>(null);
  const [editingImpuesto, setEditingImpuesto] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (isOpen && documentId) {
      loadDocument();
    } else if (!isOpen) {
      // Clean up blob URL if it exists
      if (documentUrl && documentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(documentUrl);
      }

      // Reset state when closing
      setDocumentUrl(null);
      setDocumentData(null);
      setError(null);
    }
  }, [isOpen, documentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (documentUrl && documentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(documentUrl);
      }
    };
  }, [documentUrl]);

  const loadDocument = async () => {
    console.log('📥 [DocumentViewerModal] loadDocument called with documentId:', documentId);

    // Check authentication
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    console.log('🔑 [DocumentViewerModal] Auth token present:', !!token);
    if (token) {
      console.log('🔑 [DocumentViewerModal] Token starts with:', token.substring(0, 20) + '...');
    }

    if (!documentId) {
      setError('No se especificó un documento');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch document details
      console.log('🌐 [DocumentViewerModal] Making API call to /documentos/' + documentId);
      const response = await api.get(`/documentos/${documentId}`);
      const document = response.data;
      console.log('📄 [DocumentViewerModal] Document response:', document);

      if (!document) {
        throw new Error('Documento no encontrado');
      }

      setDocumentData(document);

      // Cargar line items e impuestos en paralelo
      loadLineItems();
      loadImpuestos();

      // If document has a file path, get the document as blob URL
      if (document.rutaArchivo) {
        // Fetch the document with authentication (manual implementation)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        console.log('🔒 [DocumentViewerModal] Using token for document fetch:', !!token);

        const response = await api.get(`/documentos/view/${documentId}`, {
          responseType: 'blob',
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });

        // Detectar el tipo de archivo basado en la extensión o usar el tipo desde la respuesta
        const contentType = response.headers['content-type'] || document.tipoMime || 'application/pdf';
        const blob = new Blob([response.data], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        setDocumentUrl(blobUrl);
      } else if (document.contenidoBase64) {
        // If document is stored as base64
        const mimeType = document.tipoMime || document.tipoArchivo || 'application/pdf';
        const dataUrl = `data:${mimeType};base64,${document.contenidoBase64}`;
        setDocumentUrl(dataUrl);
      } else {
        setError('El documento no tiene contenido disponible');
      }
    } catch (error: any) {
      console.error('Error loading document:', error);
      setError(error.message || 'Error al cargar el documento');
      toast.error('Error al cargar el documento');
    } finally {
      setLoading(false);
    }
  };

  const loadLineItems = async () => {
    if (!documentId) return;

    try {
      setLoadingLineItems(true);
      const response = await api.get(`/documentos/${documentId}/lineas`);

      if (response.data.success) {
        setLineItems(response.data.lineas || []);
        console.log('📋 [DocumentViewerModal] Line items loaded:', response.data.lineas?.length || 0);
      }
    } catch (error: any) {
      console.error('Error loading line items:', error);
      // No mostrar error al usuario si no hay line items
      setLineItems([]);
    } finally {
      setLoadingLineItems(false);
    }
  };

  const loadImpuestos = async () => {
    if (!documentId) return;

    try {
      setLoadingImpuestos(true);
      const response = await api.get(`/documentos/${documentId}/impuestos`);

      if (response.data.success) {
        setImpuestos(response.data.impuestos || []);
        console.log('💰 [DocumentViewerModal] Impuestos loaded:', response.data.impuestos?.length || 0);
      }
    } catch (error: any) {
      console.error('Error loading impuestos:', error);
      // No mostrar error al usuario si no hay impuestos
      setImpuestos([]);
    } finally {
      setLoadingImpuestos(false);
    }
  };

  const handleSaveLineItem = async () => {
    if (!editingLineItem) return;

    try {
      setSavingEdit(true);
      const response = await api.put(`/documentos/lineas/${editingLineItem.id}`, editingLineItem);

      if (response.data.success) {
        // Actualizar el item en el estado local
        setLineItems(lineItems.map(item =>
          item.id === editingLineItem.id ? response.data.lineItem : item
        ));
        setEditingLineItem(null);
        toast.success('Item actualizado correctamente');
      }
    } catch (error: any) {
      console.error('Error saving line item:', error);
      toast.error('Error al guardar el item');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveImpuesto = async () => {
    if (!editingImpuesto) return;

    try {
      setSavingEdit(true);
      const response = await api.put(`/documentos/impuestos/${editingImpuesto.id}`, editingImpuesto);

      if (response.data.success) {
        // Actualizar el impuesto en el estado local
        setImpuestos(impuestos.map(imp =>
          imp.id === editingImpuesto.id ? response.data.impuesto : imp
        ));
        setEditingImpuesto(null);
        toast.success('Impuesto actualizado correctamente');
      }
    } catch (error: any) {
      console.error('Error saving impuesto:', error);
      toast.error('Error al guardar el impuesto');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDownload = async () => {
    if (!documentId || !documentData) return;

    try {
      // Use the api client which handles authentication automatically
      const response = await api.get(`/documentos/download/${documentId}`, {
        responseType: 'blob'
      });

      // Create blob URL and trigger download
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = documentData.nombreArchivo || 'documento.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      URL.revokeObjectURL(url);

      toast.success('Documento descargado');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Error al descargar el documento');
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 lg:inset-8 bg-white rounded-lg shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Visualizador de Documento
              </h2>
              {documentData && (
                <p className="text-sm text-gray-500">
                  {documentData.nombreArchivo || 'documento.pdf'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {documentUrl && (
              <button
                onClick={handleDownload}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Descargar documento"
              >
                <Download className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document Details Panel */}
          <div className="w-80 border-r border-gray-200 p-4 overflow-y-auto bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Información del Comprobante
            </h3>

            {/* Item details from grid */}
            {itemData && (
              <div className="space-y-4">
                {/* Fecha */}
                <div className="flex items-start space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Fecha</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(itemData.documento?.fechaTransaccion || itemData.fechaComprobante)}
                    </p>
                  </div>
                </div>

                {/* Tipo de Comprobante */}
                <div className="flex items-start space-x-2">
                  <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Tipo de Comprobante</p>
                    <p className="text-sm font-medium text-gray-900">
                      {itemData.tipoComprobante || '-'}
                    </p>
                  </div>
                </div>

                {/* Número */}
                <div className="flex items-start space-x-2">
                  <Hash className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Número</p>
                    <p className="text-sm font-medium text-gray-900">
                      {itemData.numeroComprobante || '-'}
                    </p>
                  </div>
                </div>

                {/* Proveedor */}
                <div className="flex items-start space-x-2">
                  <User className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Proveedor/Razón Social</p>
                    <p className="text-sm font-medium text-gray-900">
                      {itemData.documento?.proveedorNombre ||
                       itemData.documento?.razonSocialExtraida || '-'}
                    </p>
                  </div>
                </div>

                {/* Importe */}
                <div className="flex items-start space-x-2">
                  <DollarSign className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Importe Total</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(itemData.documento?.importeExtraido || itemData.importeTotal)}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Datos Extraídos del Documento
                  </h4>
                </div>

                {/* Document extracted data */}
                {itemData.documento && (
                  <>
                    {itemData.documento.cuitExtraido && (
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">CUIT</p>
                          <p className="text-sm font-medium text-gray-900">
                            {itemData.documento.cuitExtraido}
                          </p>
                        </div>
                      </div>
                    )}

                    {itemData.documento.observaciones && (
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Observaciones</p>
                          <p className="text-sm text-gray-900">
                            {itemData.documento.observaciones}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Producto Information */}
                {(itemData.tipoProducto || itemData.codigoProducto) && (
                  <>
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Información del Producto
                      </h4>
                    </div>

                    {itemData.tipoProducto && (
                      <div className="flex items-start space-x-2">
                        <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Tipo de Producto</p>
                          <p className="text-sm font-medium text-gray-900">
                            {itemData.tipoProducto}
                          </p>
                        </div>
                      </div>
                    )}

                    {itemData.codigoProducto && (
                      <div className="flex items-start space-x-2">
                        <Hash className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Código de Producto</p>
                          <p className="text-sm font-medium text-gray-900">
                            {itemData.codigoProducto}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Document metadata */}
            {documentData && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Información del Archivo
                </h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <p>Tipo: {documentData.tipoMime || 'application/pdf'}</p>
                  {documentData.tamanio && (
                    <p>Tamaño: {(documentData.tamanio / 1024).toFixed(2)} KB</p>
                  )}
                  {documentData.createdAt && (
                    <p>Subido: {formatDate(documentData.createdAt)}</p>
                  )}
                </div>
              </div>
            )}

            {/* LINE ITEMS Section */}
            {lineItems.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowLineItems(!showLineItems)}
                  className="w-full flex items-center justify-between text-left mb-3 hover:bg-gray-100 p-2 rounded transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-semibold text-gray-700">
                      Items del Comprobante ({lineItems.length})
                    </h4>
                  </div>
                  {showLineItems ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {showLineItems && (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {lineItems.map((item, index) => (
                      <div key={item.id || index} className="bg-white p-3 rounded border border-gray-200 text-xs relative">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <span className="font-medium text-gray-900">
                              #{item.numero} {item.descripcion}
                            </span>
                            {item.codigoProducto && (
                              <div className="mt-1">
                                <span className="text-gray-500">Código:</span>{' '}
                                <span className="font-mono text-blue-600">{item.codigoProducto}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-gray-600">
                          <div>
                            <span className="text-gray-500">Cantidad:</span> {parseFloat(item.cantidad).toFixed(2)} {item.unidad}
                          </div>
                          <div>
                            <span className="text-gray-500">P. Unit:</span> {formatCurrency(parseFloat(item.precioUnitario))}
                          </div>
                          <div>
                            <span className="text-gray-500">Subtotal:</span> {formatCurrency(parseFloat(item.subtotal))}
                          </div>
                          <div className="font-medium text-gray-900">
                            <span className="text-gray-500">Total:</span> {formatCurrency(parseFloat(item.totalLinea))}
                          </div>
                        </div>
                        {item.alicuotaIva && (
                          <div className="mt-2 pt-2 border-t border-gray-100 text-gray-600">
                            <span className="text-gray-500">IVA {parseFloat(item.alicuotaIva)}%:</span> {formatCurrency(parseFloat(item.importeIva || 0))}
                          </div>
                        )}
                        <button
                          onClick={() => setEditingLineItem({...item})}
                          className="absolute bottom-2 right-2 p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="Editar item"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* IMPUESTOS Section */}
            {impuestos.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowImpuestos(!showImpuestos)}
                  className="w-full flex items-center justify-between text-left mb-3 hover:bg-gray-100 p-2 rounded transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-green-600" />
                    <h4 className="text-sm font-semibold text-gray-700">
                      Impuestos Detallados ({impuestos.length})
                    </h4>
                  </div>
                  {showImpuestos ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {showImpuestos && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {impuestos.map((imp, index) => (
                      <div key={imp.id || index} className="bg-white p-3 rounded border border-gray-200 text-xs relative pb-8">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-900">{imp.descripcion}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            imp.tipo === 'IVA' ? 'bg-blue-100 text-blue-700' :
                            imp.tipo === 'PERCEPCION' ? 'bg-yellow-100 text-yellow-700' :
                            imp.tipo === 'RETENCION' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {imp.tipo}
                          </span>
                        </div>
                        <div className="space-y-1 text-gray-600">
                          {imp.alicuota && (
                            <div>
                              <span className="text-gray-500">Alícuota:</span> {parseFloat(imp.alicuota)}%
                            </div>
                          )}
                          {imp.baseImponible && (
                            <div>
                              <span className="text-gray-500">Base:</span> {formatCurrency(parseFloat(imp.baseImponible))}
                            </div>
                          )}
                          <div className="font-medium text-gray-900">
                            <span className="text-gray-500">Importe:</span> {formatCurrency(parseFloat(imp.importe))}
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingImpuesto({...imp})}
                          className="absolute bottom-2 right-2 p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="Editar impuesto"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Loading states */}
            {(loadingLineItems || loadingImpuestos) && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cargando detalles...</span>
                </div>
              </div>
            )}
          </div>

          {/* Document Viewer */}
          <div className="flex-1 bg-gray-100 relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-600">Cargando documento...</p>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium mb-2">Error al cargar el documento</p>
                  <p className="text-sm text-gray-600">{error}</p>
                </div>
              </div>
            )}

            {documentUrl && !loading && !error && (
              <div className="w-full h-full">
                {/* Determinar cómo mostrar el archivo basado en su tipo */}
                {(() => {
                  const mimeType = documentData?.tipoMime || documentData?.tipoArchivo || '';
                  const isImage = mimeType.startsWith('image/') ||
                                /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(documentData?.nombreArchivo || '');
                  const isPdf = mimeType === 'application/pdf' ||
                               documentData?.nombreArchivo?.toLowerCase().endsWith('.pdf');

                  if (isImage) {
                    return (
                      <div className="w-full h-full flex items-center justify-center p-4 bg-gray-50">
                        <img
                          src={documentUrl}
                          alt="Documento"
                          className="max-w-full max-h-full object-contain shadow-lg rounded"
                          style={{ maxHeight: 'calc(100vh - 200px)' }}
                        />
                      </div>
                    );
                  } else if (isPdf) {
                    return (
                      <iframe
                        src={documentUrl}
                        className="w-full h-full"
                        title="Visualizador de PDF"
                      />
                    );
                  } else {
                    // Para otros tipos de archivo, mostrar opción de descarga
                    return (
                      <div className="w-full h-full flex items-center justify-center p-8">
                        <div className="text-center">
                          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {documentData?.nombreArchivo || 'Documento'}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">
                            Este tipo de archivo ({mimeType}) no se puede visualizar directamente.
                          </p>
                          <button
                            onClick={handleDownload}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Descargar archivo
                          </button>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>
            )}

            {!documentId && !loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium mb-2">Sin documento adjunto</p>
                  <p className="text-sm text-gray-600">
                    Este comprobante no tiene un documento asociado
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de edición de Line Item */}
      {editingLineItem && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={() => setEditingLineItem(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-white rounded-lg shadow-2xl z-[60] max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Editar Item</h3>
                <button
                  onClick={() => setEditingLineItem(null)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={editingLineItem.descripcion || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, descripcion: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número
                  </label>
                  <input
                    type="number"
                    value={editingLineItem.numero || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, numero: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código de Producto
                  </label>
                  <input
                    type="text"
                    value={editingLineItem.codigoProducto || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, codigoProducto: e.target.value})}
                    placeholder="COD-123, ART-456, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLineItem.cantidad || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, cantidad: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidad
                  </label>
                  <input
                    type="text"
                    value={editingLineItem.unidad || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, unidad: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLineItem.cantidad || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, cantidad: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio Unitario
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLineItem.precioUnitario || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, precioUnitario: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subtotal
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLineItem.subtotal || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, subtotal: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alícuota IVA (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLineItem.alicuotaIva || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, alicuotaIva: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Importe IVA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLineItem.importeIva || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, importeIva: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Línea
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLineItem.totalLinea || ''}
                    onChange={(e) => setEditingLineItem({...editingLineItem, totalLinea: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setEditingLineItem(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveLineItem}
                  disabled={savingEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de edición de Impuesto */}
      {editingImpuesto && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={() => setEditingImpuesto(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white rounded-lg shadow-2xl z-[60]">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Editar Impuesto</h3>
                <button
                  onClick={() => setEditingImpuesto(null)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={editingImpuesto.tipo || ''}
                    onChange={(e) => setEditingImpuesto({...editingImpuesto, tipo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="IVA">IVA</option>
                    <option value="PERCEPCION">PERCEPCION</option>
                    <option value="RETENCION">RETENCION</option>
                    <option value="IMPUESTO_INTERNO">IMPUESTO INTERNO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={editingImpuesto.descripcion || ''}
                    onChange={(e) => setEditingImpuesto({...editingImpuesto, descripcion: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alícuota (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingImpuesto.alicuota || ''}
                      onChange={(e) => setEditingImpuesto({...editingImpuesto, alicuota: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base Imponible
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingImpuesto.baseImponible || ''}
                      onChange={(e) => setEditingImpuesto({...editingImpuesto, baseImponible: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Importe
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingImpuesto.importe || ''}
                    onChange={(e) => setEditingImpuesto({...editingImpuesto, importe: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setEditingImpuesto(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveImpuesto}
                  disabled={savingEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}