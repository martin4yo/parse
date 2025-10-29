# Módulo de Procesamiento de Documentos

## Descripción General

Este módulo permite subir archivos PDF o imágenes (JPG, PNG) y extraer automáticamente datos específicos como fechas, importes, números de CUIT y números de comprobante para facilitar la carga de información en el sistema de rendiciones.

## Arquitectura

### Base de Datos

#### Modelo DocumentoProcesado

```prisma
model DocumentoProcesado {
  id                        String               @id @default(cuid())
  rendicionItemId           String?              // Opcional - asociación con item de rendición
  nombreArchivo             String               // Nombre original del archivo
  tipoArchivo               String               // pdf, jpg, png
  rutaArchivo               String               // Ruta física del archivo
  fechaProcesamiento        DateTime             @default(now())
  estadoProcesamiento       String               @default("procesando") // procesando, completado, error
  datosExtraidos            Json?                // JSON con todos los datos extraídos
  fechaExtraida             DateTime?            // Fecha encontrada en el documento
  importeExtraido           Decimal?             // Importe encontrado
  cuitExtraido              String?              // CUIT encontrado
  numeroComprobanteExtraido String?              // Número de comprobante encontrado
  observaciones             String?              // Notas adicionales o errores
  usuarioId                 String               // Usuario que subió el documento
  createdAt                 DateTime             @default(now())
  updatedAt                 DateTime             @updatedAt
  
  // Relaciones
  rendicionItem             RendicionTarjetaItem? @relation(fields: [rendicionItemId], references: [id])
  usuario                   User                 @relation(fields: [usuarioId], references: [id])
}
```

#### Estados de Procesamiento

- **`procesando`**: El documento está siendo analizado
- **`completado`**: El procesamiento finalizó exitosamente
- **`error`**: Ocurrió un error durante el procesamiento

### Backend

#### Servicios

##### DocumentProcessor (`/src/lib/documentProcessor.js`)

Clase principal para el procesamiento de documentos:

```javascript
class DocumentProcessor {
  // Métodos principales
  async processPDF(filePath)      // Extrae texto de PDFs
  async processImage(filePath)    // Aplica OCR a imágenes
  async extractData(text)         // Extrae datos específicos del texto
  
  // Métodos de extracción específica
  extractFecha(text)              // Busca fechas en formato argentino
  extractImporte(text)            // Busca importes en formato $X.XXX,XX
  extractCUIT(text)               // Busca CUIT con formato XX-XXXXXXXX-X
  extractNumeroComprobante(text)  // Busca números de comprobante
}
```

##### Librerías Utilizadas

- **`pdf-parse`**: Extracción de texto de archivos PDF
- **`tesseract.js`**: OCR para reconocimiento de texto en imágenes
- **`sharp`**: Optimización de imágenes para mejorar el OCR
- **`multer`**: Manejo de subida de archivos

#### API Endpoints (`/src/routes/documentos.js`)

##### POST `/api/documentos/procesar`

Sube y procesa un documento.

**Request:**
- **Content-Type**: `multipart/form-data`
- **Headers**: `Authorization: Bearer <token>`

**Body:**
```javascript
{
  documento: File,              // Archivo (PDF, JPG, PNG, máx 10MB)
  rendicionItemId?: string      // Opcional - ID del item de rendición
}
```

**Response:**
```javascript
{
  success: true,
  documentoId: "clxxxxx",
  mensaje: "Archivo subido correctamente. El procesamiento comenzará en breve."
}
```

##### GET `/api/documentos/:id`

Obtiene el estado y resultados del procesamiento.

**Response:**
```javascript
{
  id: "clxxxxx",
  nombreArchivo: "factura.pdf",
  tipoArchivo: "pdf",
  estadoProcesamiento: "completado",
  fechaExtraida: "2024-03-15",
  importeExtraido: 1250.50,
  cuitExtraido: "20-12345678-9",
  numeroComprobanteExtraido: "0001-00001234",
  datosExtraidos: {
    texto: "Texto completo extraído...",
    fecha: "2024-03-15",
    importe: 1250.50,
    // ... otros datos
  },
  usuario: {
    nombre: "Juan",
    apellido: "Pérez"
  },
  createdAt: "2024-03-15T10:30:00.000Z"
}
```

##### GET `/api/documentos`

Lista documentos del usuario autenticado.

**Query Parameters:**
- `rendicionItemId` (opcional): Filtrar por item de rendición

##### PUT `/api/documentos/:id/aplicar`

Aplica los datos extraídos al item de rendición asociado.

