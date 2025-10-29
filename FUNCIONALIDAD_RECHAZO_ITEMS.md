# Funcionalidad de Rechazo de Items Individuales

## Descripción General
Sistema que permite rechazar items individuales en la página de autorizaciones con motivo, almacenando cambios en localStorage y sincronizando con la base de datos solo al autorizar/rechazar la rendición completa.

## Arquitectura

### Frontend (autorizaciones/page.tsx)

#### Estados Principales
- `rejectedItems: Set<string>` - IDs de items rechazados visualmente
- `modalRechazarItem` - Estado del modal para escribir motivo de rechazo
- `modalMotivoRechazo` - Estado del modal para ver motivo de rechazo
- `rendicionItems: RendicionItem[]` - Items con estado actualizado desde localStorage

#### Funciones de localStorage
```typescript
getLocalStorageKey(rendicionId: string) // Clave única por rendición
saveChangesToLocalStorage(rendicionId, itemChanges) // Guardar cambios
loadChangesFromLocalStorage(rendicionId) // Cargar cambios
clearLocalStorageChanges(rendicionId) // Limpiar después de sincronizar
syncChangesToDatabase(rendicionId) // Sincronizar con BD
```

#### Funciones de Interacción
- `handleToggleRechazarItem(itemId)` - Alternar rechazo (solo localStorage)
- `handleConfirmRechazarItem(motivo)` - Actualizar motivo (solo localStorage) 
- `handleAbrirModalMotivo(itemId)` - Abrir modal para escribir motivo
- `handleVerMotivoRechazo(motivo)` - Ver motivo existente

### Backend (routes/rendiciones.js)

#### Endpoints Implementados

**PATCH /rendiciones/items/:itemId/rechazar**
- Rechaza item individual con motivo
- Valida rendición en estado ENAUT
- Guarda `rechazo: true` y `motivoRechazo`

**PATCH /rendiciones/items/:itemId/deshacer-rechazo** 
- Revierte rechazo de item individual
- Establece `rechazo: false` y `motivoRechazo: null`

**PATCH /rendiciones/items/:itemId/actualizar-motivo**
- Actualiza solo el motivo de rechazo
- Valida que item esté rechazado

## Flujo de Usuario

### 1. Marcar Item como Rechazado
```
Usuario click XCircle → handleToggleRechazarItem() → 
  - Marca visualmente (fila roja)
  - Guarda en localStorage
  - Aparece icono AlertCircle
  - Toast: "Item rechazado (pendiente de guardar)"
```

### 2. Escribir Motivo de Rechazo
```
Usuario click AlertCircle → handleAbrirModalMotivo() →
  Modal con textarea → handleConfirmRechazarItem() →
  - Actualiza localStorage con motivo
  - Toast: "Motivo actualizado (pendiente de guardar)"
```

### 3. Revertir Rechazo
```
Usuario click CheckCircle → handleToggleRechazarItem() →
  - Remueve marca visual
  - Remueve de localStorage
  - Vuelve a estado normal
  - Toast: "Rechazo revertido (pendiente de guardar)"
```

### 4. Sincronización con BD
```
Usuario click "Autorizar/Rechazar Rendición" →
  syncChangesToDatabase() → 
  - Aplica rechazos del localStorage a BD
  - Limpia localStorage
  - Procede con autorización/rechazo de cabecera
```

## Componentes UI

### Estados Visuales
- **Item Normal**: XCircle rojo - "Rechazar item"
- **Item Rechazado sin motivo**: CheckCircle verde + AlertCircle naranja - "Escribir motivo" 
- **Item Rechazado con motivo**: CheckCircle verde + AlertCircle naranja - "Ver motivo"

### Modales
- **ModalRechazarItem**: Textarea para escribir motivo de rechazo
- **ModalMotivoRechazo**: Visualización de motivo existente
- **ModalAutorizar**: Confirmación de autorización con advertencia sobre items rechazados
- **ModalRechazar**: Confirmación de rechazo con textarea para motivo general

## Persistencia de Datos

### localStorage
```javascript
Clave: `rendicion_changes_${rendicionId}`
Valor: {
  [itemId]: {
    rechazo: boolean,
    motivoRechazo?: string
  }
}
```

### Base de Datos (tabla rendicion_tarjeta_items)
- `rechazo: Boolean` - Estado de rechazo
- `motivoRechazo: String?` - Motivo del rechazo

## Integración con Autorización

### Función handleAutorizar
1. Sincroniza cambios del localStorage con BD
2. Obtiene lista actualizada de items rechazados
3. Llama endpoint `/autorizaciones/autorizar` con items rechazados
4. Actualiza cabecera a estado "AUTOR"
5. Limpia localStorage

### Función handleRechazar
1. Sincroniza cambios del localStorage con BD  
2. Llama endpoint `/autorizaciones/rechazar` con motivo
3. Actualiza cabecera a estado "RECH"
4. Limpia localStorage

## Características Técnicas

### Ventajas
- ✅ **Offline First**: Cambios persisten en localStorage
- ✅ **Navegación Libre**: Cambios se mantienen al cambiar de período
- ✅ **Sincronización Eficiente**: Solo envía cambios reales a BD
- ✅ **UX Mejorada**: Feedback inmediato sin esperar BD
- ✅ **Consistencia**: Estado visual sincronizado con datos

### Consideraciones
- 📝 **Dependencia localStorage**: Requiere JavaScript habilitado
- 📝 **Limpieza Manual**: localStorage se limpia solo al autorizar/rechazar
- 📝 **Validación**: Backend valida estado de rendición en cada operación

## Testing

### Casos de Prueba Principales
1. **Rechazo Simple**: Rechazar → Escribir motivo → Autorizar
2. **Rechazo y Reversión**: Rechazar → Revertir → Autorizar  
3. **Navegación**: Rechazar → Cambiar período → Volver → Verificar persistencia
4. **Múltiples Items**: Rechazar varios → Autorizar → Verificar sincronización
5. **Motivos Largos**: Probar textarea con texto extenso

### Validaciones Backend
- Estado de rendición ENAUT
- Existencia de item
- Motivo obligatorio en rechazos
- Item rechazado para actualizar motivo

## Configuración

### Prerrequisitos
- Tabla `rendicion_tarjeta_items` con campos `rechazo` y `motivoRechazo`
- Estados de rendición: `ENAUT`, `AUTOR`, `RECH`
- localStorage disponible en navegador

### Variables de Entorno
- Database connection para Prisma ORM
- JWT tokens para autenticación de endpoints

## Notas de Implementación

### Decisiones de Diseño
- **localStorage vs SessionStorage**: localStorage para persistir entre sesiones
- **Sincronización Diferida**: Por performance y UX
- **Validación Dual**: Frontend (UX) + Backend (seguridad)
- **Estados Visuales Claros**: Icons y colores distintivos

### Futuras Mejoras Potenciales
- Indicador visual de "cambios pendientes"
- Auto-guardado periódico opcional
- Historial de cambios por item
- Exportación de motivos de rechazo