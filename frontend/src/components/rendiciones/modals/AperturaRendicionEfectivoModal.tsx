'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SmartSelector } from '@/components/rendiciones/SmartSelector';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface RendicionEfectivoItem {
  id: string;
  rendicionCabeceraId: string;
  resumenTarjetaId?: string;
  rendicionItemId?: string;
  tipoComprobante?: string;
  numeroComprobante?: string;
  fechaComprobante?: string;
  proveedorId?: string;
  tipoProducto?: string;
  codigoProducto?: string;
  netoGravado?: number;
  exento?: number;
  impuestos?: number;
  importeTotal?: number;
  moneda?: string;
  codigoDimension?: string;
  subcuenta?: string;
  observaciones?: string;
  cuentaContable?: string;
  cargaManual: boolean;
  rechazo: boolean;
  motivoRechazo?: string;
  documentoId?: string;
  patente?: string;
  km?: string;
  tipoOrdenCompra?: string;
  ordenCompra?: string;
  estado?: {
    codigo: string;
    descripcion: string;
    color: string;
  };
  documento?: {
    fechaTransaccion?: string;
    razonSocialExtraida?: string;
    importeExtraido?: number;
    cuitExtraido?: string;
    proveedorNombre?: string;
    observaciones?: string;
  };
}

interface AperturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: RendicionEfectivoItem[]) => void;
  item: RendicionEfectivoItem | null;
}

interface AperturaRow {
  id: string;
  tipoProducto: string;
  codigoProducto: string;
  netoGravado: number;
  exento: number;
  impuestos: number;
  codigoDimension: string;
  subcuenta: string;
  cuentaContable: string;
  patente: string;
  km: string;
  tipoOrdenCompra: string;
  ordenCompra: string;
  observaciones: string;
}

