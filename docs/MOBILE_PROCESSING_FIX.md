# Fix: Procesamiento Automático de Documentos desde Mobile App

**Fecha**: 2025-01-13

## Problema
Cuando se subían comprobantes desde la app mobile, el documento se guardaba correctamente pero NO se procesaban los datos automáticamente con IA. El documento quedaba en estado `pendiente_confirmacion` sin extracción de datos.

## Causa
El endpoint `/api/mobile/comprobante/upload` solo creaba el registro en la base de datos pero no llamaba al procesador de documentos para extraer los datos con IA/OCR.

## Solución Implementada

### 1. Importación del DocumentProcessor
```javascript
const DocumentProcessor = require('../lib/documentProcessor');
const documentProcessor = new DocumentProcessor();
```

### 2. Función de Procesamiento Asíncrono
Se agregó la función `processDocumentAsync()` que:
- Procesa el PDF/imagen para extraer texto (OCR)
- **Llama a `documentProcessor.extractData()` para extraer datos estructurados con IA**
- Actualiza el documento con los datos extraídos
- Maneja errores y timeouts (2 minutos máximo)

**Ubicación**: `backend/src/routes/mobile.js:472-580`

**Pasos del procesamiento**:
1. OCR: Extrae texto del documento (Tesseract o PDF-Parse)
2. **IA: Llama a `extractData()` que usa Gemini/Claude/OpenAI para estructurar los datos**
3. Actualización: Guarda los datos extraídos en la BD

### 3. Cambio en el Endpoint de Upload
**Archivo**: `backend/src/routes/mobile.js:167-223`

**Cambios**:
- Estado inicial cambiado de `pendiente_confirmacion` a `procesando`
- Se llama a `processDocumentAsync()` después de crear el documento
- El procesamiento ocurre en segundo plano (no bloquea la respuesta)

```javascript
// Create document record
const documento = await prisma.documentos_procesados.create({
  data: {
    // ... otros campos ...
    estadoProcesamiento: 'procesando', // CAMBIO: antes era 'pendiente_confirmacion'
    // ...
  }
});

// Procesar documento en segundo plano (extracción de datos con IA)
processDocumentAsync(documento.id, filePath, req.file.mimetype, userWithTenant?.tenantId || null)
  .catch(err => console.error('Error en procesamiento en segundo plano:', err));
```

## Flujo Completo

### Antes (Solo Guardado)
```
Usuario sube foto → Se guarda archivo → Estado: pendiente_confirmacion → FIN
                                      ❌ No se extraen datos
```

### Ahora (Procesamiento Automático)
```
Usuario sube foto → Se guarda archivo → Estado: procesando
                                      ↓
                            Procesamiento en segundo plano:
                            - OCR para extraer texto
                            - IA para extraer datos estructurados
                                      ↓
                            Estado: procesado (con datos extraídos)
                            ✅ numeroComprobante, fecha, monto, CUIT
```

## Estados del Documento

1. **procesando**: Documento está siendo procesado (OCR + IA)
2. **procesado**: Datos extraídos exitosamente
3. **error**: Error en el procesamiento (se guarda el mensaje de error)
4. **confirmado**: Usuario confirmó los datos manualmente (endpoint `/confirm`)
5. **completo**: Usuario confirmó cupón (solo para tarjetas)

## Compatibilidad

### Endpoint de Confirmación Manual
El endpoint `/comprobante/:id/confirm` sigue funcionando normalmente:
- Permite al usuario editar/confirmar los datos extraídos
- Útil si la IA extrajo datos incorrectos
- Cambia el estado a `confirmado`

### Tipos de Documento
Funciona para ambos tipos:
- **Efectivo**: Se asocia a `cajaId`
- **Tarjeta**: No requiere caja

## Tecnologías Utilizadas

- **OCR**: Tesseract (para imágenes) / PDF-Parse (para PDFs)
- **IA**: Gemini, Claude, OpenAI o Ollama (según configuración en `.env`)
- **Procesamiento Asíncrono**: Promise.race con timeout de 2 minutos

## Testing

### Prueba Manual
1. Subir comprobante desde la app mobile
2. Verificar que el estado cambia a `procesando`
3. Esperar ~5-30 segundos
4. Verificar que el estado cambia a `procesado`
5. Verificar que se extrajeron los datos:
   - `numeroComprobanteExtraido`
   - `fechaExtraida`
   - `importeExtraido`
   - `cuitExtraido`

### Logs a Monitorear
```bash
# Ver logs del backend
pm2 logs rendiciones-backend --lines 50

# Buscar estos mensajes:
📄 Procesando documento {id} - Tipo: {tipo}
✅ Documento procesado exitosamente: {id}
✅ Documento actualizado con datos extraídos: {id}
```

### En Caso de Error
```bash
# Logs de error
❌ Error procesando archivo: {mensaje}
❌ Error en processDocumentAsync: {mensaje}

# El documento quedará en estado 'error' con el mensaje en 'observaciones'
```

## Archivos Modificados

1. **backend/src/routes/mobile.js**
   - Agregadas líneas 1, 8, 12: Importaciones de DocumentProcessor
   - Línea 209: Estado inicial cambiado a `procesando`
   - Líneas 215-217: Llamada a procesamiento asíncrono
   - Líneas 472-544: Nueva función `processDocumentAsync()`

## Variables de Entorno Requeridas

Para que funcione la extracción con IA:
```env
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=tu-api-key-aqui
# O cualquiera de:
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
# OLLAMA_ENABLED=true
```

## Próximos Pasos

✅ Procesamiento automático implementado
✅ Manejo de errores
✅ Logs detallados

**Posibles mejoras futuras**:
- [ ] Notificar al usuario vía push notification cuando termine el procesamiento
- [ ] Mostrar progreso en tiempo real (websockets)
- [ ] Reintentos automáticos en caso de error temporal
- [ ] Feedback visual en la app cuando el estado cambia a `procesado`

## Notas Técnicas

- El procesamiento NO bloquea la respuesta HTTP (se ejecuta en segundo plano)
- Timeout de 2 minutos por documento
- Si falla el procesamiento, el documento queda en estado `error` pero NO se elimina
- Los datos extraídos se pueden editar manualmente usando el endpoint `/confirm`
- Compatible con el sistema existente de estadísticas de prompts AI
