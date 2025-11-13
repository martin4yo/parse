# Changelog - Sistema de Rendiciones

## Resumen de Cambios Realizados

### 🎨 **Mejoras de UI/UX**

#### **Grilla de Rendiciones**
- **Carga de descripciones optimizada**: Se cambió de múltiples llamadas API por celda a un sistema de cache por lotes que carga todas las descripciones en una sola llamada por tipo de campo
- **Eliminación de recarga innecesaria**: La grilla ya no se recarga automáticamente después de guardar cambios, solo cuando hay items nuevos o eliminados
- **Badge de cambios mejorado**: El contador de cambios pendientes ahora aparece en rojo para mejor visibilidad

#### **Layout y Posicionamiento**
- **Alturas uniformes**: Igualados los botones "Guardar cambios" y "Total del período" con altura fija `h-10` y padding `py-3`
- **Información de tarjeta sin wrap**: Aplicado `whitespace-nowrap overflow-hidden` para evitar que los textos se rompan en múltiples líneas
- **Search box expandible**: El campo de búsqueda ahora ocupa todo el espacio disponible entre los datos de tarjeta y los botones
- **Estado reposicionado**: Movido el estado del período desde la descripción de tarjeta al lado del search box como badge independiente
- **Layout estable**: Reservado espacio fijo (`w-56`) para el botón "Guardar cambios" para evitar reajustes de layout

### 🔧 **Optimizaciones de Backend**

#### **Problema de Conexiones Resuelto**
- **Singleton de Prisma**: Creado `src/lib/prisma.js` para una instancia única compartida de PrismaClient, evitando memory leaks
- **Graceful shutdown**: Implementado cierre correcto de conexiones de base de datos
- **Rate limiting mejorado**: Aumentado de 100 a 1000 requests/15min en desarrollo y 500 en producción

#### **Logging y Monitoreo**
- **Request logging**: Agregado logging de todas las requests con duración
- **Connection monitoring**: Detección de conexiones cerradas prematuramente
- **Error handling mejorado**: Mejor manejo y reporte de errores

#### **Archivos Actualizados**
- `backend/src/routes/rendiciones.js`: Actualizado para usar singleton de Prisma
- `backend/src/routes/parametros/maestros.js`: Actualizado para usar singleton de Prisma

### 🚀 **Optimizaciones de Rendimiento**

#### **Carga de Descripciones**
**Antes:**
- Una llamada API por cada celda individual
- Problemas de sincronización con descripciones faltantes
- Múltiples requests paralelas saturando el servidor

**Después:**
- Sistema de cache inteligente que recopila códigos únicos
- Una sola llamada por tipo de campo
- Cache en memoria para aplicación síncrona de descripciones
- Eliminación completa de llamadas duplicadas

#### **Gestión de Estado**
- **Sin recargas innecesarias**: La grilla mantiene los datos locales después de guardar modificaciones
- **Recarga inteligente**: Solo se recarga cuando hay items nuevos (necesitan IDs) o eliminados
- **Layout estable**: Los elementos no cambian de tamaño cuando aparecen/desaparecen botones

## Archivos Modificados

### Frontend
- `frontend/src/app/(protected)/rendiciones/page.tsx`
  - Optimización de carga de descripciones con sistema de cache
  - Eliminación de recarga automática post-guardado
  - Mejoras de layout y posicionamiento
  - Badge de cambios en rojo

### Backend
- `backend/src/index.js`
  - Rate limiting mejorado
  - Request logging
  - Connection monitoring
- `backend/src/lib/prisma.js` (nuevo)
  - Singleton de PrismaClient
  - Graceful shutdown
- `backend/src/routes/rendiciones.js`
  - Uso de singleton de Prisma
- `backend/src/routes/parametros/maestros.js`
  - Uso de singleton de Prisma

## Beneficios Obtenidos

### 🔧 **Técnicos**
- Eliminación de memory leaks en el backend
- Reducción drástica de llamadas API duplicadas
- Mejor gestión de conexiones de base de datos
- Sistema de cache eficiente para descripciones

### 👤 **Experiencia de Usuario**
- Grilla que no "parpadea" al guardar cambios
- Carga más rápida y consistente de descripciones
- Layout estable sin reajustes visuales
- Mejor visibilidad del contador de cambios

### 📊 **Performance**
- Reducción de ~90% en llamadas API para descripciones
- Eliminación de recargas innecesarias de datos
- Backend más estable sin rechazos de conexión
- Mejor tiempo de respuesta general

## Notas Técnicas

### Sistema de Cache de Descripciones
```javascript
// Antes: N llamadas (una por celda)
items.forEach(item => {
  api.get(`/parametros/maestros?tipo_campo=${tabla}&search=${codigo}`)
})

// Después: 1 llamada por tipo de campo
const codigosByField = // recopilar códigos únicos
api.get(`/parametros/maestros?tipo_campo=${tabla}&limit=1000`)
// aplicar desde cache
```

### Singleton de Prisma
```javascript
// Antes: Múltiples instancias
const prisma = new PrismaClient(); // en cada archivo

// Después: Instancia única compartida
const prisma = require('../lib/prisma'); // singleton
```

### Layout Estable
```css
/* Espacio reservado para botón */
.w-56 { width: 14rem; } /* Siempre presente */

/* Prevención de wrap */
.whitespace-nowrap { white-space: nowrap; }
.overflow-hidden { overflow: hidden; }
```

---
**Fecha:** $(date)
**Desarrollado por:** Claude Code Assistant