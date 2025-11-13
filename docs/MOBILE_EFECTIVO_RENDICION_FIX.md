# Fix V4: Creación Automática de Rendición de Efectivo desde Mobile

**Fecha**: 2025-01-13 (noche)

## Problema

Cuando se subía un comprobante de **efectivo** desde la app mobile:
- ✅ Se guardaba el documento
- ✅ Se extraían los datos con IA
- ✅ Se asociaba a la caja seleccionada
- ❌ **NO se creaba la rendición automáticamente**

Esto obligaba al usuario a ir a la página web de comprobantes-efectivo para crear la rendición manualmente.

## Comportamiento Esperado

Al subir un comprobante de efectivo desde mobile, debe:

1. Buscar una rendición de cabecera en estado `PENDIENTE` o `ENAUT` para esa caja
2. Si no existe, crear una nueva rendición de cabecera con:
   - `loteId`: `{cajaId}_{secuencial}` (ej: "caja123_00001")
   - `periodo`: AAAAMM (ej: "202501")
   - `estadoCodigo`: "PENDIENTE"
   - `numeroTarjeta`: NULL (efectivo)
   - `cajaId`: la caja seleccionada

3. Crear un item de rendición con los datos del comprobante
4. Crear la asociación en `documentos_asociados`

Este es el mismo comportamiento que tiene la página web de comprobantes-efectivo.

## Solución Implementada

### 1. Detección de Efectivo

Después de extraer los datos con IA, verificar si el tipo es "efectivo":

```javascript
// En processDocumentSync, después de actualizar el documento
const documento = await prisma.documentos_procesados.findUnique({
  where: { id: documentoId },
  select: {
    id: true,
    tipo: true,
    cajaId: true,
    tenantId: true,
    usuarioId: true,
    fechaExtraida: true,
    importeExtraido: true,
    numeroComprobanteExtraido: true,
    tipoComprobanteExtraido: true,
    cuitExtraido: true,
    netoGravadoExtraido: true,
    exentoExtraido: true,
    impuestosExtraido: true
  }
});

if (documento && documento.tipo === 'efectivo' && documento.cajaId) {
  console.log('💰 Creando rendición de efectivo para documento:', documentoId);
  await crearRendicionEfectivoMobile(documento, datosExtraidos);
}
```

### 2. Función de Creación de Rendición

Nueva función `crearRendicionEfectivoMobile()` que replica la lógica de `documentos.js`:

```javascript
async function crearRendicionEfectivoMobile(documento, datosExtraidos) {
  try {
    console.log('📋 Procesando rendición de efectivo para documento mobile:', documento.id);

    const cajaId = documento.cajaId;
    const tenantId = documento.tenantId;
    const userId = documento.usuarioId;

    // 1. Buscar rendición existente en estado PENDIENTE o ENAUT
    let rendicionCabecera = await prisma.rendicion_tarjeta_cabecera.findFirst({
      where: {
        cajaId: cajaId,
        estadoCodigo: {
          in: ['PENDIENTE', 'ENAUT']  // Buscar en ambos estados
        },
        tenantId: tenantId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 2. Si no existe, crear nueva rendición
    if (!rendicionCabecera) {
      // Generar número secuencial
      const ultimaRendicion = await prisma.rendicion_tarjeta_cabecera.findFirst({
        where: {
          loteId: {
            contains: cajaId + '_'
          }
        },
        orderBy: {
          loteId: 'desc'
        }
      });

      let secuencial = 1;
      if (ultimaRendicion && ultimaRendicion.loteId) {
        const partes = ultimaRendicion.loteId.split('_');
        if (partes.length > 1) {
          secuencial = parseInt(partes[1]) + 1;
        }
      }

      const loteId = `${cajaId}_${String(secuencial).padStart(5, '0')}`;
      const periodo = new Date().toISOString().substring(0, 7).replace('-', ''); // AAAAMM

      console.log('Creando nueva rendición de efectivo mobile:', { loteId, periodo, cajaId });

      rendicionCabecera = await prisma.rendicion_tarjeta_cabecera.create({
        data: {
          id: require('crypto').randomUUID(),
          loteId: loteId,
          numeroTarjeta: null, // NULL para efectivo
          periodo: periodo,
          estadoCodigo: 'PENDIENTE',
          cajaId: cajaId,
          tenantId: tenantId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log('✅ Rendición de efectivo creada:', rendicionCabecera.id);
    } else {
      console.log('✅ Usando rendición existente:', rendicionCabecera.id, '- Estado:', rendicionCabecera.estadoCodigo);
    }

    // 3. Crear item de rendición con datos del comprobante
    const rendicionItem = await prisma.rendicion_tarjeta_items.create({
      data: {
        id: require('crypto').randomUUID(),
        rendicionCabeceraId: rendicionCabecera.id,
        resumenTarjetaId: null, // NULL para efectivo
        tipoComprobante: datosExtraidos?.tipoComprobante || documento.tipoComprobanteExtraido,
        numeroComprobante: datosExtraidos?.numeroComprobante || documento.numeroComprobanteExtraido,
        fechaComprobante: documento.fechaExtraida,
        cuitProveedor: datosExtraidos?.cuit || documento.cuitExtraido,
        netoGravado: documento.netoGravadoExtraido,
        exento: documento.exentoExtraido,
        importeImpuestos: documento.impuestosExtraido,
        importeTotal: documento.importeExtraido,
        cargaManual: false,
        rechazo: false,
        tenantId: tenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Item de rendición creado:', rendicionItem.id);

    // 4. Crear asociación documento-rendición
    await prisma.documentos_asociados.create({
      data: {
        id: require('crypto').randomUUID(),
        documentoProcesadoId: documento.id,
        resumenTarjetaId: null, // NULL para efectivo
        usuarioAsociacion: userId,
        rendicionItemId: rendicionItem.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Asociación documento-rendición creada');

    return { rendicionCabecera, rendicionItem };

  } catch (error) {
    console.error('❌ Error creando/buscando rendición de efectivo mobile:', error);
    // No lanzamos el error para no interrumpir el procesamiento del documento
    return null;
  }
}
```

