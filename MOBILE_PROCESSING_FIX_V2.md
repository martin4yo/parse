# Fix V2: Extracción de Datos Estructurados con IA

**Fecha**: 2025-01-13 (tarde)

## Problema Detectado

Después del fix inicial, el procesamiento mobile:
- ✅ Extraía texto con OCR correctamente
- ❌ **NO extraía datos estructurados** (número, fecha, monto, CUIT)

**Síntoma**:
```json
{
  "datosExtraidos": {
    "texto": "...texto completo...",
    "metodo": "OCR"
  },
  "numeroComprobanteExtraido": null,  // ❌ vacío
  "fechaExtraida": null,               // ❌ vacío
  "importeExtraido": null,             // ❌ vacío
  "cuitExtraido": null                 // ❌ vacío
}
```

## Causa Raíz

La función `processDocumentAsync()` en `mobile.js` solo llamaba a:
- `documentProcessor.processPDF()` o `processImage()` → Extrae texto (OCR)

Pero **NO llamaba a**:
- `documentProcessor.extractData()` → Extrae datos estructurados con IA

En el endpoint normal de documentos (`documentos.js`), después del OCR se llama explícitamente a `extractData()`.

## Solución

### Antes del Fix

```javascript
// Solo OCR, sin extracción de datos estructurados
const processingResult = await documentProcessor.processImage(filePath);

await prisma.documentos_procesados.update({
  where: { id: documentoId },
  data: {
    datosExtraidos: {
      texto: processingResult.text,
      metodo: 'OCR'  // ❌ Solo texto, sin datos estructurados
    },
    numeroComprobanteExtraido: null,  // ❌ vacío
    fechaExtraida: null,               // ❌ vacío
    importeExtraido: null,             // ❌ vacío
    cuitExtraido: null                 // ❌ vacío
  }
});
```

### Después del Fix

```javascript
// 1. OCR para extraer texto
const processingResult = await documentProcessor.processImage(filePath);

// 2. IA para extraer datos estructurados del texto
const datosExtraidos = await documentProcessor.extractData(processingResult.text, tenantId);

// 3. Guardar texto + datos estructurados
await prisma.documentos_procesados.update({
  where: { id: documentoId },
  data: {
    datosExtraidos: {
      texto: processingResult.text,
      ...datosExtraidos  // ✅ Incluye datos estructurados
    },
    numeroComprobanteExtraido: datosExtraidos?.numeroComprobante || null,  // ✅ con datos
    fechaExtraida: datosExtraidos?.fecha ? new Date(datosExtraidos.fecha) : null,  // ✅ con datos
    importeExtraido: datosExtraidos?.importe || null,  // ✅ con datos
    cuitExtraido: datosExtraidos?.cuit || null  // ✅ con datos
  }
});
```

## Cambios en el Código

**Archivo**: `backend/src/routes/mobile.js`

**Líneas modificadas**: 511-565

```javascript
async function processDocumentAsync(documentoId, filePath, tipoArchivo, tenantId) {
  try {
    // ... timeout y OCR ...

    console.log('✅ Documento procesado exitosamente (OCR):', documentoId);

    // Guardar texto extraído primero
    await prisma.documentos_procesados.update({
      where: { id: documentoId },
      data: {
        datosExtraidos: {
          texto: processingResult.text,
          metodo: 'OCR'
        },
        updatedAt: new Date()
      }
    });

    // 🤖 NUEVO: Extraer datos estructurados del texto con IA
    console.log('🤖 Extrayendo datos estructurados con IA...');
    const datosExtraidos = await documentProcessor.extractData(processingResult.text, tenantId);

    console.log('✅ Datos extraídos:', {
      fecha: datosExtraidos?.fecha ? 'SÍ' : 'NO',
      importe: datosExtraidos?.importe ? 'SÍ' : 'NO',
      cuit: datosExtraidos?.cuit ? 'SÍ' : 'NO',
      numeroComprobante: datosExtraidos?.numeroComprobante ? 'SÍ' : 'NO'
    });

    // Actualizar documento con los datos estructurados extraídos
    await prisma.documentos_procesados.update({
      where: { id: documentoId },
      data: {
        datosExtraidos: {
          texto: processingResult.text,
          ...datosExtraidos  // Incluye todos los datos estructurados
        },
        numeroComprobanteExtraido: datosExtraidos?.numeroComprobante || null,
        fechaExtraida: datosExtraidos?.fecha ? (() => {
          try {
            if (typeof datosExtraidos.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datosExtraidos.fecha)) {
              return new Date(datosExtraidos.fecha + 'T00:00:00.000Z');
            }
            const fecha = new Date(datosExtraidos.fecha);
            return isNaN(fecha.getTime()) ? null : fecha;
          } catch (e) {
            return null;
          }
        })() : null,
        importeExtraido: datosExtraidos?.importe || null,
        cuitExtraido: datosExtraidos?.cuit || null,
        estadoProcesamiento: 'procesado',
        updatedAt: new Date()
      }
    });

    console.log('✅ Documento actualizado con datos extraídos:', documentoId);
  } catch (error) {
    // ... manejo de errores ...
  }
}
```

