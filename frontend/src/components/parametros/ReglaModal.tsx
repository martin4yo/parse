'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Eye, Play, Save, AlertCircle, Info, Settings, CheckCircle, AlertTriangle, XCircle, CheckCircle2, ShieldAlert, AlertOctagon, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { AILookupForm } from './AILookupForm';

interface ReglaNegocio {
  id?: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo: string;
  activa: boolean;
  esGlobal?: boolean;
  prioridad: number;
  version?: number;
  fechaVigencia?: string;
  configuracion: {
    condiciones: Condicion[];
    acciones: Accion[];
    transformacionesCampo?: TransformacionCampo[];
    logicOperator: 'AND' | 'OR';
    stopOnMatch: boolean;
    mensajeError?: string;
    severidad?: string;
    aplicaA?: ('DOCUMENTO' | 'LINEAS' | 'IMPUESTOS')[];
  };
  createdAt?: string;
  updatedAt?: string;
}

interface Condicion {
  campo: string;
  operador: string;
  valor: string;
  grupo?: string;
}

interface TransformacionCampo {
  campo: string;
  transformacion: string;
  funcionPersonalizada?: string;
}

interface Accion {
  campo: string;
  operacion: string;
  valor?: string;
  tabla?: string;
  campoConsulta?: string;
  valorConsulta?: string;
  campoResultado?: string;
  valorDefecto?: string;
  // Nuevos campos para LOOKUP_JSON
  tipoCampo?: string;
  campoJSON?: string;
  // Nuevos campos para LOOKUP_CHAIN
  cadena?: Array<{
    tabla: string;
    campoConsulta: string;
    campoResultado: string;
    descripcion?: string;
    filtroAdicional?: Record<string, any>;
  }>;
  // Nuevos campos para AI_LOOKUP
  campoTexto?: string;
  filtro?: Record<string, any>;
  filtroAdicional?: Record<string, any>;
  umbralConfianza?: number;
  requiereAprobacion?: boolean;
  instruccionesAdicionales?: string;
  campoRetorno?: string;
  // Nuevos campos para CREATE_DISTRIBUTION
  dimensionTipo?: string;
  dimensionTipoCampo?: string;
  dimensionNombre?: string;
  dimensionNombreCampo?: string;
  subcuentas?: Array<{
    codigoSubcuenta?: string;
    codigoSubcuentaCampo?: string;
    subcuentaNombre?: string;
    subcuentaNombreCampo?: string;
    cuentaContable?: string;
    cuentaContableCampo?: string;
    porcentaje?: number;
    porcentajeCampo?: string;
  }>;
}

interface TipoRegla {
  codigo: string;
  nombre: string;
  descripcion: string;
}

interface Operador {
  codigo: string;
  nombre: string;
  descripcion: string;
}

interface TipoAccion {
  codigo: string;
  nombre: string;
  descripcion: string;
  parametros: string[];
}

interface TablaLookup {
  codigo: string;
  nombre: string;
  descripcion: string;
  campos: string[];
}

interface ReglaModalProps {
  regla?: ReglaNegocio | null;
  tipos: TipoRegla[];
  operadores: Operador[];
  acciones: TipoAccion[];
  tablasLookup: TablaLookup[];
  onGuardar: (reglaData: any) => void;
  onCerrar: () => void;
}

