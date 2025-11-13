# Fix Final: Respuesta con Datos Extraídos para Mobile App

**Fecha**: 2025-01-13 (noche)

## Problema

La app mobile esperaba recibir los datos extraídos inmediatamente en la respuesta del upload, pero el backend procesaba de forma asíncrona y solo devolvía el ID del documento.

**Lo que la app esperaba**:
```javascript
const uploadResult = await uploadComprobante();
const extractedData = uploadResult.extracted_data || {
  numeroComprobante: '',
  fechaComprobante: '',
  monto: '',
  cuit: '',
  numeroCupon: ''
};
```

**Lo que el backend devolvía**:
```json
{
  "id": "abc-123",
  "imagePath": "/path/to/image.jpg",
  "message": "Comprobante subido exitosamente. Extrayendo datos..."
}
```

❌ Faltaba `extracted_data`

## Solución Implementada

### Cambio 1: Procesamiento Síncrono

El endpoint de upload ahora **espera** a que termine todo el procesamiento antes de responder.

**Antes** (Asíncrono):
```javascript
// Guardar documento
const documento = await prisma.documentos_procesados.create({ ... });

// Procesar en segundo plano (no espera)
processDocumentAsync(documento.id, ...).catch(...);

// Responder inmediatamente (sin datos)
res.json({
  id: documento.id,
  message: 'Subido. Procesando...'
});
```

**Ahora** (Síncrono):
```javascript
// Guardar documento
const documento = await prisma.documentos_procesados.create({ ... });

// Procesar y ESPERAR a que termine
const datosExtraidos = await processDocumentSync(documento.id, ...);

// Obtener documento actualizado
const documentoFinal = await prisma.documentos_procesados.findUnique({ ... });

// Responder CON datos extraídos
res.json({
  id: documentoFinal.id,
  imagePath: filePath,
  message: 'Comprobante procesado exitosamente',
  extracted_data: {
    numeroComprobante: documentoFinal.numeroComprobanteExtraido || '',
    fechaComprobante: documentoFinal.fechaExtraida?.toISOString().split('T')[0] || '',
    monto: documentoFinal.importeExtraido?.toString() || '',
    cuit: documentoFinal.cuitExtraido || '',
    numeroCupon: ''
  },
  datosExtraidos: documentoFinal.datosExtraidos,
  estadoProcesamiento: documentoFinal.estadoProcesamiento
});
```

### Cambio 2: Formato de Respuesta

La respuesta ahora incluye **dos formatos**:

#### 1. `extracted_data` (formato simplificado para la app)
```json
{
  "extracted_data": {
    "numeroComprobante": "0024-88276942",
    "fechaComprobante": "2024-02-22",
    "monto": "6956.04",
    "cuit": "",
    "numeroCupon": ""
  }
}
```

#### 2. `datosExtraidos` (formato completo del backend)
```json
{
  "datosExtraidos": {
    "texto": "...texto completo...",
    "numeroComprobante": "0024-88276942",
    "fecha": "2024-02-22",
    "importe": 6956.04,
    "cuit": null,
    "tipoComprobante": "FACTURA_SERVICIOS",
    "razonSocial": "EDENOR",
    ...
  }
}
```

### Cambio 3: Nuevo Endpoint GET

Agregado endpoint para consultar estado de un documento:

**URL**: `GET /api/mobile/comprobante/:id`

**Respuesta**:
```json
{
  "id": "abc-123",
  "nombreArchivo": "factura.jpg",
  "imagePath": "/path/to/image.jpg",
  "estadoProcesamiento": "procesado",
  "extracted_data": {
    "numeroComprobante": "...",
    "fechaComprobante": "...",
    "monto": "...",
    "cuit": "...",
    "numeroCupon": "..."
  },
  "datosExtraidos": { ... },
  "createdAt": "2025-01-13T...",
  "updatedAt": "2025-01-13T..."
}
```

**Uso**: Para polling o verificar estado después del upload.

## Cambios en el Código

### 1. Endpoint de Upload (Líneas 198-250)

