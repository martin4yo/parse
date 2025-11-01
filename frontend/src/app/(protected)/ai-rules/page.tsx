'use client';

import { useState } from 'react';
import { Sparkles, Play, Save, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function AIRulesPage() {
  const [userText, setUserText] = useState('');
  const [generatedRule, setGeneratedRule] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Ejemplos para quick start
  const examples = [
    'Todas las facturas que tengan "transporte" o "taxi" en la descripción, categorizarlas como MOVILIDAD',
    'Si el importe es mayor a $100,000, aplicar un descuento del 15%',
    'Todas las facturas de ACME S.A. asignarlas al centro de costos IT-001',
    'Si el importe supera $500,000, marcar para revisión manual'
  ];

  // Documento de ejemplo para testing
  const documentoEjemplo = {
    numeroComprobante: '0001-00001234',
    fecha: '2025-01-15',
    tipoComprobante: 'FACTURA A',
    razonSocial: 'ACME S.A.',
    cuit: '30-12345678-9',
    importe: 150000,
    netoGravado: 123966.94,
    impuestos: 26033.06,
    categoria: null,
    lineItems: [
      {
        descripcion: 'Servicio de transporte ejecutivo',
        cantidad: 1,
        precioUnitario: 123966.94
      }
    ]
  };

  const handleGenerate = async () => {
    if (!userText.trim()) {
      setError('Por favor escribe qué regla quieres crear');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setGeneratedRule(null);
    setTestResult(null);

    try {
      const response = await fetch('/api/ai-rules/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: userText }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedRule(data.rule);
        setSuccess('¡Regla generada exitosamente!');
      } else {
        setError(data.error || 'Error generando la regla');
      }
    } catch (err: any) {
      setError('Error conectando con el servidor: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!generatedRule) return;

    setTesting(true);
    setError('');
    setTestResult(null);

    try {
      const response = await fetch('/api/ai-rules/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rule: generatedRule,
          documento: documentoEjemplo
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult(data.resultado);
        setSuccess('¡Prueba completada!');
      } else {
        setError(data.error || 'Error probando la regla');
      }
    } catch (err: any) {
      setError('Error conectando con el servidor: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!generatedRule) return;

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/ai-rules/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rule: generatedRule }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('¡Regla guardada exitosamente! Ya está activa y se aplicará automáticamente.');
        // Limpiar después de 3 segundos
        setTimeout(() => {
          setUserText('');
          setGeneratedRule(null);
          setTestResult(null);
          setSuccess('');
        }, 3000);
      } else {
        setError(data.error || 'Error guardando la regla');
      }
    } catch (err: any) {
      setError('Error conectando con el servidor: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold">Reglas de IA</h1>
        </div>
        <p className="text-gray-600">
          Describe en lenguaje natural qué regla de negocio quieres crear y la IA la generará por ti
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input */}
        <div className="space-y-4">
          {/* Input Area */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe tu regla en lenguaje natural
            </label>
            <textarea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="Ej: Todas las facturas que tengan 'transporte' en la descripción, categorizarlas como MOVILIDAD"
              className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              disabled={loading}
            />

            <button
              onClick={handleGenerate}
              disabled={loading || !userText.trim()}
              className="mt-4 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generar Regla con IA
                </>
              )}
            </button>
          </div>

          {/* Examples */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="font-medium text-gray-900 mb-3">Ejemplos:</h3>
            <div className="space-y-2">
              {examples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setUserText(example)}
                  className="w-full text-left p-3 text-sm text-gray-700 bg-gray-50 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Output */}
        <div className="space-y-4">
          {/* Generated Rule */}
          {generatedRule && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-medium text-gray-900 mb-4">Regla Generada</h3>

              <div className="space-y-4">
                {/* Rule Name */}
                <div>
                  <span className="text-sm font-medium text-gray-500">Nombre:</span>
                  <p className="text-gray-900">{generatedRule.nombre}</p>
                </div>

                {/* Description */}
                {generatedRule.descripcion && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Descripción:</span>
                    <p className="text-gray-900">{generatedRule.descripcion}</p>
                  </div>
                )}

                {/* Conditions */}
                <div>
                  <span className="text-sm font-medium text-gray-500">Condiciones:</span>
                  <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
                    {JSON.stringify(generatedRule.condiciones, null, 2)}
                  </pre>
                </div>

                {/* Actions */}
                <div>
                  <span className="text-sm font-medium text-gray-500">Acciones:</span>
                  <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
                    {JSON.stringify(generatedRule.acciones, null, 2)}
                  </pre>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Probando...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Probar
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Guardar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Test Results */}
          {testResult && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-medium text-gray-900 mb-4">Resultado de la Prueba</h3>

              <div className="space-y-4">
                {/* Status */}
                <div>
                  <span className="text-sm font-medium text-gray-500">Estado:</span>
                  <p className={`font-medium ${testResult.cumpleCondiciones ? 'text-green-600' : 'text-orange-600'}`}>
                    {testResult.cumpleCondiciones ? '✓ Regla aplicada' : '○ Regla no aplicada (no cumple condiciones)'}
                  </p>
                </div>

                {/* Changes */}
                {testResult.cambios.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Cambios realizados:</span>
                    <div className="mt-2 space-y-2">
                      {testResult.cambios.map((cambio: any, index: number) => (
                        <div key={index} className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-900">
                            {cambio.campo}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="line-through">{JSON.stringify(cambio.valorAnterior)}</span>
                            {' → '}
                            <span className="font-medium text-green-600">{JSON.stringify(cambio.valorNuevo)}</span>
                          </p>
                          {cambio.formula && (
                            <p className="text-xs text-gray-500 mt-1">Fórmula: {cambio.formula}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Before / After */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Antes:</span>
                    <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(testResult.documentoAntes, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Después:</span>
                    <pre className="mt-2 p-3 bg-green-50 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(testResult.documentoDespues, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
