'use client';

import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Settings,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save,
  X
} from 'lucide-react';
import { planesApi, Plan, PlanFeature } from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function PlanesPage() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [availableFeatures, setAvailableFeatures] = useState<any[]>([]);

  // Form state for plan
  const [planFormData, setPlanFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    precio: '',
    activo: true,
    orden: 0,
    color: '#9333ea'
  });

  // Form state for new feature
  const [newFeature, setNewFeature] = useState({
    feature: '',
    config: '{}'
  });

  useEffect(() => {
    loadPlanes();
    loadAvailableFeatures();
  }, []);

  const loadPlanes = async () => {
    try {
      setLoading(true);
      const data = await planesApi.getAll();
      setPlanes(data.planes);
    } catch (error: any) {
      toast.error('Error al cargar planes: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFeatures = async () => {
    try {
      const data = await planesApi.getAvailableFeatures();
      setAvailableFeatures(data.features);
    } catch (error: any) {
      console.error('Error cargando features disponibles:', error);
    }
  };

  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      precio: '',
      activo: true,
      orden: 0,
      color: '#9333ea'
    });
    setShowPlanModal(true);
  };

  const handleOpenEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanFormData({
      codigo: plan.codigo,
      nombre: plan.nombre,
      descripcion: plan.descripcion || '',
      precio: plan.precio?.toString() || '',
      activo: plan.activo,
      orden: plan.orden,
      color: plan.color || '#9333ea'
    });
    setShowPlanModal(true);
  };

  const handleOpenDeletePlan = (planId: string) => {
    setDeletingPlanId(planId);
    setShowDeleteModal(true);
  };

  const handleOpenFeatures = async (plan: Plan) => {
    try {
      // Cargar plan completo con features
      const data = await planesApi.getById(plan.id);
      setSelectedPlan(data.plan);
      setShowFeaturesModal(true);
    } catch (error: any) {
      toast.error('Error al cargar plan: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        codigo: planFormData.codigo,
        nombre: planFormData.nombre,
        descripcion: planFormData.descripcion || undefined,
        precio: planFormData.precio ? parseFloat(planFormData.precio) : undefined,
        activo: planFormData.activo,
        orden: planFormData.orden,
        color: planFormData.color || undefined
      };

      if (editingPlan) {
        const { codigo, ...updateData } = data;
        await planesApi.update(editingPlan.id, updateData);
        toast.success('Plan actualizado correctamente');
      } else {
        await planesApi.create(data);
        toast.success('Plan creado correctamente');
      }

      setShowPlanModal(false);
      loadPlanes();
    } catch (error: any) {
      toast.error('Error al guardar plan: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlanId) return;

    try {
      await planesApi.delete(deletingPlanId);
      toast.success('Plan eliminado correctamente');
      setShowDeleteModal(false);
      setDeletingPlanId(null);
      loadPlanes();
    } catch (error: any) {
      toast.error('Error al eliminar plan: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddFeature = async () => {
    if (!selectedPlan || !newFeature.feature) {
      toast.error('Selecciona una feature');
      return;
    }

    try {
      let parsedConfig = null;
      if (newFeature.config.trim()) {
        try {
          parsedConfig = JSON.parse(newFeature.config);
        } catch (error) {
          toast.error('El campo config debe ser JSON válido');
          return;
        }
      }

      await planesApi.addFeature(selectedPlan.id, {
        feature: newFeature.feature,
        config: parsedConfig
      });

      toast.success('Feature agregada correctamente');

      // Recargar plan
      const data = await planesApi.getById(selectedPlan.id);
      setSelectedPlan(data.plan);
      setNewFeature({ feature: '', config: '{}' });
    } catch (error: any) {
      toast.error('Error al agregar feature: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteFeature = async (featureId: string) => {
    if (!selectedPlan) return;

    try {
      await planesApi.deleteFeature(selectedPlan.id, featureId);
      toast.success('Feature eliminada correctamente');

      // Recargar plan
      const data = await planesApi.getById(selectedPlan.id);
      setSelectedPlan(data.plan);
    } catch (error: any) {
      toast.error('Error al eliminar feature: ' + (error.response?.data?.error || error.message));
    }
  };

  const toggleExpandPlan = (planId: string) => {
    setExpandedPlanId(expandedPlanId === planId ? null : planId);
  };

  const getPlanBadgeColor = (codigo: string) => {
    switch (codigo) {
      case 'Common':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'Uncommon':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Rare':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Mythic':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="p-6 space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Gestión de Planes
            </h1>
            <p className="text-text-secondary mt-1">
              Administra los planes y sus features
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenCreatePlan}
          className="px-4 py-2 bg-palette-dark text-palette-yellow rounded-lg hover:bg-palette-dark/90 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo Plan
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="bg-white rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Precio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Features
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tenants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      Cargando planes...
                    </td>
                  </tr>
                ) : planes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay planes configurados
                    </td>
                  </tr>
                ) : (
                  planes.map((plan) => (
                    <>
                      <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 text-sm">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {plan.nombre}
                            </div>
                            {plan.descripcion && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {plan.descripcion}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium text-white"
                            style={{
                              backgroundColor: plan.color || '#9333ea',
                              color: 'white'
                            }}
                          >
                            {plan.codigo}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          {plan.precio ? `$${Number(plan.precio).toFixed(2)}` : 'Gratis'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => handleOpenFeatures(plan)}
                            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Sparkles className="h-4 w-4" />
                            {plan.cantidadFeatures || 0} features
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => toggleExpandPlan(plan.id)}
                            className="flex items-center gap-1 text-gray-700 dark:text-gray-300 hover:underline"
                          >
                            <Users className="h-4 w-4" />
                            {plan.cantidadTenants || 0} tenants
                            {(plan.cantidadTenants || 0) > 0 && (
                              <>
                                {expandedPlanId === plan.id ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              plan.activo
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}
                          >
                            {plan.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenFeatures(plan)}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="Gestionar features"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditPlan(plan)}
                              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDeletePlan(plan.id)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row for tenants */}
                      {expandedPlanId === plan.id && plan.tenants && plan.tenants.length > 0 && (
                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="text-sm">
                              <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Tenants asignados:
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {plan.tenants.map((tenant) => (
                                  <span
                                    key={tenant.id}
                                    className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300"
                                  >
                                    {tenant.nombre}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingPlan ? 'Editar Plan' : 'Crear Plan'}
              </h2>
            </div>

            <form onSubmit={handleSubmitPlan} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Código *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPlan}
                    value={planFormData.codigo}
                    onChange={(e) => setPlanFormData({ ...planFormData, codigo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                    placeholder="Common, Uncommon, Rare..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Orden
                  </label>
                  <input
                    type="number"
                    value={planFormData.orden}
                    onChange={(e) =>
                      setPlanFormData({ ...planFormData, orden: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={planFormData.nombre}
                  onChange={(e) => setPlanFormData({ ...planFormData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Plan Common"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={planFormData.descripcion}
                  onChange={(e) =>
                    setPlanFormData({ ...planFormData, descripcion: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Descripción del plan"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Precio (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={planFormData.precio}
                    onChange={(e) => setPlanFormData({ ...planFormData, precio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={planFormData.color}
                      onChange={(e) => setPlanFormData({ ...planFormData, color: e.target.value })}
                      className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={planFormData.color}
                      onChange={(e) => setPlanFormData({ ...planFormData, color: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                      placeholder="#9333ea"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={planFormData.activo}
                  onChange={(e) => setPlanFormData({ ...planFormData, activo: e.target.checked })}
                  className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Plan activo
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-palette-dark text-palette-yellow rounded-lg hover:bg-palette-dark/90 transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {editingPlan ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Features Modal */}
      {showFeaturesModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Features del Plan: {selectedPlan.nombre}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Add Feature Form */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Agregar Feature
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <select
                      value={newFeature.feature}
                      onChange={(e) => setNewFeature({ ...newFeature, feature: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">Seleccionar feature...</option>
                      {availableFeatures.map((f) => (
                        <option key={f.feature} value={f.feature}>
                          {f.feature} ({f.categoria})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder='Config JSON: {"key": "value"}'
                      value={newFeature.config}
                      onChange={(e) => setNewFeature({ ...newFeature, config: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                    />
                    <button
                      onClick={handleAddFeature}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Features List */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Features Actuales ({selectedPlan.features?.length || 0})
                </h3>
                {!selectedPlan.features || selectedPlan.features.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No hay features asignadas a este plan
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedPlan.features.map((feature) => (
                      <div
                        key={feature.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {feature.feature}
                          </div>
                          {feature.config && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                              {JSON.stringify(feature.config)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteFeature(feature.id)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors ml-2"
                          title="Eliminar feature"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowFeaturesModal(false);
                    setSelectedPlan(null);
                    loadPlanes();
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Confirmar Eliminación
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                ¿Estás seguro de que deseas eliminar este plan? Esta acción no se puede deshacer.
                <br />
                <strong className="text-red-600 dark:text-red-400">
                  Solo se pueden eliminar planes sin tenants asignados.
                </strong>
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeletePlan}
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