**Body:**
```javascript
{
  camposAplicar: ["fecha", "importe", "cuit", "numeroComprobante"]
}
```

##### DELETE `/api/documentos/:id`

Elimina un documento y su archivo asociado.

## Patrones de Extracción

### Fechas

El sistema reconoce estos formatos:
- `DD/MM/YYYY` (ej: 15/03/2024)
- `DD-MM-YYYY` (ej: 15-03-2024)
- `YYYY/MM/DD` (ej: 2024/03/15)
- `Fecha: DD/MM/YYYY`

### Importes

Formatos reconocidos:
- `$1.234,56`
- `Total: $1.234,56`
- `Importe: 1.234,56`
- `1.234,56`

### CUIT

Formatos reconocidos:
- `20-12345678-9`
- `20123456789`
- `CUIT: 20-12345678-9`

### Números de Comprobante

Patrones reconocidos:
- `Número: 123456`
- `Comprobante: 123456`
- `Factura N° 123456`
- `Ticket: 123456`
- `N° 123456`

## Configuración

### Variables de Entorno

No requiere variables específicas adicionales. Utiliza la configuración existente del proyecto.

### Almacenamiento

Los archivos se almacenan en:
```
backend/uploads/documentos/
```

### Límites

- **Tamaño máximo**: 10MB por archivo
- **Tipos permitidos**: PDF, JPG, JPEG, PNG
- **Procesamiento**: Asíncrono para no bloquear la respuesta

## Flujo de Uso

### 1. Subida de Documento
```javascript
// Frontend - Subir archivo
const formData = new FormData();
formData.append('documento', file);
formData.append('rendicionItemId', itemId); // Opcional

const response = await fetch('/api/documentos/procesar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### 2. Monitoreo del Procesamiento
```javascript
// Verificar estado cada 2 segundos
const checkStatus = async (documentoId) => {
  const response = await fetch(`/api/documentos/${documentoId}`);
  const documento = await response.json();
  
  if (documento.estadoProcesamiento === 'completado') {
    // Mostrar datos extraídos al usuario
    console.log('Fecha:', documento.fechaExtraida);
    console.log('Importe:', documento.importeExtraido);
    console.log('CUIT:', documento.cuitExtraido);
  }
};
```

### 3. Aplicar Datos Extraídos
```javascript
// Aplicar datos seleccionados al item de rendición
await fetch(`/api/documentos/${documentoId}/aplicar`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    camposAplicar: ['fecha', 'importe', 'cuit']
  })
});
```

## Manejo de Errores

### Errores Comunes

1. **Archivo muy grande**: Error 413 - Reducir tamaño del archivo
2. **Tipo no permitido**: Error 400 - Usar PDF, JPG o PNG
3. **OCR falló**: Estado 'error' - Imagen de baja calidad
4. **No se encontraron datos**: Estado 'completado' pero campos vacíos

### Logging

Los errores se registran en:
- Console del servidor con stack trace completo
- Campo `observaciones` del documento para errores específicos

## Optimizaciones de Rendimiento

### OCR de Imágenes
- Las imágenes se redimensionan automáticamente (máx 2000px)
- Se aplican filtros de mejora: escala de grises, normalización, enfoque
- Se crean archivos temporales que se eliminan tras el procesamiento

### Procesamiento Asíncrono
- El procesamiento no bloquea la respuesta HTTP
- El estado se actualiza en tiempo real en la base de datos
- Permite procesar múltiples archivos simultáneamente

## Seguridad

### Validaciones
- Autenticación requerida para todas las operaciones
- Validación de tipos MIME de archivos
- Límites de tamaño estrictos
- Los usuarios solo pueden acceder a sus propios documentos

### Almacenamiento
- Los archivos se almacenan fuera del directorio web público
- Nombres de archivo únicos para evitar colisiones
- Limpieza automática de archivos temporales

## Testing

### Casos de Prueba Recomendados

1. **PDFs con texto nativo**
2. **Imágenes de facturas escaneadas**
3. **Documentos con múltiples importes**
4. **Archivos corruptos o inválidos**
5. **Documentos sin datos reconocibles**

### Ejemplos de Documentos de Prueba

Crear archivos de prueba con:
- Facturas típicas argentinas
- Tickets de compra
- Comprobantes fiscales
- Documentos con CUIT y fechas variados

## Integración con Frontend

### Componente Propuesto

```tsx
interface DocumentUploadProps {
  rendicionItemId?: string;
  onDataExtracted?: (data: ExtractedData) => void;
}

