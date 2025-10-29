# Fix V5: Endpoint de Confirmación de Comprobantes Mobile

**Fecha**: 2025-01-13 (noche)

## Problema

El endpoint `/api/mobile/comprobante/:id/confirm` tenía varias limitaciones:

1. ❌ No validaba que `observaciones` fuera obligatorio
2. ❌ Concatenaba la observación del usuario al texto automático
3. ❌ No actualizaba el item de rendición si el usuario modificó datos
4. ❌ No guardaba el `tipoComprobante` que viene de extractedData

## Flujo de Usuario

1. **Upload**: Usuario sube foto y recibe datos extraídos automáticamente
2. **Review**: Usuario revisa y puede editar los datos
3. **Observación**: Usuario DEBE completar campo de observaciones (obligatorio)
4. **Confirm**: Presiona "Confirmar" y se envía PUT a `/confirm`

## Request de la App Mobile

```javascript
PUT /api/mobile/comprobante/{id}/confirm
Authorization: Bearer {token}
Content-Type: application/json

{
  "extractedData": {
    "tipoComprobante": "Factura (Efectivo)",      // String
    "numeroComprobante": "00001-12345678",        // String
    "fechaComprobante": "2025-01-13",             // String formato YYYY-MM-DD
    "monto": 1500.50,                             // Number
    "cuit": "20-12345678-9",                      // String o null
    "numeroCupon": null,                          // String o null (solo tarjetas)
    "observaciones": "Compra de insumos oficina" // String - OBLIGATORIO
  }
}
```

## Solución Implementada

### 1. Validación de Observaciones Obligatorio

```javascript
body('extractedData.observaciones')
  .notEmpty()
  .withMessage('Observaciones es un campo obligatorio')
```

Si el usuario intenta confirmar sin observaciones:
```json
{
  "errors": [
    {
      "msg": "Observaciones es un campo obligatorio",
      "param": "extractedData.observaciones",
      "location": "body"
    }
  ]
}
```

### 2. Guardar Observación del Usuario

**Antes**:
```javascript
observaciones: `${documento.observaciones || ''} - Datos confirmados por usuario`
// Resultado: "Subido desde mobile app - Tipo: efectivo - Datos confirmados por usuario"
```

**Ahora**:
```javascript
observaciones: extractedData.observaciones.trim()
// Resultado: "Compra de insumos oficina"
```

### 3. Actualizar Todos los Campos Modificados

```javascript
const updatedDocumento = await prisma.documentos_procesados.update({
  where: { id },
  data: {
    tipoComprobanteExtraido: extractedData.tipoComprobante || documento.tipoComprobanteExtraido,
    numeroComprobanteExtraido: extractedData.numeroComprobante,
    fechaExtraida: fechaExtraida,
    importeExtraido: parseFloat(extractedData.monto),
    cuitExtraido: extractedData.cuit || null,
    cuponExtraido: extractedData.numeroCupon || null,
    estadoProcesamiento: 'confirmado',
    datosExtraidos: extractedData,
    observaciones: extractedData.observaciones.trim(),
    updatedAt: new Date()
  }
});
```

### 4. Actualizar Item de Rendición (Solo Efectivo)

Si el comprobante es de efectivo y ya se creó la rendición automáticamente, también se actualiza el item:

```javascript
// Si es un comprobante de efectivo y ya tiene item de rendición
if (documento.tipo === 'efectivo' && documento.documentos_asociados && documento.documentos_asociados.length > 0) {
  const asociacion = documento.documentos_asociados[0];
  if (asociacion.rendicionItemId && asociacion.rendicion_tarjeta_items) {
    console.log('💰 Actualizando item de rendición con datos confirmados...');

    await prisma.rendicion_tarjeta_items.update({
      where: { id: asociacion.rendicionItemId },
      data: {
        tipoComprobante: extractedData.tipoComprobante || asociacion.rendicion_tarjeta_items.tipoComprobante,
        numeroComprobante: extractedData.numeroComprobante,
        fechaComprobante: fechaExtraida,
        importeTotal: parseFloat(extractedData.monto),
        cuitProveedor: extractedData.cuit || null,
        updatedAt: new Date()
      }
    });

    console.log('✅ Item de rendición actualizado con datos confirmados');
  }
}
```

Esto asegura que si el usuario corrigió datos, la rendición también se actualice.

## Cambios en el Código

**Archivo**: `backend/src/routes/mobile.js:316-431`

### Validaciones

