# Sistema de Jobs Asíncronos - Documentación Técnica

## Resumen General

Este documento describe la implementación completa del sistema de jobs asíncronos para el procesamiento de importaciones DKT, desarrollado para resolver problemas de timeout en transacciones de gran volumen (18,000+ registros).

## Problema Original

- **Timeout de transacciones**: Las importaciones grandes (18,000+ registros) superaban el límite de 60 segundos de Prisma
- **Bloqueo de UI**: El usuario no podía hacer otras tareas durante importaciones largas
- **Pérdida de progreso**: Si el usuario cerraba la página, perdía el seguimiento del proceso

## Solución Implementada

Sistema de jobs asíncronos con polling y persistencia en base de datos, que permite:
- Procesamiento en background
- Seguimiento de progreso en tiempo real
- Reanudación automática al volver a la página
- Historial de procesos completados

---

## Componentes del Sistema

### 1. Modelo de Base de Datos

**Archivo**: `backend/prisma/schema.prisma`

```prisma
model ProcessingJob {
  id            String    @id @default(cuid())
  type          String    // 'DKT_IMPORT', 'EXPORT', etc.
  status        String    // 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
  progress      Int       @default(0) // 0-100
  totalItems    Int?
  processedItems Int?
  message       String?
  userId        String
  parameters    Json      // Parámetros del job (filePath, loteId, etc.)
  result        Json?     // Resultado del job completado
  error         String?
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### 2. Servicio de Procesamiento

**Archivo**: `backend/src/services/jobProcessor.js`

**Funcionalidades principales**:
- `createJob()`: Crea un nuevo job en la base de datos
- `processJob()`: Ejecuta el procesamiento en background
- `updateJobStatus()`: Actualiza progreso y estado
- `getUserJobs()`: Obtiene jobs del usuario
- `cancelJob()`: Cancela jobs en ejecución

**Características técnicas**:
- Uso de `setImmediate()` para procesamiento asíncrono
- Transacciones extendidas (5 minutos timeout)
- Aplicación de reglas de negocio integrada
- Logging detallado de progreso

### 3. API Endpoints

**Archivo**: `backend/src/routes/jobs.js`

#### Endpoints disponibles:

- `GET /api/jobs` - Lista jobs del usuario con validación de lotes
- `GET /api/jobs/:id` - Obtiene estado específico de un job
- `POST /api/jobs/:id/cancel` - Cancela un job en ejecución
- `POST /api/jobs/dkt-import` - Crea job de importación DKT

#### Validación de lotes:
```javascript
// Solo muestra jobs cuyo lote existe en resumen_tarjeta
const loteExists = await prisma.resumenTarjeta.findFirst({
  where: { loteId: job.result.loteId }
});
if (!loteExists) job.loteDeleted = true;
```

### 4. Frontend - Página de Importación

**Archivo**: `packages/web/src/app/(protected)/dkt/importar/page.tsx`

#### Funcionalidades implementadas:

**Detección automática de jobs activos**:
```typescript
const checkActiveJobs = useCallback(async () => {
  // Evita llamadas simultáneas
  if (checkingJobsRef.current) return;
  
  // Busca jobs en progreso y reanuda automáticamente
  const activeJob = dktJobs.find(job => 
    job.status === 'PROCESSING' || job.status === 'QUEUED'
  );
  
  if (activeJob) {
    // Reanuda sin preguntar al usuario
    setIsUploading(true);
    setCurrentJob(activeJob);
    startJobPolling(activeJob.id);
  }
}, []);
```

**Polling de progreso**:
```typescript
const pollJob = useCallback(async () => {
  const job = await jobsApi.getJob(currentJobId);
  setUploadProgress(job.progress);
  setJobProgressMessage(job.message || '');
  
  if (job.status === 'COMPLETED' || job.status === 'FAILED') {
    // Finalizar polling
    clearJobPolling();
  }
}, [currentJobId]);
```

#### Mejoras de UX implementadas:

1. **Reanudación automática**: Sin confirmación del usuario
2. **Prevención de duplicados**: Control de llamadas simultáneas con refs
3. **Toast único**: Solo muestra notificación una vez por job
4. **Historial filtrado**: Solo jobs con lotes existentes
5. **Iconos consistentes**: Uso de lucide-react en lugar de emojis

### 5. API Client

**Archivo**: `packages/web/src/lib/api.ts`

```typescript
export interface ProcessingJob {
  id: string;
  type: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  totalItems?: number;
  processedItems?: number;
  message?: string;
  result?: any;
  error?: string;
  loteDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const jobsApi = {
  getJobs: async (limit: number = 50): Promise<{ jobs: ProcessingJob[] }>,
  getJob: async (id: string): Promise<ProcessingJob>,
  cancelJob: async (id: string): Promise<{ message: string }>
};
```

---

## Flujo de Trabajo

### 1. Inicio de Importación
```
Usuario selecciona archivo → 
POST /api/jobs/dkt-import → 
Job creado en BD → 
Procesamiento inicia en background → 
Frontend inicia polling
```

### 2. Procesamiento Background
```
JobProcessor.processJob() → 
Aplicar reglas de negocio → 
Insertar registros en lotes → 
Actualizar progreso cada 100 registros → 
Completar job
```

### 3. Seguimiento Frontend
```
Polling cada 2 segundos → 
Actualizar barra de progreso → 
Mostrar mensajes de estado → 
Detectar finalización → 
Actualizar historial
```

### 4. Reanudación Automática
```
Usuario vuelve a la página → 
checkActiveJobs() → 
Detecta job activo → 
Reanuda polling → 
Muestra progreso actual
```

---

## Características Técnicas

### Prevención de Problemas

1. **Timeouts**: Transacciones extendidas a 5 minutos
2. **Memoria**: Procesamiento en lotes de 100 registros
3. **Concurrencia**: Control con refs para evitar múltiples llamadas
4. **Consistencia**: Validación de existencia de lotes
5. **UX**: Reanudación automática sin interrupciones

### Logging y Debugging

- Console logs detallados en frontend
- Timestamps en cada operación
- Estados de job trackeados
- Errores capturados y reportados

### Identificadores

- **CUID**: Usado consistentemente (no UUID)
- **Validación**: `isLength({ min: 1 })` en lugar de `isUUID()`

---

## Configuración Requerida

### Variables de Entorno

```env
# Timeout extendido para transacciones largas
DATABASE_URL="postgresql://..."

# Para procesamiento de archivos
MAX_FILE_SIZE="52428800"
UPLOAD_DIR="uploads"
```

### Dependencias

- `@prisma/client` - ORM con soporte de transacciones
- `express-validator` - Validación de parámetros
- `react-hot-toast` - Notificaciones (sin .info())
- `lucide-react` - Iconos consistentes

---

## Casos de Uso Soportados

1. **Importación grande**: 18,000+ registros sin timeout
2. **Navegación libre**: Usuario puede salir y volver
3. **Múltiples usuarios**: Jobs aislados por userId
4. **Cancelación**: Jobs pueden cancelarse manualmente
5. **Historial**: Solo jobs con lotes válidos
6. **Reanudación**: Automática sin confirmación

---

## Próximas Mejoras Potenciales

1. **Notificaciones push**: Para jobs completados fuera de la página
2. **Retry automático**: Para jobs fallidos
3. **Estimación de tiempo**: Basada en registros procesados
4. **Jobs programados**: Para procesamiento diferido
5. **Métricas**: Tiempo promedio, tasa de éxito, etc.

---

## Conclusión

El sistema de jobs asíncronos resuelve completamente los problemas de timeout y UX en importaciones grandes. La implementación es robusta, escalable y proporciona una experiencia de usuario fluida con reanudación automática y seguimiento en tiempo real.

La arquitectura permite extensión fácil para otros tipos de procesos largos en el futuro.