## Flujo Completo Actualizado

```
Usuario sube comprobante
         ↓
   Guarda archivo
         ↓
Estado: "procesando"
         ↓
   1️⃣ OCR (Tesseract/PDF-Parse)
      → Extrae texto del documento
         ↓
   2️⃣ IA (extractData)
      → Gemini/Claude/OpenAI analiza el texto
      → Extrae datos estructurados:
        • Número de comprobante
        • Fecha
        • Monto total
        • CUIT
        • Razón social
        • Tipo de comprobante
         ↓
   3️⃣ Actualización en BD
      → Guarda texto + datos estructurados
         ↓
Estado: "procesado"
         ↓
✅ Datos disponibles en la app
```

## Testing

### Test con Factura de EDENOR

**Entrada**: Foto de factura de luz EDENOR

**Texto extraído (OCR)**:
```
Total a pagar $ 6.956,04
Liquidación de Servicio Público N* 0024-88276942
Cuenta N° 4 279 754 091
Fecha de Vencimiento: 22/02/2024
```

**Datos extraídos (IA)** - ESPERADO:
```json
{
  "numeroComprobante": "0024-88276942",
  "fecha": "2024-02-22",
  "importe": 6956.04,
  "cuit": null,  // EDENOR no suele mostrar CUIT en facturas
  "tipoComprobante": "FACTURA_SERVICIOS"
}
```

### Logs Esperados

```bash
pm2 logs rendiciones-backend

# Logs de éxito:
📄 Procesando documento {id} - Tipo: image/jpeg
✅ Documento procesado exitosamente (OCR): {id}
🤖 Extrayendo datos estructurados con IA...
✅ Datos extraídos: { fecha: 'SÍ', importe: 'SÍ', cuit: 'NO', numeroComprobante: 'SÍ' }
✅ Documento actualizado con datos extraídos: {id}
```

## Verificación en Base de Datos

```sql
SELECT
  id,
  nombreArchivo,
  estadoProcesamiento,
  numeroComprobanteExtraido,
  TO_CHAR(fechaExtraida, 'YYYY-MM-DD') as fecha,
  importeExtraido,
  cuitExtraido,
  datosExtraidos->>'metodo' as metodo,
  LENGTH(datosExtraidos->>'texto') as long_texto
FROM documentos_procesados
WHERE observaciones LIKE '%mobile app%'
ORDER BY createdAt DESC
LIMIT 5;
```

**Resultado esperado**:
```
id        | nombreArchivo      | estado    | numero         | fecha      | importe | cuit | metodo | long_texto
----------|-------------------|-----------|----------------|------------|---------|------|--------|----------
abc-123...| foto-factura.jpg  | procesado | 0024-88276942  | 2024-02-22 | 6956.04 | NULL | OCR    | 2543
```

## Variables de Entorno

Para que `extractData()` funcione, necesita al menos una API key:

```env
# backend/.env
ENABLE_AI_EXTRACTION=true

# Una de estas:
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_ENABLED=true  # Para IA local
```

## Performance

- **OCR**: 2-5 segundos (imagen) / 1-3 segundos (PDF)
- **IA extractData**: 3-8 segundos (depende del motor)
- **Total**: 5-13 segundos aproximadamente

El procesamiento ocurre en segundo plano, no bloquea la respuesta HTTP.

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `backend/src/routes/mobile.js` | Líneas 511-565: Agregada llamada a `extractData()` |
| `MOBILE_PROCESSING_FIX.md` | Actualizada documentación |

## Deploy

```bash
# Conectar al servidor
ssh root@149.50.148.198

# Navegar al proyecto
cd /var/www/Rendiciones

# Pull cambios
git pull origin master

# Reiniciar backend
pm2 restart rendiciones-backend

# Verificar logs
pm2 logs rendiciones-backend --lines 50
```

## Notas Importantes

1. **extractData() nunca falla**: Siempre devuelve un objeto (aunque esté vacío)
2. **Campos opcionales**: Si la IA no puede extraer un campo, queda en `null`
3. **Timeout**: Si `extractData()` tarda más de 2 minutos, se cancela
4. **Fallback**: Si la IA falla, el documento queda en estado "error" con el texto extraído

---

**Fecha de Fix**: 2025-01-13
**Criticidad**: Alta
**Tipo**: Bug Fix Crítico
**Afecta a**: Procesamiento mobile de comprobantes
