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

interface ComprobantesUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentProcessed?: (documento: DocumentoProcessed) => void;
}

export const ComprobantesUploadModal = ({ 
  isOpen, 
  onClose,
  onDocumentProcessed 
}: ComprobantesUploadModalProps) => {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);


  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFiles([]);
      setUploading(false);
      setDragActive(false);
    }
  }, [isOpen]);

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
    const maxFiles = 10; // Límite de archivos simultáneos

    const validFiles: FileUploadStatus[] = [];
    const errors: string[] = [];

    selectedFiles.slice(0, maxFiles).forEach((file) => {
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

    if (selectedFiles.length > maxFiles) {
      errors.push(`Se seleccionaron ${selectedFiles.length} archivos. Máximo permitido: ${maxFiles}`);
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

    // Procesar cada archivo
    for (let i = 0; i < files.length; i++) {
      const fileStatus = files[i];
      
      // Actualizar estado a uploading
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading' } : f
      ));

      try {
        const formData = new FormData();
        formData.append('documento', fileStatus.file);

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
                'Extrayendo datos del documento',
                'Guardando resultados'
              ]
            } : f
          ));
          
          // Polling para obtener el estado del procesamiento
          pollDocumentStatus(documentoId, i);
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
      }
    }
    
    setUploading(false);
  };

  const pollDocumentStatus = async (documentoId: string, fileIndex: number) => {
    try {
      const response = await api.get(`/documentos/${documentoId}`);
      const doc = response.data as DocumentoProcessed;
      
      if (doc.estadoProcesamiento === 'procesando') {
        // Simular progreso durante el procesamiento
        setFiles(prev => prev.map((f, idx) => {
          if (idx === fileIndex) {
            const currentProgress = f.progress || 20;
            let newProgress = Math.min(currentProgress + 15, 90);
            let currentStep = f.currentStep;
            
            // Actualizar el paso actual basado en el progreso
            if (newProgress >= 30 && newProgress < 45) {
              currentStep = 'Analizando tipo de archivo';
            } else if (newProgress >= 45 && newProgress < 60) {
              currentStep = 'Ejecutando OCR';
            } else if (newProgress >= 60 && newProgress < 75) {
              currentStep = 'Extrayendo datos';
            } else if (newProgress >= 75 && newProgress < 90) {
              currentStep = 'Extrayendo datos del documento';
            }
            
            return { ...f, progress: newProgress, currentStep };
          }
          return f;
        }));
        
        // Continuar haciendo polling cada 2 segundos
        setTimeout(() => pollDocumentStatus(documentoId, fileIndex), 2000);
      } else {
        if (doc.estadoProcesamiento === 'completado') {
          const completedStep = 'Procesamiento completado';
            
          // Actualizar estado a completed con el documento procesado
          setFiles(prev => prev.map((f, idx) => 
            idx === fileIndex ? { 
              ...f, 
              status: 'completed', 
              documento: doc, 
              progress: 100,
              currentStep: completedStep
            } : f
          ));
          onDocumentProcessed?.(doc);
        } else if (doc.estadoProcesamiento === 'error') {
          // Actualizar estado a error
          setFiles(prev => prev.map((f, idx) => 
            idx === fileIndex ? { 
              ...f, 
              status: 'error', 
              error: doc.observaciones || 'Error al procesar',
              currentStep: 'Error en el procesamiento'
            } : f
          ));
        }
      }
    } catch (error) {
      console.error('Error polling document status:', error);
      setFiles(prev => prev.map((f, idx) => 
        idx === fileIndex ? { ...f, status: 'error', error: 'Error al verificar estado' } : f
      ));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completado':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'procesando':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completado':
        return 'Procesamiento completado';
      case 'procesando':
        return 'Procesando documento...';
      case 'error':
        return 'Error en el procesamiento';
      default:
        return 'Estado desconocido';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const handleClose = () => {
    setFiles([]);
    setUploading(false);
    onClose();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const allFilesProcessed = files.length > 0 && files.every(f => 
    f.status === 'completed' || f.status === 'error'
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Subir Comprobante
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Fixed height with scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          {files.length === 0 ? (
            /* File Upload Zone */
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Subir comprobante
              </h3>
              <p className="text-gray-600 mb-4">
                Arrastra y suelta tu archivo aquí, o haz clic para seleccionar
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Formatos soportados: PDF, JPG, PNG (máximo 10MB)
              </p>
              
              <input
                type="file"
                onChange={handleFileInputChange}
                accept="application/pdf,image/jpeg,image/jpg,image/png"
                className="hidden"
                id="file-upload"
                multiple
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                <Upload className="w-4 h-4 mr-2" />
                Seleccionar archivos
              </label>
            </div>
          ) : (
            /* Files Selected and Processing */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}
                </h3>
                {!uploading && (
                  <label
                    htmlFor="file-upload"
                    className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    + Agregar más archivos
                  </label>
                )}
              </div>

              {/* Files List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {files.map((fileStatus, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center">
                      {fileStatus.file.type === 'application/pdf' ? (
                        <FileText className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
                      ) : (
                        <Image className="w-6 h-6 text-green-600 mr-3 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {fileStatus.file.name}
                        </p>
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-gray-600">
                              {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <div className="flex items-center">
                              {fileStatus.status === 'pending' && (
                                <span className="text-sm text-gray-500">Pendiente</span>
                              )}
                              {fileStatus.status === 'uploading' && (
                                <span className="text-sm text-blue-600">Subiendo...</span>
                              )}
                              {fileStatus.status === 'processing' && (
                                <span className="text-sm text-yellow-600">
                                  {fileStatus.progress && `${fileStatus.progress}% - `}
                                  {fileStatus.currentStep || 'Procesando...'}
                                </span>
                              )}
                              {fileStatus.status === 'completed' && (
                                <span className="text-sm text-green-600">Completado</span>
                              )}
                              {fileStatus.status === 'error' && (
                                <span className="text-sm text-red-600">{fileStatus.error || 'Error'}</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Barra de progreso */}
                          {(fileStatus.status === 'uploading' || fileStatus.status === 'processing') && (
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                              <div 
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  fileStatus.status === 'uploading' ? 'bg-blue-600' : 'bg-yellow-600'
                                }`}
                                style={{ width: `${fileStatus.progress || 0}%` }}
                              ></div>
                            </div>
                          )}
                          
                          {fileStatus.status === 'completed' && (
                            <div className="w-full bg-green-200 rounded-full h-2 mb-1">
                              <div className="w-full h-2 bg-green-600 rounded-full"></div>
                            </div>
                          )}
                          
                          {fileStatus.status === 'error' && (
                            <div className="w-full bg-red-200 rounded-full h-2 mb-1">
                              <div className="w-full h-2 bg-red-600 rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-2 flex items-center">
                        {fileStatus.status === 'pending' && !uploading && (
                          <button
                            onClick={() => removeFile(index)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                        {fileStatus.status === 'processing' && (
                          <Clock className="w-5 h-5 text-yellow-500 animate-spin" />
                        )}
                        {fileStatus.status === 'completed' && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                        {fileStatus.status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    </div>

                    {/* Mostrar datos extraidos si está completado */}
                    {fileStatus.status === 'completed' && fileStatus.documento && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Fecha:</span>
                            <span className="ml-2 text-gray-900">
                              {fileStatus.documento.fechaExtraida || '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">CUIT:</span>
                            <span className="ml-2 text-gray-900">
                              {fileStatus.documento.cuitExtraido || '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Importe:</span>
                            <span className="ml-2 text-gray-900">
                              {fileStatus.documento.importeExtraido ? 
                                formatCurrency(fileStatus.documento.importeExtraido) : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Número:</span>
                            <span className="ml-2 text-gray-900">
                              {fileStatus.documento.numeroComprobanteExtraido || '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="flex justify-between items-center space-x-3 p-6 border-t bg-gray-50">
          {allFilesProcessed && (
            <div className="text-sm text-green-600">
              ✓ Todos los archivos han sido procesados
            </div>
          )}
          
          {/* Upload Button - Fixed in footer */}
          {!uploading && files.some(f => f.status === 'pending') && (
            <Button
              onClick={handleUpload}
              className="px-6 py-2"
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Procesar {files.length} Documento{files.length !== 1 ? 's' : ''}
            </Button>
          )}
          
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={uploading && !allFilesProcessed}
          >
            {allFilesProcessed ? 'Cerrar' : 'Cancelar'}
          </Button>
        </div>
      </div>
    </div>
  );
};