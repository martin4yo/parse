# Roadmap - Grilla de Rendiciones

## 🎯 Funcionalidades Pendientes

### 1. **Selector Inteligente para Foreign Keys** ⭐ ALTA PRIORIDAD
**Descripción**: Para campos que referencian tablas de parámetros, implementar un selector tipo "combobox con búsqueda"

**Comportamiento esperado**:
- Al editar un campo con FK, mostrar un popup/modal
- Campo de búsqueda en la parte superior
- Lista desplegable debajo que muestre código + descripción
- Filtrado en tiempo real por texto en cualquiera de los 2 campos
- Navegación con flechas arriba/abajo
- Selección con Enter o click
- Escape para cancelar

**Implementación técnica**:
- Detectar automáticamente campos con FK en el schema de Prisma
- Crear componente `SmartSelector.tsx`
- API endpoint para búsqueda de parámetros: `GET /api/parametros/{tabla}?search={texto}`
- Posicionamiento inteligente del popup (que no se corte en bordes)

**Campos afectados**:
- `tipoComprobante` → tabla `tipos_comprobante`
- `tipoProducto` → tabla `tipos_producto`
- Cualquier otro campo que referencie tablas de parámetros

---

### 2. **Guardado con LocalStorage y Sincronización Manual** ⭐ ALTA PRIORIDAD
**Descripción**: Sistema de guardado resiliente usando localStorage como buffer temporal

**Arquitectura**:
- Todos los cambios se guardan automáticamente en localStorage
- Botón "Guardar cambios" para sincronizar con el servidor
- Recuperación automática de cambios no guardados al recargar
- Clave de storage: `rendiciones_draft_{numeroTarjeta}_{periodo}_{userId}`

**Comportamiento**:
- Auto-guardado en localStorage después de cada cambio (con debounce 500ms)
- Badge contador de cambios pendientes en botón guardar
- Warning al intentar salir con cambios sin sincronizar
- Recuperación automática al volver a la grilla
- Merge inteligente si hay cambios en localStorage al cargar

**Estados visuales**:
- 🟡 Fila modificada (fondo amarillo claro)
- 🆕 Fila nueva (borde verde)
- 🗑️ Fila eliminada (tachada, fondo rojo claro)
- 🔵 Sincronizando... (spinner en botón)
- ✅ Sincronizado (mensaje temporal)
- 🔴 Error de sincronización (con opción de reintentar)

**Ventajas**:
- Resiliencia ante pérdida de conexión
- Trabajo offline
- Una sola llamada API (eficiente)
- Usuario tiene control sobre cuándo guardar
- Posibilidad de revisar cambios antes de confirmar

