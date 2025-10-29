'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Upload, FileText, Image, AlertCircle, Check, Clock, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface ExtractedData {
  fecha?: string;
  importe?: number;
  cuit?: string;
  numeroComprobante?: string;
}

interface DocumentoProcessed {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  estadoProcesamiento: 'procesando' | 'completado' | 'error';
  fechaExtraida?: string;
  importeExtraido?: number;
  cuitExtraido?: string;
  numeroComprobanteExtraido?: string;
  caeExtraido?: string;
  observaciones?: string;
  datosExtraidos?: {
    texto: string;
    [key: string]: any;
  };
  createdAt: string;
}

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  rendicionItemId: string;
  originalItemData?: any; // Datos del item original de la grilla
  onDataApplied?: (data: ExtractedData) => void;
}

export const DocumentUploadModal = ({ 
  isOpen, 
  onClose, 
  rendicionItemId,
  originalItemData,
  onDataApplied 
}: DocumentUploadModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documento, setDocumento] = useState<DocumentoProcessed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  // Función para comparar fechas (con tolerancia)
  const compareDates = (date1: string | null | undefined, date2: string | null | undefined) => {
    if (!date1 || !date2) return false;
    
    try {
      // Función helper para crear fecha local sin conversión UTC
      const createLocalDate = (dateString: string) => {
        // Si el formato es DDMMYY (6 caracteres)
        if (dateString.length === 6) {
          const day = dateString.substring(0, 2);
          const month = dateString.substring(2, 4);
          const year = dateString.substring(4, 6);
          
          // Asumimos que años 00-30 son 2000-2030, y 31-99 son 1931-1999
          const fullYear = parseInt(year) <= 30 ? `20${year}` : `19${year}`;
          
          return new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
        }
        
        // Si ya incluye tiempo, usarlo directamente
        if (dateString.includes('T') || dateString.includes(' ')) {
          return new Date(dateString);
        } else {
          // Si es solo fecha YYYY-MM-DD, agregar hora local para evitar UTC
          return new Date(dateString + 'T00:00:00');
        }
      };

      const d1 = createLocalDate(date1);
      const d2 = createLocalDate(date2);
      
      // Verificar que las fechas sean válidas
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        console.warn('Invalid dates for comparison:', { date1, date2 });
        return false;
      }
      
      
      // Comparar solo año, mes y día
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    } catch (error) {
      console.error('Error comparing dates:', error, { date1, date2 });
      return false;
    }
  };

  // Función para comparar importes (con tolerancia del 5% o $10 ARS)
  const compareAmounts = (amount1: number | null | undefined, amount2: number | null | undefined) => {
    if (!amount1 || !amount2) return false;
    
    // Convertir a números si vienen como string
    const num1 = typeof amount1 === 'string' ? parseFloat(amount1) : amount1;
    const num2 = typeof amount2 === 'string' ? parseFloat(amount2) : amount2;
    
    if (isNaN(num1) || isNaN(num2)) return false;
    
    const diff = Math.abs(num1 - num2);
    
    // Tolerancia: 5% del valor mayor o $10 ARS (lo que sea mayor)
    const maxValue = Math.max(Math.abs(num1), Math.abs(num2));
    const percentTolerance = maxValue * 0.05; // 5%
    const fixedTolerance = 10; // $10 ARS
    const tolerance = Math.max(percentTolerance, fixedTolerance);
    
    
    return diff <= tolerance;
  };

  // Función para obtener el estado de validación de un campo (memoizada)
  const getFieldValidation = useCallback((field: string, extractedValue: any) => {
    if (!originalItemData) return null;
    
    switch(field) {
      case 'fecha':
        const originalDate = originalItemData.resumenTarjeta?.fechaTransaccion;
        return compareDates(extractedValue, originalDate) ? 'match' : 'mismatch';
      
      case 'importe':
        const originalAmount = originalItemData.resumenTarjeta?.importeTransaccion;
        return compareAmounts(extractedValue, originalAmount) ? 'match' : 'mismatch';
      
      default:
        return null;
    }
  }, [originalItemData]);
  
  // Memoizar los resultados de validación para evitar recálculos
  const fechaValidation = useMemo(() => {
    if (!documento?.fechaExtraida) return null;
    return getFieldValidation('fecha', documento.fechaExtraida);
  }, [documento?.fechaExtraida, getFieldValidation]);
  
  const importeValidation = useMemo(() => {
    if (!documento?.importeExtraido) return null;
    return getFieldValidation('importe', documento.importeExtraido);
  }, [documento?.importeExtraido, getFieldValidation]);

  // Polling para verificar el estado del procesamiento
  const pollProcessingStatus = useCallback(async (documentoId: string) => {
    try {
      const response = await api.get(`/documentos/${documentoId}`);
      const doc = response.data;
      setDocumento(doc);

      if (doc.estadoProcesamiento === 'completado') {
        // Mostrar mensaje según si se extrajeron datos o no
        const datosExtraidos = [
          doc.fechaExtraida,
          doc.importeExtraido,
          doc.cuitExtraido,
          doc.numeroComprobanteExtraido,
          doc.caeExtraido
        ].filter(Boolean).length;
        
        if (datosExtraidos === 0) {
          toast.error('No se pudieron procesar datos del documento');
        } else {
          toast.success(`Procesamiento completado. ${datosExtraidos} datos procesados`);
        }
        return; // Detener polling
      }
      
      if (doc.estadoProcesamiento === 'error') {
        toast.error('Error procesando el documento');
        return; // Detener polling
      }

      // Continuar polling si está procesando
      setTimeout(() => pollProcessingStatus(documentoId), 2000);
    } catch (err) {
      console.error('Error checking document status:', err);
      toast.error('Error al verificar el estado del documento');
    }
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    // Validar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error('Tipo de archivo no permitido. Solo se permiten PDF, JPG, JPEG y PNG.');
      return;
    }

    // Validar tamaño (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error('El archivo es demasiado grande. El tamaño máximo es 10MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('documento', file);
      formData.append('rendicionItemId', rendicionItemId);

      const response = await api.post('/documentos/procesar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { documentoId } = response.data;
      
      toast.success('Archivo subido. Procesando...');
      
      // Iniciar polling para verificar el progreso
      pollProcessingStatus(documentoId);
      
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error subiendo el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleApplyData = async () => {
    if (!documento || selectedFields.length === 0) return;

    setApplying(true);
    try {
      await api.put(`/documentos/${documento.id}/aplicar`, {
        camposAplicar: selectedFields
      });

      // Notificar a la grilla de los datos aplicados
      if (onDataApplied) {
        const appliedData: ExtractedData = {};
        if (selectedFields.includes('fecha') && documento.fechaExtraida) {
          appliedData.fecha = documento.fechaExtraida;
        }
        if (selectedFields.includes('importe') && documento.importeExtraido) {
          appliedData.importe = documento.importeExtraido;
        }
        if (selectedFields.includes('cuit') && documento.cuitExtraido) {
          appliedData.cuit = documento.cuitExtraido;
        }
        if (selectedFields.includes('numeroComprobante') && documento.numeroComprobanteExtraido) {
          appliedData.numeroComprobante = documento.numeroComprobanteExtraido;
        }
        onDataApplied(appliedData);
      }

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error aplicando los datos');
    } finally {
      setApplying(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Fecha no disponible';
    
    console.log('Modal formatDate called with:', { dateString, type: typeof dateString, length: dateString.length });
    
    try {
      // Si el formato es DDMMYY (6 caracteres) 
      if (dateString.length === 6) {
        const day = dateString.substring(0, 2);
        const month = dateString.substring(2, 4);
        const year = dateString.substring(4, 6);
        
        // Asumimos que años 00-30 son 2000-2030, y 31-99 son 1931-1999
        const fullYear = parseInt(year) <= 30 ? `20${year}` : `19${year}`;
        
        const result = `${day}/${month}/${fullYear}`;
        console.log('Modal DDMMYY format result:', result);
        return result;
      }
      
      // Intentar varios formatos de fecha
      let date;
      
      // Si ya incluye tiempo, crear fecha local manualmente para evitar UTC
      if (dateString.includes('T') || dateString.includes(' ')) {
        const isoDate = new Date(dateString);
        // Crear fecha local usando los componentes de la fecha UTC
        date = new Date(isoDate.getUTCFullYear(), isoDate.getUTCMonth(), isoDate.getUTCDate());
        console.log('Modal ISO date converted to local:', { original: dateString, isoDate, localDate: date });
      } else {
        // Si es solo fecha YYYY-MM-DD, crear fecha local sin UTC
        const parts = dateString.split('-');
        if (parts.length === 3) {
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          console.log('Modal YYYY-MM-DD parsed as local:', { original: dateString, parsed: date });
        } else {
          // Si es solo fecha YYYY-MM-DD, agregar hora local para evitar UTC
          date = new Date(dateString + 'T00:00:00');
          console.log('Modal fallback parsing:', { original: dateString, modified: dateString + 'T00:00:00', parsed: date });
        }
      }
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        // Intentar parseado manual para formatos como DD/MM/YYYY
        const parts = dateString.split(/[/-]/);
        if (parts.length === 3) {
          // Asumiendo formato DD/MM/YYYY o MM/DD/YYYY
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Los meses en JS van de 0-11
          const year = parseInt(parts[2]);
          
          if (day > 12) {
            // Es DD/MM/YYYY
            date = new Date(year, month, day);
          } else if (parseInt(parts[1]) > 12) {
            // Es MM/DD/YYYY  
            date = new Date(year, day - 1, parseInt(parts[1]));
          } else {
            // Ambiguo, asumir DD/MM/YYYY (formato argentino)
            date = new Date(year, month, day);
          }
        }
      }
      
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
      const result = date.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      console.log('Modal final date result:', { original: dateString, result });
      return result;
    } catch (error) {
      console.error('Modal error formatting date:', dateString, error);
      return 'Error en fecha';
    }
  };

  const resetModal = () => {
    setFile(null);
    setDocumento(null);
    setError(null);
    setSelectedFields([]);
    setUploading(false);
    setApplying(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getFileIcon = (type: string) => {
    if (type === 'pdf') return <FileText className="w-8 h-8 text-red-500" />;
    return <Image className="w-8 h-8 text-blue-500" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'procesando':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'completado':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'procesando':
        return 'Procesando documento...';
      case 'completado':
        return 'Procesamiento completado';
      case 'error':
        return 'Error en el procesamiento';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 h-[610px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            Subir y Analizar Documento
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Área de subida de archivos */}
          {!documento && (
            <div className="mb-6">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="flex items-center justify-center space-x-3">
                    {getFileIcon(file.type.includes('pdf') ? 'pdf' : 'image')}
                    <div>
                      <p className="font-medium text-gray-700">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Arrastra un archivo aquí o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-gray-500">
                      Soporta PDF, JPG, PNG (máx. 10MB)
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  Seleccionar archivo
                </label>
              </div>

              {error && (
                <div className="mt-4 flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {file && !uploading && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleUpload} className="px-6">
                    Subir y Procesar
                  </Button>
                </div>
              )}

              {uploading && (
                <div className="mt-4 flex items-center justify-center space-x-2 text-blue-600">
                  <Clock className="w-5 h-5 animate-spin" />
                  <span>Subiendo archivo...</span>
                </div>
              )}
            </div>
          )}

          {/* Estado del procesamiento */}
          {documento && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                {getFileIcon(documento.tipoArchivo)}
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">{documento.nombreArchivo}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusIcon(documento.estadoProcesamiento)}
                    <span className="text-sm text-gray-600">
                      {getStatusText(documento.estadoProcesamiento)}
                    </span>
                  </div>
                </div>
              </div>

              {documento.estadoProcesamiento === 'error' && documento.observaciones && (
                <div className="flex items-start space-x-2 text-orange-600 bg-orange-50 p-3 rounded">
                  <AlertCircle className="w-5 h-5 mt-0.5" />
                  <span>No se pudieron procesar algunos datos del documento</span>
                </div>
              )}

              {documento.estadoProcesamiento === 'completado' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-800">Datos Extraídos</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Fecha - mostrar siempre la tarjeta */}
                    <div className={`border rounded-lg p-3 relative ${
                      documento.fechaExtraida 
                        ? (fechaValidation === 'match' 
                            ? 'border-green-300 bg-green-50' 
                            : fechaValidation === 'mismatch'
                            ? 'border-yellow-300 bg-yellow-50'
                            : 'border-gray-300')
                        : 'border-red-300 bg-red-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!(documento.fechaExtraida && selectedFields.includes('fecha'))}
                              onChange={() => documento.fechaExtraida && handleFieldToggle('fecha')}
                              disabled={!documento.fechaExtraida}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-medium text-gray-700">Fecha</span>
                          </label>
                          {documento.fechaExtraida ? (
                            <>
                              <p className="mt-1 text-gray-900">{formatDate(documento.fechaExtraida)}</p>
                              {originalItemData?.resumenTarjeta?.fechaTransaccion && 
                               fechaValidation === 'mismatch' && (
                                <p className="text-xs text-yellow-700 mt-1">
                                  Original: {formatDate(originalItemData.resumenTarjeta.fechaTransaccion)}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="mt-1 text-red-600 text-sm">No se pudo detectar</p>
                          )}
                        </div>
                        <div className="ml-2">
                          {documento.fechaExtraida ? (
                            fechaValidation === 'match' ? (
                              <div title="Coincide con el original">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              </div>
                            ) : fechaValidation === 'mismatch' ? (
                              <div title="No coincide con el original">
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                              </div>
                            ) : (
                              <div title="Dato detectado">
                                <Check className="w-5 h-5 text-blue-600" />
                              </div>
                            )
                          ) : (
                            <div title="No se pudo detectar">
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Importe - mostrar siempre la tarjeta */}
                    <div className={`border rounded-lg p-3 relative ${
                      documento.importeExtraido 
                        ? (importeValidation === 'match' 
                            ? 'border-green-300 bg-green-50' 
                            : importeValidation === 'mismatch'
                            ? 'border-yellow-300 bg-yellow-50'
                            : 'border-gray-300')
                        : 'border-red-300 bg-red-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!(documento.importeExtraido && selectedFields.includes('importe'))}
                              onChange={() => documento.importeExtraido && handleFieldToggle('importe')}
                              disabled={!documento.importeExtraido}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-medium text-gray-700">Importe</span>
                          </label>
                          {documento.importeExtraido ? (
                            <>
                              <p className="mt-1 text-gray-900">{formatCurrency(documento.importeExtraido)}</p>
                              {originalItemData?.resumenTarjeta?.importeTransaccion && 
                               importeValidation === 'mismatch' && (
                                <p className="text-xs text-yellow-700 mt-1">
                                  Original: {formatCurrency(originalItemData.resumenTarjeta.importeTransaccion)}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="mt-1 text-red-600 text-sm">No se pudo detectar</p>
                          )}
                        </div>
                        <div className="ml-2">
                          {documento.importeExtraido ? (
                            importeValidation === 'match' ? (
                              <div title="Coincide con el original">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              </div>
                            ) : importeValidation === 'mismatch' ? (
                              <div title="No coincide con el original">
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                              </div>
                            ) : (
                              <div title="Dato detectado">
                                <Check className="w-5 h-5 text-blue-600" />
                              </div>
                            )
                          ) : (
                            <div title="No se pudo detectar">
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CUIT - mostrar siempre la tarjeta */}
                    <div className={`border rounded-lg p-3 relative ${
                      documento.cuitExtraido ? 'border-gray-300' : 'border-red-300 bg-red-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!(documento.cuitExtraido && selectedFields.includes('cuit'))}
                              onChange={() => documento.cuitExtraido && handleFieldToggle('cuit')}
                              disabled={!documento.cuitExtraido}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-medium text-gray-700">CUIT</span>
                          </label>
                          {documento.cuitExtraido ? (
                            <p className="mt-1 text-gray-900">{documento.cuitExtraido}</p>
                          ) : (
                            <p className="mt-1 text-red-600 text-sm">No se pudo detectar</p>
                          )}
                        </div>
                        <div className="ml-2">
                          {documento.cuitExtraido ? (
                            <div title="Dato detectado">
                                <Check className="w-5 h-5 text-blue-600" />
                              </div>
                          ) : (
                            <div title="No se pudo detectar">
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* N° Comprobante - mostrar siempre la tarjeta */}
                    <div className={`border rounded-lg p-3 relative ${
                      documento.numeroComprobanteExtraido ? 'border-gray-300' : 'border-red-300 bg-red-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!(documento.numeroComprobanteExtraido && selectedFields.includes('numeroComprobante'))}
                              onChange={() => documento.numeroComprobanteExtraido && handleFieldToggle('numeroComprobante')}
                              disabled={!documento.numeroComprobanteExtraido}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-medium text-gray-700">N° Comprobante</span>
                          </label>
                          {documento.numeroComprobanteExtraido ? (
                            <p className="mt-1 text-gray-900">{documento.numeroComprobanteExtraido}</p>
                          ) : (
                            <p className="mt-1 text-red-600 text-sm">No se pudo detectar</p>
                          )}
                        </div>
                        <div className="ml-2">
                          {documento.numeroComprobanteExtraido ? (
                            <div title="Dato detectado">
                                <Check className="w-5 h-5 text-blue-600" />
                              </div>
                          ) : (
                            <div title="No se pudo detectar">
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CAE - mostrar siempre la tarjeta */}
                    <div className={`border rounded-lg p-3 relative ${
                      documento.caeExtraido ? 'border-gray-300' : 'border-red-300 bg-red-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!(documento.caeExtraido && selectedFields.includes('cae'))}
                              onChange={() => documento.caeExtraido && handleFieldToggle('cae')}
                              disabled={!documento.caeExtraido}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-medium text-gray-700">CAE</span>
                          </label>
                          {documento.caeExtraido ? (
                            <p className="mt-1 text-gray-900">{documento.caeExtraido}</p>
                          ) : (
                            <p className="mt-1 text-red-600 text-sm">No se pudo detectar</p>
                          )}
                        </div>
                        <div className="ml-2">
                          {documento.caeExtraido ? (
                            <div title="Dato detectado">
                                <Check className="w-5 h-5 text-blue-600" />
                              </div>
                          ) : (
                            <div title="No se pudo detectar">
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(documento.fechaExtraida || documento.importeExtraido || documento.cuitExtraido || documento.numeroComprobanteExtraido || documento.caeExtraido) ? (
                    <div className="flex justify-end space-x-3 mt-6">
                      <Button
                        variant="outline"
                        onClick={onClose}
                      >
                        Descartar
                      </Button>
                      <Button
                        onClick={handleApplyData}
                        disabled={selectedFields.length === 0 || applying}
                        className="flex items-center gap-2"
                      >
                        {applying ? (
                          <>
                            <Clock className="w-4 h-4 animate-spin" />
                            Aplicando...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Aplicar {selectedFields.length} campo{selectedFields.length !== 1 ? 's' : ''}
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                      <p className="text-gray-600">
                        No se pudieron procesar datos reconocibles del documento.
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Verifica que el documento contenga fechas, importes, CUIT o números de comprobante legibles.
                      </p>
                      <Button
                        variant="outline"
                        onClick={onClose}
                        className="mt-4"
                      >
                        Cerrar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};