const DocumentUpload = ({ rendicionItemId, onDataExtracted }: DocumentUploadProps) => {
  // Implementar:
  // 1. Drag & drop de archivos
  // 2. Preview de archivos seleccionados
  // 3. Barra de progreso durante procesamiento
  // 4. Vista previa de datos extraídos
  // 5. Botones para aplicar datos seleccionados
};
```

## Integración con Modelos de IA

### Configuración

El sistema incluye integración opcional con modelos de IA para análisis más inteligente de documentos. Se activa configurando variables de entorno:

```bash
# Habilitar IA
ENABLE_AI_EXTRACTION=true

# Elegir uno o más proveedores
OPENAI_API_KEY=sk-xxx
GEMINI_API_KEY=xxx
OLLAMA_ENABLED=true
```

### Proveedores Disponibles

#### 1. **OpenAI GPT-4o-mini**
- **Ventajas**: Muy preciso, entiende contexto complejo
- **Costo**: ~$0.50-2.00 por 1000 documentos
- **Setup**: API key desde [OpenAI Platform](https://platform.openai.com/api-keys)

#### 2. **Anthropic Claude Haiku**
- **Ventajas**: Excelente para documentos argentinos, más económico
- **Costo**: ~$0.30-1.50 por 1000 documentos
- **Setup**: API key desde [Anthropic Console](https://console.anthropic.com/)

#### 3. **Google Gemini Flash**
- **Ventajas**: Gratis hasta 1500 requests/día
- **Limitaciones**: 15 req/minuto máximo
- **Setup**: API key desde [AI Studio](https://aistudio.google.com/app/apikey)

#### 4. **Ollama (Local)**
- **Ventajas**: Completamente gratis, privado, sin límites
- **Requisitos**: 8GB+ RAM, descarga de ~4GB
- **Setup**:
  ```bash
  # Instalar Ollama
  curl -fsSL https://ollama.ai/install.sh | sh
  
  # Descargar modelo
  ollama run llama3.2
  
  # Configurar
  OLLAMA_ENABLED=true
  ```

### Funcionamiento

1. **Prioridad automática**: Si está habilitada, la IA se ejecuta primero
2. **Fallback inteligente**: Si la IA falla, usa RegEx como respaldo  
3. **Formato específico**: Prompts optimizados para facturas argentinas
4. **Validación**: Combina resultado de IA con validaciones de formato

### Ventajas de la IA vs RegEx

| Aspecto | RegEx | IA |
|---------|-------|-----|
| **Precisión** | 60-80% | 85-95% |
| **Documentos complejos** | ❌ | ✅ |
| **Formatos no estándar** | ❌ | ✅ |
| **Costo** | Gratis | Variable |
| **Velocidad** | Muy rápida | Rápida |
| **Privacidad** | 100% | Depende del proveedor |

### Casos de Uso Ideales para IA

- ✅ Facturas escaneadas con OCR imperfecto
- ✅ Documentos con formatos no estándar
- ✅ Múltiples importes en el mismo documento
- ✅ Fechas en formatos diversos
- ✅ CUIT con caracteres mal reconocidos por OCR
- ✅ Números de comprobante en posiciones inusuales

### Configuración Recomendada

**Para uso personal/desarrollo:**
```bash
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=xxx  # Gratis hasta 1500/día
```

**Para producción (pocos documentos):**
```bash
ENABLE_AI_EXTRACTION=true
ANTHROPIC_API_KEY=sk-ant-xxx  # Más económico
```

**Para producción (muchos documentos):**
```bash
ENABLE_AI_EXTRACTION=true
OLLAMA_ENABLED=true  # Gratis, requiere servidor dedicado
```

**Para máxima precisión:**
```bash
ENABLE_AI_EXTRACTION=true
OPENAI_API_KEY=sk-xxx  # Más preciso pero costoso
```

## Próximas Mejoras

### Funcionalidades Planificadas
1. **Análisis de imágenes** directamente con IA (sin OCR previo)
2. **Reconocimiento de tablas** en PDFs
3. **Múltiples proveedores** en un mismo documento
4. **API de validación** de CUIT con AFIP
5. **Detección automática** del tipo de documento
6. **Fine-tuning** de modelos para facturas argentinas específicas

### Optimizaciones Técnicas
1. **Queue system** para procesamiento batch
2. **Caching** de resultados de IA
3. **Compresión** de archivos almacenados
4. **Limpieza automática** de archivos antiguos
5. **Métricas de precisión** por proveedor de IA