**Estructura localStorage**:
```json
{
  "timestamp": "2024-01-20T10:30:00Z",
  "changes": {
    "modified": [
      { "id": "123", "fields": { "tipoComprobante": "FC", ... } }
    ],
    "new": [
      { "tempId": "temp_1", "fields": { ... } }
    ],
    "deleted": ["456", "789"]
  }
}

---

### 3. **Validaciones en Tiempo Real** 🔶 MEDIA PRIORIDAD
**Descripción**: Validar datos mientras el usuario tipea

**Validaciones por tipo de campo**:
- **CUIT**: Formato y dígito verificador
- **Números**: Rangos válidos, decimales
- **Fechas**: Formato y rango válido
- **Obligatorios**: No vacíos
- **Longitud**: Min/max caracteres

**Comportamiento**:
- Indicador visual inmediato (borde rojo si inválido)
- Tooltip con mensaje de error
- Prevenir guardado si hay errores críticos

---

### 4. **Shortcuts Adicionales** 🔶 MEDIA PRIORIDAD
**Descripción**: Más atajos de teclado para productividad

**Shortcuts propuestos**:
- `Ctrl+C` / `Ctrl+V`: Copiar/Pegar contenido de celdas
- `Ctrl+Z` / `Ctrl+Y`: Deshacer/Rehacer cambios
- `Ctrl+D`: Rellenar hacia abajo (copiar valor de celda superior)
- `Ctrl+Shift+D`: Rellenar hacia arriba
- `Insert`: Insertar nueva fila
- `Delete`: Eliminar fila (con confirmación)
- `Ctrl+F`: Búsqueda global en la grilla

---

### 5. **Filtros por Columna** 🔶 MEDIA PRIORIDAD
**Descripción**: Filtros tipo Excel en cada columna

**Funcionalidades**:
- Icono de filtro en header de cada columna
- Dropdown con:
  - Campo de búsqueda
  - Lista de valores únicos con checkboxes
  - "Seleccionar todo" / "Deseleccionar todo"
  - Filtros por rangos (fechas, números)
- Indicador visual de columnas filtradas
- "Limpiar todos los filtros"

---

### 6. **Ordenamiento** 🔶 MEDIA PRIORIDAD
**Descripción**: Ordenar por columnas con indicadores visuales

**Funcionalidades**:
- Click en header para ordenar ASC/DESC
- Indicador de flecha ↑/↓ en header
- Ordenamiento múltiple (Ctrl+Click)
- Indicador numérico del orden (1, 2, 3...)

---

### 7. **Bulk Operations** 🟡 BAJA PRIORIDAD
**Descripción**: Operaciones en lote para múltiples filas

**Funcionalidades**:
- Selección múltiple con Ctrl+Click y Shift+Click
- Checkbox en primera columna para selección
- Barra de acciones flotante al seleccionar:
  - Eliminar seleccionadas
  - Exportar seleccionadas
  - Editar campo en lote
  - Duplicar filas

---

### 8. **Exportación** 🟡 BAJA PRIORIDAD
**Descripción**: Exportar datos en diferentes formatos

**Formatos**:
- Excel (.xlsx)
- CSV
- PDF (tabla formateada)

**Opciones**:
- Solo datos visibles (filtrados) o todos
- Solo columnas visibles o todas
- Incluir/excluir headers

---

### 9. **Columnas Configurables** 🟡 BAJA PRIORIDAD
**Descripción**: Personalizar qué columnas mostrar/ocultar

**Funcionalidades**:
- Menú "Configurar columnas"
- Drag & drop para reordenar
- Checkboxes para mostrar/ocultar
- Guardar configuración por usuario
- Presets predefinidos ("Básico", "Completo", "Contable")

---

### 10. **Historial de Cambios** 🟡 BAJA PRIORIDAD
**Descripción**: Auditoría de todas las modificaciones

**Funcionalidades**:
- Log de todos los cambios (quién, cuándo, qué cambió)
- Modal "Ver historial" por fila
- Comparar versiones lado a lado
- Posibilidad de revertir cambios

---

### 11. **Temas y Personalización** 🟡 BAJA PRIORIDAD
**Descripción**: Personalizar apariencia de la grilla

**Opciones**:
- Tema claro/oscuro
- Densidad de filas (compacto, normal, espacioso)
- Tamaño de fuente
- Colores de alternancia de filas
- Resaltar filas modificadas

---

### 12. **Performance y Virtualización** 🔶 MEDIA PRIORIDAD
**Descripción**: Manejar grandes volúmenes de datos

**Mejoras**:
- Virtualización de filas (solo renderizar las visibles)
- Paginación del lado del servidor
- Lazy loading de datos
- Debounce en búsquedas y filtros
- Caché inteligente

---

## 🏗️ Orden de Implementación Sugerido

### Fase 1 (Inmediata)
1. **Selector Inteligente para Foreign Keys**
2. **Guardado Automático**

### Fase 2 (Corto Plazo)
3. **Validaciones en Tiempo Real**
4. **Shortcuts Adicionales**
5. **Performance y Virtualización**

### Fase 3 (Mediano Plazo)
6. **Filtros por Columna**
7. **Ordenamiento**

### Fase 4 (Largo Plazo)
8. **Bulk Operations**
9. **Exportación**
10. **Columnas Configurables**
11. **Historial de Cambios**
12. **Temas y Personalización**

---

## 📋 Notas Técnicas

### Estructura de Archivos Sugerida
```
src/components/rendiciones/
├── grid/
│   ├── RendicionGrid.tsx (componente principal)
│   ├── SmartSelector.tsx (selector con búsqueda)
│   ├── CellEditor.tsx (editor de celdas)
│   ├── GridToolbar.tsx (barra de herramientas)
│   ├── ColumnFilter.tsx (filtros por columna)
│   ├── BulkActions.tsx (acciones en lote)
│   └── hooks/
│       ├── useGridNavigation.ts
│       ├── useAutoSave.ts
│       ├── useGridValidation.ts
│       └── useGridSelection.ts
```

### APIs Requeridas
- `POST /api/rendiciones/items/bulk-update` (guardado en lote)
- `GET /api/parametros/{tabla}?search={query}` (búsqueda de parámetros)
- `GET /api/rendiciones/items/export` (exportación)
- `POST /api/rendiciones/items/{id}/history` (historial)

### Dependencias Adicionales
- `@tanstack/react-virtual` (virtualización)
- `react-hotkeys-hook` (shortcuts)
- `xlsx` (exportar Excel)
- `jspdf` + `jspdf-autotable` (exportar PDF)
- `fuse.js` (búsqueda fuzzy)