```javascript
router.put('/comprobante/:id/confirm', [
  authMiddleware,
  body('extractedData').isObject(),
  body('extractedData.numeroComprobante').notEmpty().withMessage('Número de comprobante requerido'),
  body('extractedData.fechaComprobante').notEmpty().withMessage('Fecha de comprobante requerida'),
  body('extractedData.monto').isNumeric().withMessage('Monto debe ser numérico'),
  body('extractedData.observaciones').notEmpty().withMessage('Observaciones es un campo obligatorio')  // ← NUEVO
], async (req, res) => {
  // ...
});
```

### Consulta con Include

```javascript
const documento = await prisma.documentos_procesados.findFirst({
  where: {
    id,
    usuarioId: userId
  },
  include: {
    documentos_asociados: {
      include: {
        rendicion_tarjeta_items: true  // ← Para actualizar item si existe
      }
    }
  }
});
```

### Logs Agregados

```javascript
console.log('✏️ Usuario confirmando comprobante:', id);
console.log('Datos recibidos:', {
  numeroComprobante: extractedData.numeroComprobante,
  fecha: extractedData.fechaComprobante,
  monto: extractedData.monto,
  observaciones: extractedData.observaciones
});

console.log('✅ Documento actualizado con datos confirmados');

// Si actualiza rendición:
console.log('💰 Actualizando item de rendición con datos confirmados...');
console.log('✅ Item de rendición actualizado con datos confirmados');
```

## Flujo Completo con Confirmación

### Caso: Comprobante de Efectivo

```
1️⃣ Usuario sube foto
   POST /comprobante/upload
   tipo: "efectivo"
   cajaId: "caja001"
         ↓
   Procesamiento automático:
   - OCR
   - IA extrae datos
   - Crea rendición
   - Crea item
   - Crea asociación
         ↓
   Respuesta:
   {
     "extracted_data": {
       "numeroComprobante": "00001-12345678",
       "fechaComprobante": "2025-01-13",
       "monto": "1500.50",
       "cuit": "20-12345678-9"
     },
     "estadoProcesamiento": "procesado"
   }

2️⃣ Usuario revisa datos
   Puede editarlos si son incorrectos

3️⃣ Usuario completa observación
   "Compra de insumos para oficina"

4️⃣ Usuario presiona "Confirmar"
   PUT /comprobante/{id}/confirm
   {
     "extractedData": {
       "tipoComprobante": "Factura (Efectivo)",
       "numeroComprobante": "00001-12345678",  // puede haber editado
       "fechaComprobante": "2025-01-13",       // puede haber editado
       "monto": 1500.50,                       // puede haber editado
       "cuit": "20-12345678-9",
       "observaciones": "Compra de insumos para oficina"
     }
   }
         ↓
   Backend actualiza:
   - documentos_procesados → datos confirmados
   - rendicion_tarjeta_items → datos confirmados
   - Estado: "confirmado"
         ↓
   Respuesta:
   {
     "message": "Comprobante confirmado exitosamente",
     "documento": {
       "id": "abc-123",
       "numeroComprobanteExtraido": "00001-12345678",
       "fechaExtraida": "2025-01-13T00:00:00.000Z",
       "importeExtraido": 1500.50,
       "cuitExtraido": "20-12345678-9",
       "observaciones": "Compra de insumos para oficina",
       "estadoProcesamiento": "confirmado"
     }
   }

5️⃣ Comprobante listo
   ✅ Datos guardados correctamente
   ✅ Observación del usuario guardada
   ✅ Rendición actualizada con datos correctos
   ✅ Visible en la web con todos los datos
```

## Ejemplo Real de Uso

### Caso: Usuario Corrige Monto

**1. Datos extraídos con IA**:
```json
{
  "numeroComprobante": "00001-12345678",
  "fechaComprobante": "2025-01-13",
  "monto": "1500",  // ← IA extrajo mal (debería ser 1500.50)
  "cuit": "20-12345678-9"
}
```

**2. Usuario corrige y agrega observación**:
```json
{
  "numeroComprobante": "00001-12345678",
  "fechaComprobante": "2025-01-13",
  "monto": 1500.50,  // ← Corregido por usuario
  "cuit": "20-12345678-9",
  "observaciones": "Compra de insumos - Monto corregido manualmente"
}
```

**3. Backend guarda correctamente**:
- `documentos_procesados.importeExtraido`: 1500.50 ✅
- `documentos_procesados.observaciones`: "Compra de insumos - Monto corregido manualmente" ✅
- `rendicion_tarjeta_items.importeTotal`: 1500.50 ✅

## Testing