## Flujo Completo

### Comprobante de Efectivo desde Mobile

```
Usuario sube foto de comprobante
Tipo: Efectivo
Caja: Caja 001
         ↓
   Guarda documento
   Estado: "procesando"
         ↓
   1️⃣ OCR extrae texto
         ↓
   2️⃣ IA extrae datos estructurados
      - Número: 0001-12345678
      - Fecha: 2025-01-13
      - Monto: $10,000
      - CUIT: 20-12345678-9
         ↓
   3️⃣ Guarda datos extraídos
   Estado: "procesado"
         ↓
   4️⃣ Busca rendición PENDIENTE/ENAUT
      para Caja 001
         ↓
   ¿Existe rendición?

   NO → Crea nueva rendición
         loteId: "caja001_00001"
         periodo: "202501"
         estado: "PENDIENTE"

   SÍ → Usa rendición existente
         ↓
   5️⃣ Crea item de rendición
      con datos del comprobante
         ↓
   6️⃣ Crea asociación
      documento ↔ item
         ↓
   ✅ Comprobante listo en rendición
```

## Diferencias con Comprobante de Tarjeta

| Aspecto | Efectivo | Tarjeta |
|---------|----------|---------|
| **Caja** | Requiere cajaId | No requiere caja |
| **Rendición** | Se crea automáticamente | Usuario asocia manualmente |
| **numeroTarjeta** | NULL | Número de tarjeta |
| **resumenTarjetaId** | NULL | ID del resumen |
| **Estado inicial** | PENDIENTE | Espera asociación |

## Estados de Rendición

| Estado | Descripción | ¿Se puede agregar items? |
|--------|-------------|--------------------------|
| **PENDIENTE** | Rendición recién creada o en proceso | ✅ SÍ |
| **ENAUT** | En autorización | ✅ SÍ |
| **AUTORIZADA** | Autorizada | ❌ NO |
| **RECHAZADA** | Rechazada | ❌ NO |

La lógica busca rendiciones en `PENDIENTE` o `ENAUT` para agregar nuevos items.

## Archivos Modificados

| Archivo | Líneas | Cambios |
|---------|--------|---------|
| `backend/src/routes/mobile.js` | 652-675 | Detección de efectivo y llamada a crear rendición |
| `backend/src/routes/mobile.js` | 706-821 | Nueva función `crearRendicionEfectivoMobile()` |

## Base de Datos

### Tablas Involucradas

1. **documentos_procesados**
   - Almacena el documento subido
   - `tipo`: "efectivo" o "tarjeta"
   - `cajaId`: ID de la caja (solo efectivo)

2. **rendicion_tarjeta_cabecera**
   - Cabecera de la rendición
   - Una por caja en estado PENDIENTE/ENAUT
   - `loteId`: Identificador único de la rendición

3. **rendicion_tarjeta_items**
   - Items de la rendición (los comprobantes)
   - Un item por comprobante
   - `rendicionCabeceraId`: Vincula con la cabecera

4. **documentos_asociados**
   - Asociación documento ↔ item de rendición
   - Permite rastrear qué documento generó qué item

## Testing

### Test 1: Primera Carga de Comprobante

```bash
# Desde la app mobile:
1. Seleccionar tipo: Efectivo
2. Elegir caja: Caja 001
3. Subir foto de factura
4. Esperar procesamiento

# Verificar en logs:
📋 Procesando rendición de efectivo para documento mobile: {id}
Creando nueva rendición de efectivo mobile: { loteId: 'caja001_00001', periodo: '202501', cajaId: 'caja001' }
✅ Rendición de efectivo creada: {rendicionId}
✅ Item de rendición creado: {itemId}
✅ Asociación documento-rendición creada

# Verificar en BD:
SELECT * FROM rendicion_tarjeta_cabecera WHERE cajaId = 'caja001' AND estadoCodigo = 'PENDIENTE';
-- Debe aparecer 1 registro con loteId: caja001_00001

SELECT * FROM rendicion_tarjeta_items WHERE rendicionCabeceraId = '{rendicionId}';
-- Debe aparecer 1 item con los datos del comprobante

SELECT * FROM documentos_asociados WHERE documentoProcesadoId = '{documentoId}';
-- Debe aparecer 1 asociación
```