```javascript
router.post('/comprobante/upload', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    // ... validaciones ...

    // Crear documento
    const documento = await prisma.documentos_procesados.create({ ... });

    // Procesar de forma SÍNCRONA (espera a que termine)
    console.log('📄 Procesando documento de forma síncrona para mobile...');
    const datosExtraidos = await processDocumentSync(
      documento.id,
      filePath,
      req.file.mimetype,
      userWithTenant?.tenantId || null
    );

    // Obtener documento actualizado con todos los datos
    const documentoFinal = await prisma.documentos_procesados.findUnique({
      where: { id: documento.id },
      select: {
        id: true,
        nombreArchivo: true,
        estadoProcesamiento: true,
        numeroComprobanteExtraido: true,
        fechaExtraida: true,
        importeExtraido: true,
        cuitExtraido: true,
        datosExtraidos: true
      }
    });

    // Formatear respuesta para la app mobile
    res.json({
      id: documentoFinal.id,
      imagePath: filePath,
      message: 'Comprobante procesado exitosamente',
      extracted_data: {
        numeroComprobante: documentoFinal.numeroComprobanteExtraido || '',
        fechaComprobante: documentoFinal.fechaExtraida
          ? documentoFinal.fechaExtraida.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        monto: documentoFinal.importeExtraido ? documentoFinal.importeExtraido.toString() : '',
        cuit: documentoFinal.cuitExtraido || '',
        numeroCupon: ''
      },
      datosExtraidos: documentoFinal.datosExtraidos,
      estadoProcesamiento: documentoFinal.estadoProcesamiento
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error al subir comprobante' });
  }
});
```

### 2. Función de Procesamiento (Líneas 502-621)

Renombrada de `processDocumentAsync` a `processDocumentSync` y ahora **devuelve** los datos extraídos:

```javascript
async function processDocumentSync(documentoId, filePath, tipoArchivo, tenantId) {
  try {
    // ... OCR ...
    // ... IA extractData() ...
    // ... Actualizar BD ...

    console.log('✅ Documento actualizado con datos extraídos:', documentoId);

    // Devolver datos extraídos para la respuesta
    return datosExtraidos;

  } catch (error) {
    console.error('❌ Error en processDocumentSync:', error);

    // ... manejo de error ...

    // Devolver objeto vacío en caso de error
    return {
      numeroComprobante: null,
      fecha: null,
      importe: null,
      cuit: null
    };
  }
}
```

### 3. Nuevo Endpoint GET (Líneas 258-314)

```javascript
router.get('/comprobante/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar que el documento pertenece al usuario
    const documento = await prisma.documentos_procesados.findFirst({
      where: { id, usuarioId: userId },
      select: {
        id: true,
        nombreArchivo: true,
        estadoProcesamiento: true,
        numeroComprobanteExtraido: true,
        fechaExtraida: true,
        importeExtraido: true,
        cuitExtraido: true,
        cuponExtraido: true,
        datosExtraidos: true,
        rutaArchivo: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    // Formatear respuesta para la app mobile (mismo formato que upload)
    res.json({
      id: documento.id,
      nombreArchivo: documento.nombreArchivo,
      imagePath: documento.rutaArchivo,
      estadoProcesamiento: documento.estadoProcesamiento,
      extracted_data: {
        numeroComprobante: documento.numeroComprobanteExtraido || '',
        fechaComprobante: documento.fechaExtraida
          ? documento.fechaExtraida.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        monto: documento.importeExtraido ? documento.importeExtraido.toString() : '',
        cuit: documento.cuitExtraido || '',
        numeroCupon: documento.cuponExtraido || ''
      },
      datosExtraidos: documento.datosExtraidos,
      createdAt: documento.createdAt,
      updatedAt: documento.updatedAt
    });

  } catch (error) {
    console.error('Get comprobante error:', error);
    res.status(500).json({ error: 'Error al obtener comprobante' });
  }
});
```

## Flujo Completo

```
Usuario sube foto desde app
         ↓
   POST /api/mobile/comprobante/upload
         ↓
   Guarda archivo en BD
   Estado: "procesando"
         ↓
   1️⃣ OCR (Tesseract/PDF-Parse)
      → Extrae texto
         ↓
   2️⃣ IA (extractData)
      → Extrae datos estructurados
         ↓
   3️⃣ Actualiza BD
      → Guarda datos extraídos
      → Estado: "procesado"
         ↓
   4️⃣ Consulta BD
      → Obtiene documento actualizado
         ↓
   5️⃣ Responde a la app
      → extracted_data
      → datosExtraidos
      → estadoProcesamiento
         ↓
   App muestra datos extraídos ✅
```