### Test 1: Confirmación Sin Observaciones (Error)

```bash
PUT /api/mobile/comprobante/abc-123/confirm
{
  "extractedData": {
    "numeroComprobante": "00001-12345678",
    "fechaComprobante": "2025-01-13",
    "monto": 1500.50,
    "cuit": "20-12345678-9"
    // ❌ falta observaciones
  }
}

# Respuesta esperada:
400 Bad Request
{
  "errors": [
    {
      "msg": "Observaciones es un campo obligatorio",
      "param": "extractedData.observaciones",
      "location": "body"
    }
  ]
}
```

### Test 2: Confirmación Con Observaciones (Éxito)

```bash
PUT /api/mobile/comprobante/abc-123/confirm
{
  "extractedData": {
    "tipoComprobante": "Factura (Efectivo)",
    "numeroComprobante": "00001-12345678",
    "fechaComprobante": "2025-01-13",
    "monto": 1500.50,
    "cuit": "20-12345678-9",
    "observaciones": "Compra de insumos oficina"
  }
}

# Respuesta esperada:
200 OK
{
  "message": "Comprobante confirmado exitosamente",
  "documento": {
    "id": "abc-123",
    "numeroComprobanteExtraido": "00001-12345678",
    "fechaExtraida": "2025-01-13T00:00:00.000Z",
    "importeExtraido": 1500.5,
    "cuitExtraido": "20-12345678-9",
    "observaciones": "Compra de insumos oficina",
    "estadoProcesamiento": "confirmado"
  }
}
```

### Test 3: Usuario Corrige Datos

```bash
# 1. Upload con datos automáticos
POST /api/mobile/comprobante/upload
# Respuesta: monto: "1500" (incorrecto)

# 2. Usuario corrige y confirma
PUT /api/mobile/comprobante/abc-123/confirm
{
  "extractedData": {
    "monto": 1500.50,  // ← Corregido
    "observaciones": "Monto corregido"
  }
}

# 3. Verificar en BD:
SELECT importeExtraido, observaciones FROM documentos_procesados WHERE id = 'abc-123';
-- Resultado: importeExtraido = 1500.50, observaciones = "Monto corregido"

SELECT importeTotal FROM rendicion_tarjeta_items
WHERE id = (SELECT rendicionItemId FROM documentos_asociados WHERE documentoProcesadoId = 'abc-123');
-- Resultado: importeTotal = 1500.50
```

## Logs Esperados

```bash
pm2 logs rendiciones-backend

# Logs de confirmación:
✏️ Usuario confirmando comprobante: abc-123
Datos recibidos: {
  numeroComprobante: '00001-12345678',
  fecha: '2025-01-13',
  monto: 1500.5,
  observaciones: 'Compra de insumos oficina'
}
✅ Documento actualizado con datos confirmados
💰 Actualizando item de rendición con datos confirmados...
✅ Item de rendición actualizado con datos confirmados
```

## Estados del Documento

| Estado | Descripción | Cuándo |
|--------|-------------|--------|
| **procesando** | Documento siendo procesado con OCR + IA | Durante upload |
| **procesado** | Datos extraídos, esperando confirmación | Después de upload |
| **confirmado** | Usuario confirmó los datos y agregó observación | Después de confirm |
| **completo** | Cupón confirmado (solo tarjetas) | Después de confirmar cupón |

## Compatibilidad

### Comprobantes de Tarjeta

Mismo flujo, pero:
- No se actualiza rendición (no se crea automáticamente)
- Usuario debe asociar manualmente en web después

### Retrocompatibilidad

Si por alguna razón la app mobile antigua no envía observaciones:
- ❌ Endpoint devuelve error 400
- ✅ Usuario debe actualizar la app para completar observaciones

## Archivos Modificados

| Archivo | Líneas | Cambios |
|---------|--------|---------|
| `backend/src/routes/mobile.js` | 316-431 | Endpoint `/confirm` mejorado |

## Mejoras Implementadas

1. ✅ Validación de observaciones obligatorio
2. ✅ Guardar observación del usuario (no concatenar)
3. ✅ Actualizar tipoComprobante
4. ✅ Actualizar item de rendición para efectivo
5. ✅ Logs detallados para debugging
6. ✅ Respuesta más completa
7. ✅ Manejo de fecha mejorado

---

**Fecha**: 2025-01-13
**Criticidad**: Media-Alta
**Tipo**: Bug Fix + Enhancement
**Afecta a**: Confirmación de comprobantes desde mobile
**Versión**: 1.5.4
