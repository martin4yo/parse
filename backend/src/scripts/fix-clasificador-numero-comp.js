const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script para corregir:
 * 1. Clasificador de documentos - mejorar detección de FACTURA B
 * 2. Todos los extractores - reconocer variantes de número de comprobante
 */

async function updatePrompts() {
  console.log('🔧 Actualizando prompts del clasificador y extractores...\n');

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

    await prisma.ai_prompts.update({
      where: {
        clave_tenantId: {
          clave: 'CLASIFICADOR_DOCUMENTO',
          tenantId: null
        }
      },
      data: {
        prompt: clasificadorPrompt,
        updatedAt: new Date()
      }
    });
    console.log('✅ Clasificador actualizado con mejor detección de FACTURA_B\n');

    // ========== 2. ACTUALIZAR EXTRACTORES - NÚMERO DE COMPROBANTE ==========

    const numeroComprobanteInstrucciones = `
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

    const extractores = [
      {
        clave: 'EXTRACCION_UNIVERSAL',
        campo: '- numeroComprobante'
      },
      {
        clave: 'EXTRACCION_FACTURA_A',
        campo: '- numeroComprobante (formato XXXXX-XXXXXXXX) - STRING'
      },
      {
        clave: 'EXTRACCION_FACTURA_B',
        campo: '- numeroComprobante'
      },
      {
        clave: 'EXTRACCION_FACTURA_C',
        campo: '- numeroComprobante'
      },
      {
        clave: 'EXTRACCION_DESPACHO_ADUANA',
        campo: '- numeroComprobante (número de despacho)'
      }
    ];

    for (const extractor of extractores) {
      console.log(`2️⃣  Actualizando ${extractor.clave}...`);

      const promptActual = await prisma.ai_prompts.findUnique({
        where: {
          clave_tenantId: {
            clave: extractor.clave,
            tenantId: null
          }
        },
        select: { prompt: true }
      });

      if (!promptActual) {
        console.log(`⚠️  ${extractor.clave} no encontrado, saltando...`);
        continue;
      }

      // Reemplazar la línea de numeroComprobante con las instrucciones mejoradas
      const nuevoPrompt = promptActual.prompt.replace(
        new RegExp(`^${extractor.campo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'm'),
        `${extractor.campo}${numeroComprobanteInstrucciones}`
      );

      await prisma.ai_prompts.update({
        where: {
          clave_tenantId: {
            clave: extractor.clave,
            tenantId: null
          }
        },
        data: {
          prompt: nuevoPrompt,
          updatedAt: new Date()
        }
      });

      console.log(`✅ ${extractor.clave} actualizado\n`);
    }

    console.log('🎉 Todos los prompts actualizados exitosamente\n');
    console.log('CAMBIOS APLICADOS:');
    console.log('1. Clasificador: Prioriza "LEY 27743" y "IVA INCLUIDO" para FACTURA_B');
    console.log('2. Clasificador: Paso a paso para diferenciar FACTURA_A vs FACTURA_B');
    console.log('3. Extractores: Reconocen "Comp", "Comprobante", "Comp. N°"');
    console.log('4. Extractores: Aceptan formatos 00000-00000000 (5-8 dígitos)');

  } catch (error) {
    console.error('❌ Error al actualizar prompts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
updatePrompts()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  });
