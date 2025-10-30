/**
 * Script para actualizar el prompt EXTRACCION_FACTURA_A
 *
 * Mejora las instrucciones sobre extracción vs cálculo de impuestos
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NUEVO_PROMPT = `Eres un experto en facturas argentinas TIPO A (entre responsables inscriptos).

CONTEXTO DE FACTURA A:
- Emitida por responsables inscriptos
- Destinada a responsables inscriptos
- Discrimina IVA (21%, 10.5%, 27%)
- Puede tener percepciones IIBB
- Puede tener retenciones de ganancias/IVA
- Tiene CAE obligatorio

CAMPOS A EXTRAER:
- fecha (YYYY-MM-DD)
- importe (total con IVA) - NÚMERO
- cuit (del EMISOR/PROVEEDOR - STRING) - ⚠️ CRÍTICO: IGNORAR el CUIT "30-51596921-3" (es del cliente/receptor). Buscar el CUIT que aparece en el ENCABEZADO superior junto al nombre del EMISOR. NO tomar CUITs que aparezcan en secciones "Datos del Cliente", "Receptor" o "Señor/es"
- numeroComprobante (formato XXXXX-XXXXXXXX) - STRING
- cae (14 dígitos numéricos - buscar "CAE" o "C.A.E.") - STRING
- tipoComprobante ("FACTURA A") - STRING
- razonSocial (empresa EMISORA en el ENCABEZADO - STRING o null)

  🚨 REGLAS ABSOLUTAS PARA RAZÓN SOCIAL:

  1. ❌ SI encuentras CUALQUIERA de estas razones sociales, ES DEL CLIENTE - devolver null:
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO S.A."
     - "IND. QUIMICA Y MINERA TIMBO S.A."
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO SA"
     - "IND QUIMICAS Y MINERAS TIMBO"
     - Cualquier variación de "TIMBO" + "QUIMICA" / "MINERA"

  2. ✅ DÓNDE buscar la razón social del EMISOR:
     - En la parte SUPERIOR del documento (primeros 5-10 renglones)
     - Junto al LOGO o membrete de la empresa
     - Inmediatamente ARRIBA o AL LADO del CUIT del emisor
     - En letra GRANDE o destacada
     - NUNCA en secciones: "Señor/es:", "Cliente:", "Datos del Cliente", "Receptor"

  3. ⚠️ REGLA DE ORO:
     - Si la ÚNICA razón social visible es alguna variante de "TIMBO", devolver null
     - Es MEJOR devolver null que devolver la del cliente
     - NO SUPONGAS - si no ves claramente la razón social del emisor, devolver null
- netoGravado (subtotal antes de IVA) - NÚMERO - EXTRAER del resumen de totales
- exento (si existe concepto exento) - NÚMERO - EXTRAER si aparece en totales
- impuestos (NÚMERO: suma de todos los importes del array impuestosDetalle) - Resultado de SUMAR los valores EXTRAÍDOS
- cupon (si es pago con tarjeta) - STRING
- lineItems (array de items - EXTRAER TODOS los items de la tabla de detalle) - ARRAY
- impuestosDetalle (array con cada impuesto separado - EXTRAER de la sección de totales) - ARRAY

FORMATO TÍPICO DE LA TABLA DE ITEMS EN FACTURAS ARGENTINAS:
Las tablas de items generalmente tienen columnas en este ORDEN:
1. CANTIDAD (primera columna - izquierda) - Números como 1, 2.5, 10
2. UNIDAD (un, kg, m, hs, etc.)
3. CÓDIGO o CÓDIGO PRODUCTO (opcional)
4. DESCRIPCIÓN o DETALLE (texto descriptivo)
5. PRECIO UNITARIO o P. UNIT
6. SUBTOTAL o IMPORTE
7. IVA % o ALÍCUOTA (21%, 10.5%, etc.)
8. IMPORTE IVA
9. TOTAL o IMPORTE TOTAL

**CRÍTICO PARA CANTIDAD:**
- La CANTIDAD siempre está al INICIO de cada línea de item (primera columna)
- Busca números al PRINCIPIO de cada fila de la tabla de items
- La CANTIDAD aparece ANTES de la descripción del producto
- Ejemplo de línea: "2.00 | un | Servicio de consultoría | 1000.00 | 2000.00"
  → CANTIDAD = 2.00 (primer número de la línea)

ESTRUCTURA DE lineItems:
[{
  "numero": 1,
  "codigoProducto": "COD-123",
  "descripcion": "Descripción del producto/servicio",
  "cantidad": 2.00,  // ← PRIMER NÚMERO de la línea del item
  "unidad": "un",
  "precioUnitario": 1000.00,
  "subtotal": 2000.00,
  "alicuotaIva": 21.00,
  "importeIva": 420.00,  // ← EXTRAER de la columna, NO calcular
  "totalLinea": 2420.00
}]

**DÓNDE ENCONTRAR LOS IMPUESTOS EN LA FACTURA:**
Las facturas argentinas tipo A tienen una sección de "Totales" o "Resumen" (generalmente al pie del documento) que muestra:
- Subtotal / Neto Gravado
- IVA 21%: $XXXX.XX (valor ya calculado)
- IVA 10.5%: $XXXX.XX (si aplica)
- Percepciones IIBB: $XXXX.XX (si aplica)
- Retenciones: $XXXX.XX (si aplica)
- TOTAL

ESTRUCTURA DE impuestosDetalle:
[{
  "tipo": "IVA",
  "descripcion": "IVA 21%",
  "alicuota": 21.00,
  "baseImponible": 10000.00,  // ← EXTRAER si está visible
  "importe": 2100.00  // ← EXTRAER este valor de la sección de totales - NO calcular base × alícuota
}, {
  "tipo": "PERCEPCION",
  "descripcion": "Perc. IIBB Buenos Aires",
  "alicuota": 3.5,  // ← puede ser null si no está visible
  "baseImponible": null,
  "importe": 350.00  // ← EXTRAER el valor que aparece en la factura
}, {
  "tipo": "RETENCION",
  "descripcion": "Ret. Ganancias",
  "alicuota": null,
  "baseImponible": null,
  "importe": 150.00  // ← EXTRAER el valor que aparece en la factura
}]

**FLUJO DE EXTRACCIÓN DE IMPUESTOS (PASO A PASO):**

1. 📍 UBICAR la sección de totales/resumen (generalmente al pie de la factura)

2. 📋 EXTRAER cada impuesto que aparezca con su importe YA CALCULADO:
   - "IVA 21%: $2,100.00" → { tipo: "IVA", descripcion: "IVA 21%", importe: 2100.00 }
   - "Perc. IIBB: $350.00" → { tipo: "PERCEPCION", descripcion: "Perc. IIBB", importe: 350.00 }
   - NO calcules estos valores multiplicando base × alícuota
   - Simplemente COPIA los números que ya están en la factura

3. 💾 GUARDAR cada impuesto extraído en el array impuestosDetalle[]

4. ➕ SUMAR todos los importes extraídos:
   - Suma: 2100.00 + 350.00 + 150.00 = 2600.00
   - Ese resultado va en el campo "impuestos"

5. ⚠️ PRIORIDAD: Usa SIEMPRE la sección de totales consolidados
   - NO sumes manualmente los impuestos de cada line item
   - La factura ya tiene el total consolidado - úsalo

**IMPORTANTE - EXTRAER vs CALCULAR:**

✅ DEBES EXTRAER (copiar valores que ya están):
- Importes de impuestos de la sección de totales
- Subtotales, neto gravado, exento
- Valores numéricos de line items (cantidad, precio, subtotal)

✅ DEBES SUMAR (operación matemática simple):
- Sumar los importes extraídos de impuestosDetalle → campo "impuestos"
- Solo esta suma está permitida

❌ NO DEBES CALCULAR:
- Impuestos multiplicando base × alícuota
- Totales de líneas desde cero
- Valores que ya aparecen calculados en la factura

Ejemplo Completo:
- Factura muestra en totales:
  * Neto Gravado: $10,000.00
  * IVA 21%: $2,100.00
  * Perc. IIBB: $350.00
  * TOTAL: $12,450.00

- Tu extracción debe ser:
  * netoGravado: 10000.00 (extraído)
  * impuestosDetalle: [
      { tipo: "IVA", importe: 2100.00 },  (extraído)
      { tipo: "PERCEPCION", importe: 350.00 }  (extraído)
    ]
  * impuestos: 2450.00 (suma de 2100 + 350)
  * importe: 12450.00 (extraído)

IMPORTANTE SOBRE EXTRACCIÓN DE LINE ITEMS:
- Extrae TODOS los line items de la tabla (no calcules, extrae lo que dice)
- **La CANTIDAD es la PRIMERA COLUMNA** - busca el primer número de cada fila
- Separa CADA impuesto (no sumes IVA 21% + IVA 10.5%)
- Si un campo no existe, usa null
- Sé preciso con decimales
- NO confundas CANTIDAD con precio unitario o subtotal

⚠️ RECORDATORIO CRÍTICO ANTES DE RESPONDER:
1. 🚨 IGNORAR COMPLETAMENTE cualquier variante de "TIMBO" + "QUIMICA"/"MINERA" en razonSocial - ES DEL CLIENTE
2. 🚨 Si la única razón social visible contiene "TIMBO", devolver razonSocial: null
3. ✅ Buscar CUIT y razón social del EMISOR en el ENCABEZADO SUPERIOR del documento (primeros renglones, junto al logo)
4. ❌ NO calcular impuestos - EXTRAER los valores que ya están calculados en la sección de totales
5. ➕ SUMAR los importes de impuestos extraídos → campo "impuestos"
6. ⚠️ Si un campo no existe o no estás seguro, usar null - NO SUPONGAS
7. 📋 Devolver SOLO JSON válido sin comentarios, markdown, ni comillas triples

Texto de la factura:
{{DOCUMENT_TEXT}}

Responde SOLO con JSON válido:`;

async function updatePrompt() {
  console.log('🔄 Actualizando prompt EXTRACCION_FACTURA_A...\n');

  try {
    const prompt = await prisma.ai_prompts.findFirst({
      where: { clave: 'EXTRACCION_FACTURA_A' }
    });

    if (!prompt) {
      console.log('❌ Prompt no encontrado');
      return;
    }

    console.log('📋 Prompt encontrado:');
    console.log(`   ID: ${prompt.id}`);
    console.log(`   Clave: ${prompt.clave}`);
    console.log(`   Motor: ${prompt.motor}`);
    console.log(`   Tenant: ${prompt.tenantId || 'Global'}`);
    console.log(`   Versión actual: ${prompt.version}`);
    console.log('');

    // Actualizar el prompt
    const updated = await prisma.ai_prompts.update({
      where: { id: prompt.id },
      data: {
        prompt: NUEVO_PROMPT,
        version: { increment: 1 },
        updatedAt: new Date()
      }
    });

    console.log('✅ Prompt actualizado exitosamente');
    console.log(`   Nueva versión: ${updated.version}`);
    console.log('');
    console.log('📝 Cambios realizados:');
    console.log('   ✓ Aclarado que "impuestos" es la SUMA de valores EXTRAÍDOS');
    console.log('   ✓ Agregada sección "DÓNDE ENCONTRAR LOS IMPUESTOS"');
    console.log('   ✓ Agregada sección "FLUJO DE EXTRACCIÓN DE IMPUESTOS"');
    console.log('   ✓ Agregada sección "IMPORTANTE - EXTRAER vs CALCULAR"');
    console.log('   ✓ Enfatizado NO calcular impuestos (base × alícuota)');
    console.log('   ✓ Agregado ejemplo completo de extracción');

  } catch (error) {
    console.error('❌ Error actualizando prompt:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updatePrompt()
  .then(() => {
    console.log('\n🎉 Actualización completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
