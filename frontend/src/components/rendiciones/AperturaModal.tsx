'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash2, ChevronDown, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SmartSelector } from '@/components/rendiciones/SmartSelector';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

// Interface para RendicionItem - importar desde types si existe
interface RendicionItem {
  id: string;
  rendicionCabeceraId: string;
  resumenTarjetaId: string;
  tipoComprobante?: string;
  numeroComprobante?: string;
  fechaComprobante?: string;
  proveedorId?: string;
  tipoProducto?: string;
  codigoProducto?: string;
  netoGravado?: number;
  exento?: number;
  impuestos?: number;
  moneda?: string;
  codigoDimension?: string;
  subcuenta?: string;
  observaciones?: string;
  cuentaContable?: string;
  cargaManual: boolean;
  rechazo: boolean;
  motivoRechazo?: string;
  patente?: string;
  km?: string;
  tipoOrdenCompra?: string;
  ordenCompra?: string;
  resumenTarjeta: {
    fechaTransaccion?: string;
    numeroCupon?: string;
    descripcionCupon?: string;
    importeTransaccion?: number;
  };
  aperturaDetails?: any[];
  hasAperturaDetails?: boolean;
}

export interface AperturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: RendicionItem[]) => void;
  item: RendicionItem | null;
}

export interface AperturaRow {
  id: string;
  tipoComprobante: string;
  numeroComprobante: string;
  fechaComprobante: string;
  proveedorId: string;
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

export const AperturaModal = ({ isOpen, onClose, onSave, item }: AperturaModalProps) => {
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

  // Función auxiliar para convertir fecha ISO a formato YYYY-MM-DD para input date
  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';

    try {
      // Si viene como string ISO con timestamp
      if (dateString.includes('T')) {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          // Formatear como YYYY-MM-DD
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      // Si ya está en formato YYYY-MM-DD, devolverlo tal cual
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
    } catch (error) {
      console.error('Error formatting date for input:', error);
    }

    return dateString || '';
  };

  // Calcular totales
  const totalApertura = rows.reduce((sum, row) => {
    return sum + Number(row.netoGravado || 0) + Number(row.exento || 0) + Number(row.impuestos || 0);
  }, 0);

  const totalOriginal = (item?.resumenTarjeta?.importeTransaccion || 0);

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

  // Campos editables en orden de navegación
  const editableFields = [
    'tipoComprobante', 'numeroComprobante', 'fechaComprobante', 'proveedorId',
    'tipoProducto', 'codigoProducto', 'netoGravado', 'exento', 'impuestos',
    'codigoDimension', 'subcuenta', 'cuentaContable', 'tipoOrdenCompra',
    'ordenCompra', 'patente', 'km', 'observaciones'
  ];

  // Campos que necesitan SmartSelector
  const fieldsWithSelector = {
    'proveedorId': 'proveedor',
    'codigoDimension': 'codigo_dimension',
    'subcuenta': 'subcuenta',
    'cuentaContable': 'cuenta_contable',
    'tipoOrdenCompra': 'tipo_orden_compra',
    'tipoComprobante': 'tipo_comprobante',
    'tipoProducto': 'tipo_producto',
    'codigoProducto': 'codigo_producto'
  } as const;

  // Función para generar clave de localStorage
  const getStorageKey = () => {
    if (!item) return null;
    return `apertura_changes_${item.id}`;
  };

  // Cargar datos desde localStorage, base de datos o inicializar con item original
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

      // ✅ NUEVA FUNCIONALIDAD: Usar datos precargados en lugar de llamada API
      const loadFromPrecargados = async () => {
        // Verificar si hay datos de apertura precargados
        if (item.hasAperturaDetails && item.aperturaDetails && item.aperturaDetails.length > 0) {
          console.log('🚀 Usando datos de apertura precargados:', {
            rowsCount: item.aperturaDetails.length,
            firstRow: item.aperturaDetails[0]
          });

          setRows(item.aperturaDetails);
          setOriginalRows(item.aperturaDetails);
          setHasChanges(false); // No hay cambios cuando cargamos datos precargados

          // Cargar descripciones para todas las filas precargadas
          Promise.all(item.aperturaDetails.map((row: AperturaRow) =>
            loadDescriptionsForRow(row)
          )).then(() => {
            console.log('Todas las descripciones cargadas desde datos precargados');
          });

          return;
        }

        console.log('📄 No hay datos de apertura precargados, creando fila inicial');

        // Si no hay datos precargados, crear fila inicial con datos del item
        const initialRow: AperturaRow = {
          id: item.id, // Usar el ID del item original para la primera fila
          tipoComprobante: item.tipoComprobante || '',
          numeroComprobante: item.numeroComprobante || '',
          fechaComprobante: formatDateForInput(item.fechaComprobante),
          proveedorId: item.proveedorId || '',
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

        console.log('📝 Fila inicial creada:', initialRow);

        // Cargar las descripciones para la fila inicial - esperar a que termine
        loadDescriptionsForRow(initialRow).then(() => {
          console.log('Descripciones cargadas para fila inicial:', initialRow.id);
        });
      };

      loadFromPrecargados();
    }
  }, [item, isOpen]);

  // Guardar en localStorage cuando cambian las filas
  useEffect(() => {
    if (!item || !isOpen || rows.length === 0) return;

    const storageKey = getStorageKey();
    if (!storageKey) return;

    // Verificar si hay cambios comparando con las filas originales
    const hasAnyChange = JSON.stringify(rows) !== JSON.stringify(originalRows);
    setHasChanges(hasAnyChange);

    if (hasAnyChange) {
      // Guardar en localStorage
      const dataToSave = {
        rows,
        originalRows,
        itemId: item.id,
        timestamp: new Date().toISOString(),
        totalApertura, // Guardar el total para referencia
        totalOriginal // Guardar el total original para referencia
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    } else {
      // Si no hay cambios, eliminar del localStorage
      localStorage.removeItem(storageKey);
    }
  }, [rows, originalRows, item, isOpen, totalApertura, totalOriginal]);

  // Función para formatear fecha
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    if (dateString.length === 6) {
      const day = dateString.substring(0, 2);
      const month = dateString.substring(2, 4);
      const year = '20' + dateString.substring(4, 6);
      return `${day}/${month}/${year}`;
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
  };

  // Agregar nueva fila clonando los datos del item principal
  const addRow = async () => {
    if (!item) return;

    // Clonar los datos de la primera fila (item original)
    const firstRow = rows[0] || item;
    const newRow: AperturaRow = {
      id: `new-${Date.now()}`, // ID temporal para nuevas filas
      tipoComprobante: firstRow.tipoComprobante || '',
      numeroComprobante: firstRow.numeroComprobante || '',
      fechaComprobante: firstRow.fechaComprobante || '',
      proveedorId: firstRow.proveedorId || '',
      tipoProducto: firstRow.tipoProducto || '',
      codigoProducto: firstRow.codigoProducto || '',
      netoGravado: 0, // Nuevo registro inicia en 0
      exento: 0,
      impuestos: 0,
      codigoDimension: firstRow.codigoDimension || '',
      subcuenta: firstRow.subcuenta || '',
      cuentaContable: firstRow.cuentaContable || '',
      patente: firstRow.patente || '',
      km: firstRow.km || '',
      tipoOrdenCompra: firstRow.tipoOrdenCompra || '',
      ordenCompra: firstRow.ordenCompra || '',
      observaciones: firstRow.observaciones || ''
    };

    // Agregar la nueva fila al estado
    setRows([...rows, newRow]);

    // Marcar que hay cambios para habilitar el botón Guardar
    setHasChanges(true);

    // Debug: Log de totales después de agregar fila
    console.log('Nueva fila agregada:', {
      newRowId: newRow.id,
      totalRowsCount: rows.length + 1,
      newRowValues: {
        netoGravado: newRow.netoGravado,
        exento: newRow.exento,
        impuestos: newRow.impuestos
      }
    });

    // Cargar las descripciones para la nueva fila
    // También copiar las descripciones de la primera fila para los mismos valores
    if (descriptions[firstRow.id]) {
      setDescriptions(prev => ({
        ...prev,
        [newRow.id]: { ...descriptions[firstRow.id] }
      }));
    } else {
      await loadDescriptionsForRow(newRow);
    }
  };

  // Eliminar fila
  const deleteRow = (rowId: string) => {
    if (rows.length > 1) { // No permitir eliminar si solo hay una fila
      setRows(rows.filter(r => r.id !== rowId));
    }
  };

  // Actualizar valor de celda
  const updateCell = (rowId: string, field: string, value: any) => {
    setRows(prevRows => prevRows.map(row =>
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  };

  // Manejar navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) => {
    const key = e.key;
    const shiftKey = e.shiftKey;

    // No interferir con SmartSelector
    if (showSmartSelector) return;

    let newRowIndex = rowIndex;
    let newFieldIndex = fieldIndex;

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
      focusCell(newRowIndex, newFieldIndex);
    }
  };

  // Enfocar una celda específica
  const focusCell = (rowIndex: number, fieldIndex: number) => {
    setFocusedCell({ rowIndex, fieldIndex });

    // Usar setTimeout para asegurar que el DOM esté actualizado
    setTimeout(() => {
      const fieldName = editableFields[fieldIndex];
      const rowId = rows[rowIndex]?.id;
      if (!rowId) return;

      // Buscar el input o botón correspondiente
      const cellId = `cell-${rowId}-${fieldName}`;
      const element = document.getElementById(cellId);

      if (element) {
        if (element.tagName === 'INPUT') {
          (element as HTMLInputElement).focus();
          (element as HTMLInputElement).select();
        } else if (element.tagName === 'BUTTON') {
          element.focus();
        }
      }
    }, 0);
  };

  // Abrir SmartSelector
  const openSmartSelector = (rowId: string, field: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let position = { x: rect.left, y: 0 };

    if (spaceBelow >= 400 || spaceBelow > spaceAbove) {
      position.y = rect.bottom + 5;
    } else {
      position.y = rect.top - 405;
    }

    setSelectorPosition(position);
    setSelectorField({ rowId, field });

    const row = rows.find(r => r.id === rowId);
    if (row) {
      setSelectorInitialValue(row[field as keyof AperturaRow] as string || '');

      // Manejar relación padre-hijo para subcuenta
      if (field === 'subcuenta') {
        setSelectorParentValue(row.codigoDimension || null);
      } else {
        setSelectorParentValue(null);
      }
    }

    setShowSmartSelector(true);
  };

  // Función para cargar descripciones de los campos con valores de una fila específica
  const loadDescriptionsForRow = async (row: AperturaRow) => {
    const newDescriptions: {[field: string]: string} = {};

    for (const [field, tipoParametro] of Object.entries(fieldsWithSelector)) {
      const fieldValue = row[field as keyof AperturaRow];
      if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '') {
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

    if (Object.keys(newDescriptions).length > 0) {
      setDescriptions(prev => ({
        ...prev,
        [row.id]: {
          ...prev[row.id],
          ...newDescriptions
        }
      }));
    }
  };

  // Manejar selección del SmartSelector
  const handleSelectorSelect = (codigo: string, nombre: string) => {
    if (selectorField) {
      // Actualizar el valor del campo con el código seleccionado
      updateCell(selectorField.rowId, selectorField.field, codigo);

      // Guardar la descripción/nombre
      setDescriptions(prev => ({
        ...prev,
        [selectorField.rowId]: {
          ...prev[selectorField.rowId],
          [selectorField.field]: nombre
        }
      }));

      // Si se cambia código dimensión, limpiar subcuenta
      if (selectorField.field === 'codigoDimension') {
        updateCell(selectorField.rowId, 'subcuenta', '');
        // Limpiar descripción de subcuenta
        setDescriptions(prev => ({
          ...prev,
          [selectorField.rowId]: {
            ...prev[selectorField.rowId],
            subcuenta: ''
          }
        }));
      }
    }
    setShowSmartSelector(false);
    setSelectorField(null);
  };

  // Cerrar modal y mantener cambios en localStorage
  const handleClose = () => {
    // Los cambios ya están guardados en localStorage
    // Solo cerrar el modal sin limpiar
    onClose();
  };

  // Cancelar y descartar cambios
  const handleCancel = () => {
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    setRows(originalRows);
    setHasChanges(false);
    onClose();
  };

  // Aplicar cambios (guardar directamente con el endpoint de apertura)
  const handleApplyChanges = async () => {
    console.log('🔄 handleApplyChanges ejecutado - nueva versión con endpoint directo');
    console.log('Estado del botón:', {
      hasChanges,
      comparisonStatus,
      totalApertura,
      totalOriginal,
      difference: totalApertura - totalOriginal
    });

    if (!item) {
      console.log('❌ No hay item, retornando');
      return;
    }

    // Validar que los totales coincidan
    if (!comparisonStatus.canSave) {
      console.log('❌ No se puede guardar, los totales no coinciden');
      if (comparisonStatus.status === 'menor') {
        toast.error(`No se puede guardar: Falta ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalOriginal - totalApertura)}`);
      } else if (comparisonStatus.status === 'mayor') {
        toast.error(`No se puede guardar: Excede ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalApertura - totalOriginal)}`);
      }
      return;
    }

    console.log('✅ Validación pasada, guardando apertura directamente...');

    try {
      // Preparar datos para el endpoint de apertura
      const aperturaData = rows.map(row => ({
        tipoComprobante: row.tipoComprobante || '',
        numeroComprobante: row.numeroComprobante || '',
        fechaComprobante: row.fechaComprobante || null,
        proveedorId: row.proveedorId || '',
        tipoProducto: row.tipoProducto || '',
        codigoProducto: row.codigoProducto || '',
        netoGravado: Number(row.netoGravado) || 0,
        exento: Number(row.exento) || 0,
        moneda: 'PESOS',
        codigoDimension: row.codigoDimension || '',
        subcuenta: row.subcuenta || '',
        observaciones: row.observaciones || '',
        cuentaContable: row.cuentaContable || '',
        cargaManual: false,
        rechazo: false,
        motivoRechazo: '',
        patente: row.patente || '',
        km: Number(row.km) || 0,
        tipoOrdenCompra: row.tipoOrdenCompra || '',
        ordenCompra: row.ordenCompra || ''
      }));

      console.log('🚀 Enviando apertura al endpoint:', {
        rendicionItemId: item.id,
        changesCount: aperturaData.length
      });

      // Llamar al endpoint de apertura
      const response = await api.post('/rendiciones/apertura/save', {
        rendicionItemId: item.id,
        changes: aperturaData
      });

      if (response.data.success) {
        console.log('✅ Apertura guardada exitosamente:', response.data.message);

        // Limpiar localStorage de apertura
        const storageKey = getStorageKey();
        if (storageKey) {
          localStorage.removeItem(storageKey);
        }

        // Notificar éxito
        toast.success('Apertura guardada correctamente en la base de datos');

        // Llamar onSave para notificar al componente padre
        onSave(rows.map(row => ({ ...item } as RendicionItem)));

        // Cerrar el modal
        onClose();
      } else {
        console.error('❌ Error guardando apertura:', response.data.error);
        toast.error(`Error guardando apertura: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error('❌ Error en handleApplyChanges:', error);
      toast.error(`Error guardando apertura: ${error.response?.data?.error || error.message}`);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-[108rem] mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header del modal */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">Editar Apertura de Item</h2>
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span><strong>Fecha:</strong> {formatDate(item.resumenTarjeta.fechaTransaccion)}</span>
                  <span><strong>Cupón:</strong> {item.resumenTarjeta.numeroCupon || '-'}</span>
                  <span><strong>Importe Original:</strong> {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalOriginal)}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span><strong>Descripción:</strong> {item.resumenTarjeta.descripcionCupon || '-'}</span>
                </div>

                {/* Acumulador de totales */}
                <div className="flex items-center gap-4 mt-2 p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Total Apertura:</span>
                    <span className={`text-lg font-bold px-3 py-1 rounded ${comparisonStatus.color}`}>
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalApertura)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {comparisonStatus.status === 'igual' && (
                      <span className="text-green-600 font-medium">✓ Totales coinciden</span>
                    )}
                    {comparisonStatus.status === 'menor' && (
                      <span className="text-blue-600 font-medium">Falta: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalOriginal - totalApertura)}</span>
                    )}
                    {comparisonStatus.status === 'mayor' && (
                      <span className="text-red-600 font-medium">Excede: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalApertura - totalOriginal)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Contenido - Grilla */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-4">
            <Button
              onClick={addRow}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Fila
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Acciones
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo Comprobante
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nro Comprobante
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo Producto
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código Producto
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Neto Gravado
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Exento
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Impuestos
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cód. Dimensión
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subcuenta
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cuenta Contable
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo OC
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Orden Compra
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patente
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    KM
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Observaciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, rowIndex) => (
                  <tr key={row.id} className="hover:bg-gray-50">
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
                    {/* Tipo Comprobante con SmartSelector */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="relative group">
                        <div className="flex flex-col">
                          <input
                            id={`cell-${row.id}-tipoComprobante`}
                            type="text"
                            value={row.tipoComprobante}
                            onChange={(e) => updateCell(row.id, 'tipoComprobante', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                            className="w-48 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                            placeholder="Código"
                          />
                          {descriptions[row.id]?.tipoComprobante && (
                            <span className="text-xs text-gray-500 px-1 truncate w-48">
                              {descriptions[row.id].tipoComprobante}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => openSmartSelector(row.id, 'tipoComprobante', e.currentTarget)}
                          className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        id={`cell-${row.id}-numeroComprobante`}
                        type="text"
                        value={row.numeroComprobante}
                        onChange={(e) => updateCell(row.id, 'numeroComprobante', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                        className="w-32 px-1 py-0.5 text-sm bg-transparent focus:outline-none"
                        placeholder="Número"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        id={`cell-${row.id}-fechaComprobante`}
                        type="date"
                        value={row.fechaComprobante}
                        onChange={(e) => updateCell(row.id, 'fechaComprobante', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
                        className="w-32 px-1 py-0.5 text-sm bg-transparent focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="relative group">
                        <div className="flex flex-col">
                          <input
                            id={`cell-${row.id}-proveedorId`}
                            type="text"
                            value={row.proveedorId}
                            onChange={(e) => updateCell(row.id, 'proveedorId', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, 3)}
                            className="w-48 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                            placeholder="Código"
                          />
                          {descriptions[row.id]?.proveedorId && (
                            <span className="text-xs text-gray-500 px-1 truncate w-48">
                              {descriptions[row.id].proveedorId}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => openSmartSelector(row.id, 'proveedorId', e.currentTarget)}
                          className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="relative group">
                        <div className="flex flex-col">
                          <input
                            id={`cell-${row.id}-tipoProducto`}
                            type="text"
                            value={row.tipoProducto}
                            onChange={(e) => updateCell(row.id, 'tipoProducto', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, 4)}
                            className="w-48 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                            placeholder="Tipo"
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
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="relative group">
                        <div className="flex flex-col">
                          <input
                            id={`cell-${row.id}-codigoProducto`}
                            type="text"
                            value={row.codigoProducto}
                            onChange={(e) => updateCell(row.id, 'codigoProducto', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, 5)}
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
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        id={`cell-${row.id}-netoGravado`}
                        type="number"
                        step="0.01"
                        value={row.netoGravado}
                        onChange={(e) => updateCell(row.id, 'netoGravado', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 6)}
                        className="w-24 px-1 py-0.5 text-sm bg-transparent focus:outline-none text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        id={`cell-${row.id}-exento`}
                        type="number"
                        step="0.01"
                        value={row.exento}
                        onChange={(e) => updateCell(row.id, 'exento', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 7)}
                        className="w-24 px-1 py-0.5 text-sm bg-transparent focus:outline-none text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        id={`cell-${row.id}-impuestos`}
                        type="number"
                        step="0.01"
                        value={row.impuestos}
                        onChange={(e) => updateCell(row.id, 'impuestos', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 8)}
                        className="w-24 px-1 py-0.5 text-sm bg-transparent focus:outline-none text-right"
                        placeholder="0.00"
                      />
                    </td>
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
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="relative group">
                        <div className="flex flex-col">
                          <input
                            id={`cell-${row.id}-codigoDimension`}
                            type="text"
                            value={row.codigoDimension}
                            onChange={(e) => {
                              updateCell(row.id, 'codigoDimension', e.target.value);
                              // Si se borra el código de dimensión, limpiar subcuenta
                              if (!e.target.value) {
                                updateCell(row.id, 'subcuenta', '');
                                setDescriptions(prev => ({
                                  ...prev,
                                  [row.id]: {
                                    ...prev[row.id],
                                    codigoDimension: '',
                                    subcuenta: ''
                                  }
                                }));
                              }
                            }}
                            onBlur={async (e) => {
                              // Al salir del campo, intentar cargar la descripción si hay un valor
                              const value = e.target.value.trim();
                              if (value) {
                                try {
                                  const response = await api.get('/parametros/maestros', {
                                    params: {
                                      tipo_campo: 'codigo_dimension',
                                      codigo: value,
                                      limit: 1
                                    }
                                  });
                                  if (response.data && response.data.length > 0) {
                                    setDescriptions(prev => ({
                                      ...prev,
                                      [row.id]: {
                                        ...prev[row.id],
                                        codigoDimension: response.data[0].nombre
                                      }
                                    }));
                                  }
                                } catch (error) {
                                  console.error('Error loading codigo dimension description:', error);
                                }
                              }
                            }}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, 9)}
                            className="w-40 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                            placeholder="Cód"
                          />
                          {row.codigoDimension && descriptions[row.id]?.codigoDimension && (
                            <span className="text-xs text-gray-500 px-1 truncate w-40" title={descriptions[row.id].codigoDimension}>
                              {descriptions[row.id].codigoDimension}
                            </span>
                          )}
                          {row.codigoDimension && !descriptions[row.id]?.codigoDimension && (
                            <span className="text-xs text-gray-400 px-1 truncate w-40 italic">
                              Cargando...
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
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="relative group">
                        <div className="flex flex-col">
                          <input
                            id={`cell-${row.id}-subcuenta`}
                            type="text"
                            value={row.subcuenta}
                            onChange={(e) => updateCell(row.id, 'subcuenta', e.target.value)}
                            onBlur={async (e) => {
                              // Al salir del campo, intentar cargar la descripción si hay un valor
                              const value = e.target.value.trim();
                              if (value && row.codigoDimension) {
                                try {
                                  const response = await api.get('/parametros/maestros', {
                                    params: {
                                      tipo_campo: 'subcuenta',
                                      codigo: value,
                                      codigo_padre: row.codigoDimension,
                                      limit: 1
                                    }
                                  });
                                  if (response.data && response.data.length > 0) {
                                    setDescriptions(prev => ({
                                      ...prev,
                                      [row.id]: {
                                        ...prev[row.id],
                                        subcuenta: response.data[0].nombre
                                      }
                                    }));
                                  }
                                } catch (error) {
                                  console.error('Error loading subcuenta description:', error);
                                }
                              }
                            }}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, 10)}
                            className="w-40 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none disabled:opacity-50"
                            disabled={!row.codigoDimension}
                            placeholder={row.codigoDimension ? "Sub" : "Primero código"}
                          />
                          {row.subcuenta && descriptions[row.id]?.subcuenta && (
                            <span className="text-xs text-gray-500 px-1 truncate w-40" title={descriptions[row.id].subcuenta}>
                              {descriptions[row.id].subcuenta}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => openSmartSelector(row.id, 'subcuenta', e.currentTarget)}
                          disabled={!row.codigoDimension}
                          className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="relative group">
                        <div className="flex flex-col">
                          <input
                            id={`cell-${row.id}-cuentaContable`}
                            type="text"
                            value={row.cuentaContable}
                            onChange={(e) => updateCell(row.id, 'cuentaContable', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, 11)}
                            className="w-48 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                            placeholder="Cuenta"
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
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="relative group">
                        <div className="flex flex-col">
                          <input
                            id={`cell-${row.id}-tipoOrdenCompra`}
                            type="text"
                            value={row.tipoOrdenCompra}
                            onChange={(e) => updateCell(row.id, 'tipoOrdenCompra', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, 12)}
                            className="w-40 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none"
                            placeholder="Tipo"
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
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        id={`cell-${row.id}-ordenCompra`}
                        type="text"
                        value={row.ordenCompra}
                        onChange={(e) => updateCell(row.id, 'ordenCompra', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 13)}
                        className="w-28 px-1 py-0.5 text-sm bg-transparent focus:outline-none"
                        placeholder="Orden"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        id={`cell-${row.id}-patente`}
                        type="text"
                        value={row.patente}
                        onChange={(e) => updateCell(row.id, 'patente', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 14)}
                        className="w-24 px-1 py-0.5 text-sm bg-transparent focus:outline-none uppercase"
                        placeholder="ABC123"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        id={`cell-${row.id}-km`}
                        type="text"
                        value={row.km}
                        onChange={(e) => updateCell(row.id, 'km', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 15)}
                        className="w-20 px-1 py-0.5 text-sm bg-transparent focus:outline-none text-right"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        id={`cell-${row.id}-observaciones`}
                        type="text"
                        value={row.observaciones}
                        onChange={(e) => updateCell(row.id, 'observaciones', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 16)}
                        className="w-40 px-1 py-0.5 text-sm bg-transparent focus:outline-none"
                        placeholder="Observaciones"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer del modal */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {hasChanges && (
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  Tienes cambios sin guardar
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleClose}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!hasChanges}
                title={!hasChanges ? 'No hay cambios para guardar' : 'Guardar cambios en almacenamiento local'}
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* SmartSelector */}
      {showSmartSelector && selectorField && (
        <SmartSelector
          value={selectorInitialValue}
          fieldType={fieldsWithSelector[selectorField.field as keyof typeof fieldsWithSelector]!}
          parentValue={selectorParentValue}
          onSelect={handleSelectorSelect}
          onClose={() => {
            setShowSmartSelector(false);
            setSelectorField(null);
          }}
          position={selectorPosition}
        />
      )}
    </div>
  );
};

export default AperturaModal;
