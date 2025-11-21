# Refactorización del Modal de Edición de Comprobantes

## Objetivos

1. Eliminar código duplicado entre `/parse` y `/exportar`
2. Centralizar lógica en hook reutilizable
3. Crear componente de validación reutilizable
4. Facilitar mantenimiento futuro

## Cambios Completados

### ✅ 1. Hook `useComprobanteEdit` creado
**Ubicación:** `frontend/src/hooks/useComprobanteEdit.ts`

**Contiene toda la lógica:**
- Estados (documento, líneas, impuestos, parámetros maestros, etc.)
- Funciones de carga (`loadDocumentoLineas`, `loadDocumentoImpuestos`)
- Función de guardado (`saveEdit`)
- Gestión de modales de items e impuestos
- Estado de distribuciones (dimensiones)

### ✅ 2. Componente `ValidationErrorIcon` creado
**Ubicación:** `frontend/src/components/comprobantes/ValidationErrorIcon.tsx`

**Funcionalidad:**
- Muestra íconos de error según severidad (BLOQUEANTE, ERROR, WARNING)
- Tooltip con detalles del error
- Búsqueda de errores por ID de registro (robusto)

### ✅ 3. Backend actualizado
**Archivo:** `backend/src/services/businessRulesEngine.js`

**Cambios:**
- Ahora guarda `lineaId` en errores de líneas (línea 1326)
- Ahora guarda `impuestoId` en errores de impuestos (línea 1391)
- Permite identificación robusta de errores por ID de registro

---

## Cambios Pendientes

### 📋 Funciones a Eliminar de `page.tsx` (parse y exportar)

Las siguientes funciones **YA ESTÁN EN EL HOOK** y deben eliminarse de ambas páginas:

#### Funciones de Carga:
- ❌ `loadDocumentoLineas()` → usar `comprobanteEdit.loadDocumentoLineas()`
- ❌ `loadDocumentoImpuestos()` → usar `comprobanteEdit.loadDocumentoImpuestos()`
- ❌ `enrichWithNames()` → está integrado en el hook
- ❌ `loadDistribucionesStatus()` → usar `comprobanteEdit.loadDistribucionesStatus()`

#### Funciones de Validación:
- ❌ `getFieldErrors()` → ahora en componente `ValidationErrorIcon`
- ❌ `ValidationErrorIcon` (componente local) → reemplazar con importación
- ✅ `getErrorCountBySection()` → **MANTENER** (no está en el hook, es específica de UI)

#### Funciones de Edición:
- ❌ `handleOpenEditModal()` → reemplazar con `comprobanteEdit.openEditModal()`
- ❌ `handleSaveEdit()` → reemplazar con `comprobanteEdit.saveEdit()`

#### Funciones de Items/Impuestos:
- Revisar si `handleDeleteLinea` y `handleDeleteImpuesto` están duplicadas

---

## Cómo Usar el Hook en las Páginas

### 1. Imports necesarios

```typescript
import { useComprobanteEdit } from '@/hooks/useComprobanteEdit';
import { ValidationErrorIcon } from '@/components/comprobantes/ValidationErrorIcon';
```

### 2. Instanciar el hook

```typescript
const comprobanteEdit = useComprobanteEdit({
  onSaveSuccess: (updatedDoc) => {
    // Actualizar lista local de documentos
    setDocumentos(prev => prev.map(doc =>
      doc.id === updatedDoc.id ? updatedDoc : doc
    ));
  }
});

// Estado local solo para controlar visibilidad del modal
const [showEditModal, setShowEditModal] = useState(false);
```

### 3. Abrir modal de edición

```typescript
const handleOpenEditModal = async (doc: DocumentoProcessado) => {
  await comprobanteEdit.openEditModal(doc);
  setShowEditModal(true);
};
```

### 4. Guardar cambios

```typescript
const handleSaveEdit = async () => {
  const success = await comprobanteEdit.saveEdit();
  if (success) {
    setShowEditModal(false);
    comprobanteEdit.closeEditModal();
  }
};
```

### 5. Usar ValidationErrorIcon en JSX

**Antes:**
```jsx
<ValidationErrorIcon fieldName="tipoProducto" itemIndex={lineaIndex} />
```

**Después:**
```jsx
<ValidationErrorIcon
  fieldName="tipoProducto"
  entityId={linea.id}
  errors={comprobanteEdit.selectedDocument?.validationErrors?.errors}
/>
```

---

## Mapeo de Estados

### Estados que ahora vienen del hook:

| Antes (local) | Después (hook) |
|---|---|
| `selectedDocumentForEdit` | `comprobanteEdit.selectedDocument` |
| `editFormData` | `comprobanteEdit.editFormData` |
| `setEditFormData` | `comprobanteEdit.setEditFormData` |
| `activeTab` | `comprobanteEdit.activeTab` |
| `setActiveTab` | `comprobanteEdit.setActiveTab` |
| `savingEdit` | `comprobanteEdit.savingEdit` |
| `documentoLineas` | `comprobanteEdit.documentoLineas` |
| `documentoImpuestos` | `comprobanteEdit.documentoImpuestos` |
| `loadingLineas` | `comprobanteEdit.loadingLineas` |
| `loadingImpuestos` | `comprobanteEdit.loadingImpuestos` |
| `showItemModal` | `comprobanteEdit.showItemModal` |
| `setShowItemModal` | `comprobanteEdit.setShowItemModal` |
| `selectedItem` | `comprobanteEdit.selectedItem` |
| `setSelectedItem` | `comprobanteEdit.setSelectedItem` |
| `itemFormData` | `comprobanteEdit.itemFormData` |
| `setItemFormData` | `comprobanteEdit.setItemFormData` |
| `savingItem` | `comprobanteEdit.savingItem` |
| `setSavingItem` | `comprobanteEdit.setSavingItem` |
| `showImpuestoModal` | `comprobanteEdit.showImpuestoModal` |
| `setShowImpuestoModal` | `comprobanteEdit.setShowImpuestoModal` |
| `selectedImpuesto` | `comprobanteEdit.selectedImpuesto` |
| `setSelectedImpuesto` | `comprobanteEdit.setSelectedImpuesto` |
| `impuestoFormData` | `comprobanteEdit.impuestoFormData` |
| `setImpuestoFormData` | `comprobanteEdit.setImpuestoFormData` |
| `savingImpuesto` | `comprobanteEdit.savingImpuesto` |
| `setSavingImpuesto` | `comprobanteEdit.setSavingImpuesto` |
| `proveedores` | `comprobanteEdit.proveedores` |
| `tiposProducto` | `comprobanteEdit.tiposProducto` |
| `codigosProducto` | `comprobanteEdit.codigosProducto` |
| `codigosDimension` | `comprobanteEdit.codigosDimension` |
| `subcuentas` | `comprobanteEdit.subcuentas` |
| `cuentasContables` | `comprobanteEdit.cuentasContables` |
| `tiposOrdenCompra` | `comprobanteEdit.tiposOrdenCompra` |
| `showDistribucionesModal` | `comprobanteEdit.showDistribucionesModal` |
| `setShowDistribucionesModal` | `comprobanteEdit.setShowDistribucionesModal` |
| `distribucionesEntidad` | `comprobanteEdit.distribucionesEntidad` |
| `setDistribucionesEntidad` | `comprobanteEdit.setDistribucionesEntidad` |
| `distribucionesStatus` | `comprobanteEdit.distribucionesStatus` |
| `setDistribucionesStatus` | `comprobanteEdit.setDistribucionesStatus` |

---

## Pasos Siguientes

### Para `/parse/page.tsx`:

1. ✅ Imports agregados
2. ✅ Hook instanciado
3. ✅ `handleOpenEditModal` actualizado
4. ✅ `handleSaveEdit` actualizado
5. ⏳ Eliminar función `getFieldErrors`
6. ⏳ Eliminar función `ValidationErrorIcon` local
7. ⏳ Eliminar funciones duplicadas de carga
8. ⏳ Actualizar referencias en JSX a estados del hook
9. ⏳ Actualizar todas las instancias de `ValidationErrorIcon` en JSX

### Para `/exportar/page.tsx`:

1. ⏳ Agregar imports
2. ⏳ Instanciar hook
3. ⏳ Actualizar funciones
4. ⏳ Eliminar duplicados
5. ⏳ Actualizar JSX

---

## Beneficios de la Refactorización

### ✅ Mantenibilidad
- Cambios en un solo lugar
- Menos código duplicado
- Más fácil de entender

### ✅ Consistencia
- Mismo comportamiento en ambas páginas
- Validaciones centralizadas
- Errores identificados correctamente por ID

### ✅ Testabilidad
- Hook puede testearse de forma aislada
- Componentes más pequeños y enfocados

### ✅ Escalabilidad
- Fácil agregar nuevas páginas que usen el modal
- Lógica reutilizable en otras funcionalidades

---

## Problemas Solucionados

1. **Identificación de errores por índice** → Ahora usa IDs de registro
2. **Código duplicado entre páginas** → Centralizado en hook
3. **Funciones de validación repetidas** → Componente reutilizable
4. **Difícil mantener cambios** → Un solo punto de modificación

---

## Testing

Después de completar la refactorización, probar:

1. ✅ Abrir modal de edición
2. ✅ Editar datos del encabezado
3. ✅ Guardar cambios
4. ✅ Ver errores de validación en campos correctos
5. ✅ Editar líneas e impuestos
6. ✅ Gestionar dimensiones y subcuentas
7. ✅ Verificar que funciona igual en `/parse` y `/exportar`
