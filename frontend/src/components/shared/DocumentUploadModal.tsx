'use client';

import { useState, useEffect } from 'react';
import { X, Upload, FileText, Image, AlertCircle, Check, Clock, Download, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface DocumentoProcessed {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  estadoProcesamiento: 'procesando' | 'completado' | 'error';
  fechaExtraida?: string;
  importeExtraido?: number;
  cuitExtraido?: string;
  numeroComprobanteExtraido?: string;
  razonSocialExtraida?: string;
  netoGravadoExtraido?: number;
  exentoExtraido?: number;
  cuponExtraido?: string;
  caeExtraido?: string;
  observaciones?: string;
  datosExtraidos?: {
    texto: string;
    [key: string]: any;
  };
  createdAt: string;
}

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  documento?: DocumentoProcessed;
  error?: string;
  progress?: number;
  currentStep?: string;
  processingSteps?: string[];
}

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentProcessed?: (documento: DocumentoProcessed | DocumentoProcessed[]) => void;
  allowMultiple?: boolean; // Por defecto true para comprobantes, false para rendiciones
  title?: string;
  maxFiles?: number;
  autoCloseOnSuccess?: boolean; // Auto cerrar cuando se sube con éxito
  context?: 'comprobantes' | 'rendiciones'; // Para saber el contexto
  itemId?: string; // Para rendiciones, el ID del item al que se asociará
  tipo?: string; // 'efectivo' o 'tarjeta'
  additionalData?: Record<string, any>; // Para datos adicionales como cajaId
  onSuccess?: () => void;
}

