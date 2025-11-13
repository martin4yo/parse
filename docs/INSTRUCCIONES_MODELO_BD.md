# Instrucciones para Activar el Sistema de Modelos en Base de Datos

## ✅ Lo que ya está hecho

### Backend
1. ✅ Tabla `ai_models` creada en schema Prisma
2. ✅ Migración aplicada a la base de datos
3. ✅ API routes `/api/ai-models` creadas (CRUD completo)
4. ✅ `aiConfigService` actualizado para leer de BD
5. ✅ Seed script creado con modelos actuales

### Frontend
1. ✅ Funciones API agregadas en `lib/api.ts`
2. ✅ Imports y estados agregados en `ia-config/page.tsx`
3. ✅ Funciones de gestión de modelos implementadas

## 🚀 Pasos para Activar

### 1. Poblar la Base de Datos con Modelos

```bash
cd backend
node prisma/seeds/ai-models-seed.js
```

**Resultado esperado:**
```
🌱 Seeding AI models...
✅ Creado: Claude 3.7 Sonnet (anthropic)
✅ Creado: Claude 3.5 Sonnet (Oct 2024) (anthropic)
...
✅ 16 modelos creados exitosamente!
```

### 2. Reiniciar el Backend

```bash
# Detener el backend (Ctrl+C si está corriendo)

# Regenerar Prisma Client
npx prisma generate

# Iniciar backend
npm run dev
```

**Verificar que funciona:**
```bash
# Test endpoint
curl http://localhost:5050/api/ai-models
```

Debería devolver array de modelos.

### 3. Agregar Botón "Gestionar Modelos" en Frontend

En `frontend/src/app/(protected)/ia-config/page.tsx`, buscar la sección donde se renderizan los botones de cada tarjeta (alrededor de línea 340) y agregar:

```tsx
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

  {/* ⭐ NUEVO - Agregar este botón */}
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
```

### 4. Agregar Modal de Gestión de Modelos

Al final del archivo `ia-config/page.tsx`, antes del último `</div>` del return, agregar:

```tsx
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
```

## 🧪 Cómo Probar

### 1. Verificar que los modelos están en BD

```bash
# En el backend
npx prisma studio
```

Ir a tabla `ai_models` y verificar que hay 16 registros.

### 2. Probar desde la UI

1. Navegar a `/ia-config`
2. Localizar una tarjeta de proveedor configurado
3. Click en botón "Modelos"
4. Debería abrir modal con lista de modelos

### 3. Agregar un Nuevo Modelo

1. En el modal, click "Agregar Modelo"
2. Llenar:
   - ID: `claude-4-opus-20250301`
   - Nombre: `Claude 4 Opus`
   - Descripción: `Nueva generación`
   - ✅ Recomendado
   - ✅ Activo
3. Guardar
4. ✅ **El modelo aparece INMEDIATAMENTE en los dropdowns**
5. ✅ **Sin código, sin deploy, sin restart**

### 4. Marcar Modelo como Obsoleto

1. Localizar `Claude 3.5 Sonnet (Jun 2024)`
2. Click "Editar"
3. ✅ Marcar "Obsoleto"
4. ❌ Desmarcar "Activo"
5. Guardar
6. ✅ Modelo muestra badge amarillo "Obsoleto"

### 5. Cambiar Modelo Recomendado

1. Click en estrella de `Claude 4 Opus`
2. ✅ Se marca como recomendado
3. ✅ El anterior recomendado pierde la estrella automáticamente
4. ✅ En dropdowns aparece con ⭐

## 📊 Resultado Final

```
ANTES:
- Modelo hardcodeado → modificar código → commit → deploy → restart
- Tiempo: 30+ minutos

AHORA:
- Abrir modal → agregar modelo → guardar
- Tiempo: 30 segundos
- ✅ CERO código
- ✅ CERO deploy
- ✅ CERO restart
```

## 🔧 Troubleshooting

### Error: "ai_models table not found"

```bash
cd backend
npx prisma db push
npx prisma generate
```

### Error: "No models found"

```bash
node prisma/seeds/ai-models-seed.js
```

### El modal no abre

Verificar que agregaste el código del modal al final del return en `ia-config/page.tsx`.

### Modelos no aparecen en dropdown

Refrescar la página después de agregar/editar modelos.

## 📝 Próximos Pasos Opcionales

1. **Auto-refresh**: Agregar WebSocket para actualizar en tiempo real
2. **Validaciones**: Validar formato de model IDs
3. **Import/Export**: Exportar catálogo de modelos
4. **Audit log**: Registrar quién modificó qué modelo
5. **API externa**: Sincronizar con APIs de proveedores

## ✅ Checklist Final

- [ ] Seed ejecutado exitosamente
- [ ] Backend reiniciado
- [ ] Prisma Client regenerado
- [ ] Botón "Modelos" agregado en tarjetas
- [ ] Modal de gestión agregado
- [ ] Probado agregar modelo
- [ ] Probado editar modelo
- [ ] Probado eliminar modelo
- [ ] Probado toggle recomendado
- [ ] Verificado que aparece en dropdowns

Una vez completados todos los pasos, **nunca más necesitarás tocar código para gestionar modelos de IA**.
