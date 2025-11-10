const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script simplificado para actualizar prompts directamente por SQL
 */

async function updatePrompts() {
  console.log('🔧 Actualizando prompts...\n');

  try {
    // ========== 1. ACTUALIZAR CLASIFICADOR ==========
    console.log('1️⃣  Actualizando CLASIFICADOR_DOCUMENTO...');

    const clasificadorPrompt = `Analiza el siguiente texto de un documento fiscal argentino y determina su tipo exacto.

TIPOS POSIBLES:
- FACTURA_A: Factura tipo A (entre empresas/responsables inscriptos)
- FACTURA_B: Factura tipo B (a responsables inscriptos/monotributistas)
- FACTURA_C: Factura tipo C (a consumidores finales)
- NOTA_CREDITO: Nota de crédito (cualquier tipo)
- DESPACHO_ADUANA: Despacho de aduana / documentación aduanera
- COMPROBANTE_IMPORTACION: Comprobante de importación
- TICKET: Ticket fiscal / comprobante de consumidor final

INSTRUCCIONES DE CLASIFICACIÓN:

1. INDICADORES PRINCIPALES (orden de prioridad):

   a) Letra en recuadro superior del documento: A, B o C

   b) FACTURA B - **VERIFICAR PRIMERO** (prioridad máxima):
      ✓ **REGLA ABSOLUTA**: Si contiene "LEY 27743" → ES FACTURA_B (confianza 0.99)
      ✓ **REGLA ABSOLUTA**: Si dice "IVA INCLUIDO" sin tabla de IVA → ES FACTURA_B
      ✓ IVA INCLUIDO (NO discriminado en tabla separada)
      ✓ Frases: "IVA INCLUIDO", "Precio Final", "Total con IVA incluido"
      ✓ NO hay tabla de IVA separada con alícuotas
      ✓ Estructura: Solo muestra Total (sin desglose de Subtotal + IVA)
      ✓ Destinatario: puede decir "MONOTRIBUTISTA" o "RESPONSABLE INSCRIPTO"
      ✓ Puede decir "IVA incluido en el precio" o "Precio final con IVA"
      ✓ Si hay letra "B" visible en recuadro → confirma FACTURA_B

   c) FACTURA A - Busca TODOS estos indicadores:
      ✓ IVA DISCRIMINADO (separado del subtotal EN UNA TABLA)
      ✓ Frases: "IVA 21%", "Subtotal", "Neto Gravado", "Impuesto Liquidado"
      ✓ **Tabla de IVA** con columnas separadas: Alícuota | Base | Impuesto
      ✓ Estructura clara: Subtotal + IVA = Total
      ✓ Destinatario: "RESPONSABLE INSCRIPTO", "CUIT"
      ✓ Puede tener percepciones/retenciones
      ✓ Si hay letra "A" visible en recuadro → confirma FACTURA_A

   d) FACTURA C - Busca estos indicadores:
      ✓ IVA INCLUIDO (nunca discriminado)
      ✓ Frases: "CONSUMIDOR FINAL", "CF", "IVA Incluido"
      ✓ NO discrimina IVA
      ✓ NO tiene tabla de impuestos
      ✓ Destinatario: sin CUIT, "Consumidor Final"
      ✓ Si hay letra "C" visible en recuadro → confirma FACTURA_C

   e) Para DESPACHOS ADUANA:
      ✓ Palabras: "DESPACHO", "ADUANA", "IMPORTACION", "DI", "SIM"
      ✓ Términos: "FOB", "CIF", "Arancel", "Posición Arancelaria"

   f) Para TICKETS:
      ✓ Palabras: "TICKET", "TIQUE", "CF"
      ✓ Sin CUIT del cliente
      ✓ Sin discriminación de IVA

2. DIFERENCIACIÓN CRÍTICA ENTRE A y B (PASO A PASO):

   **PASO 1 - Buscar LEY 27743:**
   - Si encuentras "LEY 27743" → FACTURA_B (confianza 0.99) - NO SEGUIR ANALIZANDO

   **PASO 2 - Buscar tabla de IVA:**
   - ¿Hay una TABLA con columnas "Alícuota", "Base Imponible", "Impuesto"? → FACTURA_A
   - ¿NO hay tabla y solo dice "IVA incluido" en texto? → FACTURA_B

   **PASO 3 - Analizar estructura de totales:**
   - Si hay líneas separadas: "Subtotal: $X", "IVA 21%: $Y", "Total: $Z" → FACTURA_A
   - Si solo hay: "Total: $X (IVA incluido)" → FACTURA_B

   **PASO 4 - Verificar letra visible:**
   - Si hay letra "A" en recuadro → confirma FACTURA_A
   - Si hay letra "B" en recuadro → confirma FACTURA_B

3. Asigna nivel de confianza (0.0 a 1.0):
   - 0.99: Si contiene "LEY 27743" (es FACTURA_B)
   - 0.95-0.98: Letra visible + 3+ indicadores coinciden
   - 0.85-0.94: Letra visible + 2 indicadores
   - 0.75-0.84: Solo indicadores (sin letra visible)
   - 0.60-0.74: Pocos indicadores
   - <0.60: Dudoso

4. Identifica subtipos si aplica: ["SERVICIOS"], ["PRODUCTOS"], ["IMPORTACION"]

Texto del documento:
{{DOCUMENT_TEXT}}

IMPORTANTE - REGLAS DE ORO (verificar en este orden):
1. **Si contiene "LEY 27743" → ES FACTURA_B** (confianza 0.99) - REGLA ABSOLUTA
2. **Si dice "IVA INCLUIDO" sin tabla de IVA → ES FACTURA_B** (confianza 0.95)
3. Si encuentras una TABLA con columnas de IVA (Alícuota, Base, Impuesto) → es FACTURA_A
4. Si hay estructura "Subtotal + IVA = Total" con montos separados → es FACTURA_A

Responde ÚNICAMENTE con un objeto JSON válido en este formato exacto:
{
  "tipo": "FACTURA_B",
  "confianza": 0.99,
  "subtipos": ["SERVICIOS"]
}`;

    await prisma.$executeRaw`
      UPDATE ai_prompts
      SET prompt = ${clasificadorPrompt},
          "updatedAt" = NOW()
      WHERE clave = 'CLASIFICADOR_DOCUMENTO'
        AND "tenantId" IS NULL
    `;
    console.log('✅ Clasificador actualizado\n');

    // ========== 2. ACTUALIZAR EXTRACTORES ==========

    const instrucc = `

NÚMERO DE COMPROBANTE - VARIANTES A RECONOCER:
El número de comprobante puede aparecer con diferentes etiquetas y formatos:

ETIQUETAS POSIBLES:
- "N°", "Nro", "Número", "Num"
- "Comprobante N°", "Comp. N°", "Comp N°"
- "Factura N°", "Fact. N°", "FC N°"
- "Nro. Comprobante", "Numero Comprobante"
- Solo números sin etiqueta cerca del CAE

FORMATOS VÁLIDOS:
- XXXXX-XXXXXXXX (5-8 dígitos, formato estándar)
- XXXX-XXXXXXXX (4-8 dígitos)
- 00000-00000000 (con ceros a la izquierda)
- Puede tener espacios: XXXXX - XXXXXXXX
- Solo números largos (13 dígitos sin guión)

UBICACIÓN:
- Generalmente en la parte superior derecha
- Cerca del CAE o fecha de vencimiento CAE
- Puede estar en una caja/recuadro junto a la letra (A, B, C)

EJEMPLO DE EXTRACCIÓN:
Si encuentras: "Comp. N° 00003-00045821" → extraer: "00003-00045821"
Si encuentras: "Comprobante 12345 67890123" → extraer: "12345-67890123"
Si encuentras: "N° 0001200000145" → extraer: "00012-00000145"`;

    console.log('2️⃣  Actualizando extractores...');

    // Actualizar todos los extractores agregando las instrucciones después de "numeroComprobante"
    await prisma.$executeRaw`
      UPDATE ai_prompts
      SET prompt = REGEXP_REPLACE(
        prompt,
        '- numeroComprobante[^\n]*',
        CONCAT('- numeroComprobante', ${instrucc}),
        'g'
      ),
      "updatedAt" = NOW()
      WHERE clave IN ('EXTRACCION_UNIVERSAL', 'EXTRACCION_FACTURA_A', 'EXTRACCION_FACTURA_B',
                      'EXTRACCION_FACTURA_C', 'EXTRACCION_DESPACHO_ADUANA')
        AND "tenantId" IS NULL
    `;

    console.log('✅ Extractores actualizados\n');

    console.log('🎉 Actualización completada\n');
    console.log('CAMBIOS APLICADOS:');
    console.log('1. Clasificador: Prioriza "LEY 27743" para FACTURA_B');
    console.log('2. Clasificador: Paso a paso para diferenciar A vs B');
    console.log('3. Extractores: Reconocen "Comp", "Comprobante", formato 00000-00000000');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updatePrompts()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
