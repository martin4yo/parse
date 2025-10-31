/**
 * Script para actualizar el prompt EXTRACCION_FACTURA_A
 * Agrega instrucciones para extraer descuentos y recargos
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
- Puede tener descuentos o recargos (globales o por item)
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
- descuentoGlobal (NÚMERO o null) - Descuento o recargo global que aparece en la sección de totales
- descuentoGlobalTipo (STRING: "DESCUENTO" o "RECARGO" o null) - Tipo de ajuste global
- cupon (si es pago con tarjeta) - STRING
- lineItems (array de items - EXTRAER TODOS los items de la tabla de detalle) - ARRAY
- impuestosDetalle (array con cada impuesto separado - EXTRAER de la sección de totales) - ARRAY

**DÓNDE ENCONTRAR DESCUENTOS/RECARGOS:**

Las facturas pueden tener descuentos o recargos en DOS lugares:

1. **A NIVEL GLOBAL (en la sección de totales al pie):**
   - Aparecen junto con Subtotal, IVA, Total
   - Ejemplos: "Descuento: $500.00", "Recargo: $200.00", "Bonificación: 10%"
   - Si encuentras esto, extraer:
     * descuentoGlobal: el importe numérico (500.00 o 200.00)
     * descuentoGlobalTipo: "DESCUENTO" (si resta del total) o "RECARGO" (si suma al total)

2. **A NIVEL DE ITEM (en cada línea de la tabla):**
   - Pueden aparecer como columna en la tabla de items
   - Ejemplos: "Dto. 10%", "Desc. $50.00", "Bonif. 5%"
   - Si encuentras esto en un item, extraer en ese lineItem:
     * descuentoTipo: "PORCENTAJE" (si es %) o "IMPORTE" (si es $)
     * descuentoValor: el valor numérico (10 para 10%, o 50.00 para $50)
     * descuentoImporte: el importe del descuento en pesos (si no está visible, null)

FORMATO TÍPICO DE LA TABLA DE ITEMS EN FACTURAS ARGENTINAS:
Las tablas de items generalmente tienen columnas en este ORDEN:
1. CANTIDAD (primera columna - izquierda) - Números como 1, 2.5, 10
2. UNIDAD (un, kg, m, hs, etc.)
3. CÓDIGO o CÓDIGO PRODUCTO (opcional)
4. DESCRIPCIÓN o DETALLE (texto descriptivo)
5. PRECIO UNITARIO o P. UNIT
6. **DESCUENTO (opcional)** - Puede ser "10%" o "$50.00"
7. SUBTOTAL o IMPORTE
8. IVA % o ALÍCUOTA (21%, 10.5%, etc.)
9. IMPORTE IVA
10. TOTAL o IMPORTE TOTAL

**CRÍTICO PARA CANTIDAD:**
- La CANTIDAD siempre está al INICIO de cada línea de item (primera columna)
- Busca números al PRINCIPIO de cada fila de la tabla de items
- La CANTIDAD aparece ANTES de la descripción del producto
- Ejemplo de línea: "2.00 | un | Servicio de consultoría | 1000.00 | 10% | 2000.00"
  → CANTIDAD = 2.00 (primer número de la línea)

ESTRUCTURA DE lineItems:
[{
  "numero": 1,
  "codigoProducto": "COD-123",
  "descripcion": "Descripción del producto/servicio",
  "cantidad": 2.00,  // ← PRIMER NÚMERO de la línea del item
  "unidad": "un",
  "precioUnitario": 1000.00,
  "descuentoTipo": "PORCENTAJE",  // ← "PORCENTAJE" o "IMPORTE" o null
  "descuentoValor": 10.00,  // ← 10 (para 10%) o 100.00 (para $100) o null
  "descuentoImporte": 200.00,  // ← Importe en $ del descuento o null
  "subtotal": 1800.00,  // ← DESPUÉS de aplicar descuento
  "alicuotaIva": 21.00,
  "importeIva": 378.00,  // ← EXTRAER de la columna, NO calcular
  "totalLinea": 2178.00
}]

**DÓNDE ENCONTRAR LOS IMPUESTOS EN LA FACTURA:**
Las facturas argentinas tipo A tienen una sección de "Totales" o "Resumen" (generalmente al pie del documento) que muestra:
- Subtotal / Neto Gravado
- Descuento / Recargo (si aplica) ← **NUEVO**
- IVA 21%: $XXXX.XX (valor ya calculado)
- IVA 10.5%: $XXXX.XX (si aplica)
- Percepciones IIBB: $XXXX.XX (si aplica)
- Retenciones: $XXXX.XX (si aplica)
- TOTAL

Ejemplo de sección de totales CON descuento global:

Subtotal:        10,000.00
Descuento 5%:    -500.00      (extraer: descuentoGlobal: 500.00, descuentoGlobalTipo: "DESCUENTO")
Neto Gravado:    9,500.00
IVA 21%:         1,995.00
TOTAL:           11,495.00

Ejemplo de sección de totales CON recargo:

Subtotal:        10,000.00
Recargo 10%:     +1,000.00    (extraer: descuentoGlobal: 1000.00, descuentoGlobalTipo: "RECARGO")
Neto Gravado:    11,000.00
IVA 21%:         2,310.00
TOTAL:           13,310.00

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

5. 🎁 EXTRAER descuento/recargo global si existe:
   - Buscar en totales: "Descuento:", "Bonificación:", "Recargo:"
   - Si encuentra, extraer importe y tipo

6. ⚠️ PRIORIDAD: Usa SIEMPRE la sección de totales consolidados
   - NO sumes manualmente los impuestos de cada line item
   - La factura ya tiene el total consolidado - úsalo

**IMPORTANTE - EXTRAER vs CALCULAR:**

✅ DEBES EXTRAER (copiar valores que ya están):
- Importes de impuestos de la sección de totales
- Subtotales, neto gravado, exento
- Valores numéricos de line items (cantidad, precio, subtotal)
- Descuentos y recargos (global e items)

✅ DEBES SUMAR (operación matemática simple):
- Sumar los importes extraídos de impuestosDetalle → campo "impuestos"
- Solo esta suma está permitida

❌ NO DEBES CALCULAR:
- Impuestos multiplicando base × alícuota
- Totales de líneas desde cero
- Valores que ya aparecen calculados en la factura
- Descuentos aplicando porcentajes (si el importe ya está, extraerlo)

Ejemplo Completo CON DESCUENTO GLOBAL:
- Factura muestra en totales:
  * Subtotal: $12,000.00
  * Descuento 5%: -$600.00
  * Neto Gravado: $11,400.00
  * IVA 21%: $2,394.00
  * Perc. IIBB: $400.00
  * TOTAL: $14,194.00

- Tu extracción debe ser:
  * netoGravado: 11400.00 (extraído DESPUÉS del descuento)
  * descuentoGlobal: 600.00 (extraído)
  * descuentoGlobalTipo: "DESCUENTO"
  * impuestosDetalle: [
      { tipo: "IVA", importe: 2394.00 },  (extraído)
      { tipo: "PERCEPCION", importe: 400.00 }  (extraído)
    ]
  * impuestos: 2794.00 (suma de 2394 + 400)
  * importe: 14194.00 (extraído)

Ejemplo de Item CON DESCUENTO:
- Línea de factura: "2 | un | Producto X | $1,000.00 | Dto 10% | $1,800.00 | IVA 21% | $378.00 | $2,178.00"

- Tu extracción debe ser:
  * cantidad: 2.00
  * descripcion: "Producto X"
  * precioUnitario: 1000.00
  * descuentoTipo: "PORCENTAJE"
  * descuentoValor: 10.00
  * descuentoImporte: 200.00 (si está visible; si no, null)
  * subtotal: 1800.00
  * alicuotaIva: 21.00
  * importeIva: 378.00
  * totalLinea: 2178.00

IMPORTANTE SOBRE EXTRACCIÓN DE LINE ITEMS:
- Extrae TODOS los line items de la tabla (no calcules, extrae lo que dice)
- **La CANTIDAD es la PRIMERA COLUMNA** - busca el primer número de cada fila
- Separa CADA impuesto (no sumes IVA 21% + IVA 10.5%)
- Si un campo de descuento no existe, usa null
- Sé preciso con decimales
- NO confundas CANTIDAD con precio unitario o subtotal

⚠️ RECORDATORIO CRÍTICO ANTES DE RESPONDER:
1. 🚨 IGNORAR COMPLETAMENTE cualquier variante de "TIMBO" + "QUIMICA"/"MINERA" en razonSocial - ES DEL CLIENTE
2. 🚨 Si la única razón social visible contiene "TIMBO", devolver razonSocial: null
3. ✅ Buscar CUIT y razón social del EMISOR en el ENCABEZADO SUPERIOR del documento (primeros renglones, junto al logo)
4. ❌ NO calcular impuestos - EXTRAER los valores que ya están calculados en la sección de totales
5. ➕ SUMAR los importes de impuestos extraídos → campo "impuestos"
6. 🎁 EXTRAER descuentos/recargos tanto globales como por item - NO calcularlos
7. ⚠️ Si un campo no existe o no estás seguro, usar null - NO SUPONGAS
8. 📋 Devolver SOLO JSON válido sin comentarios, markdown, ni comillas triples

Texto de la factura:
{{DOCUMENT_TEXT}}

Responde SOLO con JSON válido:`;

async function updatePrompt() {
  console.log('🔄 Actualizando prompt EXTRACCION_FACTURA_A con instrucciones de descuentos...\n');

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
    console.log('   ✓ Agregados campos descuentoGlobal y descuentoGlobalTipo');
    console.log('   ✓ Agregados campos de descuento en lineItems (descuentoTipo, descuentoValor, descuentoImporte)');
    console.log('   ✓ Agregada sección "DÓNDE ENCONTRAR DESCUENTOS/RECARGOS"');
    console.log('   ✓ Actualizado formato de tabla con columna de descuento');
    console.log('   ✓ Agregados ejemplos de descuentos globales y por item');
    console.log('   ✓ Actualizada estructura de lineItems con campos de descuento');
    console.log('   ✓ Agregado paso 5 en flujo de extracción para descuentos');
    console.log('   ✓ Agregado recordatorio sobre extraer descuentos (no calcularlos)');

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