export const DocumentUploadModal = ({
  isOpen,
  onClose,
  onDocumentProcessed,
  allowMultiple = true,
  title = 'Subir Comprobantes',
  maxFiles = 10,
  autoCloseOnSuccess = false,
  context = 'comprobantes',
  itemId,
  tipo,
  additionalData,
  onSuccess
}: DocumentUploadModalProps) => {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFiles([]);
      setUploading(false);
      setDragActive(false);
      setSuccessCount(0);
      setCurrentProcessingIndex(null);
    }
  }, [isOpen]);

  // Auto close si está configurado y todos los archivos se procesaron con éxito
  useEffect(() => {
    if (autoCloseOnSuccess && successCount > 0 && successCount === files.length && 
        files.every(f => f.status === 'completed')) {
      const timer = setTimeout(() => {
        onClose();
        toast.success(
          allowMultiple 
            ? `${successCount} comprobante${successCount > 1 ? 's' : ''} procesado${successCount > 1 ? 's' : ''} exitosamente`
            : 'Comprobante procesado exitosamente'
        );
      }, 1500); // Esperar 1.5 segundos antes de cerrar
      return () => clearTimeout(timer);
    }
  }, [successCount, files, autoCloseOnSuccess, onClose, allowMultiple]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFilesSelection(droppedFiles);
    }
  };

  const handleFilesSelection = (selectedFiles: File[]) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const effectiveMaxFiles = allowMultiple ? maxFiles : 1;

    const validFiles: FileUploadStatus[] = [];
    const errors: string[] = [];

    // Si no permite múltiples, solo tomar el primer archivo
    const filesToProcess = allowMultiple ? selectedFiles.slice(0, effectiveMaxFiles) : [selectedFiles[0]];

    filesToProcess.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Tipo no permitido`);
        return;
      }

      if (file.size > maxSize) {
        errors.push(`${file.name}: Tamaño mayor a 10MB`);
        return;
      }

      validFiles.push({
        file,
        status: 'pending',
      });
    });

    if (!allowMultiple && selectedFiles.length > 1) {
      toast.error('Solo se permite subir un archivo. Se seleccionó el primero.');
    } else if (allowMultiple && selectedFiles.length > effectiveMaxFiles) {
      errors.push(`Se seleccionaron ${selectedFiles.length} archivos. Máximo permitido: ${effectiveMaxFiles}`);
    }

    if (errors.length > 0) {
      toast.error(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setFiles(validFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length > 0) {
      handleFilesSelection(selectedFiles);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const processedDocuments: DocumentoProcessed[] = [];

    // Procesar cada archivo
    for (let i = 0; i < files.length; i++) {
      const fileStatus = files[i];

      // Actualizar índice de procesamiento actual
      setCurrentProcessingIndex(i);

      // Actualizar estado a uploading
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'uploading' } : f
      ));

      try {
        const formData = new FormData();
        formData.append('documento', fileStatus.file);

        // Si es para rendiciones, agregar el itemId si existe
        if (context === 'rendiciones' && itemId) {
          formData.append('itemId', itemId);
        }

        // Agregar el tipo si está especificado
        if (tipo) {
          formData.append('tipo', tipo);
        }

        // Agregar datos adicionales como cajaId
        if (additionalData) {
          Object.entries(additionalData).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              formData.append(key, String(value));
            }
          });
        }

        const response = await api.post('/documentos/procesar', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          const documentoId = response.data.documentoId;
          
          // Actualizar estado a processing con pasos detallados
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { 
              ...f, 
              status: 'processing', 
              progress: 20,
              currentStep: 'Iniciando procesamiento...',
              processingSteps: [
                'Subida completada',
                'Iniciando procesamiento...',
                'Analizando tipo de archivo',
                'Ejecutando OCR',
                'Extrayendo datos',
                'Guardando resultados'
              ]
            } : f
          ));
          
          // Polling para obtener el estado del procesamiento
          const documento = await pollDocumentStatus(documentoId, i);
          if (documento) {
            processedDocuments.push(documento);
          }
        } else {
          throw new Error(response.data.error || 'Error desconocido');
        }
      } catch (error) {
        console.error('Error uploading document:', error);
        const errorMsg = (error as any)?.response?.data?.error || (error as any)?.message || 'Error al subir el documento';

        // Actualizar estado a error
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'error', error: errorMsg } : f
        ));

        // Mostrar el error específico al usuario
        toast.error(errorMsg);
      }
    }

    setUploading(false);
    setCurrentProcessingIndex(null);

    // Llamar al callback con los documentos procesados
    if (processedDocuments.length > 0 && onDocumentProcessed) {
      onDocumentProcessed(allowMultiple ? processedDocuments : processedDocuments[0]);
    }
  };

  const pollDocumentStatus = async (documentoId: string, fileIndex: number): Promise<DocumentoProcessed | null> => {
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const response = await api.get(`/documentos/${documentoId}`);
        const documento = response.data;
        
        // Calcular progreso basado en el estado
        let progress = 20;
        let currentStep = 'Procesando...';
        
        if (documento.estadoProcesamiento === 'procesando') {
          // Actualizar progreso gradualmente
          progress = Math.min(20 + (attempts * 2.5), 90);
          
          // Simular pasos de procesamiento
          if (progress < 30) currentStep = 'Analizando tipo de archivo...';
          else if (progress < 50) currentStep = 'Ejecutando OCR...';
          else if (progress < 70) currentStep = 'Extrayendo datos...';
          else if (progress < 90) currentStep = 'Guardando resultados...';
          
          setFiles(prev => prev.map((f, idx) => 
            idx === fileIndex ? { 
              ...f, 
              progress,
              currentStep
            } : f
          ));
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
        } else if (documento.estadoProcesamiento === 'completado') {
          // Actualizar estado a completed
          setFiles(prev => prev.map((f, idx) => 
            idx === fileIndex ? { 
              ...f, 
              status: 'completed', 
              documento, 
              progress: 100,
              currentStep: 'Completado'
            } : f
          ));
          
          setSuccessCount(prev => prev + 1);
          return documento;
        } else if (documento.estadoProcesamiento === 'error') {
          // Marcar el archivo como error en la UI
          setFiles(prev => prev.map((f, idx) => 
            idx === fileIndex ? { 
              ...f, 
              status: 'error', 
              error: documento.observaciones || 'Error al procesar el documento',
              currentStep: 'Error',
              progress: 0
            } : f
          ));
          return null; // No incluir en documentos procesados exitosos
        }
      } catch (error) {
        console.error('Error polling document status:', error);
        const errorMsg = (error as any)?.message || 'Error al obtener el estado del documento';
        
        setFiles(prev => prev.map((f, idx) => 
          idx === fileIndex ? { 
            ...f, 
            status: 'error', 
            error: errorMsg,
            currentStep: 'Error'
          } : f
        ));
        return null;
      }
    }
    
    // Si llegamos aquí, se agotó el tiempo de espera
    setFiles(prev => prev.map((f, idx) => 
      idx === fileIndex ? { 
        ...f, 
        status: 'error', 
        error: 'Tiempo de espera agotado',
        currentStep: 'Timeout'
      } : f
    ));
    return null;
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-500" />;
    } else if (fileType.includes('image')) {
      return <Image className="w-8 h-8 text-blue-500" />;
    }
    return <FileText className="w-8 h-8 text-gray-500" />;
  };

  const getStatusIcon = (status: string, error?: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      case 'uploading':
        return <Upload className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Área de drag and drop */}
            {files.length === 0 && (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center ${
                  dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Arrastra y suelta {allowMultiple ? 'tus archivos' : 'tu archivo'} aquí, o
                </p>
                <Button className="mt-2 cursor-pointer">
                  <label className="cursor-pointer">
                    Seleccionar {allowMultiple ? 'archivos' : 'archivo'}
                    <input
                      type="file"
                      className="hidden"
                      multiple={allowMultiple}
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileInputChange}
                    />
                  </label>
                </Button>
                <p className="mt-2 text-xs text-gray-500">
                  PDF, JPG o PNG. Máximo 10MB {allowMultiple ? `(hasta ${maxFiles} archivos)` : ''}
                </p>
              </div>
            )}

            {/* Lista de archivos */}
            {files.length > 0 && (
              <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                {files.map((fileStatus, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 bg-gray-50 overflow-hidden"
                  >
                    <div className="flex items-start justify-between min-w-0">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        {getFileIcon(fileStatus.file.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate break-all">
                            {fileStatus.file.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          
                          {/* Mostrar progreso si está procesando */}
                          {fileStatus.status === 'processing' && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-600">
                                  {fileStatus.currentStep}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {fileStatus.progress}%
                                </span>
                              </div>
                              <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${fileStatus.progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {/* Mostrar error si hay */}
                          {fileStatus.status === 'error' && (
                            <p className="mt-1 text-sm text-red-600">
                              {fileStatus.error}
                            </p>
                          )}
                          
                          {/* Mostrar datos extraídos si está completado */}
                          {fileStatus.status === 'completed' && fileStatus.documento && (
                            <div className="mt-2 text-xs text-gray-600 space-y-1">
                              {fileStatus.documento.fechaExtraida && (
                                <p>Fecha: {new Date(fileStatus.documento.fechaExtraida).toLocaleDateString()}</p>
                              )}
                              {fileStatus.documento.importeExtraido && (
                                <p>Importe: ${fileStatus.documento.importeExtraido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                              )}
                              {fileStatus.documento.razonSocialExtraida && (
                                <p>Razón Social: {fileStatus.documento.razonSocialExtraida}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(fileStatus.status, fileStatus.error)}
                          {fileStatus.status === 'pending' && !uploading && (
                            <button
                              onClick={() => removeFile(index)}
                              className="text-gray-400 hover:text-gray-500"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row sm:justify-between sm:items-center">
            {/* Contador de procesamiento */}
            <div className="mb-3 sm:mb-0">
              {uploading && currentProcessingIndex !== null && (
                <span className="text-sm text-gray-600">
                  Procesando comprobante {currentProcessingIndex + 1} de {files.length}
                </span>
              )}
            </div>

            {/* Botones */}
            <div className="flex flex-col sm:flex-row-reverse gap-3 sm:gap-0">
              {files.length > 0 && files.some(f => f.status === 'pending') && (
                <Button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full sm:w-auto sm:ml-3"
                >
                  {uploading ? 'Procesando...' : 'Subir y procesar'}
                </Button>
              )}
              {!autoCloseOnSuccess && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="w-full sm:w-auto"
                >
                  {files.some(f => f.status === 'completed') ? 'Cerrar' : 'Cancelar'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};