export const AperturaRendicionEfectivoModal = ({ isOpen, onClose, onSave, item }: AperturaModalProps) => {
  const [rows, setRows] = useState<AperturaRow[]>([]);
  const [showSmartSelector, setShowSmartSelector] = useState(false);
  const [selectorField, setSelectorField] = useState<{rowId: string, field: string} | null>(null);
  const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });
  const [selectorInitialValue, setSelectorInitialValue] = useState('');
  const [selectorParentValue, setSelectorParentValue] = useState<string | null>(null);
  const [originalRows, setOriginalRows] = useState<AperturaRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [descriptions, setDescriptions] = useState<{[rowId: string]: {[field: string]: string}}>({});
  const [focusedCell, setFocusedCell] = useState<{rowIndex: number, fieldIndex: number} | null>(null);
  const aperturaGridRef = useRef<HTMLTableElement>(null);

  // Calcular totales
  const totalApertura = rows.reduce((sum, row) => {
    return sum + Number(row.netoGravado || 0) + Number(row.exento || 0) + Number(row.impuestos || 0);
  }, 0);

  const totalOriginal = (item?.documento?.importeExtraido || item?.importeTotal || 0);

  // Debug: Log de totales en cada render
  useEffect(() => {
    console.log('Totales calculados:', {
      totalApertura,
      totalOriginal,
      rowsCount: rows.length,
      hasChanges,
      canSave: Math.abs(totalApertura - totalOriginal) < 0.01,
      difference: totalApertura - totalOriginal
    });
  }, [totalApertura, totalOriginal, rows.length, hasChanges]);

  // Determinar color y estado de validación
  const getComparisonStatus = () => {
    const diff = Math.abs(totalApertura - totalOriginal);
    if (diff < 0.01) { // Consideramos iguales si la diferencia es menor a 1 centavo
      return { color: 'text-green-600 bg-green-50', status: 'igual', canSave: true };
    } else if (totalApertura < totalOriginal) {
      return { color: 'text-blue-600 bg-blue-50', status: 'menor', canSave: false };
    } else {
      return { color: 'text-red-600 bg-red-50', status: 'mayor', canSave: false };
    }
  };

  const comparisonStatus = getComparisonStatus();

  // Campos editables en orden de navegación (SIN fecha, tipo, numero, proveedor)
  const editableFields = [
    'tipoProducto', 'codigoProducto', 'netoGravado', 'exento', 'impuestos',
    'codigoDimension', 'subcuenta', 'cuentaContable', 'tipoOrdenCompra',
    'ordenCompra', 'patente', 'km', 'observaciones'
  ];

  // Campos que necesitan SmartSelector (SIN proveedor, tipo_comprobante)
  const fieldsWithSelector = {
    'codigoDimension': 'codigo_dimension',
    'subcuenta': 'subcuenta',
    'cuentaContable': 'cuenta_contable',
    'tipoOrdenCompra': 'tipo_orden_compra',
    'tipoProducto': 'tipo_producto',
    'codigoProducto': 'codigo_producto'
  } as const;

  // Función para generar clave de localStorage
  const getStorageKey = () => {
    if (!item) return null;
    return `apertura_efectivo_changes_${item.id}`;
  };

  // Función para cargar descripciones de una fila
  const loadDescriptionsForRow = async (row: AperturaRow) => {
    const newDescriptions: {[field: string]: string} = {};

    for (const [field, tipoParametro] of Object.entries(fieldsWithSelector)) {
      const fieldValue = row[field as keyof AperturaRow];
      if (fieldValue && typeof fieldValue === 'string') {
        try {
          const response = await api.get('/parametros/maestros', {
            params: {
              tipo_campo: tipoParametro,
              codigo: fieldValue,
              limit: 1
            }
          });
          if (response.data && response.data.length > 0) {
            newDescriptions[field] = response.data[0].nombre;
          }
        } catch (error) {
          console.error(`Error loading description for ${field}:`, error);
        }
      }
    }

    setDescriptions(prev => ({
      ...prev,
      [row.id]: newDescriptions
    }));
  };

  // Cargar datos desde localStorage o inicializar con item original
  useEffect(() => {
    if (item && isOpen) {
      const storageKey = getStorageKey();

      // Intentar cargar desde localStorage primero
      if (storageKey) {
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            const savedRows = parsed.rows || [];
            setRows(savedRows);
            setOriginalRows(parsed.originalRows || []);
            setHasChanges(true);

            console.log('📱 Cargando datos desde localStorage:', { savedRowsCount: savedRows.length });

            // Cargar descripciones para todas las filas guardadas
            Promise.all(savedRows.map((row: AperturaRow) =>
              loadDescriptionsForRow(row)
            )).then(() => {
              console.log('Todas las descripciones cargadas desde localStorage');
            });

            return;
          } catch (error) {
            console.error('Error parsing saved apertura data:', error);
          }
        }
      }

      console.log('📄 Creando fila inicial desde item');

      // Si no hay datos guardados, crear fila inicial con datos del item
      const initialRow: AperturaRow = {
        id: item.id, // Usar el ID del item original para la primera fila
        tipoProducto: item.tipoProducto || '',
        codigoProducto: item.codigoProducto || '',
        netoGravado: item.netoGravado || 0,
        exento: item.exento || 0,
        impuestos: item.impuestos || 0,
        codigoDimension: item.codigoDimension || '',
        subcuenta: item.subcuenta || '',
        cuentaContable: item.cuentaContable || '',
        patente: item.patente || '',
        km: item.km || '',
        tipoOrdenCompra: item.tipoOrdenCompra || '',
        ordenCompra: item.ordenCompra || '',
        observaciones: item.observaciones || ''
      };

      setRows([initialRow]);
      setOriginalRows([initialRow]);
      setHasChanges(false);

      // Cargar descripciones para la fila inicial
      loadDescriptionsForRow(initialRow);
    }
  }, [item, isOpen]);

  // Guardar cambios en localStorage cuando cambian las filas
  useEffect(() => {
    const storageKey = getStorageKey();
    if (storageKey && hasChanges && rows.length > 0) {
      const dataToSave = {
        rows,
        originalRows,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      console.log('💾 Cambios guardados en localStorage');
    }
  }, [rows, hasChanges, originalRows]);

  // Función para agregar una nueva fila
  const addRow = () => {
    const newRow: AperturaRow = {
      id: `new-${Date.now()}`, // ID temporal único
      tipoProducto: '',
      codigoProducto: '',
      netoGravado: 0,
      exento: 0,
      impuestos: 0,
      codigoDimension: '',
      subcuenta: '',
      cuentaContable: '',
      patente: '',
      km: '',
      tipoOrdenCompra: '',
      ordenCompra: '',
      observaciones: ''
    };

    setRows(prevRows => [...prevRows, newRow]);
    setHasChanges(true);
  };

  // Función para eliminar una fila
  const deleteRow = (rowId: string) => {
    if (rows.length <= 1) {
      toast.error('Debe mantener al menos una fila');
      return;
    }

    setRows(prevRows => prevRows.filter(row => row.id !== rowId));
    setDescriptions(prev => {
      const newDescriptions = { ...prev };
      delete newDescriptions[rowId];
      return newDescriptions;
    });
    setHasChanges(true);
  };

  // Función para actualizar una celda
  const updateCell = async (rowId: string, field: string, value: string | number) => {
    setRows(prevRows =>
      prevRows.map(row =>
        row.id === rowId
          ? { ...row, [field]: value }
          : row
      )
    );
    setHasChanges(true);

    // Si es un campo con descripción, cargar la descripción
    if (fieldsWithSelector[field as keyof typeof fieldsWithSelector] && value) {
      try {
        const response = await api.get('/parametros/maestros', {
          params: {
            tipo_campo: fieldsWithSelector[field as keyof typeof fieldsWithSelector],
            codigo: value,
            limit: 1
          }
        });

        if (response.data && response.data.length > 0) {
          setDescriptions(prev => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              [field]: response.data[0].nombre
            }
          }));
        }
      } catch (error) {
        console.error(`Error loading description for ${field}:`, error);
      }
    }

    // Si se cambió código dimensión, limpiar subcuenta
    if (field === 'codigoDimension') {
      setRows(prevRows =>
        prevRows.map(row =>
          row.id === rowId
            ? { ...row, subcuenta: '' }
            : row
        )
      );
      setDescriptions(prev => ({
        ...prev,
        [rowId]: {
          ...prev[rowId],
          subcuenta: ''
        }
      }));
    }
  };

  // Verificar si una fila ha sido modificada
  const hasRowChanges = (row: AperturaRow): boolean => {
    const originalRow = originalRows.find(orig => orig.id === row.id);
    if (!originalRow) {
      // Es una fila nueva
      return true;
    }

    // Comparar campos editables
    const editableFields: (keyof AperturaRow)[] = [
      'tipoProducto', 'codigoProducto', 'netoGravado', 'exento', 'impuestos',
      'codigoDimension', 'subcuenta', 'cuentaContable', 'tipoOrdenCompra',
      'ordenCompra', 'patente', 'km', 'observaciones'
    ];

    return editableFields.some(field => {
      const currentValue = row[field];
      const originalValue = originalRow[field];

      // Para números, convertir a string para comparar
      if (typeof currentValue === 'number' && typeof originalValue === 'number') {
        return currentValue !== originalValue;
      }

      // Para strings
      return String(currentValue || '').trim() !== String(originalValue || '').trim();
    });
  };

  // Función para navegación con teclado en inputs (específica para inputs)
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) => {
    const key = e.key;
    const shiftKey = e.shiftKey;

    // No interferir con SmartSelector
    if (showSmartSelector) return;

    let newRowIndex = rowIndex;
    let newFieldIndex = fieldIndex;

    const editableFields = [
      'tipoProducto', 'codigoProducto', 'netoGravado', 'exento', 'impuestos',
      'codigoDimension', 'subcuenta', 'cuentaContable', 'tipoOrdenCompra',
      'ordenCompra', 'patente', 'km', 'observaciones'
    ];

    switch(key) {
      case 'ArrowUp':
        e.preventDefault();
        newRowIndex = Math.max(0, rowIndex - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newRowIndex = Math.min(rows.length - 1, rowIndex + 1);
        break;
      case 'ArrowLeft':
        // Solo prevenir default si estamos al inicio del input
        if ((e.target as HTMLInputElement).selectionStart === 0) {
          e.preventDefault();
          if (fieldIndex > 0) {
            newFieldIndex = fieldIndex - 1;
          } else if (rowIndex > 0) {
            newRowIndex = rowIndex - 1;
            newFieldIndex = editableFields.length - 1;
          }
        }
        break;
      case 'ArrowRight':
        // Solo prevenir default si estamos al final del input
        const input = e.target as HTMLInputElement;
        if (input.selectionEnd === input.value.length) {
          e.preventDefault();
          if (fieldIndex < editableFields.length - 1) {
            newFieldIndex = fieldIndex + 1;
          } else if (rowIndex < rows.length - 1) {
            newRowIndex = rowIndex + 1;
            newFieldIndex = 0;
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (shiftKey) {
          // Shift+Enter: ir arriba
          newRowIndex = Math.max(0, rowIndex - 1);
        } else {
          // Enter: ir abajo
          newRowIndex = Math.min(rows.length - 1, rowIndex + 1);
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (shiftKey) {
          // Shift+Tab: ir a la izquierda
          if (fieldIndex > 0) {
            newFieldIndex = fieldIndex - 1;
          } else if (rowIndex > 0) {
            newRowIndex = rowIndex - 1;
            newFieldIndex = editableFields.length - 1;
          }
        } else {
          // Tab: ir a la derecha
          if (fieldIndex < editableFields.length - 1) {
            newFieldIndex = fieldIndex + 1;
          } else if (rowIndex < rows.length - 1) {
            newRowIndex = rowIndex + 1;
            newFieldIndex = 0;
          }
        }
        break;
      default:
        return; // No hacer nada para otras teclas
    }

    // Enfocar la nueva celda
    if (newRowIndex !== rowIndex || newFieldIndex !== fieldIndex) {
      focusCellByIndex(newRowIndex, newFieldIndex);
    }
  };

  // Navegación por teclado global
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || showSmartSelector) return;

      // Solo manejar si el foco está en la tabla
      const activeElement = document.activeElement;
      if (!activeElement || !aperturaGridRef.current?.contains(activeElement)) return;

      const currentRowIndex = focusedCell?.rowIndex ?? 0;
      const currentFieldIndex = focusedCell?.fieldIndex ?? 0;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentRowIndex < rows.length - 1) {
            const newRowIndex = currentRowIndex + 1;
            setFocusedCell({ rowIndex: newRowIndex, fieldIndex: currentFieldIndex });
            focusCellByIndex(newRowIndex, currentFieldIndex);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (currentRowIndex > 0) {
            const newRowIndex = currentRowIndex - 1;
            setFocusedCell({ rowIndex: newRowIndex, fieldIndex: currentFieldIndex });
            focusCellByIndex(newRowIndex, currentFieldIndex);
          }
          break;

        case 'ArrowRight':
        case 'Tab':
          if (!e.shiftKey) {
            e.preventDefault();
            let newFieldIndex = currentFieldIndex + 1;
            let newRowIndex = currentRowIndex;

            if (newFieldIndex >= editableFields.length) {
              newFieldIndex = 0;
              newRowIndex = Math.min(currentRowIndex + 1, rows.length - 1);
            }

            setFocusedCell({ rowIndex: newRowIndex, fieldIndex: newFieldIndex });
            focusCellByIndex(newRowIndex, newFieldIndex);
          }
          break;

        case 'ArrowLeft':
          if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            let newFieldIndex = currentFieldIndex - 1;
            let newRowIndex = currentRowIndex;

            if (newFieldIndex < 0) {
              newFieldIndex = editableFields.length - 1;
              newRowIndex = Math.max(currentRowIndex - 1, 0);
            }

            setFocusedCell({ rowIndex: newRowIndex, fieldIndex: newFieldIndex });
            focusCellByIndex(newRowIndex, newFieldIndex);
          }
          break;

        case 'Enter':
          e.preventDefault();
          // Abrir SmartSelector si es un campo que lo requiere
          const field = editableFields[currentFieldIndex];
          if (fieldsWithSelector[field as keyof typeof fieldsWithSelector]) {
            const row = rows[currentRowIndex];
            const element = document.activeElement as HTMLElement;
            openSmartSelector(row.id, field, element);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, showSmartSelector, focusedCell, rows, editableFields]);

  // Función para enfocar una celda por índices
  const focusCellByIndex = (rowIndex: number, fieldIndex: number) => {
    setTimeout(() => {
      const row = rows[rowIndex];
      const field = editableFields[fieldIndex];
      if (row && field) {
        const cellElement = document.querySelector(`[data-cell="${row.id}-${field}"]`) as HTMLElement;
        cellElement?.focus();
      }
    }, 0);
  };

  // Abrir SmartSelector
  const openSmartSelector = (rowId: string, field: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const selectorHeight = 400;

    let x = rect.left;
    let y;

    if (spaceBelow >= selectorHeight) {
      y = rect.bottom + window.scrollY;
    } else if (spaceAbove >= selectorHeight) {
      y = rect.top + window.scrollY - selectorHeight;
    } else {
      y = rect.bottom + window.scrollY;
    }

    setSelectorPosition({ x, y });

    const row = rows.find(r => r.id === rowId);
    setSelectorInitialValue((row?.[field as keyof AperturaRow] as string) || '');
    setSelectorField({ rowId, field });

    // Si es subcuenta, necesita el valor del código dimensión como padre
    if (field === 'subcuenta') {
      setSelectorParentValue((row?.codigoDimension as string) || null);
    } else {
      setSelectorParentValue(null);
    }

    setShowSmartSelector(true);
  };

  // Manejar selección del SmartSelector
  const handleSelectorSelect = (codigo: string, nombre: string) => {
    if (selectorField) {
      updateCell(selectorField.rowId, selectorField.field, codigo);

      setDescriptions(prev => ({
        ...prev,
        [selectorField.rowId]: {
          ...prev[selectorField.rowId],
          [selectorField.field]: nombre
        }
      }));
    }
    setShowSmartSelector(false);
    setSelectorField(null);
  };

  // Cerrar SmartSelector
  const handleSelectorClose = () => {
    setShowSmartSelector(false);
    setSelectorField(null);
  };

  // Manejar cierre del modal
  const handleClose = () => {
    const storageKey = getStorageKey();
    if (storageKey && hasChanges) {
      // Mantener los cambios en localStorage para recuperarlos después
      console.log('📱 Manteniendo cambios en localStorage para recuperación futura');
    }
    onClose();
  };

  // Manejar cancelar cambios
  const handleCancel = () => {
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.removeItem(storageKey);
      console.log('🗑️ Cambios cancelados y eliminados de localStorage');
    }
    onClose();
  };

  // Manejar guardar
  const handleSave = async () => {
    if (!comparisonStatus.canSave) {
      toast.error('Los totales no coinciden. No se puede guardar.');
      return;
    }

    if (rows.length === 0) {
      toast.error('Debe tener al menos una fila');
      return;
    }

    try {
      // TODO: Implementar llamada a API para guardar
      console.log('💾 Guardando apertura:', { rows, totalApertura, totalOriginal });

      // Limpiar localStorage después de guardar exitosamente
      const storageKey = getStorageKey();
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }

      toast.success('Apertura guardada correctamente');
      onClose();
    } catch (error) {
      console.error('Error saving apertura:', error);
      toast.error('Error al guardar la apertura');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('es-AR');
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
    return dateString;
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header del modal */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">Editar Apertura de Item - Efectivo</h2>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span><strong>Fecha:</strong> {formatDate(item.documento?.fechaTransaccion || item.fechaComprobante)}</span>
                  <span><strong>Número:</strong> {item.numeroComprobante || '-'}</span>
                  <span><strong>Proveedor:</strong> {item.documento?.razonSocialExtraida || item.documento?.proveedorNombre || '-'}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span><strong>Importe Original:</strong> {formatCurrency(totalOriginal)}</span>
                  <span className="ml-4"><strong>Total Apertura:</strong> <span className={comparisonStatus.color}>{formatCurrency(totalApertura)}</span></span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Contenido del modal */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Botón para agregar fila */}
            <div className="flex justify-between items-center">
              <Button
                onClick={addRow}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Agregar Fila
              </Button>
              <div className={`px-3 py-2 rounded-lg text-sm font-medium ${comparisonStatus.color}`}>
                {comparisonStatus.status === 'igual' && 'Totales coinciden ✓'}
                {comparisonStatus.status === 'menor' && `Falta: ${formatCurrency(totalOriginal - totalApertura)}`}
                {comparisonStatus.status === 'mayor' && `Exceso: ${formatCurrency(totalApertura - totalOriginal)}`}
              </div>
            </div>

            {/* Tabla de apertura */}
            <div className="overflow-x-auto">
              <table ref={aperturaGridRef} className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Acciones</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Producto</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Producto</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Neto Gravado</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exento</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impuestos</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cód. Dimensión</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subcuenta</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cuenta Contable</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo OC</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden Compra</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patente</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KM</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row, rowIndex) => {
                    // Determinar si la fila ha sido modificada
                    const hasChanges = hasRowChanges(row);

                    const rowClassName = `hover:bg-gray-50 transition-colors ${
                      hasChanges ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''
                    }`;

                    return (
                    <tr key={row.id} className={rowClassName}>
                      {/* Acciones */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRow(row.id)}
                          disabled={rows.length <= 1}
                          className="h-8 w-8 text-red-600 hover:text-red-900 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>

                      {/* Tipo Producto */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="relative group">
                          <div className="flex flex-col">
                            <input
                              id={`cell-${row.id}-tipoProducto`}
                              type="text"
                              value={row.tipoProducto}
                              onChange={(e) => updateCell(row.id, 'tipoProducto', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                              className="w-48 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                              placeholder="Código"
                            />
                            {descriptions[row.id]?.tipoProducto && (
                              <span className="text-xs text-gray-500 px-1 truncate w-48">
                                {descriptions[row.id].tipoProducto}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => openSmartSelector(row.id, 'tipoProducto', e.currentTarget)}
                            className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Código Producto */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="relative group">
                          <div className="flex flex-col">
                            <input
                              id={`cell-${row.id}-codigoProducto`}
                              type="text"
                              value={row.codigoProducto}
                              onChange={(e) => updateCell(row.id, 'codigoProducto', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
                              className="w-48 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                              placeholder="Código"
                            />
                            {descriptions[row.id]?.codigoProducto && (
                              <span className="text-xs text-gray-500 px-1 truncate w-48">
                                {descriptions[row.id].codigoProducto}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => openSmartSelector(row.id, 'codigoProducto', e.currentTarget)}
                            className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                        </div>
                      </td>

                      {/* Neto Gravado */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <input
                          id={`cell-${row.id}-netoGravado`}
                          type="number"
                          step="0.01"
                          value={row.netoGravado}
                          onChange={(e) => updateCell(row.id, 'netoGravado', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 3)}
                          className="w-24 px-1 py-0.5 text-sm bg-transparent focus:outline-none text-right"
                          placeholder="0.00"
                        />
                      </td>

                      {/* Exento */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <input
                          id={`cell-${row.id}-exento`}
                          type="number"
                          step="0.01"
                          value={row.exento}
                          onChange={(e) => updateCell(row.id, 'exento', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 4)}
                          className="w-24 px-1 py-0.5 text-sm bg-transparent focus:outline-none text-right"
                          placeholder="0.00"
                        />
                      </td>

                      {/* Impuestos */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <input
                          id={`cell-${row.id}-impuestos`}
                          type="number"
                          step="0.01"
                          value={row.impuestos}
                          onChange={(e) => updateCell(row.id, 'impuestos', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 5)}
                          className="w-24 px-1 py-0.5 text-sm bg-transparent focus:outline-none text-right"
                          placeholder="0.00"
                        />
                      </td>

                      {/* Total */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="w-24 px-1 py-0.5 text-sm font-semibold text-right bg-gray-50 rounded">
                          {new Intl.NumberFormat('es-AR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(
                            Number(row.netoGravado || 0) +
                            Number(row.exento || 0) +
                            Number(row.impuestos || 0)
                          )}
                        </div>
                      </td>

                      {/* Código Dimensión */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="relative group">
                          <div className="flex flex-col">
                            <input
                              id={`cell-${row.id}-codigoDimension`}
                              type="text"
                              value={row.codigoDimension}
                              onChange={(e) => updateCell(row.id, 'codigoDimension', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, 6)}
                              className="w-48 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                              placeholder="Código"
                            />
                            {descriptions[row.id]?.codigoDimension && (
                              <span className="text-xs text-gray-500 px-1 truncate w-48">
                                {descriptions[row.id].codigoDimension}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => openSmartSelector(row.id, 'codigoDimension', e.currentTarget)}
                            className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Subcuenta */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="relative group">
                          <div className="flex flex-col">
                            <input
                              id={`cell-${row.id}-subcuenta`}
                              type="text"
                              value={row.subcuenta}
                              onChange={(e) => updateCell(row.id, 'subcuenta', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, 7)}
                              disabled={!row.codigoDimension}
                              className="w-48 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none disabled:opacity-50"
                              placeholder="Código"
                            />
                            {descriptions[row.id]?.subcuenta && (
                              <span className="text-xs text-gray-500 px-1 truncate w-48">
                                {descriptions[row.id].subcuenta}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => openSmartSelector(row.id, 'subcuenta', e.currentTarget)}
                            disabled={!row.codigoDimension}
                            className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-25"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Cuenta Contable */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="relative group">
                          <div className="flex flex-col">
                            <input
                              id={`cell-${row.id}-cuentaContable`}
                              type="text"
                              value={row.cuentaContable}
                              onChange={(e) => updateCell(row.id, 'cuentaContable', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, 8)}
                              className="w-48 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                              placeholder="Código"
                            />
                            {descriptions[row.id]?.cuentaContable && (
                              <span className="text-xs text-gray-500 px-1 truncate w-48">
                                {descriptions[row.id].cuentaContable}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => openSmartSelector(row.id, 'cuentaContable', e.currentTarget)}
                            className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Tipo Orden Compra */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="relative group">
                          <div className="flex flex-col">
                            <input
                              id={`cell-${row.id}-tipoOrdenCompra`}
                              type="text"
                              value={row.tipoOrdenCompra}
                              onChange={(e) => updateCell(row.id, 'tipoOrdenCompra', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, 9)}
                              className="w-40 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                              placeholder="Código"
                            />
                            {descriptions[row.id]?.tipoOrdenCompra && (
                              <span className="text-xs text-gray-500 px-1 truncate w-40">
                                {descriptions[row.id].tipoOrdenCompra}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => openSmartSelector(row.id, 'tipoOrdenCompra', e.currentTarget)}
                            className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Orden Compra */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <input
                          id={`cell-${row.id}-ordenCompra`}
                          type="text"
                          value={row.ordenCompra}
                          onChange={(e) => updateCell(row.id, 'ordenCompra', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 10)}
                          className="w-28 px-1 py-0.5 text-sm bg-transparent focus:outline-none"
                          placeholder="Orden"
                        />
                      </td>

                      {/* Patente */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <input
                          id={`cell-${row.id}-patente`}
                          type="text"
                          value={row.patente}
                          onChange={(e) => updateCell(row.id, 'patente', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 11)}
                          className="w-24 px-1 py-0.5 text-sm bg-transparent focus:outline-none uppercase"
                          placeholder="ABC123"
                        />
                      </td>

                      {/* KM */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <input
                          id={`cell-${row.id}-km`}
                          type="text"
                          value={row.km}
                          onChange={(e) => updateCell(row.id, 'km', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 12)}
                          className="w-20 px-1 py-0.5 text-sm bg-transparent focus:outline-none text-right"
                          placeholder="0"
                        />
                      </td>

                      {/* Observaciones */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <input
                          id={`cell-${row.id}-observaciones`}
                          type="text"
                          value={row.observaciones}
                          onChange={(e) => updateCell(row.id, 'observaciones', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 13)}
                          className="w-48 px-1 py-0.5 text-sm bg-transparent focus:outline-none"
                          placeholder="Observaciones..."
                        />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer del modal */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!comparisonStatus.canSave}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar Apertura
          </Button>
        </div>
      </div>

      {/* SmartSelector para campos con FK */}
      {showSmartSelector && selectorField && (
        <SmartSelector
          value={selectorInitialValue}
          fieldType={fieldsWithSelector[selectorField.field as keyof typeof fieldsWithSelector]!}
          parentValue={selectorParentValue}
          onSelect={handleSelectorSelect}
          onClose={handleSelectorClose}
          position={selectorPosition}
        />
      )}
    </div>
  );
};