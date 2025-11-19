'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/Badge';
import {
  FileSearch,
  Save,
  RefreshCw,
  Play,
  Settings,
  MapPin,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ZoneConfig {
  nombre: string;
  topY: number;
  centerXMin: number;
  centerXMax: number;
  descripcion: string;
}

interface PatternConfig {
  nombre: string;
  patrones: string[];
  codigoAFIP?: string;
  activo: boolean;
}

interface PriorityConfig {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

interface OptionsConfig {
  usarZonaSuperior: boolean;
  buscarLetraSola: boolean;
  logDetallado: boolean;
}

interface DetectionConfig {
  id?: string;
  nombre?: string;
  descripcion?: string;
  zonaBusqueda: {
    zona1: ZoneConfig;
    zona2: ZoneConfig;
  };
  patronesBusqueda: {
    [key: string]: PatternConfig;
  };
  prioridades: PriorityConfig[];
  opciones: OptionsConfig;
}

export default function DocumentAIConfigPage() {
  const [config, setConfig] = useState<DetectionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDocumentAIEnabled, setIsDocumentAIEnabled] = useState(false);

  useEffect(() => {
    loadConfig();
    checkDocumentAIStatus();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/document-detection-config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error cargando configuración');
      }

      const data = await response.json();
      setConfig(data.config);
    } catch (error) {
      console.error('Error:', error);
      toast.error('No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const checkDocumentAIStatus = async () => {
    try {
      const response = await fetch('/api/documentos/processor-status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsDocumentAIEnabled(data.useDocumentAI || false);
      }
    } catch (error) {
      console.error('Error checking Document AI status:', error);
    }
  };

  const toggleDocumentAI = async (enabled: boolean) => {
    // Esta funcionalidad requeriría un endpoint adicional para actualizar
    // la configuración de Document AI a nivel tenant
    setIsDocumentAIEnabled(enabled);
    toast.success(
      enabled
        ? 'Document AI activado. Se usará para procesar documentos.'
        : 'Document AI desactivado. Se usarán otros métodos de procesamiento.'
    );
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);

      const response = await fetch('/api/document-detection-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          nombre: config.nombre || 'Configuración Personalizada',
          descripcion: config.descripcion || 'Configuración editada desde la UI',
          zonaBusqueda: config.zonaBusqueda,
          patronesBusqueda: config.patronesBusqueda,
          prioridades: config.prioridades,
          opciones: config.opciones,
          activarInmediatamente: true
        })
      });

      if (!response.ok) {
        throw new Error('Error guardando configuración');
      }

      toast.success('Configuración guardada. Los cambios se aplicarán en el próximo documento procesado.');

      await loadConfig();
    } catch (error) {
      console.error('Error:', error);
      toast.error('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const updateZone = (zoneKey: 'zona1' | 'zona2', field: keyof ZoneConfig, value: any) => {
    if (!config) return;

    setConfig({
      ...config,
      zonaBusqueda: {
        ...config.zonaBusqueda,
        [zoneKey]: {
          ...config.zonaBusqueda[zoneKey],
          [field]: value
        }
      }
    });
  };

  const updatePattern = (patternKey: string, field: keyof PatternConfig, value: any) => {
    if (!config) return;

    setConfig({
      ...config,
      patronesBusqueda: {
        ...config.patronesBusqueda,
        [patternKey]: {
          ...config.patronesBusqueda[patternKey],
          [field]: value
        }
      }
    });
  };

  const updateOption = (field: keyof OptionsConfig, value: boolean) => {
    if (!config) return;

    setConfig({
      ...config,
      opciones: {
        ...config.opciones,
        [field]: value
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No se pudo cargar la configuración de Document AI
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <FileSearch className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Configuración Document AI
            </h1>
            <p className="text-text-secondary">
              Configura la detección automática de tipos de comprobantes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="document-ai-toggle"
              checked={isDocumentAIEnabled}
              onCheckedChange={toggleDocumentAI}
            />
            <Badge variant={isDocumentAIEnabled ? 'default' : 'secondary'}>
              {isDocumentAIEnabled ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>

          <Button onClick={loadConfig} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Recargar
          </Button>

          <Button onClick={saveConfig} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar Cambios
          </Button>
        </div>
      </div>

      <Tabs defaultValue="zones" className="space-y-4">
        <TabsList>
          <TabsTrigger value="zones">
            <MapPin className="h-4 w-4 mr-2" />
            Zonas de Búsqueda
          </TabsTrigger>
          <TabsTrigger value="patterns">
            <FileText className="h-4 w-4 mr-2" />
            Patrones
          </TabsTrigger>
          <TabsTrigger value="options">
            <Settings className="h-4 w-4 mr-2" />
            Opciones
          </TabsTrigger>
        </TabsList>

        {/* Tab: Zonas de Búsqueda */}
        <TabsContent value="zones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zona 1: {config.zonaBusqueda.zona1.nombre}</CardTitle>
              <CardDescription>{config.zonaBusqueda.zona1.descripcion}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>
                  Límite Superior (topY): {(config.zonaBusqueda.zona1.topY * 100).toFixed(0)}%
                </Label>
                <Slider
                  value={[config.zonaBusqueda.zona1.topY * 100]}
                  onValueChange={([value]) => updateZone('zona1', 'topY', value / 100)}
                  min={10}
                  max={50}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Busca en el {(config.zonaBusqueda.zona1.topY * 100).toFixed(0)}% superior de la página
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Centro Mínimo (X): {(config.zonaBusqueda.zona1.centerXMin * 100).toFixed(0)}%
                  </Label>
                  <Slider
                    value={[config.zonaBusqueda.zona1.centerXMin * 100]}
                    onValueChange={([value]) => updateZone('zona1', 'centerXMin', value / 100)}
                    min={0}
                    max={50}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Centro Máximo (X): {(config.zonaBusqueda.zona1.centerXMax * 100).toFixed(0)}%
                  </Label>
                  <Slider
                    value={[config.zonaBusqueda.zona1.centerXMax * 100]}
                    onValueChange={([value]) => updateZone('zona1', 'centerXMax', value / 100)}
                    min={50}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm">
                  La zona actual cubre desde <strong>{(config.zonaBusqueda.zona1.centerXMin * 100).toFixed(0)}%</strong> hasta{' '}
                  <strong>{(config.zonaBusqueda.zona1.centerXMax * 100).toFixed(0)}%</strong> horizontalmente, en el{' '}
                  <strong>{(config.zonaBusqueda.zona1.topY * 100).toFixed(0)}%</strong> superior de la página.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zona 2: {config.zonaBusqueda.zona2.nombre}</CardTitle>
              <CardDescription>{config.zonaBusqueda.zona2.descripcion}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>
                  Límite Superior (topY): {(config.zonaBusqueda.zona2.topY * 100).toFixed(0)}%
                </Label>
                <Slider
                  value={[config.zonaBusqueda.zona2.topY * 100]}
                  onValueChange={([value]) => updateZone('zona2', 'topY', value / 100)}
                  min={20}
                  max={60}
                  step={5}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Centro Mínimo (X): {(config.zonaBusqueda.zona2.centerXMin * 100).toFixed(0)}%
                  </Label>
                  <Slider
                    value={[config.zonaBusqueda.zona2.centerXMin * 100]}
                    onValueChange={([value]) => updateZone('zona2', 'centerXMin', value / 100)}
                    min={0}
                    max={50}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Centro Máximo (X): {(config.zonaBusqueda.zona2.centerXMax * 100).toFixed(0)}%
                  </Label>
                  <Slider
                    value={[config.zonaBusqueda.zona2.centerXMax * 100]}
                    onValueChange={([value]) => updateZone('zona2', 'centerXMax', value / 100)}
                    min={50}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Patrones */}
        <TabsContent value="patterns" className="space-y-4">
          <div className="grid gap-4">
            {Object.entries(config.patronesBusqueda).map(([key, pattern]) => (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{pattern.nombre}</CardTitle>
                      {pattern.codigoAFIP && (
                        <Badge variant="outline">Código AFIP: {pattern.codigoAFIP}</Badge>
                      )}
                    </div>
                    <Switch
                      checked={pattern.activo}
                      onCheckedChange={(checked) => updatePattern(key, 'activo', checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Patrones de detección:</Label>
                    <div className="flex flex-wrap gap-2">
                      {pattern.patrones.map((patron, idx) => (
                        <Badge key={idx} variant="secondary" className="font-mono text-xs">
                          {patron}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Opciones */}
        <TabsContent value="options" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Opciones de Detección</CardTitle>
              <CardDescription>
                Configura el comportamiento general del sistema de detección
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Usar Zona Superior</Label>
                  <p className="text-sm text-muted-foreground">
                    Buscar el tipo de comprobante primero en la zona superior central
                  </p>
                </div>
                <Switch
                  checked={config.opciones.usarZonaSuperior}
                  onCheckedChange={(checked) => updateOption('usarZonaSuperior', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Buscar Letra Sola</Label>
                  <p className="text-sm text-muted-foreground">
                    Detectar letras individuales (A, B, C, E, M) en recuadros
                  </p>
                </div>
                <Switch
                  checked={config.opciones.buscarLetraSola}
                  onCheckedChange={(checked) => updateOption('buscarLetraSola', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Log Detallado</Label>
                  <p className="text-sm text-muted-foreground">
                    Mostrar información detallada en los logs del servidor
                  </p>
                </div>
                <Switch
                  checked={config.opciones.logDetallado}
                  onCheckedChange={(checked) => updateOption('logDetallado', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prioridades de Detección</CardTitle>
              <CardDescription>
                Orden en que se aplican las reglas de detección
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {config.prioridades
                  .sort((a, b) => a.orden - b.orden)
                  .map((prioridad) => (
                    <div
                      key={prioridad.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{prioridad.orden}</Badge>
                        <span className="font-medium">{prioridad.nombre}</span>
                      </div>
                      <CheckCircle2
                        className={`h-5 w-5 ${prioridad.activo ? 'text-green-600' : 'text-gray-300'}`}
                      />
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
