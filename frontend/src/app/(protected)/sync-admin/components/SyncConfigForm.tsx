'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Save, TestTube, Plus, Trash2, ArrowLeft, Sparkles, Lightbulb, Zap, Package, Download, FolderDown } from 'lucide-react';
import { SyncConfigFormData, TablaSubida, TablaBajada, Tenant } from '@/types/sync';
import { toast } from 'sonner';
import PhaseEditor from './PhaseEditor';
import SimpleParamMaestroForm, { SimpleParamMaestroConfig } from './SimpleParamMaestroForm';
import { useApiClient } from '@/hooks/useApiClient';

interface SyncConfigFormProps {
  initialData?: SyncConfigFormData;
  configId?: string;
}

export default function SyncConfigForm({ initialData, configId }: SyncConfigFormProps) {
  const router = useRouter();
  const { get, post, put } = useApiClient();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showSimpleParamForm, setShowSimpleParamForm] = useState(false);

  const [formData, setFormData] = useState<SyncConfigFormData>(
    initialData || {
      tenantId: '',
      sqlServerHost: '',
      sqlServerPort: 1433,
      sqlServerDatabase: '',
      sqlServerUser: '',
      sqlServerPassword: '',
      configuracionTablas: {
        tablasSubida: [],
        tablasBajada: [],
      },
      activo: true,
    }
  );

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const data = await get('/api/tenants');

      if (data.success) {
        setTenants(data.data);
      } else {
        toast.error('Error al cargar tenants');
      }
    } catch (error) {
      console.error('Error al cargar tenants:', error);
      toast.error('Error al cargar lista de tenants');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const data = await post('/api/sync/test-connection', {
        host: formData.sqlServerHost,
        port: formData.sqlServerPort,
        database: formData.sqlServerDatabase,
        user: formData.sqlServerUser,
        password: formData.sqlServerPassword,
      });

      if (data.success) {
        toast.success('Conexión exitosa');
      } else {
        toast.error(data.error || 'Error al conectar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al probar conexión');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = configId
        ? await put(`/api/sync/configurations/${configId}`, formData)
        : await post('/api/sync/configurations', formData);

      if (data.success) {
        toast.success(
          configId ? 'Configuración actualizada' : 'Configuración creada'
        );
        router.push('/sync-admin');
      } else {
        toast.error(data.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setLoading(false);
    }
  };

  const addTablaSubida = () => {
    setFormData({
      ...formData,
      configuracionTablas: {
        ...formData.configuracionTablas,
        tablasSubida: [
          ...formData.configuracionTablas.tablasSubida,
          {
            nombre: '',
            primaryKey: 'id',
            incremental: false,
            process: {
              query: '',
            },
          },
        ],
      },
    });
  };

  const addParamMaestro = (config: SimpleParamMaestroConfig) => {
    const { vistaOrigen, tipoCampo, modoSync, campoFecha } = config;

    // Generar la query automáticamente
    let query = `SELECT
  codigo,
  nombre,
  '${tipoCampo}' as tipo_campo,
  parametros_json,
  activo,
  updatedAt
FROM ${vistaOrigen}`;

    if (modoSync === 'incremental' && campoFecha) {
      query += `\nWHERE ${campoFecha} > @ultimaSync OR @ultimaSync IS NULL`;
    }

    // Convertir a TablaSubida
    const tablaSubida: TablaSubida = {
      nombre: 'parametros_maestros',
      primaryKey: 'codigo',
      incremental: modoSync === 'incremental',
      campoFecha: modoSync === 'incremental' ? campoFecha : undefined,
      process: {
        query,
      },
    };

    // Agregar a la configuración
    setFormData({
      ...formData,
      configuracionTablas: {
        ...formData.configuracionTablas,
        tablasSubida: [
          ...formData.configuracionTablas.tablasSubida,
          tablaSubida,
        ],
      },
    });

    // Cerrar el formulario
    setShowSimpleParamForm(false);
    toast.success(`Parámetro maestro "${tipoCampo}" agregado`);
  };

  const removeTablaSubida = (index: number) => {
    const newTablas = [...formData.configuracionTablas.tablasSubida];
    newTablas.splice(index, 1);
    setFormData({
      ...formData,
      configuracionTablas: {
        ...formData.configuracionTablas,
        tablasSubida: newTablas,
      },
    });
  };

  const updateTablaSubida = (index: number, data: Partial<TablaSubida>) => {
    const newTablas = [...formData.configuracionTablas.tablasSubida];
    newTablas[index] = { ...newTablas[index], ...data };
    setFormData({
      ...formData,
      configuracionTablas: {
        ...formData.configuracionTablas,
        tablasSubida: newTablas,
      },
    });
  };

  const addTablaBajada = () => {
    setFormData({
      ...formData,
      configuracionTablas: {
        ...formData.configuracionTablas,
        tablasBajada: [
          ...formData.configuracionTablas.tablasBajada,
          {
            nombre: '',
            primaryKey: 'id',
            incremental: false,
            schema: {
              columns: [],
            },
            process: {
              query: '',
            },
          },
        ],
      },
    });
  };

  const removeTablaBajada = (index: number) => {
    const newTablas = [...formData.configuracionTablas.tablasBajada];
    newTablas.splice(index, 1);
    setFormData({
      ...formData,
      configuracionTablas: {
        ...formData.configuracionTablas,
        tablasBajada: newTablas,
      },
    });
  };

  const updateTablaBajada = (index: number, data: Partial<TablaBajada>) => {
    const newTablas = [...formData.configuracionTablas.tablasBajada];
    newTablas[index] = { ...newTablas[index], ...data };
    setFormData({
      ...formData,
      configuracionTablas: {
        ...formData.configuracionTablas,
        tablasBajada: newTablas,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header con botones */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/sync-admin')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !formData.sqlServerHost}
          >
            <TestTube className="h-4 w-4 mr-2" />
            Probar Conexión
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Configuración SQL Server */}
      <Card>
        <CardHeader>
          <CardTitle>Conexión SQL Server</CardTitle>
          <CardDescription>
            Datos de conexión al servidor SQL Server del cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="tenantId">Tenant *</Label>
            {configId ? (
              <Input
                id="tenantId"
                value={formData.tenantId}
                disabled
                className="bg-gray-100"
              />
            ) : (
              <Select
                value={formData.tenantId}
                onChange={(e) =>
                  setFormData({ ...formData, tenantId: e.target.value })
                }
                required
              >
                <option value="">Seleccionar tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.nombre} ({tenant.cuit})
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="host">Host *</Label>
            <Input
              id="host"
              value={formData.sqlServerHost}
              onChange={(e) =>
                setFormData({ ...formData, sqlServerHost: e.target.value })
              }
              placeholder="192.168.1.100 o servidor.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="port">Puerto</Label>
            <Input
              id="port"
              type="number"
              value={formData.sqlServerPort}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sqlServerPort: parseInt(e.target.value),
                })
              }
              placeholder="1433"
            />
          </div>

          <div>
            <Label htmlFor="database">Base de Datos *</Label>
            <Input
              id="database"
              value={formData.sqlServerDatabase}
              onChange={(e) =>
                setFormData({ ...formData, sqlServerDatabase: e.target.value })
              }
              placeholder="EmpresaDB"
              required
            />
          </div>

          <div>
            <Label htmlFor="user">Usuario *</Label>
            <Input
              id="user"
              value={formData.sqlServerUser}
              onChange={(e) =>
                setFormData({ ...formData, sqlServerUser: e.target.value })
              }
              placeholder="sync_user"
              required
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="password">Contraseña *</Label>
            <Input
              id="password"
              type="password"
              value={formData.sqlServerPassword}
              onChange={(e) =>
                setFormData({ ...formData, sqlServerPassword: e.target.value })
              }
              placeholder="••••••••"
              required={!configId} // Solo requerido en creación
            />
            {configId && (
              <p className="text-sm text-gray-500 mt-1">
                Dejar vacío para mantener la contraseña actual
              </p>
            )}
          </div>

          <div className="col-span-2 flex items-center space-x-2">
            <Switch
              id="activo"
              checked={formData.activo}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, activo: checked })
              }
            />
            <Label htmlFor="activo">Sincronización activa</Label>
          </div>
        </CardContent>
      </Card>

      {/* Configuración de Tablas */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Tablas</CardTitle>
          <CardDescription>
            Define qué tablas se sincronizan y en qué dirección
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upload">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">
                Subida (Cliente → Backend){' '}
                <Badge variant="outline" className="ml-2">
                  {formData.configuracionTablas.tablasSubida.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="download">
                Bajada (Backend → Cliente){' '}
                <Badge variant="outline" className="ml-2">
                  {formData.configuracionTablas.tablasBajada.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Tablas de subida */}
            <TabsContent value="upload" className="space-y-4">
              {formData.configuracionTablas.tablasSubida.map((tabla, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Tabla #{index + 1}
                      </CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTablaSubida(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nombre Vista/Tabla</Label>
                        <Input
                          value={tabla.nombre}
                          onChange={(e) =>
                            updateTablaSubida(index, { nombre: e.target.value })
                          }
                          placeholder="vista_proveedores"
                        />
                      </div>
                      <div>
                        <Label>Primary Key</Label>
                        <Input
                          value={tabla.primaryKey}
                          onChange={(e) =>
                            updateTablaSubida(index, { primaryKey: e.target.value })
                          }
                          placeholder="id"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={tabla.incremental}
                        onCheckedChange={(checked) =>
                          updateTablaSubida(index, { incremental: checked })
                        }
                      />
                      <Label>Sincronización Incremental</Label>
                    </div>

                    {tabla.incremental && (
                      <div>
                        <Label>Campo de Fecha</Label>
                        <Input
                          value={tabla.campoFecha || ''}
                          onChange={(e) =>
                            updateTablaSubida(index, { campoFecha: e.target.value })
                          }
                          placeholder="updated_at"
                        />
                      </div>
                    )}

                    <div>
                      <Label>Query de Extracción</Label>
                      <Textarea
                        value={tabla.process.query}
                        onChange={(e) =>
                          updateTablaSubida(index, {
                            process: { ...tabla.process, query: e.target.value },
                          })
                        }
                        placeholder="SELECT * FROM vista_proveedores WHERE updated_at > @ultimaSync"
                        rows={3}
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* Fases avanzadas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PhaseEditor
                        title="Pre-Process"
                        phase={tabla.pre_process}
                        onChange={(phase) =>
                          updateTablaSubida(index, { pre_process: phase })
                        }
                        description="Ejecuta antes de extraer datos"
                      />
                      <PhaseEditor
                        title="Post-Process"
                        phase={tabla.post_process}
                        onChange={(phase) =>
                          updateTablaSubida(index, { post_process: phase })
                        }
                        description="Ejecuta después de subir datos"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Formulario Simple de Parámetro Maestro */}
              {showSimpleParamForm && (
                <SimpleParamMaestroForm
                  onAdd={addParamMaestro}
                  onCancel={() => setShowSimpleParamForm(false)}
                />
              )}

              {/* Botones para agregar tablas */}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={addTablaSubida}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tabla Avanzada
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setShowSimpleParamForm(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Parámetro Maestro
                </Button>
              </div>
            </TabsContent>

            {/* Tablas de bajada */}
            <TabsContent value="download" className="space-y-4">
              {formData.configuracionTablas.tablasBajada.map((tabla, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Tabla #{index + 1}
                      </CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTablaBajada(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nombre Tabla Destino</Label>
                        <Input
                          value={tabla.nombre}
                          onChange={(e) =>
                            updateTablaBajada(index, { nombre: e.target.value })
                          }
                          placeholder="plan_cuentas"
                        />
                      </div>
                      <div>
                        <Label>Primary Key</Label>
                        <Input
                          value={tabla.primaryKey}
                          onChange={(e) =>
                            updateTablaBajada(index, { primaryKey: e.target.value })
                          }
                          placeholder="codigo"
                        />
                      </div>
                    </div>

                    {/* Sincronización Incremental */}
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={tabla.incremental || false}
                          onCheckedChange={(checked) =>
                            updateTablaBajada(index, { incremental: checked })
                          }
                        />
                        <Label>Sincronización Incremental</Label>
                      </div>

                      {tabla.incremental && (
                        <div className="ml-6 p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3">
                          <div>
                            <Label>Campo de Fecha</Label>
                            <Input
                              value={tabla.campoFecha || ''}
                              onChange={(e) =>
                                updateTablaBajada(index, { campoFecha: e.target.value })
                              }
                              placeholder="updatedAt"
                            />
                            <p className="text-xs text-gray-600 mt-1">
                              Nombre del campo de fecha/timestamp en la tabla (ej: updatedAt, modified_at)
                            </p>
                          </div>
                          <div className="bg-blue-100 border-l-4 border-blue-500 p-3 text-sm">
                            <p className="font-semibold text-blue-800 mb-1 flex items-center gap-2">
                              <Lightbulb className="h-4 w-4" />
                              Sincronización por fecha:
                            </p>
                            <p className="text-blue-700">
                              El sistema descargará solo registros modificados después de la última sincronización exitosa.
                              Asegurate que el campo configurado se actualice automáticamente cuando el registro cambia.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Descarga de Archivos */}
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={tabla.descargarArchivos || false}
                          onCheckedChange={(checked) =>
                            updateTablaBajada(index, { descargarArchivos: checked })
                          }
                        />
                        <Label className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Descargar Archivos Adjuntos
                        </Label>
                      </div>

                      {tabla.descargarArchivos && (
                        <div className="ml-6 p-4 bg-green-50 border border-green-200 rounded-md space-y-3">
                          <div>
                            <Label>Campo con Ruta del Archivo</Label>
                            <Input
                              value={tabla.campoRutaArchivo || ''}
                              onChange={(e) =>
                                updateTablaBajada(index, { campoRutaArchivo: e.target.value })
                              }
                              placeholder="rutaArchivo"
                            />
                            <p className="text-xs text-gray-600 mt-1">
                              Campo que contiene la URL o ruta del archivo (ej: rutaArchivo, fileUrl)
                            </p>
                          </div>
                          <div>
                            <Label>Carpeta de Destino</Label>
                            <Input
                              value={tabla.carpetaArchivos || ''}
                              onChange={(e) =>
                                updateTablaBajada(index, { carpetaArchivos: e.target.value })
                              }
                              placeholder="C:\MisDocumentos\Sync"
                            />
                            <p className="text-xs text-gray-600 mt-1">
                              Carpeta local donde se guardarán los archivos descargados (default: ./archivos_sync)
                            </p>
                          </div>
                          <div className="bg-green-100 border-l-4 border-green-500 p-3 text-sm">
                            <p className="font-semibold text-green-800 mb-1 flex items-center gap-2">
                              <FolderDown className="h-4 w-4" />
                              Descarga automática:
                            </p>
                            <p className="text-green-700">
                              Los archivos se descargarán automáticamente después de sincronizar los datos.
                              Se mantiene la estructura de carpetas original.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Tipo de Campo (maestros_parametros)</Label>
                      <Input
                        value={tabla.tipoCampo || ''}
                        onChange={(e) =>
                          updateTablaBajada(index, { tipoCampo: e.target.value })
                        }
                        placeholder="cuenta"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Tipo de campo en parametros_maestros para filtrar datos
                      </p>
                    </div>

                    <div>
                      <Label>Query de Extracción (Backend)</Label>
                      <Textarea
                        value={tabla.process.query}
                        onChange={(e) =>
                          updateTablaBajada(index, {
                            process: { ...tabla.process, query: e.target.value },
                          })
                        }
                        placeholder="SELECT * FROM parametros_maestros WHERE tipo_campo = 'cuenta' AND tenantId = $1"
                        rows={3}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        {tabla.incremental ? (
                          <>
                            <Zap className="h-3 w-3" />
                            El filtro incremental se agrega automáticamente según campoFecha/campoId
                          </>
                        ) : (
                          <>
                            <Package className="h-3 w-3" />
                            Sincronización completa - se descargan todos los registros
                          </>
                        )}
                      </p>
                    </div>

                    {/* Fases avanzadas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PhaseEditor
                        title="Pre-Process"
                        phase={tabla.pre_process}
                        onChange={(phase) =>
                          updateTablaBajada(index, { pre_process: phase })
                        }
                        description="Ejecuta antes de bajar datos (ej: crear tabla)"
                      />
                      <PhaseEditor
                        title="Post-Process"
                        phase={tabla.post_process}
                        onChange={(phase) =>
                          updateTablaBajada(index, { post_process: phase })
                        }
                        description="Ejecuta después de bajar datos (ej: MERGE)"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button type="button" variant="outline" onClick={addTablaBajada}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Tabla de Bajada
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </form>
  );
}