### Test 2: Segunda Carga en Misma Caja

```bash
# Desde la app mobile:
1. Seleccionar tipo: Efectivo
2. Elegir caja: Caja 001 (la misma)
3. Subir otra foto de factura
4. Esperar procesamiento

# Verificar en logs:
📋 Procesando rendición de efectivo para documento mobile: {id}
✅ Usando rendición existente: {rendicionId} - Estado: PENDIENTE
✅ Item de rendición creado: {nuevoItemId}
✅ Asociación documento-rendición creada

# Verificar en BD:
SELECT * FROM rendicion_tarjeta_cabecera WHERE cajaId = 'caja001' AND estadoCodigo = 'PENDIENTE';
-- Debe aparecer 1 solo registro (la misma rendición)

SELECT * FROM rendicion_tarjeta_items WHERE rendicionCabeceraId = '{rendicionId}';
-- Debe aparecer 2 items ahora
```

### Test 3: Carga en Otra Caja

```bash
# Desde la app mobile:
1. Seleccionar tipo: Efectivo
2. Elegir caja: Caja 002 (diferente)
3. Subir foto de factura
4. Esperar procesamiento

# Verificar en logs:
📋 Procesando rendición de efectivo para documento mobile: {id}
Creando nueva rendición de efectivo mobile: { loteId: 'caja002_00001', periodo: '202501', cajaId: 'caja002' }
✅ Rendición de efectivo creada: {nuevaRendicionId}

# Verificar en BD:
SELECT * FROM rendicion_tarjeta_cabecera WHERE estadoCodigo = 'PENDIENTE';
-- Deben aparecer 2 registros:
--   - caja001_00001 (de tests anteriores)
--   - caja002_00001 (nueva)
```

## Verificación en la Web

1. Ir a la página de **Comprobantes de Efectivo**
2. Verificar que aparezcan las rendiciones creadas desde mobile
3. Los comprobantes deben estar asociados correctamente
4. Se puede autorizar/rechazar la rendición normalmente

## Logs Esperados

```bash
pm2 logs rendiciones-backend

# Logs de éxito:
📄 Procesando documento de forma síncrona para mobile...
📄 Procesando documento abc-123 - Tipo: image/jpeg
✅ Documento procesado exitosamente (OCR): abc-123
🤖 Extrayendo datos estructurados con IA...
✅ Datos extraídos: { fecha: 'SÍ', importe: 'SÍ', cuit: 'SÍ', numeroComprobante: 'SÍ' }
✅ Documento actualizado con datos extraídos: abc-123
💰 Creando rendición de efectivo para documento: abc-123
📋 Procesando rendición de efectivo para documento mobile: abc-123
Creando nueva rendición de efectivo mobile: { loteId: 'caja001_00001', periodo: '202501', cajaId: 'caja001' }
✅ Rendición de efectivo creada: def-456
✅ Item de rendición creado: ghi-789
✅ Asociación documento-rendición creada
```

## Errores Posibles

### Error: No se crea la rendición

**Causa**: `tipo` del documento no es "efectivo" o `cajaId` es NULL

**Solución**: Verificar que al subir se envíe correctamente:
```javascript
// En el body del POST:
{
  tipo: 'efectivo',
  cajaId: 'id-de-la-caja'
}
```

### Error: Rendición duplicada

**Causa**: Lógica de búsqueda no encuentra rendición existente

**Solución**: Verificar que la búsqueda incluya ambos estados:
```javascript
estadoCodigo: {
  in: ['PENDIENTE', 'ENAUT']
}
```

### Error: Item sin datos

**Causa**: Extracción con IA falló

**Solución**: Los campos se guardan con lo que se pudo extraer o NULL. No falla el proceso completo.

## Compatibilidad

### Comprobantes de Tarjeta

Los comprobantes de **tarjeta** NO son afectados:
- No se crea rendición automáticamente
- Usuario debe asociar manualmente en la web
- Flujo existente sin cambios

### Web vs Mobile

La rendición creada desde mobile es **idéntica** a la creada desde web:
- Mismo formato de `loteId`
- Misma estructura de datos
- Mismos estados
- Totalmente compatible

## Próximos Pasos

- [ ] Agregar notificación push cuando se cree la rendición
- [ ] Mostrar en la app la rendición asociada
- [ ] Permitir ver items de la rendición desde mobile
- [ ] Permitir autorizar rendiciones desde mobile

---

**Fecha**: 2025-01-13
**Criticidad**: Alta
**Tipo**: Feature Enhancement
**Afecta a**: Procesamiento de comprobantes de efectivo desde mobile
**Versión**: 1.5.3
