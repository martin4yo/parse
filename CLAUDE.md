# Claude Code - Rendiciones App

## 🚨 IMPORTANTE - CONFIGURACIÓN DE PUERTOS
**PUERTOS CONFIGURADOS:**
- Backend: **5050** (API)
- Frontend Desarrollo: **3000** (npm run dev)
- Frontend Producción: **8084** (servidor con PM2)

## Configuración y Notas de Desarrollo

### IA Local - Para Futuro Desarrollo

**Alternativa a Gemini/OpenAI para extracción de documentos**

#### Opción Recomendada: Ollama
```bash
# Instalación
curl -fsSL https://ollama.com/install.sh | sh

# Modelo recomendado para facturas argentinas
ollama pull llama3.2:3b  # 2GB disco, 4GB RAM

# Actualizar modelo
ollama pull llama3.2:3b

# Gestión
ollama list    # ver modelos
ollama rm modelo-viejo  # limpiar espacio
```

#### Configuración en .env
```env
# Para usar IA local en lugar de Gemini
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
ENABLE_AI_EXTRACTION=true
USE_OLLAMA=true  # Nueva variable para alternar
```

#### Ventajas IA Local
- ✅ Sin costos por token
- ✅ Funciona offline
- ✅ Datos privados (no salen del servidor)
- ✅ Sin límites de rate limiting
- ✅ Respuestas más consistentes

#### Requisitos
- **Disco**: 5GB libres
- **RAM**: 4GB disponibles
- **CPU**: Cualquier procesador moderno

#### Código Existente
La función `extractWithOllama()` ya existe en `documentProcessor.js:324`
Solo necesita configuración y testing.

---

## Estado Actual del Proyecto

### Problemas Resueltos
1. **Regex Error**: Agregado flag `g` a patrón en `extractTipoComprobante()` línea 1041
2. **JSON Parsing Gemini**: Mejorada limpieza de respuestas con logs detallados
3. **Error Handling**: Documentos ya no se eliminan al fallar extracción

### Flujo de Procesamiento
1. 🤖 **Primero**: Intenta extracción con Gemini (3 reintentos)
2. 🔧 **Segundo**: Si falla, usa procesamiento local con regex
3. 💾 **Resultado**: Documento se guarda siempre (incluso con datos parciales)

### Variables de Entorno Actuales
```env
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=AIzaSyChQdergthmXWkNDJ2xaDfyqfov3ac2fM8
```

### Logs de Debugging Agregados
- `Raw Gemini response:` - respuesta completa de Gemini
- `Cleaned JSON text:` - JSON después de limpieza
- `Re-cleaned JSON:` - segundo intento si falla parsing

---

## 📋 ROADMAP - Mejoras Futuras

### 🎯 Prioridad Alta: Google Document AI para Extracción de PDFs

**Objetivo**: Reemplazar Gemini con Document AI de Vertex AI para mejorar precisión de extracción de facturas y documentos fiscales.

#### Por qué Document AI es Superior

| Característica | Gemini (Actual) | Document AI | Mejora |
|---|---|---|---|
| **Precisión** | 70-80% | 95%+ | +25% |
| **OCR** | Básico | Avanzado | Mejor con escaneos |
| **Tablas** | Regular | Excelente | Mantiene estructura |
| **Campos Fiscales** | Genérico | Especializado | CUIT, IVA, etc. |
| **Costo por página** | ~$0.001 | $0.06 | Más caro pero justificado |

#### Implementación Propuesta

```javascript
// backend/src/services/documentAIProcessor.js
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');

async function extractWithDocumentAI(pdfBuffer) {
  const client = new DocumentProcessorServiceClient();

  const request = {
    name: `projects/${PROJECT_ID}/locations/us/processors/${PROCESSOR_ID}`,
    rawDocument: {
      content: pdfBuffer.toString('base64'),
      mimeType: 'application/pdf',
    },
  };

  const [result] = await client.processDocument(request);

  // Document AI devuelve datos estructurados nativamente
  return {
    numeroFactura: result.document.entities.find(e => e.type === 'invoice_number')?.mentionText,
    fecha: result.document.entities.find(e => e.type === 'invoice_date')?.mentionText,
    total: result.document.entities.find(e => e.type === 'total_amount')?.normalizedValue?.money?.amount,
    cuit: result.document.entities.find(e => e.type === 'supplier_tax_id')?.mentionText,
    items: result.document.entities.filter(e => e.type === 'line_item')
  };
}
```

#### Pasos para Implementar

1. **Configuración GCP**
   - Habilitar Document AI API en Google Cloud Console
   - Crear procesador tipo "Invoice Parser"
   - Obtener credenciales de servicio

2. **Variables de Entorno**
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
   GCP_PROJECT_ID=tu-proyecto
   DOCUMENT_AI_PROCESSOR_ID=tu-procesador-id
   DOCUMENT_AI_LOCATION=us  # o southamerica-east1 para LATAM
   USE_DOCUMENT_AI=false  # Activar cuando esté listo
   ```

3. **Integración en Pipeline**
   - Mantener Gemini como fallback
   - Document AI como primera opción
   - Regex local como última instancia

4. **Procesadores Recomendados**
   - **Invoice Parser**: Para facturas tipo A/B/C
   - **Receipt Parser**: Para tickets y recibos
   - **Custom Processor**: Entrenable con facturas argentinas específicas

#### Beneficios Esperados

- ✅ **Reducción de errores**: 95%+ de precisión en extracción
- ✅ **Menos intervención manual**: Campos detectados automáticamente
- ✅ **Mejor UX**: Procesamiento más rápido y confiable
- ✅ **Compliance fiscal**: Mejor detección de campos AFIP requeridos
- ✅ **Procesamiento de tablas**: Items de factura con estructura preservada

#### Consideraciones

- **Costo**: $60 USD por 1000 páginas (incluye 1000 gratis/mes)
- **Latencia**: ~2-3 segundos por página
- **Límites**: 15 páginas por documento, 40MB máximo
- **Región**: Usar southamerica-east1 para menor latencia desde Argentina

#### Estrategia de Migración

1. **Fase 1**: Implementar en paralelo, comparar resultados
2. **Fase 2**: A/B testing con 10% de documentos
3. **Fase 3**: Migración gradual al 100%
4. **Fase 4**: Entrenar custom processor con documentos argentinos

### 🔄 Otras Mejoras en el Roadmap

- **Integración con AFIP**: Validación automática de CUIT y facturas
- **Machine Learning**: Categorización automática de gastos
- **OCR Mejorado**: Para fotos de tickets con mala calidad
- **Exportación SAP/ERP**: Conectores directos