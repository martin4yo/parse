'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { parametrosApi } from '@/lib/api';

interface CampoRendicion {
  codigo: string;
  nombre: string;
  grupo: string;
}

interface SimpleParamMaestroFormProps {
  onAdd: (config: SimpleParamMaestroConfig) => void;
  onCancel: () => void;
}

export interface SimpleParamMaestroConfig {
  vistaOrigen: string;
  tipoCampo: string;
  modoSync: 'completa' | 'incremental';
  campoFecha?: string;
}

export default function SimpleParamMaestroForm({ onAdd, onCancel }: SimpleParamMaestroFormProps) {
  const [camposRendicion, setCamposRendicion] = useState<CampoRendicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<SimpleParamMaestroConfig>({
    vistaOrigen: '',
    tipoCampo: '',
    modoSync: 'incremental',
    campoFecha: 'updatedAt'
  });

  useEffect(() => {
    fetchCamposRendicion();
  }, []);

  const fetchCamposRendicion = async () => {
    try {
      setLoading(true);
      const data = await parametrosApi.getCamposRendicion();
      setCamposRendicion(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar campos de rendición');
      setCamposRendicion([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!formData.vistaOrigen) {
      toast.error('Vista origen es requerida');
      return;
    }

    if (!formData.tipoCampo) {
      toast.error('Tipo de campo es requerido');
      return;
    }

    if (formData.modoSync === 'incremental' && !formData.campoFecha) {
      toast.error('Campo de fecha es requerido para modo incremental');
      return;
    }

    onAdd(formData);
  };

  // Vista previa de la query generada
  const getGeneratedQuery = () => {
    const { vistaOrigen, tipoCampo, modoSync, campoFecha } = formData;

    if (!vistaOrigen || !tipoCampo) return '';

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

    return query;
  };

  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          Parámetro Maestro (Modo Simplificado)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Vista Origen */}
          <div>
            <Label htmlFor="vistaOrigen">
              Vista Origen en SQL Server *
            </Label>
            <Input
              id="vistaOrigen"
              value={formData.vistaOrigen}
              onChange={(e) => setFormData({ ...formData, vistaOrigen: e.target.value })}
              placeholder="ej: vista_plan_cuentas"
              required
            />
            <p className="text-xs text-gray-600 mt-1">
              Nombre de la vista o tabla en SQL Server que contiene los datos
            </p>
          </div>

          {/* Tipo Campo / Campo de Rendición */}
          <div>
            <Label htmlFor="tipoCampo">
              Campo de Rendición *
            </Label>
            {loading ? (
              <div className="text-sm text-gray-500">Cargando campos...</div>
            ) : (
              <Select
                id="tipoCampo"
                value={formData.tipoCampo}
                onChange={(e) => setFormData({ ...formData, tipoCampo: e.target.value })}
                required
              >
                <option value="">Seleccionar campo de rendición...</option>
                {Object.entries(
                  camposRendicion.reduce((acc, campo) => {
                    if (!acc[campo.grupo]) acc[campo.grupo] = [];
                    acc[campo.grupo].push(campo);
                    return acc;
                  }, {} as Record<string, CampoRendicion[]>)
                ).map(([grupo, campos]) => (
                  <optgroup key={grupo} label={grupo}>
                    {campos.map((campo) => (
                      <option key={campo.codigo} value={campo.codigo}>
                        {campo.nombre}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Campo de la tabla rendicion_tarjeta que se sincronizará
            </p>
          </div>

          {/* Modo Sync */}
          <div>
            <Label>Modo de Sincronización *</Label>
            <div className="space-y-2 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="modoSync"
                  value="incremental"
                  checked={formData.modoSync === 'incremental'}
                  onChange={(e) => setFormData({ ...formData, modoSync: 'incremental' })}
                  className="mr-2"
                />
                <div>
                  <div className="font-medium">Incremental</div>
                  <div className="text-xs text-gray-600">
                    Solo sincroniza registros modificados desde la última sync
                  </div>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="modoSync"
                  value="completa"
                  checked={formData.modoSync === 'completa'}
                  onChange={(e) => setFormData({ ...formData, modoSync: 'completa' })}
                  className="mr-2"
                />
                <div>
                  <div className="font-medium">Completa</div>
                  <div className="text-xs text-gray-600">
                    Sincroniza todos los registros cada vez
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Campo Fecha (solo si incremental) */}
          {formData.modoSync === 'incremental' && (
            <div>
              <Label htmlFor="campoFecha">
                Campo de Fecha para Incremental *
              </Label>
              <Input
                id="campoFecha"
                value={formData.campoFecha}
                onChange={(e) => setFormData({ ...formData, campoFecha: e.target.value })}
                placeholder="updatedAt"
                required
              />
              <p className="text-xs text-gray-600 mt-1">
                Campo que indica cuándo se modificó el registro
              </p>
            </div>
          )}

          {/* Preview de Query */}
          {formData.vistaOrigen && formData.tipoCampo && (
            <div className="p-3 bg-gray-900 text-green-400 rounded-md font-mono text-xs overflow-x-auto">
              <div className="text-gray-400 mb-2">📝 Query que se ejecutará:</div>
              <pre className="whitespace-pre-wrap">{getGeneratedQuery()}</pre>
            </div>
          )}

          {/* Info */}
          <div className="p-3 bg-blue-100 border border-blue-300 rounded-md flex gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Modo Simplificado:</strong> Solo selecciona el campo de rendición y la vista origen.
              El sistema genera automáticamente la query para sincronizar valores a <code>parametros_maestros</code>.
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e as any);
              }}
            >
              Agregar Parámetro Maestro
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
