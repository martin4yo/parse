'use client';

import { useState, useEffect } from 'react';
import { Sparkles, HelpCircle } from 'lucide-react';
import { aiConfigsApi, type AIAvailableModels, type AIModel } from '@/lib/api';

interface AILookupFormProps {
  value: any;
  onChange: (value: any) => void;
}

export function AILookupForm({ value, onChange }: AILookupFormProps) {
  const [formData, setFormData] = useState({
    campo: value?.campo || '',
    campoTexto: value?.campoTexto || '',
    tabla: value?.tabla || 'parametros_maestros',
    filtro: value?.filtro ? JSON.stringify(value.filtro, null, 2) : '{\n  "tipo_campo": "",\n  "activo": true\n}',
    campoRetorno: value?.campoRetorno || 'codigo',
    umbralConfianza: value?.umbralConfianza ? (parseFloat(value.umbralConfianza) * 100) : 85,
    requiereAprobacion: value?.requiereAprobacion !== false,
    instruccionesAdicionales: value?.instruccionesAdicionales || '',
    valorDefecto: value?.valorDefecto || '',
    aiProvider: value?.aiProvider || 'gemini',
    aiModel: value?.aiModel || ''
  });

  const [filtroError, setFiltroError] = useState('');
  const [availableModels, setAvailableModels] = useState<AIAvailableModels | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);

  // Cargar modelos disponibles
  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await aiConfigsApi.getAvailableModels();
        setAvailableModels(models);
      } catch (error) {
        console.error('Error loading AI models:', error);
      } finally {
        setLoadingModels(false);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    // Validar JSON del filtro
    try {
      JSON.parse(formData.filtro);
      setFiltroError('');
    } catch (e) {
      setFiltroError('JSON inválido');
    }
  }, [formData.filtro]);

  // Helper para obtener modelos de un proveedor
  const getProviderAvailableModels = (providerId: string): AIModel[] => {
    if (!availableModels) return [];
    return availableModels[providerId as keyof AIAvailableModels] || [];
  };

  const handleChange = (field: string, value: any) => {
    let newData = { ...formData, [field]: value };

    // Si cambia el proveedor, limpiar el modelo seleccionado
    if (field === 'aiProvider') {
      newData.aiModel = '';
    }

    setFormData(newData);

    // Convertir y emitir cambio
    try {
      const filtroObj = JSON.parse(newData.filtro);

      onChange({
        campo: newData.campo,
        operacion: 'AI_LOOKUP',
        campoTexto: newData.campoTexto,
        tabla: newData.tabla,
        filtro: filtroObj,
        campoRetorno: newData.campoRetorno,
        umbralConfianza: parseFloat((newData.umbralConfianza / 100).toFixed(2)),
        requiereAprobacion: newData.requiereAprobacion,
        instruccionesAdicionales: newData.instruccionesAdicionales || undefined,
        valorDefecto: newData.valorDefecto || undefined,
        aiProvider: newData.aiProvider,
        aiModel: newData.aiModel || undefined
      });
    } catch (e) {
      // Si el JSON es inválido, no emitir el cambio completo todavía
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
        <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-purple-900">
          <p className="font-medium mb-1">Clasificación con IA</p>
          <p className="text-purple-700 text-xs">
            Usa inteligencia artificial para encontrar la mejor coincidencia semántica
            en tu lista de parámetros maestros
          </p>
        </div>
      </div>

      {/* Campo de texto a analizar */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Campo de texto a analizar <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.campoTexto}
          onChange={(e) => handleChange('campoTexto', e.target.value)}
          placeholder="{resumen.descripcionCupon}"
          className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
        />
        <p className="text-xs text-text-secondary mt-1">
          Usa llaves para referenciar campos: <code className="bg-gray-100 px-1 rounded">{'{'} campo {'}'}</code>
        </p>
      </div>

      {/* Filtro JSON */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Filtro para parámetros maestros <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.filtro}
          onChange={(e) => handleChange('filtro', e.target.value)}
          rows={4}
          className={`w-full px-3 py-2 border rounded-lg font-mono text-sm ${filtroError ? 'border-red-300' : ''}`}
        />
        {filtroError && (
          <p className="text-xs text-red-600 mt-1">{filtroError}</p>
        )}
        <p className="text-xs text-text-secondary mt-1">
          JSON con los filtros para buscar en parametros_maestros
        </p>
      </div>

      {/* Campo a retornar */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Campo a retornar <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.campoRetorno}
          onChange={(e) => handleChange('campoRetorno', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="codigo">Código</option>
          <option value="nombre">Nombre</option>
          <option value="descripcion">Descripción</option>
          <option value="parametros_json">JSON Completo</option>
        </select>
        <p className="text-xs text-text-secondary mt-1">
          También puedes usar notación de punto para JSON: <code className="bg-gray-100 px-1 rounded">parametros_json.subcuenta</code>
        </p>
      </div>

      {/* Umbral de confianza */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Umbral de confianza: {formData.umbralConfianza}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={formData.umbralConfianza}
          onChange={(e) => handleChange('umbralConfianza', parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-text-secondary mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <p className="text-xs text-text-secondary mt-2">
          Si la confianza es menor al umbral, se requerirá aprobación manual
        </p>
      </div>

      {/* Requiere aprobación */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="requiereAprobacion"
          checked={formData.requiereAprobacion}
          onChange={(e) => handleChange('requiereAprobacion', e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-gray-300"
        />
        <div>
          <label htmlFor="requiereAprobacion" className="block text-sm font-medium text-text-primary cursor-pointer">
            Siempre requiere aprobación manual
          </label>
          <p className="text-xs text-text-secondary mt-1">
            Si está activado, todas las sugerencias irán a revisión manual sin importar la confianza
          </p>
        </div>
      </div>

      {/* Instrucciones adicionales */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1 flex items-center gap-2">
          Instrucciones para la IA
          <HelpCircle className="w-4 h-4 text-text-secondary" />
        </label>
        <textarea
          value={formData.instruccionesAdicionales}
          onChange={(e) => handleChange('instruccionesAdicionales', e.target.value)}
          rows={3}
          placeholder="Ej: Prioriza categorías específicas sobre genéricas. Si es una estación de servicio, siempre es COMBUSTIBLE."
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <p className="text-xs text-text-secondary mt-1">
          Contexto adicional para ayudar a la IA a tomar mejores decisiones
        </p>
      </div>

      {/* Valor por defecto */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Valor por defecto (opcional)
        </label>
        <input
          type="text"
          value={formData.valorDefecto}
          onChange={(e) => handleChange('valorDefecto', e.target.value)}
          placeholder="SIN_CLASIFICAR"
          className="w-full px-3 py-2 border rounded-lg"
        />
        <p className="text-xs text-text-secondary mt-1">
          Valor a usar si la IA no encuentra coincidencia o hay error
        </p>
      </div>

      {/* Configuración de IA */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-3">Configuración del Motor de IA</h4>

        <div className="grid grid-cols-2 gap-4">
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Proveedor de IA
            </label>
            <select
              value={formData.aiProvider}
              onChange={(e) => handleChange('aiProvider', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
            </select>
            <p className="text-xs text-text-secondary mt-1">
              Motor de IA para clasificación (más barato que extracción)
            </p>
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Modelo {loadingModels && '(cargando...)'}
            </label>
            <select
              value={formData.aiModel}
              onChange={(e) => handleChange('aiModel', e.target.value)}
              disabled={loadingModels}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Usar modelo por defecto</option>
              {getProviderAvailableModels(formData.aiProvider).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                  {model.recommended ? ' ⭐' : ''}
                  {model.deprecated ? ' ⚠️' : ''}
                </option>
              ))}
            </select>
            {formData.aiModel && (() => {
              const selectedModel = getProviderAvailableModels(formData.aiProvider).find(
                m => m.id === formData.aiModel
              );
              return selectedModel?.description ? (
                <p className="text-xs text-text-secondary mt-1 italic">
                  {selectedModel.description}
                </p>
              ) : null;
            })()}
            {!formData.aiModel && (
              <p className="text-xs text-text-secondary mt-1">
                Si no seleccionas, usa la config global del .env
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 bg-white border border-blue-100 rounded p-2">
          <p className="text-xs text-blue-800">
            <strong>💡 Recomendación:</strong> Para clasificación semántica usa modelos recomendados marcados con ⭐.
            Son más rápidos y económicos que los modelos para extracción de documentos.
          </p>
        </div>
      </div>

      {/* Ejemplo de resultado */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <p className="text-sm font-medium text-text-primary mb-2">Vista previa de la configuración:</p>
        <pre className="text-xs bg-white border rounded p-2 overflow-auto">
{JSON.stringify({
  operacion: 'AI_LOOKUP',
  campoTexto: formData.campoTexto || '{campo.origen}',
  tabla: 'parametros_maestros',
  filtro: filtroError ? '...' : JSON.parse(formData.filtro),
  campoRetorno: formData.campoRetorno,
  umbralConfianza: formData.umbralConfianza / 100,
  requiereAprobacion: formData.requiereAprobacion,
  instruccionesAdicionales: formData.instruccionesAdicionales || undefined,
  valorDefecto: formData.valorDefecto || undefined,
  aiProvider: formData.aiProvider,
  aiModel: formData.aiModel || undefined
}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
