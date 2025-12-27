'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  ArrowLeft,
  Save,
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
  TestTube,
  Loader2
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

export default function EditApiConnectorPage() {
  const router = useRouter();
  const params = useParams();
  const connectorId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Datos del conector
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direction, setDirection] = useState<Direction>('PULL');
  const [baseUrl, setBaseUrl] = useState('');
  const [activo, setActivo] = useState(true);

  // Autenticacion
  const [authType, setAuthType] = useState<AuthType>('API_KEY');
  const [authConfig, setAuthConfig] = useState<Record<string, any>>({});

  // Recursos
  const [pullResources, setPullResources] = useState<PullResource[]>([]);
  const [pushResources, setPushResources] = useState<PushResource[]>([]);

  // Modales de edicion
  const [editingResource, setEditingResource] = useState<PullResource | null>(null);
  const [editingPushResource, setEditingPushResource] = useState<PushResource | null>(null);

  useEffect(() => {
    loadConnector();
  }, [connectorId]);

  const loadConnector = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api-connectors/${connectorId}`);
      const connector = response.data.data;

      setNombre(connector.nombre || '');
      setDescripcion(connector.descripcion || '');
      setDirection(connector.direction || 'PULL');
      setBaseUrl(connector.baseUrl || '');
      setActivo(connector.activo ?? true);
      setAuthType(connector.authType || 'API_KEY');
      setAuthConfig(connector.authConfig || {});
      setPullResources(connector.pullResources || []);
      setPushResources(connector.pushResources || []);
    } catch (error: any) {
      console.error('Error cargando conector:', error);
      toast.error('Error al cargar el conector');
      router.push('/api-connectors');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthTypeChange = (type: AuthType) => {
    setAuthType(type);
    switch (type) {
      case 'API_KEY':
        setAuthConfig({ location: 'header', headerName: 'X-API-Key', apiKey: authConfig.apiKey || '' });
        break;
      case 'BEARER_TOKEN':
        setAuthConfig({ token: authConfig.token || '' });
        break;
      case 'OAUTH2_CLIENT_CREDENTIALS':
        setAuthConfig({ tokenUrl: '', clientId: '', clientSecret: '', scope: '', ...authConfig });
        break;
      case 'BASIC_AUTH':
        setAuthConfig({ username: authConfig.username || '', password: authConfig.password || '' });
        break;
      case 'CUSTOM_HEADERS':
        setAuthConfig({ headers: authConfig.headers || {} });
        break;
      case 'NONE':
        setAuthConfig({});
        break;
    }
  };

  const handleTestConnection = async () => {
    if (!baseUrl) {
      toast.error('Completa la URL base primero');
      return;
    }

    try {
      setTesting(true);
      const response = await api.post(`/api-connectors/${connectorId}/test-connection`, {});
      if (response.data.success) {
        toast.success('Conexion exitosa!');
      } else {
        toast.error(`Conexion fallo: ${response.data.message}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al probar conexion');
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
      paginationConfig: { enabled: false, type: 'PAGE_NUMBER', pageSize: 100 }
    };
    setEditingResource(newResource);
  };

  const handleSaveResource = () => {
    if (!editingResource || !editingResource.nombre || !editingResource.endpoint) {
      toast.error('Completa los campos requeridos');
      return;
    }
    const existingIndex = pullResources.findIndex(r => r.id === editingResource.id);
    if (existingIndex >= 0) {
      const updated = [...pullResources];
      updated[existingIndex] = editingResource;
      setPullResources(updated);
    } else {
      setPullResources([...pullResources, editingResource]);
    }
    setEditingResource(null);
    toast.success('Recurso guardado');
  };

  const handleDeleteResource = (id: string) => {
    setPullResources(pullResources.filter(r => r.id !== id));
    toast.success('Recurso eliminado');
  };

  const handleAddPushResource = () => {
    const newResource: PushResource = {
      id: `push-resource-${Date.now()}`,
      nombre: '',
      endpoint: '',
      method: 'POST',
      resourceType: 'DOCUMENTO',
      activo: true,
      batchSize: 50
    };
    setEditingPushResource(newResource);
  };

  const handleSavePushResource = () => {
    if (!editingPushResource || !editingPushResource.nombre || !editingPushResource.endpoint) {
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

  const handleSubmit = async () => {
    if (!nombre || !baseUrl) {
      toast.error('Completa los campos requeridos');
      return;
    }

    const connectorData = {
      nombre,
      descripcion,
      direction,
      baseUrl,
      authType,
      authConfig,
      pullResources,
      pushResources,
      activo
    };

    try {
      setSaving(true);
      await api.put(`/api-connectors/${connectorId}`, connectorData);
      toast.success('Conector actualizado exitosamente!');
      router.push('/api-connectors');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al actualizar conector');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Editar Conector</h1>
            <p className="text-sm text-gray-600 mt-1">{nombre}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Info Basica */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informacion Basica</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Direccion
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'PULL', icon: Download, color: 'blue' },
                  { value: 'PUSH', icon: Upload, color: 'green' },
                  { value: 'BIDIRECTIONAL', icon: ArrowLeftRight, color: 'purple' }
                ].map(({ value, icon: Icon, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDirection(value as Direction)}
                    className={`flex-1 p-2 border-2 rounded-lg transition-all ${
                      direction === value
                        ? `border-${color}-600 bg-${color}-50`
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mx-auto ${direction === value ? `text-${color}-600` : 'text-gray-600'}`} />
                    <div className="text-xs mt-1">{value}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripcion</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL Base <span className="text-red-600">*</span>
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Autenticacion */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Autenticacion</h2>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { value: 'API_KEY', label: 'API Key', icon: Key },
              { value: 'BEARER_TOKEN', label: 'Bearer', icon: Shield },
              { value: 'OAUTH2_CLIENT_CREDENTIALS', label: 'OAuth 2.0', icon: Lock },
              { value: 'BASIC_AUTH', label: 'Basic', icon: Lock },
              { value: 'CUSTOM_HEADERS', label: 'Custom', icon: Settings },
              { value: 'NONE', label: 'Ninguna', icon: Database }
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleAuthTypeChange(value as AuthType)}
                className={`p-2 border-2 rounded-lg transition-all text-left ${
                  authType === value ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${authType === value ? 'text-blue-600' : 'text-gray-600'}`} />
                  <span className="text-sm">{label}</span>
                </div>
              </button>
            ))}
          </div>

          {authType === 'API_KEY' && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicacion</label>
                  <select
                    value={authConfig.location || 'header'}
                    onChange={(e) => setAuthConfig({ ...authConfig, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="header">Header</option>
                    <option value="query">Query Param</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Header/Param</label>
                  <input
                    type="text"
                    value={authConfig.headerName || authConfig.paramName || ''}
                    onChange={(e) => setAuthConfig({
                      ...authConfig,
                      [authConfig.location === 'query' ? 'paramName' : 'headerName']: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={authConfig.apiKey || ''}
                  onChange={(e) => setAuthConfig({ ...authConfig, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                />
              </div>
            </div>
          )}

          {authType === 'BEARER_TOKEN' && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
              <input
                type="password"
                value={authConfig.token || ''}
                onChange={(e) => setAuthConfig({ ...authConfig, token: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
          )}

          {authType === 'BASIC_AUTH' && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                <input
                  type="text"
                  value={authConfig.username || ''}
                  onChange={(e) => setAuthConfig({ ...authConfig, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
                <input
                  type="password"
                  value={authConfig.password || ''}
                  onChange={(e) => setAuthConfig({ ...authConfig, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !baseUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              {testing ? 'Probando...' : 'Probar Conexion'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Recursos PULL */}
      {(direction === 'PULL' || direction === 'BIDIRECTIONAL') && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recursos PULL</h2>
              <button
                type="button"
                onClick={handleAddResource}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>

            {pullResources.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Database className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No hay recursos configurados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pullResources.map((resource) => (
                  <div key={resource.id} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{resource.nombre}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{resource.tipoRecurso}</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono">{resource.method}</span>
                      </div>
                      <p className="text-sm text-gray-600 font-mono">{resource.endpoint}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingResource(resource)} className="p-2 hover:bg-gray-100 rounded">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteResource(resource.id)} className="p-2 hover:bg-red-50 text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recursos PUSH */}
      {(direction === 'PUSH' || direction === 'BIDIRECTIONAL') && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recursos PUSH</h2>
              <button
                type="button"
                onClick={handleAddPushResource}
                className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>

            {pushResources.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No hay recursos configurados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pushResources.map((resource) => (
                  <div key={resource.id} className="p-3 border border-purple-200 bg-purple-50 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{resource.nombre}</span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">{resource.resourceType}</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono">{resource.method}</span>
                      </div>
                      <p className="text-sm text-gray-600 font-mono">{resource.endpoint}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingPushResource(resource)} className="p-2 hover:bg-purple-100 rounded">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeletePushResource(resource.id)} className="p-2 hover:bg-red-50 text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal Editar Recurso PULL */}
      {editingResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Editar Recurso PULL</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={editingResource.nombre}
                  onChange={(e) => setEditingResource({ ...editingResource, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select
                    value={editingResource.tipoRecurso}
                    onChange={(e) => setEditingResource({ ...editingResource, tipoRecurso: e.target.value as ResourceType })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="DOCUMENTO">Documentos</option>
                    <option value="PROVEEDOR">Proveedores</option>
                    <option value="PRODUCTO">Productos</option>
                    <option value="CUENTA_CONTABLE">Cuentas Contables</option>
                    <option value="CENTRO_COSTO">Centros de Costo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Metodo</label>
                  <select
                    value={editingResource.method}
                    onChange={(e) => setEditingResource({ ...editingResource, method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Endpoint</label>
                <input
                  type="text"
                  value={editingResource.endpoint}
                  onChange={(e) => setEditingResource({ ...editingResource, endpoint: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setEditingResource(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSaveResource} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Recurso PUSH */}
      {editingPushResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Editar Recurso PUSH</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={editingPushResource.nombre}
                  onChange={(e) => setEditingPushResource({ ...editingPushResource, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select
                    value={editingPushResource.resourceType}
                    onChange={(e) => setEditingPushResource({ ...editingPushResource, resourceType: e.target.value as ResourceType })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="DOCUMENTO">Documentos</option>
                    <option value="PROVEEDOR">Proveedores</option>
                    <option value="PRODUCTO">Productos</option>
                    <option value="CUENTA_CONTABLE">Cuentas Contables</option>
                    <option value="CENTRO_COSTO">Centros de Costo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Metodo</label>
                  <select
                    value={editingPushResource.method}
                    onChange={(e) => setEditingPushResource({ ...editingPushResource, method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Endpoint</label>
                <input
                  type="text"
                  value={editingPushResource.endpoint}
                  onChange={(e) => setEditingPushResource({ ...editingPushResource, endpoint: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Batch Size</label>
                <input
                  type="number"
                  value={editingPushResource.batchSize || 50}
                  onChange={(e) => setEditingPushResource({ ...editingPushResource, batchSize: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="1"
                  max="1000"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setEditingPushResource(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSavePushResource} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
