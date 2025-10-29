'use client';

import { useState, useEffect } from 'react';
import { X, Save, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SmartSelector } from '@/components/rendiciones/SmartSelector';
import { api } from '@/lib/api';

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
  documentoId?: string;
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

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: RendicionItem) => void;
  item: RendicionItem | null;
}

export const EditItemModal = ({ isOpen, onClose, onSave, item }: EditItemModalProps) => {
  const [formData, setFormData] = useState<Partial<RendicionItem>>({});
  const [showSmartSelector, setShowSmartSelector] = useState(false);
  const [selectorField, setSelectorField] = useState<string | null>(null);
  const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });
  const [selectorInitialValue, setSelectorInitialValue] = useState('');
  const [selectorParentValue, setSelectorParentValue] = useState<string | null>(null);
  const [descriptions, setDescriptions] = useState<{[key: string]: string}>({});

  // Definir qué campos del modal necesitan SmartSelector
  const modalFieldsWithSelector = {
    'proveedorId': 'proveedor',
    'codigoDimension': 'codigo_dimension',
    'subcuenta': 'subcuenta',
    'cuentaContable': 'cuenta_contable',
    'tipoOrdenCompra': 'tipo_orden_compra'
  } as const;

  // Función para cargar descripciones de los campos con valores
  const loadDescriptionsForFields = async (item: RendicionItem) => {
    const newDescriptions: {[key: string]: string} = {};

    for (const [field, tipoParametro] of Object.entries(modalFieldsWithSelector)) {
      const fieldValue = item[field as keyof RendicionItem];
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

    setDescriptions(newDescriptions);
  };

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

  // Función para formatear fecha
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';

    // Si el formato es DDMMYY (6 caracteres)
    if (dateString.length === 6) {
      const day = dateString.substring(0, 2);
      const month = dateString.substring(2, 4);
      const year = '20' + dateString.substring(4, 6);
      return `${day}/${month}/${year}`;
    }

    // Si el formato es ISO o similar
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

  // Inicializar el formulario cuando se abre el modal
  useEffect(() => {
    if (isOpen && item) {
      setFormData({
        id: item.id,
        fechaComprobante: formatDateForInput(item.fechaComprobante),
        proveedorId: item.proveedorId || '',
        netoGravado: item.netoGravado || 0,
        exento: item.exento || 0,
        codigoDimension: item.codigoDimension || '',
        subcuenta: item.subcuenta || '',
        cuentaContable: item.cuentaContable || '',
        patente: item.patente || '',
        km: item.km || '',
        tipoOrdenCompra: item.tipoOrdenCompra || '',
        ordenCompra: item.ordenCompra || ''
      });

      // Cargar las descripciones de los campos con SmartSelector si tienen valores
      loadDescriptionsForFields(item);
    }
  }, [isOpen, item]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Manejar cuando el usuario empieza a tipear en campos con SmartSelector
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: string) => {
    // Si es un campo que tiene SmartSelector y el usuario está empezando a tipear
    if (modalFieldsWithSelector[field as keyof typeof modalFieldsWithSelector]) {
      // Si no está abierto el selector y es un carácter imprimible
      if (!showSmartSelector && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const element = e.currentTarget;
        openSmartSelector(field, element);
      }
      // Si es Enter, también abrir el selector
      else if (!showSmartSelector && (e.key === 'Enter' || e.key === 'F2')) {
        e.preventDefault();
        const element = e.currentTarget;
        openSmartSelector(field, element);
      }
    }
  };

  // Manejar click en input de campos con SmartSelector
  const handleInputFocus = (field: string, element: HTMLInputElement) => {
    // Si es un campo que tiene SmartSelector, abrir automáticamente
    if (modalFieldsWithSelector[field as keyof typeof modalFieldsWithSelector]) {
      // Solo abrir si no está ya abierto
      if (!showSmartSelector) {
        openSmartSelector(field, element);
      }
    }
  };

  // Abrir SmartSelector para un campo
  const openSmartSelector = (field: string, element: HTMLElement) => {
    // Obtener el input que es el elemento padre del botón
    const inputElement = element.parentElement?.querySelector('input');
    if (inputElement) {
      const rect = inputElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const selectorHeight = 300;

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
    } else {
      const rect = element.getBoundingClientRect();
      setSelectorPosition({
        x: rect.left - 200,
        y: rect.bottom + window.scrollY
      });
    }
    setSelectorInitialValue((formData[field as keyof typeof formData] as string) || '');
    setSelectorField(field);

    // Si es subcuenta, necesita el valor del código dimensión como padre
    if (field === 'subcuenta') {
      setSelectorParentValue(formData.codigoDimension as string || null);
    } else {
      setSelectorParentValue(null);
    }

    setShowSmartSelector(true);
  };

  // Manejar selección del SmartSelector
  const handleSelectorSelect = (codigo: string, nombre: string) => {
    if (selectorField) {
      setFormData(prev => ({
        ...prev,
        [selectorField]: codigo
      }));

      setDescriptions(prev => ({
        ...prev,
        [selectorField]: nombre
      }));

      // Si se cambió código dimensión, limpiar subcuenta
      if (selectorField === 'codigoDimension') {
        setFormData(prev => ({
          ...prev,
          subcuenta: ''
        }));
        setDescriptions(prev => ({
          ...prev,
          subcuenta: ''
        }));
      }
    }
    setShowSmartSelector(false);
    setSelectorField(null);
  };

  // Cerrar SmartSelector
  const handleSelectorClose = () => {
    setShowSmartSelector(false);
    setSelectorField(null);
  };

  const handleSave = () => {
    if (item) {
      const updatedItem: RendicionItem = {
        ...item,
        ...formData
      };
      onSave(updatedItem);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-7xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header del modal */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">Editar Item de Rendición</h2>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span><strong>Fecha:</strong> {formatDate(item.resumenTarjeta.fechaTransaccion)}</span>
                  <span><strong>Cupón:</strong> {item.resumenTarjeta.numeroCupon || '-'}</span>
                  <span><strong>Importe:</strong> {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(item.resumenTarjeta.importeTransaccion || 0)}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span><strong>Descripción:</strong> {item.resumenTarjeta.descripcionCupon || '-'}</span>
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

        {/* Contenido del modal */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Columna izquierda - más ancha */}
            <div className="lg:col-span-2 space-y-6">

            {/* Campos básicos */}
            <div className="space-y-4">
              {/* Fecha Comprobante */}
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Comprobante
                </label>
                <input
                  type="date"
                  value={formData.fechaComprobante || ''}
                  onChange={(e) => { handleInputChange('fechaComprobante', e.target.value) }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Proveedor ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor ID
                </label>
                <div className="flex items-center space-x-2">
                  <div className="relative w-32">
                    <input
                      type="text"
                      value={formData.proveedorId || ''}
                      onChange={(e) => { handleInputChange('proveedorId', e.target.value) }}
                      onKeyDown={(e) => handleInputKeyDown(e, 'proveedorId')}
                      onFocus={(e) => handleInputFocus('proveedorId', e.target)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Código del proveedor"
                    />
                    <button
                      type="button"
                      onClick={(e) => openSmartSelector('proveedorId', e.currentTarget)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                  {/* Label de descripción */}
                  <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md min-h-[42px] flex items-center">
                    {descriptions.proveedorId ? (
                      <span className="text-sm text-gray-700">{descriptions.proveedorId}</span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Nombre del proveedor</span>
                    )}
                  </div>
                </div>
              </div>
            </div>


            {/* Contenedor: Código Dimensión, Subcuenta y Cuenta Contable */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Información Contable</h3>
              <div className="space-y-4">
                {/* Código Dimensión */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código Dimensión
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative w-32">
                      <input
                        type="text"
                        value={formData.codigoDimension || ''}
                        onChange={(e) => { handleInputChange('codigoDimension', e.target.value) }}
                        onKeyDown={(e) => handleInputKeyDown(e, 'codigoDimension')}
                        onFocus={(e) => handleInputFocus('codigoDimension', e.target)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Seleccione código"
                      />
                      <button
                        type="button"
                        onClick={(e) => openSmartSelector('codigoDimension', e.currentTarget)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md min-h-[42px] flex items-center">
                      {descriptions.codigoDimension ? (
                        <span className="text-sm text-gray-700">{descriptions.codigoDimension}</span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Nombre del código</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subcuenta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subcuenta
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative w-32">
                      <input
                        type="text"
                        value={formData.subcuenta || ''}
                        onChange={(e) => { handleInputChange('subcuenta', e.target.value) }}
                        onKeyDown={(e) => handleInputKeyDown(e, 'subcuenta')}
                        onFocus={(e) => handleInputFocus('subcuenta', e.target)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={formData.codigoDimension ? "Seleccione subcuenta" : "Seleccione primero código dimensión"}
                        disabled={!formData.codigoDimension}
                      />
                      <button
                        type="button"
                        onClick={(e) => openSmartSelector('subcuenta', e.currentTarget)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        disabled={!formData.codigoDimension}
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md min-h-[42px] flex items-center">
                      {descriptions.subcuenta ? (
                        <span className="text-sm text-gray-700">{descriptions.subcuenta}</span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Nombre de la subcuenta</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cuenta Contable */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuenta Contable
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative w-48">
                      <input
                        type="text"
                        value={formData.cuentaContable || ''}
                        onChange={(e) => { handleInputChange('cuentaContable', e.target.value) }}
                        onKeyDown={(e) => handleInputKeyDown(e, 'cuentaContable')}
                        onFocus={(e) => handleInputFocus('cuentaContable', e.target)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Seleccione cuenta"
                      />
                      <button
                        type="button"
                        onClick={(e) => openSmartSelector('cuentaContable', e.currentTarget)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md min-h-[42px] flex items-center">
                      {descriptions.cuentaContable ? (
                        <span className="text-sm text-gray-700">{descriptions.cuentaContable}</span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Nombre de la cuenta</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            </div>

            {/* Columna derecha - más angosta */}
            <div className="lg:col-span-1 space-y-6">
              {/* Contenedor: Importes */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Importes</h3>
                <div className="space-y-4">
                  {/* Neto Gravado */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Neto Gravado
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.netoGravado ? parseFloat(String(formData.netoGravado)).toFixed(2) : '0.00'}
                      onChange={(e) => { handleInputChange('netoGravado', parseFloat(e.target.value) || 0) }}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleInputChange('netoGravado', value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                    />
                  </div>

                  {/* Exento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Exento
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.exento ? parseFloat(String(formData.exento)).toFixed(2) : '0.00'}
                      onChange={(e) => { handleInputChange('exento', parseFloat(e.target.value) || 0) }}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleInputChange('exento', value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Contenedor: Información Adicional */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Información Adicional</h3>
                <div className="space-y-4">
                  {/* Tipo Orden Compra - línea completa */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo Orden Compra
                    </label>
                    <div className="flex items-center space-x-2">
                      <div className="relative w-24">
                        <input
                          type="text"
                          value={formData.tipoOrdenCompra || ''}
                          onChange={(e) => { handleInputChange('tipoOrdenCompra', e.target.value) }}
                          onKeyDown={(e) => handleInputKeyDown(e, 'tipoOrdenCompra')}
                          onFocus={(e) => handleInputFocus('tipoOrdenCompra', e.target)}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Seleccione tipo"
                        />
                        <button
                          type="button"
                          onClick={(e) => openSmartSelector('tipoOrdenCompra', e.currentTarget)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <ChevronDown className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md min-h-[42px] flex items-center">
                        {descriptions.tipoOrdenCompra ? (
                          <span className="text-sm text-gray-700">{descriptions.tipoOrdenCompra}</span>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Nombre del tipo</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Orden Compra - línea completa */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Orden Compra
                    </label>
                    <input
                      type="text"
                      value={formData.ordenCompra || ''}
                      onChange={(e) => { handleInputChange('ordenCompra', e.target.value) }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Patente y KM juntos */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Patente */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Patente
                      </label>
                      <input
                        type="text"
                        value={formData.patente || ''}
                        onChange={(e) => { handleInputChange('patente', e.target.value) }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* KM */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        KM
                      </label>
                      <input
                        type="text"
                        value={formData.km || ''}
                        onChange={(e) => { handleInputChange('km', e.target.value) }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer del modal */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* SmartSelector para campos con FK */}
      {showSmartSelector && selectorField && (
        <SmartSelector
          value={selectorInitialValue}
          fieldType={modalFieldsWithSelector[selectorField as keyof typeof modalFieldsWithSelector]!}
          parentValue={selectorParentValue}
          onSelect={handleSelectorSelect}
          onClose={handleSelectorClose}
          position={selectorPosition}
        />
      )}
    </div>
  );
};
