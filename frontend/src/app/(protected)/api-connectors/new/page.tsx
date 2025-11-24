'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Upload,
  ArrowLeftRight,
  Key,
  Lock,
  Shield,
  Settings,
  Database,
  RefreshCw,
  Plus,
  Trash2,
  TestTube
} from 'lucide-react';

type AuthType = 'API_KEY' | 'BEARER_TOKEN' | 'OAUTH2_CLIENT_CREDENTIALS' | 'BASIC_AUTH' | 'CUSTOM_HEADERS' | 'NONE';
type Direction = 'PULL' | 'PUSH' | 'BIDIRECTIONAL';
type ResourceType = 'DOCUMENTO' | 'PROVEEDOR' | 'PRODUCTO' | 'CUENTA_CONTABLE' | 'CENTRO_COSTO';

interface PullResource {
  id: string;
  nombre: string;
  endpoint: string;
  method: string;
  tipoRecurso: ResourceType;
  activo: boolean;
  queryParams?: Record<string, string>;
  paginationConfig?: {
    enabled: boolean;
    type: 'PAGE_NUMBER' | 'OFFSET_LIMIT' | 'CURSOR';
    pageParam?: string;
    pageSizeParam?: string;
    pageSize?: number;
  };
  dataPath?: string;
}

interface PushResource {
  id: string;
  nombre: string;
  endpoint: string;
  method: string;
  resourceType: ResourceType;
  activo: boolean;
  fieldMapping?: Record<string, string>;
  filters?: Record<string, any>;
  batchSize?: number;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  defaultValue?: string;
  transform?: {
    type: string;
    params?: Record<string, any>;
  };
}