export default function ReglaModal({ 
  regla, 
  tipos, 
  operadores, 
  acciones, 
  tablasLookup, 
  onGuardar, 
  onCerrar 
}: ReglaModalProps) {
  
  // Estados del formulario
  const [formData, setFormData] = useState<ReglaNegocio>({
    codigo: '',
    nombre: '',
    descripcion: '',
    tipo: 'TRANSFORMACION',
    activa: true,
    esGlobal: false,
    prioridad: 100,
    configuracion: {
      condiciones: [],
      acciones: [],
      logicOperator: 'AND',
      stopOnMatch: false,
      mensajeError: '',
      severidad: 'ERROR',
      aplicaA: ['DOCUMENTO', 'LINEAS', 'IMPUESTOS']
    }
  });

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'transformaciones' | 'condiciones' | 'acciones' | 'preview'>('general');
  const [errores, setErrores] = useState<string[]>([]);
  const [tiposCampo, setTiposCampo] = useState<string[]>([]);

  // Cargar tipos de campo disponibles
  useEffect(() => {
    const fetchTiposCampo = async () => {
      try {
        const response = await api.get('/reglas/meta/tipos-campo');
        setTiposCampo(response.data);
      } catch (error) {
        console.error('Error al cargar tipos de campo:', error);
        // Fallback a valores por defecto si falla
        setTiposCampo(['proveedor', 'tipo_producto', 'codigo_producto', 'tipo_comprobante', 'codigo_dimension']);
      }
    };
    fetchTiposCampo();
  }, []);

  // Inicializar formulario cuando cambia la regla
  useEffect(() => {
    if (regla) {
      // Convertir aplicaA antiguo (string) a nuevo formato (array)
      let aplicaAArray: ('DOCUMENTO' | 'LINEAS' | 'IMPUESTOS')[] = ['DOCUMENTO', 'LINEAS', 'IMPUESTOS'];

      if (regla.configuracion.aplicaA) {
        const aplicaAValue = regla.configuracion.aplicaA as any;
        if (Array.isArray(aplicaAValue)) {
          aplicaAArray = aplicaAValue;
        } else if (typeof aplicaAValue === 'string') {
          // Compatibilidad con valores antiguos
          switch (aplicaAValue) {
            case 'TODOS':
              aplicaAArray = ['DOCUMENTO', 'LINEAS', 'IMPUESTOS'];
              break;
            case 'DOCUMENTO':
              aplicaAArray = ['DOCUMENTO'];
              break;
            case 'LINEAS':
              aplicaAArray = ['LINEAS'];
              break;
            case 'IMPUESTOS':
              aplicaAArray = ['IMPUESTOS'];
              break;
            default:
              aplicaAArray = ['DOCUMENTO', 'LINEAS', 'IMPUESTOS'];
          }
        }
      }

      setFormData({
        ...regla,
        fechaVigencia: regla.fechaVigencia ? regla.fechaVigencia.split('T')[0] : '',
        configuracion: {
          ...regla.configuracion,
          transformacionesCampo: regla.configuracion.transformacionesCampo || [],
          aplicaA: aplicaAArray
        }
      });
    } else {
      // Reset para nueva regla
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        tipo: 'TRANSFORMACION',
        activa: true,
        prioridad: 100,
        configuracion: {
          condiciones: [],
          acciones: [],
          transformacionesCampo: [],
          logicOperator: 'AND',
          stopOnMatch: false,
          mensajeError: '',
          severidad: 'ERROR',
          aplicaA: ['DOCUMENTO', 'LINEAS', 'IMPUESTOS']
        }
      });
    }
    setActiveTab('general');
    setErrores([]);
  }, [regla]);

  // Si cambia a VALIDACION y está en tab de Acciones, cambiar a Condiciones
  useEffect(() => {
    if (formData.tipo === 'VALIDACION' && activeTab === 'acciones') {
      setActiveTab('condiciones');
    }
  }, [formData.tipo, activeTab]);

  // Manejadores de cambios en el formulario
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConfigChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      configuracion: {
        ...prev.configuracion,
        [field]: value
      }
    }));
  };

  // Manejadores de condiciones
  const agregarCondicion = () => {
    const nuevaCondicion: Condicion = {
      campo: '',
      operador: 'EQUALS',
      valor: ''
    };
    
    handleConfigChange('condiciones', [...formData.configuracion.condiciones, nuevaCondicion]);
  };

  const actualizarCondicion = (index: number, field: string, value: any) => {
    const condiciones = [...formData.configuracion.condiciones];
    condiciones[index] = { ...condiciones[index], [field]: value };
    handleConfigChange('condiciones', condiciones);
  };

  const eliminarCondicion = (index: number) => {
    const condiciones = formData.configuracion.condiciones.filter((_, i) => i !== index);
    handleConfigChange('condiciones', condiciones);
  };

  // Manejadores de transformaciones de campo
  const agregarTransformacionCampo = () => {
    const nuevaTransformacion: TransformacionCampo = {
      campo: '',
      transformacion: 'REMOVE_LEADING_ZEROS'
    };
    
    handleConfigChange('transformacionesCampo', [...(formData.configuracion.transformacionesCampo || []), nuevaTransformacion]);
  };

  const actualizarTransformacionCampo = (index: number, field: string, value: any) => {
    const transformaciones = [...(formData.configuracion.transformacionesCampo || [])];
    transformaciones[index] = { ...transformaciones[index], [field]: value };
    handleConfigChange('transformacionesCampo', transformaciones);
  };

  const eliminarTransformacionCampo = (index: number) => {
    const transformaciones = (formData.configuracion.transformacionesCampo || []).filter((_, i) => i !== index);
    handleConfigChange('transformacionesCampo', transformaciones);
  };

  // Manejadores de acciones
  const agregarAccion = () => {
    const nuevaAccion: Accion = {
      campo: '',
      operacion: 'SET',
      valor: ''
    };
    
    handleConfigChange('acciones', [...formData.configuracion.acciones, nuevaAccion]);
  };

  const actualizarAccion = (index: number, field: string, value: any) => {
    const acciones = [...formData.configuracion.acciones];
    acciones[index] = { ...acciones[index], [field]: value };

    // Limpiar campos no utilizados según el tipo de operación
    if (field === 'operacion') {
      if (value === 'LOOKUP') {
        // Limpiar y configurar campos específicos de LOOKUP
        const { tipoCampo, campoJSON, cadena, ...baseAction } = acciones[index];
        acciones[index] = {
          ...baseAction,
          tabla: '',
          campoConsulta: '',
          valorConsulta: '',
          campoResultado: '',
          valorDefecto: ''
        };
      } else if (value === 'LOOKUP_JSON') {
        // Limpiar y configurar campos específicos de LOOKUP_JSON
        const { tabla, campoConsulta, campoResultado, cadena, ...baseAction } = acciones[index];
        acciones[index] = {
          ...baseAction,
          tipoCampo: '',
          campoJSON: '',
          valorConsulta: '',
          campoResultado: '',
          valorDefecto: ''
        };
      } else if (value === 'LOOKUP_CHAIN') {
        // Limpiar y configurar campos específicos de LOOKUP_CHAIN
        const { tabla, campoConsulta, campoResultado, tipoCampo, campoJSON, campoTexto, filtro, umbralConfianza, requiereAprobacion, instruccionesAdicionales, ...baseAction } = acciones[index];
        acciones[index] = {
          ...baseAction,
          valorConsulta: '',
          cadena: [],
          valorDefecto: ''
        };
      } else if (value === 'AI_LOOKUP') {
        // Limpiar y configurar campos específicos de AI_LOOKUP
        const { tabla, campoConsulta, valorConsulta, cadena, tipoCampo, campoJSON, valor, ...baseAction } = acciones[index];
        acciones[index] = {
          ...baseAction,
          campoTexto: '',
          filtro: { tipo_campo: '', activo: true },
          campoRetorno: 'codigo',
          umbralConfianza: 0.85,
          requiereAprobacion: true,
          instruccionesAdicionales: '',
          valorDefecto: ''
        };
      } else if (value === 'CREATE_DISTRIBUTION') {
        // Limpiar y configurar campos específicos de CREATE_DISTRIBUTION
        const { tabla, campoConsulta, valorConsulta, cadena, tipoCampo, campoJSON, valor, campoTexto, filtro, umbralConfianza, requiereAprobacion, instruccionesAdicionales, ...baseAction } = acciones[index];
        acciones[index] = {
          ...baseAction,
          campo: '', // No se usa para CREATE_DISTRIBUTION
          dimensionTipo: '',
          dimensionTipoCampo: '',
          dimensionNombre: '',
          dimensionNombreCampo: '',
          subcuentas: []
        };
      } else {
        // Limpiar todos los campos específicos de lookup para operaciones normales (SET, APPEND, etc.)
        const { tabla, campoConsulta, valorConsulta, campoResultado, valorDefecto, tipoCampo, campoJSON, cadena, campoTexto, filtro, umbralConfianza, requiereAprobacion, instruccionesAdicionales, ...accionLimpia } = acciones[index];
        acciones[index] = {
          ...accionLimpia,
          valor: ''
        };
      }
    }

    handleConfigChange('acciones', acciones);
  };

  const eliminarAccion = (index: number) => {
    const acciones = formData.configuracion.acciones.filter((_, i) => i !== index);
    handleConfigChange('acciones', acciones);
  };

  // Validación del formulario
  const validarFormulario = (): string[] => {
    const errores: string[] = [];
    
    if (!formData.codigo.trim()) errores.push('El código es obligatorio');
    if (!formData.nombre.trim()) errores.push('El nombre es obligatorio');
    if (!formData.tipo) errores.push('El tipo es obligatorio');
    if (formData.prioridad < 1) errores.push('La prioridad debe ser mayor a 0');
    
    if (formData.configuracion.condiciones.length === 0) {
      errores.push('Debe agregar al menos una condición');
    } else {
      formData.configuracion.condiciones.forEach((cond, i) => {
        if (!cond.campo.trim()) errores.push(`Condición ${i + 1}: Campo es obligatorio`);
        if (!cond.operador) errores.push(`Condición ${i + 1}: Operador es obligatorio`);
      });
    }

    // Validación específica para reglas de VALIDACION
    if (formData.tipo === 'VALIDACION') {
      // Para reglas de validación, NO se requieren acciones
      // Pero SÍ se requieren mensajeError y severidad
      if (!formData.configuracion.mensajeError || !formData.configuracion.mensajeError.trim()) {
        errores.push('Las reglas de validación deben tener un mensaje de error');
      }
      if (!formData.configuracion.severidad) {
        errores.push('Las reglas de validación deben tener una severidad (BLOQUEANTE, ERROR o WARNING)');
      } else if (!['BLOQUEANTE', 'ERROR', 'WARNING'].includes(formData.configuracion.severidad)) {
        errores.push('La severidad debe ser BLOQUEANTE, ERROR o WARNING');
      }
    } else {
      // Para reglas de transformación, SÍ se requieren acciones
      if (formData.configuracion.acciones.length === 0) {
        errores.push('Debe agregar al menos una acción');
      } else {
        formData.configuracion.acciones.forEach((acc, i) => {
          if (!acc.operacion) errores.push(`Acción ${i + 1}: Operación es obligatoria`);

          // Campo es obligatorio solo para ciertas operaciones (no para CREATE_DISTRIBUTION)
          const operacionesSinCampo = ['CREATE_DISTRIBUTION'];
          if (!operacionesSinCampo.includes(acc.operacion) && (!acc.campo || !acc.campo.trim())) {
            errores.push(`Acción ${i + 1}: Campo es obligatorio`);
          }

          if (acc.operacion === 'LOOKUP') {
            if (!acc.tabla) errores.push(`Acción ${i + 1}: Tabla es obligatoria para LOOKUP`);
            if (!acc.campoConsulta) errores.push(`Acción ${i + 1}: Campo de consulta es obligatorio para LOOKUP`);
            if (!acc.valorConsulta) errores.push(`Acción ${i + 1}: Valor de consulta es obligatorio para LOOKUP`);
            if (!acc.campoResultado) errores.push(`Acción ${i + 1}: Campo resultado es obligatorio para LOOKUP`);
          } else if (acc.operacion === 'LOOKUP_JSON') {
            if (!acc.tipoCampo) errores.push(`Acción ${i + 1}: Tipo de campo es obligatorio para LOOKUP_JSON`);
            if (!acc.campoJSON) errores.push(`Acción ${i + 1}: Campo JSON es obligatorio para LOOKUP_JSON`);
            if (!acc.valorConsulta) errores.push(`Acción ${i + 1}: Valor de consulta es obligatorio para LOOKUP_JSON`);
            if (!acc.campoResultado) errores.push(`Acción ${i + 1}: Campo resultado es obligatorio para LOOKUP_JSON`);
          } else if (acc.operacion === 'LOOKUP_CHAIN') {
            if (!acc.valorConsulta) errores.push(`Acción ${i + 1}: Valor de consulta es obligatorio para LOOKUP_CHAIN`);
            if (!acc.cadena || acc.cadena.length === 0) {
              errores.push(`Acción ${i + 1}: Debe agregar al menos un paso en la cadena para LOOKUP_CHAIN`);
            } else {
              acc.cadena.forEach((paso, pIndex) => {
                if (!paso.tabla) errores.push(`Acción ${i + 1}, Paso ${pIndex + 1}: Tabla es obligatoria`);
                if (!paso.campoConsulta) errores.push(`Acción ${i + 1}, Paso ${pIndex + 1}: Campo de consulta es obligatorio`);
                if (!paso.campoResultado) errores.push(`Acción ${i + 1}, Paso ${pIndex + 1}: Campo resultado es obligatorio`);
              });
            }
          } else if (acc.operacion === 'AI_LOOKUP') {
            if (!acc.campoTexto) errores.push(`Acción ${i + 1}: Campo de texto a analizar es obligatorio para AI_LOOKUP`);
            if (!acc.filtro) errores.push(`Acción ${i + 1}: Filtro para parámetros maestros es obligatorio para AI_LOOKUP`);
            if (!acc.campoRetorno) errores.push(`Acción ${i + 1}: Campo a retornar es obligatorio para AI_LOOKUP`);
          } else if (['SET', 'APPEND'].includes(acc.operacion)) {
            if (!acc.valor) errores.push(`Acción ${i + 1}: Valor es obligatorio para ${acc.operacion}`);
          }
        });
      }
    }
    
    return errores;
  };

  // Manejar guardado
  const handleGuardar = async () => {
    const validationErrors = validarFormulario();
    setErrores(validationErrors);
    
    if (validationErrors.length > 0) {
      toast.error(`Hay ${validationErrors.length} errores de validación`);
      return;
    }

    try {
      setLoading(true);
      
      const dataToSave = {
        ...formData,
        fechaVigencia: formData.fechaVigencia ? new Date(formData.fechaVigencia).toISOString() : null
      };

      await onGuardar(dataToSave);
    } catch (error: any) {
      console.error('Error validando regla:', error);
      toast.error('Error validando regla');
    } finally {
      setLoading(false);
    }
  };

  // Probar regla
  const handleProbar = async () => {
    if (regla?.id) {
      const datosEjemplo = {
        itemData: {
          rendicionCabeceraId: 'example',
          resumenTarjetaId: 'example'
        },
        resumenData: {
          numeroTarjeta: '1234567890123456',
          descripcionCupon: 'COMBUSTIBLE YPF',
          importeTransaccion: 1000
        }
      };

      try {
        const response = await api.post(`/reglas/${regla.id}/test`, datosEjemplo);
        console.log('Resultado de prueba:', response.data);
        toast.success('Regla probada. Ver consola para detalles.');
      } catch (error) {
        console.error('Error probando regla:', error);
        toast.error('Error probando regla');
      }
    } else {
      toast.error('Guarda la regla primero para poder probarla');
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full overflow-hidden flex flex-col" style={{ maxHeight: '90vh', height: '90vh' }}>
        
        {/* Header */}
        <div className="p-6 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {regla ? 'Editar Regla de Negocio' : 'Nueva Regla de Negocio'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {regla ? `Código: ${regla.codigo} (v${regla.version || 1})` : 'Crear nueva regla de negocio'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {regla && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleProbar}
                  className="text-blue-600"
                >
                  <Play className="w-4 h-4 mr-1" />
                  Probar
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onCerrar}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b bg-white flex-shrink-0">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'general', name: 'General', icon: Settings },
              { id: 'transformaciones', name: 'Transformaciones', icon: Settings },
              { id: 'condiciones', name: 'Condiciones', icon: AlertCircle },
              ...(formData.tipo !== 'VALIDACION' ? [{ id: 'acciones', name: 'Acciones', icon: Settings }] : []),
              { id: 'preview', name: 'Preview', icon: Eye }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-palette-purple text-palette-purple'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.name}</span>
                {tab.id === 'transformaciones' && (formData.configuracion.transformacionesCampo?.length || 0) > 0 && (
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    {formData.configuracion.transformacionesCampo?.length || 0}
                  </span>
                )}
                {tab.id === 'condiciones' && formData.configuracion.condiciones.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    {formData.configuracion.condiciones.length}
                  </span>
                )}
                {tab.id === 'acciones' && formData.configuracion.acciones.length > 0 && (
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    {formData.configuracion.acciones.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Errores de validación */}
        {errores.length > 0 && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Se encontraron {errores.length} errores de validación
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {errores.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          
          {/* Tab General */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => handleInputChange('codigo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: REGLA_DIMENSION"
                    disabled={!!regla}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo *
                  </label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => handleInputChange('tipo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {tipos.map(tipo => (
                      <option key={tipo.codigo} value={tipo.codigo}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aplica a *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.configuracion.aplicaA?.includes('DOCUMENTO') || false}
                        onChange={(e) => {
                          const currentValues = formData.configuracion.aplicaA || [];
                          const newValues = e.target.checked
                            ? [...currentValues, 'DOCUMENTO']
                            : currentValues.filter(v => v !== 'DOCUMENTO');
                          handleConfigChange('aplicaA', newValues);
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Cabecera del documento</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.configuracion.aplicaA?.includes('LINEAS') || false}
                        onChange={(e) => {
                          const currentValues = formData.configuracion.aplicaA || [];
                          const newValues = e.target.checked
                            ? [...currentValues, 'LINEAS']
                            : currentValues.filter(v => v !== 'LINEAS');
                          handleConfigChange('aplicaA', newValues);
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Líneas/Items</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.configuracion.aplicaA?.includes('IMPUESTOS') || false}
                        onChange={(e) => {
                          const currentValues = formData.configuracion.aplicaA || [];
                          const newValues = e.target.checked
                            ? [...currentValues, 'IMPUESTOS']
                            : currentValues.filter(v => v !== 'IMPUESTOS');
                          handleConfigChange('aplicaA', newValues);
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Impuestos</span>
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Selecciona una o más secciones donde se aplicará esta regla
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => handleInputChange('nombre', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre descriptivo de la regla"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion || ''}
                  onChange={(e) => handleInputChange('descripcion', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción detallada de la regla"
                />
              </div>

              {/* Campos específicos para reglas de VALIDACION */}
              {formData.tipo === 'VALIDACION' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-medium text-gray-900 flex items-center">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                    Configuración de Validación
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mensaje de Error *
                    </label>
                    <textarea
                      value={formData.configuracion.mensajeError || ''}
                      onChange={(e) => handleConfigChange('mensajeError', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Mensaje claro que verá el usuario cuando falle la validación"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ejemplo: "El CUIT es obligatorio y no puede estar vacío"
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Severidad *
                    </label>
                    <div className="space-y-2">
                      {/* Opción BLOQUEANTE */}
                      <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        formData.configuracion.severidad === 'BLOQUEANTE'
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                      }`}>
                        <input
                          type="radio"
                          name="severidad"
                          value="BLOQUEANTE"
                          checked={formData.configuracion.severidad === 'BLOQUEANTE'}
                          onChange={(e) => handleConfigChange('severidad', e.target.value)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-red-600" />
                            <span className="font-semibold text-red-900">BLOQUEANTE</span>
                          </div>
                          <p className="text-xs text-red-700 mt-1">Detiene la exportación - Debe corregirse antes de continuar</p>
                        </div>
                      </label>

                      {/* Opción ERROR */}
                      <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        formData.configuracion.severidad === 'ERROR'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                      }`}>
                        <input
                          type="radio"
                          name="severidad"
                          value="ERROR"
                          checked={formData.configuracion.severidad === 'ERROR'}
                          onChange={(e) => handleConfigChange('severidad', e.target.value)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <AlertOctagon className="w-4 h-4 text-orange-600" />
                            <span className="font-semibold text-orange-900">ERROR</span>
                          </div>
                          <p className="text-xs text-orange-700 mt-1">Permite exportar pero muestra advertencia - Se recomienda corregir</p>
                        </div>
                      </label>

                      {/* Opción WARNING */}
                      <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        formData.configuracion.severidad === 'WARNING'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
                      }`}>
                        <input
                          type="radio"
                          name="severidad"
                          value="WARNING"
                          checked={formData.configuracion.severidad === 'WARNING'}
                          onChange={(e) => handleConfigChange('severidad', e.target.value)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            <span className="font-semibold text-yellow-900">WARNING</span>
                          </div>
                          <p className="text-xs text-yellow-700 mt-1">Solo informa - No impide la exportación</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-800">
                        <strong>Nota:</strong> Las reglas de validación NO requieren acciones.
                        Solo defina las condiciones que deben cumplirse para que sea válido.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridad *
                  </label>
                  <input
                    type="number"
                    value={formData.prioridad}
                    onChange={(e) => handleInputChange('prioridad', parseInt(e.target.value) || 100)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="999"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Menor número = mayor prioridad
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Vigencia
                  </label>
                  <input
                    type="date"
                    value={formData.fechaVigencia || ''}
                    onChange={(e) => handleInputChange('fechaVigencia', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.activa}
                      onChange={(e) => handleInputChange('activa', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Activa</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.esGlobal || false}
                      onChange={(e) => handleInputChange('esGlobal', e.target.checked)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 flex items-center gap-1">
                      <span>Es Global</span>
                      <span className="text-xs text-gray-500">(disponible para todos los tenants)</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Configuración de Lógica</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operador Lógico entre Condiciones
                    </label>
                    <select
                      value={formData.configuracion.logicOperator}
                      onChange={(e) => handleConfigChange('logicOperator', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="AND">AND (Todas las condiciones deben cumplirse)</option>
                      <option value="OR">OR (Al menos una condición debe cumplirse)</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center mt-8">
                      <input
                        type="checkbox"
                        checked={formData.configuracion.stopOnMatch}
                        onChange={(e) => handleConfigChange('stopOnMatch', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Detener evaluación al encontrar coincidencia
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Transformaciones */}
          {activeTab === 'transformaciones' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Transformaciones de Campo</h3>
                  <p className="text-sm text-gray-600">
                    Transforma los valores de campos específicos antes de evaluar condiciones
                  </p>
                </div>
                <Button onClick={agregarTransformacionCampo} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Transformación
                </Button>
              </div>

              {(formData.configuracion.transformacionesCampo || []).length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Settings className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Sin transformaciones</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Agrega transformaciones para modificar los valores de campos antes de evaluar condiciones
                  </p>
                  <div className="mt-6">
                    <Button onClick={agregarTransformacionCampo} className="bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Primera Transformación
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {(formData.configuracion.transformacionesCampo || []).map((transformacion, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900">
                          Transformación {index + 1}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarTransformacionCampo(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Campo a transformar
                          </label>
                          <input
                            type="text"
                            value={transformacion.campo}
                            onChange={(e) => actualizarTransformacionCampo(index, 'campo', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="ej: resumen.cuit, proveedorId, etc."
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Use notación de punto para campos anidados (ej: resumen.cuit)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Transformación
                          </label>
                          <select
                            value={transformacion.transformacion}
                            onChange={(e) => actualizarTransformacionCampo(index, 'transformacion', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="NORMALIZE_CUIT">Normalizar CUIT (quitar guiones)</option>
                            <option value="REMOVE_DASHES">Remover guiones</option>
                            <option value="REMOVE_SPECIAL_CHARS">Remover caracteres especiales</option>
                            <option value="REMOVE_LEADING_ZEROS">Remover ceros del inicio</option>
                            <option value="REMOVE_TRAILING_ZEROS">Remover ceros del final</option>
                            <option value="TRIM_SPACES">Quitar espacios</option>
                            <option value="UPPER_CASE">Convertir a mayúsculas</option>
                            <option value="LOWER_CASE">Convertir a minúsculas</option>
                            <option value="CUSTOM_FUNCTION">Función personalizada</option>
                          </select>
                        </div>
                      </div>

                      {transformacion.transformacion === 'CUSTOM_FUNCTION' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Función JavaScript
                          </label>
                          <textarea
                            rows={3}
                            value={transformacion.funcionPersonalizada || ''}
                            onChange={(e) => actualizarTransformacionCampo(index, 'funcionPersonalizada', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="value.substring(2)"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Escriba código JavaScript que reciba 'value' y retorne el valor transformado
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Condiciones */}
          {activeTab === 'condiciones' && (
            <div className="space-y-6">
              {formData.tipo === 'VALIDACION' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-900 space-y-2">
                      <p><strong>Importante para Validaciones:</strong> Las condiciones definen lo que <strong>DEBE cumplirse</strong> para que sea válido.</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span>Si las condiciones se cumplen → <strong>VÁLIDO</strong> (todo OK)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                          <span>Si las condiciones NO se cumplen → <strong>INVÁLIDO</strong> (se muestra el mensaje de error)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Condiciones</h3>
                  <p className="text-sm text-gray-600">
                    {formData.tipo === 'VALIDACION'
                      ? 'Define lo que DEBE cumplirse para que sea válido'
                      : 'Define cuándo se debe ejecutar esta regla'
                    }
                  </p>
                </div>
                <Button onClick={agregarCondicion} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Condición
                </Button>
              </div>

              {formData.configuracion.condiciones.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Sin condiciones</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Agrega al menos una condición para que la regla funcione.
                  </p>
                  <div className="mt-6">
                    <Button onClick={agregarCondicion} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Primera Condición
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.configuracion.condiciones.map((condicion, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900">
                          Condición {index + 1}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarCondicion(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Campo
                          </label>
                          <input
                            type="text"
                            value={condicion.campo}
                            onChange={(e) => actualizarCondicion(index, 'campo', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ej: resumen.cuit, proveedorId, etc."
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Use notación de punto para campos anidados (ej: resumen.cuit)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Operador
                          </label>
                          <select
                            value={condicion.operador}
                            onChange={(e) => actualizarCondicion(index, 'operador', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {operadores.map(op => (
                              <option key={op.codigo} value={op.codigo}>
                                {op.nombre}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Valor
                          </label>
                          <input
                            type="text"
                            value={condicion.valor}
                            onChange={(e) => actualizarCondicion(index, 'valor', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={condicion.operador === 'IS_NOT_EMPTY' ? 'Dejar vacío' : 'Valor a comparar'}
                            disabled={condicion.operador === 'IS_EMPTY' || condicion.operador === 'IS_NOT_EMPTY'}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Acciones */}
          {activeTab === 'acciones' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Acciones</h3>
                  <p className="text-sm text-gray-600">
                    Define qué hacer cuando las condiciones se cumplen
                  </p>
                </div>
                <Button onClick={agregarAccion} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Acción
                </Button>
              </div>

              {formData.configuracion.acciones.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Settings className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Sin acciones</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Agrega al menos una acción para que la regla tenga efecto.
                  </p>
                  <div className="mt-6">
                    <Button onClick={agregarAccion} className="bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Primera Acción
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.configuracion.acciones.map((accion, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900">
                          Acción {index + 1}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarAccion(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Campo Destino
                          </label>
                          <input
                            type="text"
                            value={accion.campo}
                            onChange={(e) => actualizarAccion(index, 'campo', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ej: proveedorId, tipoComprobante, etc."
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Campo donde se guardará el resultado
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Operación
                          </label>
                          <select
                            value={accion.operacion}
                            onChange={(e) => actualizarAccion(index, 'operacion', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {acciones.map(tipo => (
                              <option key={tipo.codigo} value={tipo.codigo}>
                                {tipo.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Campos para operaciones normales (SET, APPEND, etc.) */}
                      {accion.operacion && accion.operacion !== 'LOOKUP' && accion.operacion !== 'LOOKUP_JSON' && accion.operacion !== 'LOOKUP_CHAIN' && accion.operacion !== 'AI_LOOKUP' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Valor
                          </label>
                          <input
                            type="text"
                            value={accion.valor || ''}
                            onChange={(e) => actualizarAccion(index, 'valor', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Valor a asignar o agregar"
                          />
                        </div>
                      )}

                      {/* Campos específicos para LOOKUP */}
                      {accion.operacion === 'LOOKUP' && (
                        <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                          <h5 className="font-medium text-blue-900">Configuración de Lookup</h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tabla a Consultar
                              </label>
                              <select
                                value={accion.tabla || ''}
                                onChange={(e) => actualizarAccion(index, 'tabla', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Seleccionar tabla</option>
                                {tablasLookup.map(tabla => (
                                  <option key={tabla.codigo} value={tabla.codigo}>
                                    {tabla.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Campo de Búsqueda
                              </label>
                              <input
                                type="text"
                                value={accion.campoConsulta || ''}
                                onChange={(e) => actualizarAccion(index, 'campoConsulta', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="ej: codigo, id, email"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Campo por el cual buscar en la tabla
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Filtros Adicionales (opcional)
                              </label>
                              <textarea
                                rows={2}
                                defaultValue={accion.filtroAdicional ? JSON.stringify(accion.filtroAdicional, null, 2) : ''}
                                onBlur={(e) => {
                                  const valor = e.target.value.trim();

                                  // Si está vacío, limpiar
                                  if (!valor) {
                                    actualizarAccion(index, 'filtroAdicional', null);
                                    return;
                                  }

                                  // Validar JSON
                                  try {
                                    const parsed = JSON.parse(valor);
                                    actualizarAccion(index, 'filtroAdicional', parsed);
                                  } catch (err) {
                                    toast.error('El filtro adicional debe ser un JSON válido');
                                    e.target.value = accion.filtroAdicional ? JSON.stringify(accion.filtroAdicional, null, 2) : '';
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                placeholder='{"tipo_campo": "codigo_producto", "activo": true}'
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                JSON con condiciones adicionales para filtrar. Se validará al salir del campo.
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valor de Búsqueda
                              </label>
                              <input
                                type="text"
                                value={accion.valorConsulta || ''}
                                onChange={(e) => actualizarAccion(index, 'valorConsulta', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="ej: {resumen.numeroTarjeta}"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Campo Resultado
                              </label>
                              <input
                                type="text"
                                value={accion.campoResultado || ''}
                                onChange={(e) => actualizarAccion(index, 'campoResultado', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="ej: nombre, codigo, parametros_json"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Campo de la tabla a obtener
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Campo JSON (opcional)
                              </label>
                              <input
                                type="text"
                                value={accion.campoJSON || ''}
                                onChange={(e) => actualizarAccion(index, 'campoJSON', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="ej: cuenta_contable, cuentas.compra"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Si el campo resultado es JSON, especifica qué propiedad extraer
                              </p>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valor por Defecto (opcional)
                              </label>
                              <input
                                type="text"
                                value={accion.valorDefecto || ''}
                                onChange={(e) => actualizarAccion(index, 'valorDefecto', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Valor si no se encuentra resultado"
                              />
                            </div>

                            <div className="md:col-span-2 bg-blue-100 p-3 rounded border border-blue-300">
                              <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="w-4 h-4 text-blue-700" />
                                <p className="text-xs text-blue-900 font-medium">Ejemplos de uso de Campo JSON:</p>
                              </div>
                              <div className="space-y-1 text-xs text-blue-800">
                                <div>• Simple: <code className="bg-white px-1 rounded">cuenta_contable</code> → Extrae el valor directo</div>
                                <div>• Anidado: <code className="bg-white px-1 rounded">cuentas.compra</code> → Extrae de objeto anidado</div>
                                <div>• Array: <code className="bg-white px-1 rounded">cuentas[0].numero</code> → Extrae del primer elemento</div>
                                <div>• Complejo: <code className="bg-white px-1 rounded">contabilidad.subcuenta.codigo</code> → Navega niveles</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Campos específicos para LOOKUP_JSON */}
                      {accion.operacion === 'LOOKUP_JSON' && (
                        <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
                          <h5 className="font-medium text-purple-900">Configuración de Lookup en JSON</h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo de Campo en Parámetros
                              </label>
                              <select
                                value={accion.tipoCampo || ''}
                                onChange={(e) => actualizarAccion(index, 'tipoCampo', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Seleccionar tipo</option>
                                {tiposCampo.map(tipo => (
                                  <option key={tipo} value={tipo}>
                                    {tipo.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Campo dentro del JSON
                              </label>
                              <input
                                type="text"
                                value={accion.campoJSON || ''}
                                onChange={(e) => actualizarAccion(index, 'campoJSON', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="ej: cuit, direccion, etc."
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valor a Buscar
                              </label>
                              <input
                                type="text"
                                value={accion.valorConsulta || ''}
                                onChange={(e) => actualizarAccion(index, 'valorConsulta', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="ej: {resumen.cuit}"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Use {'{campo}'} para referenciar campos
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Campo a Retornar
                              </label>
                              <select
                                value={accion.campoResultado || ''}
                                onChange={(e) => actualizarAccion(index, 'campoResultado', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Seleccionar campo</option>
                                <option value="codigo">Código</option>
                                <option value="nombre">Nombre</option>
                                <option value="id">ID</option>
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valor por Defecto (opcional)
                              </label>
                              <input
                                type="text"
                                value={accion.valorDefecto || ''}
                                onChange={(e) => actualizarAccion(index, 'valorDefecto', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Valor si no se encuentra resultado"
                              />
                            </div>
                          </div>

                          <div className="bg-purple-100 p-3 rounded">
                            <p className="text-sm text-purple-800">
                              <strong>Ejemplo:</strong> Buscar CUIT en campo JSON de proveedores y retornar su código
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Campos específicos para LOOKUP_CHAIN */}
                      {accion.operacion === 'LOOKUP_CHAIN' && (
                        <div className="space-y-4 p-4 bg-green-50 rounded-lg">
                          <h5 className="font-medium text-green-900">Configuración de Lookup Encadenado</h5>
                          
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valor de Consulta Inicial
                              </label>
                              <input
                                type="text"
                                value={accion.valorConsulta || ''}
                                onChange={(e) => actualizarAccion(index, 'valorConsulta', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="ej: {resumen.numeroTarjeta}"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Use {'{campo}'} para referenciar campos
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cadena de Lookups
                              </label>
                              {accion.cadena && accion.cadena.length > 0 ? (
                                <div className="space-y-3">
                                  {accion.cadena.map((paso, pasoIndex) => (
                                    <div key={pasoIndex} className="bg-white p-3 rounded border">
                                      <div className="flex items-center justify-between mb-2">
                                        <h6 className="font-medium text-sm">Paso {pasoIndex + 1}</h6>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const nuevaCadena = [...(accion.cadena || [])];
                                            nuevaCadena.splice(pasoIndex, 1);
                                            actualizarAccion(index, 'cadena', nuevaCadena);
                                          }}
                                          className="text-red-600 hover:text-red-800"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                      
                                      <div className="grid grid-cols-3 gap-2">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1">Tabla</label>
                                          <select
                                            value={paso.tabla}
                                            onChange={(e) => {
                                              const nuevaCadena = [...(accion.cadena || [])];
                                              nuevaCadena[pasoIndex].tabla = e.target.value;
                                              actualizarAccion(index, 'cadena', nuevaCadena);
                                            }}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                          >
                                            <option value="">Seleccionar</option>
                                            <option value="userAtributo">Atributos de Usuario</option>
                                            <option value="valorAtributo">Valores de Atributo</option>
                                            <option value="user">Usuarios</option>
                                            <option value="parametroMaestro">Parámetros Maestros</option>
                                          </select>
                                        </div>
                                        
                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1">Buscar por</label>
                                          <input
                                            type="text"
                                            value={paso.campoConsulta}
                                            onChange={(e) => {
                                              const nuevaCadena = [...(accion.cadena || [])];
                                              nuevaCadena[pasoIndex].campoConsulta = e.target.value;
                                              actualizarAccion(index, 'cadena', nuevaCadena);
                                            }}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                            placeholder="ej: numeroTarjeta"
                                          />
                                        </div>
                                        
                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1">Obtener</label>
                                          <input
                                            type="text"
                                            value={paso.campoResultado}
                                            onChange={(e) => {
                                              const nuevaCadena = [...(accion.cadena || [])];
                                              nuevaCadena[pasoIndex].campoResultado = e.target.value;
                                              actualizarAccion(index, 'cadena', nuevaCadena);
                                            }}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                            placeholder="ej: userId"
                                          />
                                        </div>
                                      </div>
                                      
                                      <div className="mt-2">
                                        <input
                                          type="text"
                                          value={paso.descripcion || ''}
                                          onChange={(e) => {
                                            const nuevaCadena = [...(accion.cadena || [])];
                                            nuevaCadena[pasoIndex].descripcion = e.target.value;
                                            actualizarAccion(index, 'cadena', nuevaCadena);
                                          }}
                                          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                          placeholder="Descripción opcional del paso"
                                        />
                                      </div>

                                      {/* Filtro adicional genérico */}
                                      <div className="mt-2">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                          Filtro Adicional (opcional)
                                        </label>
                                        <textarea
                                          value={paso.filtroAdicional ? JSON.stringify(paso.filtroAdicional, null, 2) : ''}
                                          onChange={(e) => {
                                            const nuevaCadena = [...(accion.cadena || [])];
                                            try {
                                              if (e.target.value.trim()) {
                                                nuevaCadena[pasoIndex].filtroAdicional = JSON.parse(e.target.value);
                                              } else {
                                                delete nuevaCadena[pasoIndex].filtroAdicional;
                                              }
                                              actualizarAccion(index, 'cadena', nuevaCadena);
                                            } catch (error) {
                                              // Ignorar errores de JSON mientras el usuario escribe
                                            }
                                          }}
                                          className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                          placeholder='{"campo": "valor"} o expresión JSON'
                                          rows={2}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                          Filtro JSON para refinar la búsqueda. Ej: {`{"valorAtributo": {"atributo": {"codigo": "CODDIM"}}}`}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 bg-gray-50 rounded border-2 border-dashed border-gray-300">
                                  <p className="text-sm text-gray-500">No hay pasos definidos</p>
                                </div>
                              )}
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const nuevoPaso = {
                                    tabla: '',
                                    campoConsulta: '',
                                    campoResultado: '',
                                    descripcion: '',
                                    filtroAdicional: null
                                  };
                                  const nuevaCadena = [...(accion.cadena || []), nuevoPaso];
                                  actualizarAccion(index, 'cadena', nuevaCadena);
                                }}
                                className="mt-2"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Agregar Paso
                              </Button>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valor por Defecto (opcional)
                              </label>
                              <input
                                type="text"
                                value={accion.valorDefecto || ''}
                                onChange={(e) => actualizarAccion(index, 'valorDefecto', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Valor si falla algún paso de la cadena"
                              />
                            </div>
                          </div>

                          <div className="bg-green-100 p-3 rounded">
                            <p className="text-sm text-green-800">
                              <strong>Ejemplo:</strong> numeroTarjeta → userId → código de dimensión
                            </p>
                            <ul className="text-xs text-green-700 mt-1 ml-4 list-disc">
                              <li>Paso 1: Buscar en user_tarjetas_credito donde numeroTarjeta="123" → obtener userId</li>
                              <li>Paso 2: Buscar en user_atributos donde userId="456" → obtener atributo.codigo_dimension</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Campos específicos para AI_LOOKUP */}
                      {accion.operacion === 'AI_LOOKUP' && (
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <AILookupForm
                            value={accion}
                            onChange={(newValue) => {
                              const acciones = [...formData.configuracion.acciones];
                              acciones[index] = newValue;
                              handleConfigChange('acciones', acciones);
                            }}
                          />
                        </div>
                      )}

                      {/* Campos específicos para CREATE_DISTRIBUTION */}
                      {accion.operacion === 'CREATE_DISTRIBUTION' && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Tipo Dimensión (Fijo)
                                </label>
                                <input
                                  type="text"
                                  value={accion.dimensionTipo || ''}
                                  onChange={(e) => {
                                    const acciones = [...formData.configuracion.acciones];
                                    acciones[index] = { ...acciones[index], dimensionTipo: e.target.value };
                                    handleConfigChange('acciones', acciones);
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                  placeholder="ej: CENTRO_COSTO"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Tipo Dimensión (Campo)
                                </label>
                                <input
                                  type="text"
                                  value={accion.dimensionTipoCampo || ''}
                                  onChange={(e) => {
                                    const acciones = [...formData.configuracion.acciones];
                                    acciones[index] = { ...acciones[index], dimensionTipoCampo: e.target.value };
                                    handleConfigChange('acciones', acciones);
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                  placeholder="ej: {codigoDimension}"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Nombre Dimensión (Fijo)
                                </label>
                                <input
                                  type="text"
                                  value={accion.dimensionNombre || ''}
                                  onChange={(e) => {
                                    const acciones = [...formData.configuracion.acciones];
                                    acciones[index] = { ...acciones[index], dimensionNombre: e.target.value };
                                    handleConfigChange('acciones', acciones);
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                  placeholder="ej: Centro de Costo"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Nombre Dimensión (Campo)
                                </label>
                                <input
                                  type="text"
                                  value={accion.dimensionNombreCampo || ''}
                                  onChange={(e) => {
                                    const acciones = [...formData.configuracion.acciones];
                                    acciones[index] = { ...acciones[index], dimensionNombreCampo: e.target.value };
                                    handleConfigChange('acciones', acciones);
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                  placeholder="ej: {nombreDimension}"
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  Subcuentas
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const acciones = [...formData.configuracion.acciones];
                                    const subcuentas = acciones[index].subcuentas || [];
                                    subcuentas.push({ porcentaje: 100 });
                                    acciones[index] = { ...acciones[index], subcuentas };
                                    handleConfigChange('acciones', acciones);
                                  }}
                                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                >
                                  + Agregar Subcuenta
                                </button>
                              </div>

                              {accion.subcuentas && accion.subcuentas.length > 0 && (
                                <div className="space-y-3">
                                  {accion.subcuentas.map((sub, subIndex) => (
                                    <div key={subIndex} className="bg-white p-3 rounded border border-gray-200">
                                      <div className="grid grid-cols-3 gap-2 mb-2">
                                        <div>
                                          <label className="block text-xs text-gray-600 mb-1">Código (Fijo)</label>
                                          <input
                                            type="text"
                                            value={sub.codigoSubcuenta || ''}
                                            onChange={(e) => {
                                              const acciones = [...formData.configuracion.acciones];
                                              const subcuentas = [...(acciones[index].subcuentas || [])];
                                              subcuentas[subIndex] = { ...subcuentas[subIndex], codigoSubcuenta: e.target.value };
                                              acciones[index] = { ...acciones[index], subcuentas };
                                              handleConfigChange('acciones', acciones);
                                            }}
                                            className="w-full px-2 py-1 text-sm border rounded"
                                            placeholder="SUC001"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-600 mb-1">Código (Campo)</label>
                                          <input
                                            type="text"
                                            value={sub.codigoSubcuentaCampo || ''}
                                            onChange={(e) => {
                                              const acciones = [...formData.configuracion.acciones];
                                              const subcuentas = [...(acciones[index].subcuentas || [])];
                                              subcuentas[subIndex] = { ...subcuentas[subIndex], codigoSubcuentaCampo: e.target.value };
                                              acciones[index] = { ...acciones[index], subcuentas };
                                              handleConfigChange('acciones', acciones);
                                            }}
                                            className="w-full px-2 py-1 text-sm border rounded"
                                            placeholder="{sucursal}"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-600 mb-1">%</label>
                                          <input
                                            type="number"
                                            value={sub.porcentaje || 100}
                                            onChange={(e) => {
                                              const acciones = [...formData.configuracion.acciones];
                                              const subcuentas = [...(acciones[index].subcuentas || [])];
                                              subcuentas[subIndex] = { ...subcuentas[subIndex], porcentaje: parseFloat(e.target.value) };
                                              acciones[index] = { ...acciones[index], subcuentas };
                                              handleConfigChange('acciones', acciones);
                                            }}
                                            className="w-full px-2 py-1 text-sm border rounded"
                                            min="0"
                                            max="100"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex justify-end">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const acciones = [...formData.configuracion.acciones];
                                            const subcuentas = (acciones[index].subcuentas || []).filter((_, i) => i !== subIndex);
                                            acciones[index] = { ...acciones[index], subcuentas };
                                            handleConfigChange('acciones', acciones);
                                          }}
                                          className="text-xs text-red-600 hover:text-red-800"
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="bg-blue-100 p-3 rounded">
                              <p className="text-sm text-blue-800">
                                <strong>Nota:</strong> CREATE_DISTRIBUTION crea registros en documento_distribuciones y documento_subcuentas.
                                Usa campos fijos o dinámicos ({'{campo}'}) según necesites.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Preview */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Preview de la Regla</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Vista previa de la configuración JSON que se guardará
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Información General</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Código:</span>
                    <div className="font-medium">{formData.codigo || '(sin definir)'}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Tipo:</span>
                    <div className="font-medium">
                      {tipos.find(t => t.codigo === formData.tipo)?.nombre || formData.tipo}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Prioridad:</span>
                    <div className="font-medium">{formData.prioridad}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Estado:</span>
                    <div className="font-medium">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        formData.activa ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {formData.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-3 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Condiciones ({formData.configuracion.condiciones.length})
                  </h4>
                  {formData.configuracion.condiciones.length === 0 ? (
                    <p className="text-orange-700 text-sm">No hay condiciones definidas</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.configuracion.condiciones.map((cond, i) => (
                        <div key={i} className="text-sm bg-white p-2 rounded border">
                          <code className="text-orange-800">
                            {cond.campo} {operadores.find(op => op.codigo === cond.operador)?.nombre.toLowerCase()} {cond.valor}
                          </code>
                        </div>
                      ))}
                      <div className="text-xs text-orange-600 mt-2">
                        Operador: <strong>{formData.configuracion.logicOperator}</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Acciones ({formData.configuracion.acciones.length})
                  </h4>
                  {formData.configuracion.acciones.length === 0 ? (
                    <p className="text-green-700 text-sm">No hay acciones definidas</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.configuracion.acciones.map((acc, i) => (
                        <div key={i} className="text-sm bg-white p-2 rounded border">
                          <div className="font-medium text-green-800">{acc.campo}</div>
                          <div className="text-green-600">
                            {acciones.find(a => a.codigo === acc.operacion)?.nombre}
                            {acc.operacion === 'LOOKUP' ?
                              ` → ${acc.tabla}.${acc.campoResultado}` :
                            acc.operacion === 'AI_LOOKUP' ?
                              ` → IA: ${acc.campoTexto} (${acc.campoRetorno})` :
                              ` → ${acc.valor}`
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Configuración JSON</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                  <pre className="text-sm">
                    {JSON.stringify(formData, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              {(formData.configuracion.transformacionesCampo?.length || 0) > 0 && `${formData.configuracion.transformacionesCampo?.length || 0} transformaciones, `}
              {formData.configuracion.condiciones.length} condiciones, {formData.configuracion.acciones.length} acciones
            </div>
            {errores.length > 0 && (
              <div className="text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errores.length} errores
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              onClick={handleGuardar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {regla ? 'Actualizar' : 'Crear'} Regla
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}