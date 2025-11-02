'use client';

import { useState, useEffect } from 'react';
import { Brain, Plus, Edit, Trash2, X, Eye, EyeOff, Check, AlertCircle, RefreshCw, Settings, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { aiConfigsApi, aiModelsApi, type AIProviderConfig, type AIProvider, type AIAvailableModels, type AIModel, type AIModelData } from '@/lib/api';
import toast from 'react-hot-toast';

export default function IAConfigPage() {
  const [configs, setConfigs] = useState<AIProviderConfig[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [availableModels, setAvailableModels] = useState<AIAvailableModels | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIProviderConfig | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [updatingModel, setUpdatingModel] = useState<string | null>(null);
  const [showModelsModal, setShowModelsModal] = useState(false);
  const [managingProvider, setManagingProvider] = useState<string | null>(null);
  const [providerModels, setProviderModels] = useState<AIModelData[]>([]);
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModelData | null>(null);

  const [formData, setFormData] = useState({
    provider: '',
    apiKey: '',
    modelo: '',
    maxRequestsPerDay: 1000,
    activo: true
  });

  const [modelFormData, setModelFormData] = useState({
    modelId: '',
    name: '',
    description: '',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configsData, providersData, modelsData] = await Promise.all([
        aiConfigsApi.getAll(),
        aiConfigsApi.getProviders(),
        aiConfigsApi.getAvailableModels()
      ]);
      setConfigs(configsData);
      setProviders(providersData);
      setAvailableModels(modelsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar configuraciones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setFormData({
      provider: '',
      apiKey: '',
      modelo: '',
      maxRequestsPerDay: 1000,
      activo: true
    });
    setShowModal(true);
  };

  const handleEdit = (config: AIProviderConfig) => {
    setEditingConfig(config);
    setFormData({
      provider: config.provider,
      apiKey: '', // No mostrar la key actual
      modelo: config.modelo,
      maxRequestsPerDay: config.maxRequestsPerDay,
      activo: config.activo
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingConfig) {
        // Actualizar
        await aiConfigsApi.update(editingConfig.id, {
          modelo: formData.modelo,
          maxRequestsPerDay: formData.maxRequestsPerDay,
          activo: formData.activo,
          apiKey: formData.apiKey || undefined // Solo enviar si hay nueva key
        });
        toast.success('Configuración actualizada');
      } else {
        // Crear
        if (!formData.apiKey) {
          toast.error('API Key es requerida');
          return;
        }
        await aiConfigsApi.create(formData);
        toast.success('Configuración creada');
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const handleDelete = async (config: AIProviderConfig) => {
    if (!confirm(`¿Eliminar configuración de ${getProviderName(config.provider)}?`)) {
      return;
    }

    try {
      await aiConfigsApi.delete(config.id);
      toast.success('Configuración eliminada');
      loadData();
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Error al eliminar');
    }
  };

  const getProviderName = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.nombre || providerId;
  };

  const getProviderModels = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.modelosDisponibles || [];
  };

  const getAvailableProviders = () => {
    const usedProviders = new Set(configs.map(c => c.provider));
    return providers.filter(p => !usedProviders.has(p.id));
  };

  const getProviderAvailableModels = (providerId: string): AIModel[] => {
    if (!availableModels) return [];
    return availableModels[providerId as keyof AIAvailableModels] || [];
  };

  const getCurrentModelInfo = (providerId: string, modelId: string): AIModel | null => {
    const models = getProviderAvailableModels(providerId);
    return models.find(m => m.id === modelId) || null;
  };

  const handleQuickModelChange = async (config: AIProviderConfig, newModelId: string) => {
    if (newModelId === config.modelo) return;

    try {
      setUpdatingModel(config.id);
      await aiConfigsApi.updateModel(config.provider, newModelId);
      toast.success('Modelo actualizado correctamente');
      loadData();
    } catch (error: any) {
      console.error('Error updating model:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar modelo');
    } finally {
      setUpdatingModel(null);
    }
  };

  const handleManageModels = async (providerId: string) => {
    try {
      setManagingProvider(providerId);
      const models = await aiModelsApi.getAll(providerId);
      setProviderModels(models);
      setShowModelsModal(true);
    } catch (error) {
      console.error('Error loading models:', error);
      toast.error('Error al cargar modelos');
    }
  };

  const handleAddModel = () => {
    setEditingModel(null);
    setModelFormData({
      modelId: '',
      name: '',
      description: '',
      recommended: false,
      active: true,
      deprecated: false,
      orderIndex: providerModels.length
    });
    setShowModelForm(true);
  };

  const handleEditModel = (model: AIModelData) => {
    setEditingModel(model);
    setModelFormData({
      modelId: model.modelId,
      name: model.name,
      description: model.description || '',
      recommended: model.recommended,
      active: model.active,
      deprecated: model.deprecated,
      orderIndex: model.orderIndex
    });
    setShowModelForm(true);
  };

  const handleSaveModel = async () => {
    try {
      if (!managingProvider) return;

      if (editingModel) {
        // Actualizar
        await aiModelsApi.update(editingModel.id, modelFormData);
        toast.success('Modelo actualizado');
      } else {
        // Crear
        await aiModelsApi.create({
          provider: managingProvider,
          ...modelFormData
        });
        toast.success('Modelo creado');
      }

      // Recargar modelos del provider
      const updated = await aiModelsApi.getAll(managingProvider);
      setProviderModels(updated);

      // Recargar toda la data para actualizar dropdowns
      loadData();

      setShowModelForm(false);
    } catch (error: any) {
      console.error('Error saving model:', error);
      toast.error(error.response?.data?.message || 'Error al guardar modelo');
    }
  };

  const handleDeleteModel = async (model: AIModelData) => {
    if (!confirm(`¿Eliminar el modelo "${model.name}"?`)) return;

    try {
      await aiModelsApi.delete(model.id);
      toast.success('Modelo eliminado');

      // Recargar modelos
      if (managingProvider) {
        const updated = await aiModelsApi.getAll(managingProvider);
        setProviderModels(updated);
      }

      loadData();
    } catch (error: any) {
      console.error('Error deleting model:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar modelo');
    }
  };

  const handleToggleRecommended = async (model: AIModelData) => {
    try {
      await aiModelsApi.toggleRecommended(model.id);
      toast.success('Modelo actualizado');

      // Recargar modelos
      if (managingProvider) {
        const updated = await aiModelsApi.getAll(managingProvider);
        setProviderModels(updated);
      }

      loadData();
    } catch (error: any) {
      console.error('Error toggling recommended:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar modelo');
    }
  };

  return (
    <div className="p-6 space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
            <Brain className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Configuración de IA
            </h1>
            <p className="text-text-secondary mt-1">
              Gestiona los proveedores de inteligencia artificial para extracción de documentos
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="bg-white rounded-lg border border-border flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <h3 className="text-lg font-semibold text-text-primary">Proveedores Configurados</h3>
              {getAvailableProviders().length > 0 && (
                <Button
                  onClick={handleCreate}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Proveedor</span>
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-text-secondary">Cargando configuraciones...</div>
                </div>
              ) : configs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Brain className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-text-secondary mb-4">
                    No hay proveedores configurados
                  </p>
                  <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Primer Proveedor
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {configs.map((config) => {
                    const modelInfo = getCurrentModelInfo(config.provider, config.modelo);
                    const providerModels = getProviderAvailableModels(config.provider);

                    return (
                      <div
                        key={config.id}
                        className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-text-primary">
                              {getProviderName(config.provider)}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-text-secondary">
                                {modelInfo?.name || config.modelo}
                              </p>
                              {modelInfo?.recommended && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                  Recomendado
                                </span>
                              )}
                              {modelInfo?.deprecated && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                  Obsoleto
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {config.activo ? (
                              <span className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                <Check className="w-3 h-3 mr-1" />
                                Activo
                              </span>
                            ) : (
                              <span className="flex items-center text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Inactivo
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Model Selector */}
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-text-secondary mb-1">
                            Cambiar modelo:
                          </label>
                          <div className="relative">
                            <select
                              value={config.modelo}
                              onChange={(e) => handleQuickModelChange(config, e.target.value)}
                              disabled={updatingModel === config.id}
                              className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {providerModels.map((model) => (
                                <option key={model.id} value={model.id}>
                                  {model.name}
                                  {model.recommended ? ' ⭐' : ''}
                                  {model.deprecated ? ' ⚠️' : ''}
                                </option>
                              ))}
                            </select>
                            {updatingModel === config.id && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                              </div>
                            )}
                          </div>
                          {modelInfo?.description && (
                            <p className="text-xs text-text-secondary mt-1 italic">
                              {modelInfo.description}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2 text-sm mb-4">
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Límite diario:</span>
                            <span className="font-medium">{config.maxRequestsPerDay.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(config)}
                            className="flex-1"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManageModels(config.provider)}
                            className="flex-1"
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Modelos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(config)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                {editingConfig ? 'Editar Configuración' : 'Agregar Proveedor'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Proveedor
                </label>
                {editingConfig ? (
                  <input
                    type="text"
                    value={getProviderName(formData.provider)}
                    disabled
                    className="w-full px-3 py-2 border border-input rounded-md bg-gray-50"
                  />
                ) : (
                  <select
                    value={formData.provider}
                    onChange={(e) => {
                      setFormData({ ...formData, provider: e.target.value, modelo: '' });
                    }}
                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {getAvailableProviders().map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Modelo */}
              {formData.provider && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Modelo
                  </label>
                  <select
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  >
                    <option value="">Seleccionar modelo...</option>
                    {getProviderAvailableModels(formData.provider).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                        {model.recommended ? ' ⭐ Recomendado' : ''}
                        {model.deprecated ? ' ⚠️ Obsoleto' : ''}
                      </option>
                    ))}
                  </select>
                  {formData.modelo && (() => {
                    const selectedModel = getProviderAvailableModels(formData.provider).find(
                      m => m.id === formData.modelo
                    );
                    return selectedModel?.description ? (
                      <p className="text-xs text-text-secondary mt-1 italic">
                        {selectedModel.description}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  API Key {editingConfig && '(dejar en blanco para no cambiar)'}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder={editingConfig ? 'Nueva API Key (opcional)' : 'API Key del proveedor'}
                    required={!editingConfig}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Max Requests */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Límite de Requests Diarios
                </label>
                <input
                  type="number"
                  value={formData.maxRequestsPerDay}
                  onChange={(e) => setFormData({ ...formData, maxRequestsPerDay: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  min="1"
                  required
                />
              </div>

              {/* Activo */}
              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 text-primary border-input rounded focus:ring-primary focus:ring-2"
                  />
                  <span className="text-sm text-text-primary">
                    Configuración activa
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingConfig ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Modelos */}
      {showModelsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                Gestionar Modelos - {getProviderName(managingProvider || '')}
              </h3>
              <button
                onClick={() => setShowModelsModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {!showModelForm ? (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-text-secondary">
                      {providerModels.length} modelo(s) disponible(s)
                    </p>
                    <Button onClick={handleAddModel} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Modelo
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {providerModels.map((model) => (
                      <div
                        key={model.id}
                        className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-text-primary">
                                {model.name}
                              </h4>
                              {model.recommended && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex items-center">
                                  <Star className="w-3 h-3 mr-1" />
                                  Recomendado
                                </span>
                              )}
                              {model.deprecated && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                  Obsoleto
                                </span>
                              )}
                              {!model.active && (
                                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                  Inactivo
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-secondary mt-1">
                              ID: {model.modelId}
                            </p>
                            {model.description && (
                              <p className="text-sm text-text-secondary mt-2">
                                {model.description}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleRecommended(model)}
                              title={model.recommended ? 'Quitar recomendación' : 'Marcar como recomendado'}
                            >
                              <Star
                                className={`w-3 h-3 ${model.recommended ? 'fill-yellow-400 text-yellow-400' : ''}`}
                              />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditModel(model)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteModel(model)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                // Formulario de modelo
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      ID del Modelo *
                    </label>
                    <input
                      type="text"
                      value={modelFormData.modelId}
                      onChange={(e) => setModelFormData({ ...modelFormData, modelId: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="claude-3-7-sonnet-20250219"
                      disabled={!!editingModel}
                    />
                    <p className="text-xs text-text-secondary mt-1">
                      {editingModel ? 'El ID no puede modificarse' : 'Usar el ID oficial del proveedor'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={modelFormData.name}
                      onChange={(e) => setModelFormData({ ...modelFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Claude 3.7 Sonnet"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Descripción
                    </label>
                    <textarea
                      value={modelFormData.description}
                      onChange={(e) => setModelFormData({ ...modelFormData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Descripción del modelo..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelFormData.recommended}
                        onChange={(e) => setModelFormData({ ...modelFormData, recommended: e.target.checked })}
                        className="w-4 h-4 text-primary border-input rounded focus:ring-primary focus:ring-2"
                      />
                      <span className="text-sm text-text-primary">Recomendado</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelFormData.active}
                        onChange={(e) => setModelFormData({ ...modelFormData, active: e.target.checked })}
                        className="w-4 h-4 text-primary border-input rounded focus:ring-primary focus:ring-2"
                      />
                      <span className="text-sm text-text-primary">Activo</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelFormData.deprecated}
                        onChange={(e) => setModelFormData({ ...modelFormData, deprecated: e.target.checked })}
                        className="w-4 h-4 text-primary border-input rounded focus:ring-primary focus:ring-2"
                      />
                      <span className="text-sm text-text-primary">Obsoleto</span>
                    </label>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Orden
                      </label>
                      <input
                        type="number"
                        value={modelFormData.orderIndex}
                        onChange={(e) => setModelFormData({ ...modelFormData, orderIndex: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowModelForm(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveModel}>
                      {editingModel ? 'Actualizar' : 'Crear'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