export default function NewApiConnectorPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [testing, setTesting] = useState(false);

  // Paso 1: Información básica
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direction, setDirection] = useState<Direction>('PULL');
  const [baseUrl, setBaseUrl] = useState('');

  // Paso 2: Autenticación
  const [authType, setAuthType] = useState<AuthType>('API_KEY');
  const [authConfig, setAuthConfig] = useState<Record<string, any>>({
    location: 'header',
    headerName: 'X-API-Key',
    apiKey: ''
  });

  // Paso 3: Recursos PULL
  const [pullResources, setPullResources] = useState<PullResource[]>([]);
  const [editingResource, setEditingResource] = useState<PullResource | null>(null);

  // Paso 4: Field Mapping y Validación (PULL)
  const [pullFieldMapping, setPullFieldMapping] = useState<FieldMapping[]>([]);
  const [requireValidation, setRequireValidation] = useState(false);

  // Paso 5: Recursos PUSH (solo para PUSH y BIDIRECTIONAL)
  const [pushResources, setPushResources] = useState<PushResource[]>([]);
  const [editingPushResource, setEditingPushResource] = useState<PushResource | null>(null);

  // Calcular total de pasos dinámicamente
  const getTotalSteps = () => {
    if (direction === 'PULL') return 4;
    if (direction === 'PUSH') return 3; // Info básica, Auth, Recursos PUSH
    if (direction === 'BIDIRECTIONAL') return 5; // Info, Auth, PULL, PULL Mapping, PUSH
    return 2;
  };

  const totalSteps = getTotalSteps();

  const handleAuthTypeChange = (type: AuthType) => {
    setAuthType(type);

    // Configurar valores por defecto según tipo
    switch (type) {
      case 'API_KEY':
        setAuthConfig({
          location: 'header',
          headerName: 'X-API-Key',
          apiKey: ''
        });
        break;
      case 'BEARER_TOKEN':
        setAuthConfig({ token: '' });
        break;
      case 'OAUTH2_CLIENT_CREDENTIALS':
        setAuthConfig({
          tokenUrl: '',
          clientId: '',
          clientSecret: '',
          scope: ''
        });
        break;
      case 'BASIC_AUTH':
        setAuthConfig({
          username: '',
          password: ''
        });
        break;
      case 'CUSTOM_HEADERS':
        setAuthConfig({ headers: {} });
        break;
      case 'NONE':
        setAuthConfig({});
        break;
    }
  };

  const handleTestConnection = async () => {
    // Validar datos mínimos
    if (!baseUrl) {
      toast.error('Completa la URL base primero');
      return;
    }

    // Crear configuración temporal para testing
    const tempConfig = {
      nombre: nombre || 'Test',
      descripcion,
      direction,
      baseUrl,
      authType,
      authConfig,
      pullResources: [],
      pushResources: [],
      requireValidation: false,
      activo: false
    };

    try {
      setTesting(true);

      // Crear conector temporal
      const createResponse = await api.post('/api-connectors', tempConfig);
      const connectorId = createResponse.data.data.id;

      // Probar conexión
      const testResponse = await api.post(`/api-connectors/${connectorId}/test-connection`, {});

      // Eliminar conector temporal
      await api.delete(`/api-connectors/${connectorId}?hardDelete=true`);

      if (testResponse.data.success) {
        toast.success('Conexión exitosa!');
      } else {
        toast.error(`Conexión falló: ${testResponse.data.message}`);
      }
    } catch (error: any) {
      console.error('Error probando conexión:', error);
      toast.error(error.response?.data?.error || 'Error al probar conexión');
    } finally {
      setTesting(false);
    }
  };

  const handleAddResource = () => {
    const newResource: PullResource = {
      id: `resource-${Date.now()}`,
      nombre: '',
      endpoint: '',
      method: 'GET',
      tipoRecurso: 'DOCUMENTO',
      activo: true,
      queryParams: {},
      paginationConfig: {
        enabled: false,
        type: 'PAGE_NUMBER',
        pageParam: 'page',
        pageSizeParam: 'pageSize',
        pageSize: 100
      },
      dataPath: ''
    };
    setEditingResource(newResource);
  };

  const handleSaveResource = () => {
    if (!editingResource) return;

    if (!editingResource.nombre || !editingResource.endpoint) {
      toast.error('Completa los campos requeridos');
      return;
    }

    const existingIndex = pullResources.findIndex(r => r.id === editingResource.id);

    if (existingIndex >= 0) {
      // Actualizar existente
      const updated = [...pullResources];
      updated[existingIndex] = editingResource;
      setPullResources(updated);
    } else {
      // Agregar nuevo
      setPullResources([...pullResources, editingResource]);
    }

    setEditingResource(null);
    toast.success('Recurso guardado');
  };

  const handleDeleteResource = (id: string) => {
    setPullResources(pullResources.filter(r => r.id !== id));
    toast.success('Recurso eliminado');
  };

  // Handlers para recursos PUSH
  const handleAddPushResource = () => {
    const newResource: PushResource = {
      id: `push-resource-${Date.now()}`,
      nombre: '',
      endpoint: '',
      method: 'POST',
      resourceType: 'DOCUMENTO',
      activo: true,
      fieldMapping: {},
      filters: {},
      batchSize: 50
    };
    setEditingPushResource(newResource);
  };

  const handleSavePushResource = () => {
    if (!editingPushResource) return;

    if (!editingPushResource.nombre || !editingPushResource.endpoint) {
      toast.error('Completa los campos requeridos');
      return;
    }

    const existingIndex = pushResources.findIndex(r => r.id === editingPushResource.id);

    if (existingIndex >= 0) {
      const updated = [...pushResources];
      updated[existingIndex] = editingPushResource;
      setPushResources(updated);
    } else {
      setPushResources([...pushResources, editingPushResource]);
    }

    setEditingPushResource(null);
    toast.success('Recurso PUSH guardado');
  };

  const handleDeletePushResource = (id: string) => {
    setPushResources(pushResources.filter(r => r.id !== id));
    toast.success('Recurso PUSH eliminado');
  };

  const handleAddFieldMapping = () => {
    setPullFieldMapping([
      ...pullFieldMapping,
      { sourceField: '', targetField: '' }
    ]);
  };

  const handleUpdateFieldMapping = (index: number, field: keyof FieldMapping, value: any) => {
    const updated = [...pullFieldMapping];
    updated[index] = { ...updated[index], [field]: value };
    setPullFieldMapping(updated);
  };

  const handleDeleteFieldMapping = (index: number) => {
    setPullFieldMapping(pullFieldMapping.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!nombre || !baseUrl) {
      toast.error('Completa los campos requeridos');
      return;
    }

    if ((direction === 'PULL' || direction === 'BIDIRECTIONAL') && pullResources.length === 0) {
      toast.error('Agrega al menos un recurso PULL');
      return;
    }

    if ((direction === 'PUSH' || direction === 'BIDIRECTIONAL') && pushResources.length === 0) {
      toast.error('Agrega al menos un recurso PUSH');
      return;
    }

    const connectorData = {
      nombre,
      descripcion,
      direction,
      baseUrl,
      authType,
      authConfig,
      pullResources: direction === 'PULL' || direction === 'BIDIRECTIONAL' ? pullResources : [],
      pushResources: direction === 'PUSH' || direction === 'BIDIRECTIONAL' ? pushResources : [],
      pullFieldMapping: pullFieldMapping.length > 0 ? pullFieldMapping : null,
      pushFieldMapping: null,
      requireValidation,
      validationRules: null,
      pullSchedule: null,
      pushSchedule: null,
      callbackConfig: null
    };

    try {
      await api.post('/api-connectors', connectorData);
      toast.success('Conector creado exitosamente!');
      router.push('/api-connectors');
    } catch (error: any) {
      console.error('Error creando conector:', error);
      toast.error(error.response?.data?.error || 'Error al crear conector');
    }
  };

  const canGoNext = () => {
    switch (step) {
      case 1:
        return nombre && baseUrl;
      case 2:
        return true; // Autenticación es opcional (NONE)
      case 3:
        // Para PULL y BIDIRECTIONAL, validar recursos PULL
        // Para PUSH puro, validar recursos PUSH
        if (direction === 'PULL' || direction === 'BIDIRECTIONAL') {
          return pullResources.length > 0;
        }
        if (direction === 'PUSH') {
          return pushResources.length > 0;
        }
        return false;
      case 4:
        return true; // Field mapping es opcional
      case 5:
        // Solo para BIDIRECTIONAL: validar recursos PUSH
        return pushResources.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Conector API</h1>
        <p className="text-sm text-gray-600 mt-1">
          Configura la sincronización con un sistema externo
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                    s < step
                      ? 'bg-green-600 text-white'
                      : s === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {s < step ? <Check className="w-5 h-5" /> : s}
                </div>
                <span className="text-xs text-gray-600 mt-2 text-center">
                  {s === 1 && 'Info Básica'}
                  {s === 2 && 'Autenticación'}
                  {s === 3 && 'Recursos'}
                  {s === 4 && 'Mapeo'}
                </span>
              </div>
              {s < totalSteps && (
                <div
                  className={`h-1 flex-1 mx-2 ${
                    s < step ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-6">
        <CardContent className="p-6">
        {/* PASO 1: Información Básica */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Información Básica
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Conector <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: ERP Principal, Sistema de Compras, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe qué datos sincroniza este conector..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setDirection('PULL')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    direction === 'PULL'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Download className={`w-6 h-6 mx-auto mb-2 ${direction === 'PULL' ? 'text-blue-600' : 'text-gray-600'}`} />
                  <div className="font-medium text-sm">PULL</div>
                  <div className="text-xs text-gray-600">Importar datos</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDirection('PUSH')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    direction === 'PUSH'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Upload className={`w-6 h-6 mx-auto mb-2 ${direction === 'PUSH' ? 'text-green-600' : 'text-gray-600'}`} />
                  <div className="font-medium text-sm">PUSH</div>
                  <div className="text-xs text-gray-600">Exportar datos</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDirection('BIDIRECTIONAL')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    direction === 'BIDIRECTIONAL'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <ArrowLeftRight className={`w-6 h-6 mx-auto mb-2 ${direction === 'BIDIRECTIONAL' ? 'text-purple-600' : 'text-gray-600'}`} />
                  <div className="font-medium text-sm">BIDIRECTIONAL</div>
                  <div className="text-xs text-gray-600">Ambas direcciones</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL Base de la API <span className="text-red-600">*</span>
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="https://api.ejemplo.com/v1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Los endpoints se agregarán a partir de esta URL base
              </p>
            </div>
          </div>
        )}

        {/* PASO 2: Autenticación */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Configuración de Autenticación
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Autenticación
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'API_KEY', label: 'API Key', icon: Key },
                  { value: 'BEARER_TOKEN', label: 'Bearer Token', icon: Shield },
                  { value: 'OAUTH2_CLIENT_CREDENTIALS', label: 'OAuth 2.0', icon: Lock },
                  { value: 'BASIC_AUTH', label: 'Basic Auth', icon: Lock },
                  { value: 'CUSTOM_HEADERS', label: 'Headers Custom', icon: Settings },
                  { value: 'NONE', label: 'Sin Autenticación', icon: Database }
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleAuthTypeChange(value as AuthType)}
                    className={`p-3 border-2 rounded-lg transition-all text-left ${
                      authType === value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${authType === value ? 'text-blue-600' : 'text-gray-600'}`} />
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Configuración específica por tipo */}
            {authType === 'API_KEY' && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ubicación
                  </label>
                  <select
                    value={authConfig.location}
                    onChange={(e) => setAuthConfig({ ...authConfig, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="header">Header HTTP</option>
                    <option value="query">Query Parameter</option>
                  </select>
                </div>

                {authConfig.location === 'header' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del Header
                    </label>
                    <input
                      type="text"
                      value={authConfig.headerName}
                      onChange={(e) => setAuthConfig({ ...authConfig, headerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      placeholder="X-API-Key"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del Parámetro
                    </label>
                    <input
                      type="text"
                      value={authConfig.paramName || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, paramName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      placeholder="apiKey"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={authConfig.apiKey}
                    onChange={(e) => setAuthConfig({ ...authConfig, apiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    placeholder="••••••••••••••••"
                  />
                </div>
              </div>
            )}

            {authType === 'BEARER_TOKEN' && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bearer Token
                </label>
                <input
                  type="password"
                  value={authConfig.token}
                  onChange={(e) => setAuthConfig({ ...authConfig, token: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  placeholder="••••••••••••••••"
                />
              </div>
            )}

            {authType === 'OAUTH2_CLIENT_CREDENTIALS' && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token URL
                  </label>
                  <input
                    type="url"
                    value={authConfig.tokenUrl}
                    onChange={(e) => setAuthConfig({ ...authConfig, tokenUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    placeholder="https://api.ejemplo.com/oauth/token"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={authConfig.clientId}
                      onChange={(e) => setAuthConfig({ ...authConfig, clientId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={authConfig.clientSecret}
                      onChange={(e) => setAuthConfig({ ...authConfig, clientSecret: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scope (opcional)
                  </label>
                  <input
                    type="text"
                    value={authConfig.scope}
                    onChange={(e) => setAuthConfig({ ...authConfig, scope: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    placeholder="read:documents write:documents"
                  />
                </div>
              </div>
            )}

            {authType === 'BASIC_AUTH' && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Usuario
                  </label>
                  <input
                    type="text"
                    value={authConfig.username}
                    onChange={(e) => setAuthConfig({ ...authConfig, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={authConfig.password}
                    onChange={(e) => setAuthConfig({ ...authConfig, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            {authType === 'NONE' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  La API no requiere autenticación. Las solicitudes se realizarán sin credenciales.
                </p>
              </div>
            )}

            {/* Botón de probar conexión */}
            <div className="pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !baseUrl}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Probando...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4" />
                    Probar Conexión
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Verifica que la autenticación funcione correctamente antes de continuar
              </p>
            </div>
          </div>
        )}

        {/* PASO 3: Recursos PULL */}
        {step === 3 && (direction === 'PULL' || direction === 'BIDIRECTIONAL') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recursos a Sincronizar (PULL)
              </h2>
              <button
                type="button"
                onClick={handleAddResource}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Agregar Recurso
              </button>
            </div>

            {/* Lista de recursos */}
            {pullResources.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Database className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">
                  No hay recursos configurados
                </p>
                <button
                  type="button"
                  onClick={handleAddResource}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Primer Recurso
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {pullResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900">{resource.nombre}</h4>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {resource.tipoRecurso}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono">
                            {resource.method}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 font-mono">{resource.endpoint}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          type="button"
                          onClick={() => setEditingResource(resource)}
                          className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteResource(resource.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal de edición de recurso */}
            {editingResource && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {pullResources.find(r => r.id === editingResource.id) ? 'Editar' : 'Nuevo'} Recurso
                    </h3>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={editingResource.nombre}
                        onChange={(e) => setEditingResource({ ...editingResource, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Ej: Documentos Procesados, Proveedores, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Recurso <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={editingResource.tipoRecurso}
                        onChange={(e) => setEditingResource({ ...editingResource, tipoRecurso: e.target.value as ResourceType })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="DOCUMENTO">Documentos</option>
                        <option value="PROVEEDOR">Proveedores</option>
                        <option value="PRODUCTO">Productos</option>
                        <option value="CUENTA_CONTABLE">Cuentas Contables</option>
                        <option value="CENTRO_COSTO">Centros de Costo</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Método HTTP
                        </label>
                        <select
                          value={editingResource.method}
                          onChange={(e) => setEditingResource({ ...editingResource, method: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Data Path (opcional)
                        </label>
                        <input
                          type="text"
                          value={editingResource.dataPath || ''}
                          onChange={(e) => setEditingResource({ ...editingResource, dataPath: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                          placeholder="data.items"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Endpoint <span className="text-red-600">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">{baseUrl}</span>
                        <input
                          type="text"
                          value={editingResource.endpoint}
                          onChange={(e) => setEditingResource({ ...editingResource, endpoint: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                          placeholder="/documents"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingResource.paginationConfig?.enabled || false}
                          onChange={(e) => setEditingResource({
                            ...editingResource,
                            paginationConfig: {
                              ...editingResource.paginationConfig!,
                              enabled: e.target.checked
                            }
                          })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          El endpoint soporta paginación
                        </span>
                      </label>

                      {editingResource.paginationConfig?.enabled && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Tipo de Paginación
                            </label>
                            <select
                              value={editingResource.paginationConfig.type}
                              onChange={(e) => setEditingResource({
                                ...editingResource,
                                paginationConfig: {
                                  ...editingResource.paginationConfig!,
                                  type: e.target.value as any
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="PAGE_NUMBER">Page Number (page, pageSize)</option>
                              <option value="OFFSET_LIMIT">Offset/Limit (offset, limit)</option>
                              <option value="CURSOR">Cursor Based</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Tamaño de Página
                            </label>
                            <input
                              type="number"
                              value={editingResource.paginationConfig.pageSize}
                              onChange={(e) => setEditingResource({
                                ...editingResource,
                                paginationConfig: {
                                  ...editingResource.paginationConfig!,
                                  pageSize: parseInt(e.target.value)
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              min="1"
                              max="1000"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingResource(null)}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveResource}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Guardar Recurso
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 4: Field Mapping y Validación */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Mapeo de Campos y Validación
            </h2>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Field Mapping (opcional)
                </label>
                <button
                  type="button"
                  onClick={handleAddFieldMapping}
                  className="inline-flex items-center gap-1 px-3 py-1 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                >
                  <Plus className="w-3 h-3" />
                  Agregar Mapeo
                </button>
              </div>

              {pullFieldMapping.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    No hay mapeos de campos configurados. Si no agregas mapeos, los datos se importarán tal como vienen del API.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pullFieldMapping.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={mapping.sourceField}
                        onChange={(e) => handleUpdateFieldMapping(index, 'sourceField', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                        placeholder="campo_origen"
                      />
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={mapping.targetField}
                        onChange={(e) => handleUpdateFieldMapping(index, 'targetField', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                        placeholder="campoDestino"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteFieldMapping(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={requireValidation}
                  onChange={(e) => setRequireValidation(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    Requiere validación manual antes de importar
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Los datos se guardarán en una tabla de staging donde podrás revisarlos antes de aprobar la importación.
                  </p>
                </div>
              </label>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">
                {direction === 'BIDIRECTIONAL' ? 'Continúa con la configuración PUSH' : '¡Listo para crear!'}
              </h4>
              <p className="text-sm text-green-800">
                {direction === 'BIDIRECTIONAL'
                  ? 'En el siguiente paso configurarás la exportación de datos (PUSH).'
                  : 'Tu conector está configurado y listo. Revisa los pasos anteriores si necesitas hacer cambios.'
                }
              </p>
            </div>
          </div>
        )}

        {/* PASO 5 (o 3 para PUSH): Recursos PUSH */}
        {((step === 5 && direction === 'BIDIRECTIONAL') || (step === 3 && direction === 'PUSH')) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recursos a Exportar (PUSH)
              </h2>
              <button
                type="button"
                onClick={handleAddPushResource}
                className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Agregar Recurso
              </button>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-800">
                📤 Configurarás qué datos de Parse se exportarán hacia el sistema externo. Por ejemplo: documentos procesados, proveedores, productos, etc.
              </p>
            </div>

            {/* Lista de recursos PUSH */}
            {pushResources.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">
                  No hay recursos de exportación configurados
                </p>
                <button
                  type="button"
                  onClick={handleAddPushResource}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Primer Recurso
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {pushResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="p-4 border border-purple-200 rounded-lg hover:border-purple-300 transition-colors bg-purple-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900">{resource.nombre}</h4>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                            {resource.resourceType}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono">
                            {resource.method}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 font-mono">{resource.endpoint}</p>
                        {resource.batchSize && (
                          <p className="text-xs text-gray-500 mt-1">
                            Batch size: {resource.batchSize} registros
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          type="button"
                          onClick={() => setEditingPushResource(resource)}
                          className="p-2 text-gray-700 hover:bg-purple-100 rounded-lg transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePushResource(resource.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal de edición de recurso PUSH */}
            {editingPushResource && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {pushResources.find(r => r.id === editingPushResource.id) ? 'Editar' : 'Nuevo'} Recurso PUSH
                    </h3>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={editingPushResource.nombre}
                        onChange={(e) => setEditingPushResource({ ...editingPushResource, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Ej: Exportar Documentos, Sync Proveedores, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Recurso <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={editingPushResource.resourceType}
                        onChange={(e) => setEditingPushResource({ ...editingPushResource, resourceType: e.target.value as ResourceType })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="DOCUMENTO">Documentos</option>
                        <option value="PROVEEDOR">Proveedores</option>
                        <option value="PRODUCTO">Productos</option>
                        <option value="CUENTA_CONTABLE">Cuentas Contables</option>
                        <option value="CENTRO_COSTO">Centros de Costo</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Método HTTP
                        </label>
                        <select
                          value={editingPushResource.method}
                          onChange={(e) => setEditingPushResource({ ...editingPushResource, method: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tamaño del Lote
                        </label>
                        <input
                          type="number"
                          value={editingPushResource.batchSize || 50}
                          onChange={(e) => setEditingPushResource({ ...editingPushResource, batchSize: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          min="1"
                          max="1000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Endpoint <span className="text-red-600">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">{baseUrl}</span>
                        <input
                          type="text"
                          value={editingPushResource.endpoint}
                          onChange={(e) => setEditingPushResource({ ...editingPushResource, endpoint: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                          placeholder="/api/documents"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-800">
                        ℹ️ El mapeo de campos se puede configurar más adelante desde la página de detalle del conector.
                      </p>
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingPushResource(null)}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePushResource}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Guardar Recurso
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">¡Listo para crear!</h4>
              <p className="text-sm text-green-800">
                Tu conector está configurado y listo. Revisa los pasos anteriores si necesitas hacer cambios.
              </p>
            </div>
          </div>
        )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
          Anterior
        </button>

        <div className="flex items-center gap-3">
          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canGoNext()}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canGoNext()}
              className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              Crear Conector
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
