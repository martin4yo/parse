'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Plus, Pencil, Trash2, RefreshCw, TestTube, Database } from 'lucide-react';
import { promptsApi, AIPrompt } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface MotorIA {
  id: string;
  nombre: string;
  descripcion: string;
  requiresConfig: boolean;
  isGlobal: boolean;
  isConfigured: boolean;
  hasCustomConfig?: boolean;
  modelo?: string;
}

export default function PromptsIAPage() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [testingPrompt, setTestingPrompt] = useState<AIPrompt | null>(null);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<{ size: number; entries: any[] } | null>(null);
  const [motoresDisponibles, setMotoresDisponibles] = useState<MotorIA[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    clave: '',
    nombre: '',
    descripcion: '',
    prompt: '',
    motor: '',
    activo: true,
    variables: '{}'
  });

  // Test form state
  const [testVariables, setTestVariables] = useState('{}');
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    loadPrompts();
    loadMotoresDisponibles();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const data = await promptsApi.getAll();
      setPrompts(data.prompts);
    } catch (error: any) {
      toast.error('Error al cargar prompts: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadMotoresDisponibles = async () => {
    try {
      const data = await promptsApi.getMotoresDisponibles();
      setMotoresDisponibles(data.motores || []);
    } catch (error: any) {
      console.error('Error al cargar motores:', error);
      // No mostrar error al usuario, usar lista por defecto si falla
      setMotoresDisponibles([]);
    }
  };

  const loadCacheStats = async () => {
    try {
      const stats = await promptsApi.getCacheStats();
      setCacheStats(stats);
      toast.success('Estadísticas del cache cargadas');
    } catch (error: any) {
      toast.error('Error al cargar estadísticas: ' + (error.response?.data?.error || error.message));
    }
  };

  const clearCache = async () => {
    try {
      await promptsApi.clearCache();
      toast.success('Cache limpiado correctamente');
      setCacheStats(null);
    } catch (error: any) {
      toast.error('Error al limpiar cache: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleOpenCreate = () => {
    setEditingPrompt(null);
    setFormData({
      clave: '',
      nombre: '',
      descripcion: '',
      prompt: '',
      motor: '',
      activo: true,
      variables: '{}'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (prompt: AIPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      clave: prompt.clave,
      nombre: prompt.nombre,
      descripcion: prompt.descripcion || '',
      prompt: prompt.prompt,
      motor: prompt.motor || '',
      activo: prompt.activo,
      variables: JSON.stringify(prompt.variables || {}, null, 2)
    });
    setShowModal(true);
  };

  const handleOpenTest = (prompt: AIPrompt) => {
    setTestingPrompt(prompt);
    setTestVariables(JSON.stringify(prompt.variables || {}, null, 2));
    setTestResult('');
    setShowTestModal(true);
  };

  const handleOpenDelete = (promptId: string) => {
    setDeletingPromptId(promptId);
    setShowDeleteModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Parse variables JSON
      let parsedVariables = {};
      if (formData.variables.trim()) {
        try {
          parsedVariables = JSON.parse(formData.variables);
        } catch (error) {
          toast.error('El campo "Variables" debe ser un JSON válido');
          return;
        }
      }

      const data = {
        clave: formData.clave,
        nombre: formData.nombre,
        descripcion: formData.descripcion || undefined,
        prompt: formData.prompt,
        motor: formData.motor || undefined,
        activo: formData.activo,
        variables: parsedVariables
      };

      if (editingPrompt) {
        await promptsApi.update(editingPrompt.id, data);
        toast.success('Prompt actualizado correctamente');
      } else {
        await promptsApi.create(data);
        toast.success('Prompt creado correctamente');
      }

      setShowModal(false);
      loadPrompts();
    } catch (error: any) {
      toast.error('Error al guardar: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTest = async () => {
    if (!testingPrompt) return;

    try {
      let parsedVariables = {};
      if (testVariables.trim()) {
        try {
          parsedVariables = JSON.parse(testVariables);
        } catch (error) {
          toast.error('Las variables deben ser un JSON válido');
          return;
        }
      }

      const result = await promptsApi.test({
        clave: testingPrompt.clave,
        variables: parsedVariables,
        motor: testingPrompt.motor || undefined
      });

      setTestResult(result.prompt);
      toast.success('Prompt generado correctamente');
    } catch (error: any) {
      toast.error('Error al probar prompt: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async () => {
    if (!deletingPromptId) return;

    try {
      await promptsApi.delete(deletingPromptId);
      toast.success('Prompt eliminado correctamente');
      setShowDeleteModal(false);
      setDeletingPromptId(null);
      loadPrompts();
    } catch (error: any) {
      toast.error('Error al eliminar: ' + (error.response?.data?.error || error.message));
    }
  };

  const getMotorBadgeColor = (motor?: string) => {
    switch (motor) {
      case 'openai':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'anthropic':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'gemini':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'ollama':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Gestión de Prompts IA
            </h1>
            <p className="text-text-secondary">
              Administra los prompts de inteligencia artificial para extracción de documentos
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadCacheStats}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            Stats Cache
          </button>
          <button
            onClick={clearCache}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Limpiar Cache
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuevo Prompt
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        {/* Cache Stats */}
        {cacheStats && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Estadísticas del Cache</h3>
            </div>
            <p className="text-sm text-blue-700">
              <strong>Entradas en cache:</strong> {cacheStats.size}
            </p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Clave
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Motor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Veces Usado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tasa Éxito
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Versión
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Cargando prompts...
                  </td>
                </tr>
              ) : prompts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No hay prompts configurados
                  </td>
                </tr>
              ) : (
                prompts.map((prompt) => (
                  <tr key={prompt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {prompt.clave}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <div>
                        <div className="font-medium">{prompt.nombre}</div>
                        {prompt.descripcion && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {prompt.descripcion}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {prompt.motor ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMotorBadgeColor(prompt.motor)}`}>
                          {prompt.motor}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">Sin motor</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          prompt.activo
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {prompt.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {prompt.vecesUsado || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {prompt.tasaExito ? `${Number(prompt.tasaExito).toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      v{prompt.version}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenTest(prompt)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Probar prompt"
                        >
                          <TestTube className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(prompt)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(prompt.id)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingPrompt ? 'Editar Prompt' : 'Crear Prompt'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Clave *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPrompt}
                    value={formData.clave}
                    onChange={(e) => setFormData({ ...formData, clave: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                    placeholder="EXTRACCION_FACTURA_GEMINI"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Motor
                  </label>
                  <select
                    value={formData.motor}
                    onChange={(e) => setFormData({ ...formData, motor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Sin motor específico</option>
                    {(motoresDisponibles || []).map((motor) => (
                      <option key={motor.id} value={motor.id}>
                        {motor.nombre}
                        {motor.isConfigured ? ' ✓' : ''}
                        {motor.requiresConfig && !motor.isConfigured ? ' (requiere configuración)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Extracción de Factura - Gemini"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Prompt para extraer datos de facturas argentinas"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prompt *
                </label>
                <textarea
                  required
                  rows={8}
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  placeholder="Analiza el siguiente texto y extrae... Usa variables como {{text}}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Variables (JSON)
                </label>
                <textarea
                  rows={4}
                  value={formData.variables}
                  onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  placeholder='{ "text": "Texto del documento" }'
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Prompt activo
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {editingPrompt ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && testingPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Probar Prompt: {testingPrompt.nombre}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Variables (JSON)
                </label>
                <textarea
                  rows={6}
                  value={testVariables}
                  onChange={(e) => setTestVariables(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  placeholder='{ "text": "Texto de prueba..." }'
                />
              </div>

              <button
                onClick={handleTest}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <TestTube className="h-4 w-4" />
                Generar Prompt
              </button>

              {testResult && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Resultado
                  </label>
                  <textarea
                    readOnly
                    rows={12}
                    value={testResult}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Confirmar Eliminación
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                ¿Estás seguro de que deseas eliminar este prompt? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