## Ventajas vs Desventajas

### ✅ Ventajas
- App recibe datos inmediatamente
- No necesita polling
- Experiencia de usuario fluida
- Compatible con código existente de la app

### ⚠️ Desventajas
- Request HTTP más largo (~10-15 segundos)
- Puede dar timeout si el procesamiento es muy lento
- Usuario debe esperar a que termine

### 💡 Mitigación
- Timeout del procesamiento: 2 minutos
- Si falla, devuelve datos vacíos pero no error 500
- La app puede mostrar spinner mientras espera

## Testing

### 1. Test de Upload Completo

```bash
# En la app mobile:
1. Seleccionar tipo (efectivo o tarjeta)
2. Tomar foto de comprobante
3. Subir
4. Esperar ~10-15 segundos
5. ✅ Verificar que aparezcan los datos extraídos inmediatamente
```

**Respuesta esperada**:
```json
{
  "id": "abc-123",
  "imagePath": "/path/to/image.jpg",
  "message": "Comprobante procesado exitosamente",
  "extracted_data": {
    "numeroComprobante": "0024-88276942",
    "fechaComprobante": "2024-02-22",
    "monto": "6956.04",
    "cuit": "",
    "numeroCupon": ""
  },
  "estadoProcesamiento": "procesado"
}
```

### 2. Test de Endpoint GET

```bash
# Desde Postman o curl:
GET /api/mobile/comprobante/{id}
Authorization: Bearer {token}

# Respuesta:
{
  "id": "abc-123",
  "nombreArchivo": "factura.jpg",
  "estadoProcesamiento": "procesado",
  "extracted_data": { ... },
  ...
}
```

### 3. Logs Esperados

```bash
pm2 logs rendiciones-backend

# Logs:
📄 Procesando documento de forma síncrona para mobile...
📄 Procesando documento {id} - Tipo: image/jpeg
✅ Documento procesado exitosamente (OCR): {id}
🤖 Extrayendo datos estructurados con IA...
✅ Datos extraídos: { fecha: 'SÍ', importe: 'SÍ', cuit: 'NO', numeroComprobante: 'SÍ' }
✅ Documento actualizado con datos extraídos: {id}
```

## Compatibilidad con la App

La app mobile espera exactamente este formato:

```javascript
// Código de la app mobile:
const extractedData = uploadResult.extracted_data || uploadResult.datosExtraidos || {
  numeroComprobante: '',
  fechaComprobante: new Date().toISOString().split('T')[0],
  monto: '',
  cuit: '',
  numeroCupon: ''
};
```

✅ El backend ahora provee `extracted_data` en el formato correcto.

## Archivos Modificados

| Archivo | Líneas | Cambios |
|---------|--------|---------|
| `backend/src/routes/mobile.js` | 198-250 | Endpoint de upload ahora es síncrono y devuelve `extracted_data` |
| `backend/src/routes/mobile.js` | 258-314 | Nuevo endpoint GET `/comprobante/:id` |
| `backend/src/routes/mobile.js` | 502-621 | Función renombrada a `processDocumentSync` y devuelve datos |

## Variables de Entorno

Necesarias para que funcione la extracción con IA:

```env
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=AIza...
# O cualquier otra API key de IA
```

## Deploy

```bash
ssh root@149.50.148.198
cd /var/www/Rendiciones
git pull origin master
pm2 restart rendiciones-backend
pm2 logs rendiciones-backend --lines 50
```

## Próximos Pasos (Opcional)

Si el procesamiento síncrono resulta muy lento:

### Opción Alternativa: Procesamiento Híbrido
1. Responder inmediatamente con `estadoProcesamiento: "procesando"`
2. App hace polling a `GET /comprobante/:id` cada 2 segundos
3. Cuando `estadoProcesamiento === "procesado"`, mostrar datos

Pero por ahora, el procesamiento síncrono debería funcionar bien.

---

**Fecha**: 2025-01-13
**Criticidad**: Alta
**Tipo**: Fix de Integración Mobile-Backend
**Resultado**: App mobile ahora recibe datos extraídos inmediatamente ✅
