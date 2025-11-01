// ============================================
// MODAL DE GESTIÓN DE MODELOS
// ============================================
// Copiar este código y pegarlo en frontend/src/app/(protected)/ia-config/page.tsx
// ANTES del cierre final del return (justo antes de `      )}` y `    </div>`
// DESPUÉS del modal de edición de configuración (que termina en línea ~588)

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
