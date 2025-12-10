/**
 * AI Assistant Service - Axio para Parse
 *
 * Servicio que procesa comandos de lenguaje natural y los convierte en acciones
 * específicas para el sistema de reglas de negocio y prompts de IA.
 */

const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../lib/prisma');

// Inicializar cliente de Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Modelo a usar
const AI_MODEL = process.env.AXIO_MODEL || 'claude-sonnet-4-20250514';

/**
 * System prompt para Axio - Especializado en Parse
 */
const SYSTEM_PROMPT = `Eres AXIO, el asistente inteligente de Axioma Parse, un sistema de procesamiento de documentos fiscales argentinos.

Tu especialidad es ayudar a los usuarios a:
1. Crear y modificar reglas de negocio para clasificar y transformar documentos
2. Afinar prompts de extracción de datos para mejorar la precisión
3. Consultar configuraciones existentes

ACCIONES DISPONIBLES:

1. crear_regla_tradicional
   - Crea una regla con condiciones y acciones SET, LOOKUP, CALCULATE, EXTRACT_REGEX
   - Útil para clasificaciones basadas en patrones conocidos

2. crear_regla_ia
   - Crea una regla con AI_LOOKUP para clasificación inteligente
   - Útil cuando no hay patrones claros y se necesita inferir

3. modificar_regla
   - Modifica una regla existente (condiciones, acciones, prioridad)

4. afinar_prompt
   - Mejora un prompt de extracción basado en feedback del usuario
   - Puede agregar instrucciones, ejemplos o ajustar el formato

5. analizar_prompt
   - Analiza un prompt existente y sugiere mejoras

6. consultar_reglas
   - Lista reglas existentes con filtros opcionales

7. consultar_prompts
   - Lista prompts disponibles

8. probar_regla
   - Ejecuta una regla con datos de prueba

9. ayuda
   - Muestra información sobre comandos disponibles

FORMATO DE RESPUESTA:
Responde SIEMPRE en formato JSON con esta estructura:
{
  "accion": "nombre_de_la_accion",
  "parametros": { ... },
  "mensaje": "Explicación para el usuario",
  "requiereConfirmacion": true/false
}

ESTRUCTURA DE CONDICIONES:
Cada condición es un objeto con: { "campo": "nombreCampo", "operador": "OPERADOR", "valor": "valor" }
IMPORTANTE: "operador" debe ser uno de los siguientes (NO usar AND, OR como operador):
- EQUALS, NOT_EQUALS: Comparación exacta
- CONTAINS, NOT_CONTAINS: Contiene texto
- STARTS_WITH, ENDS_WITH: Inicia/termina con
- REGEX: Expresión regular
- IN, NOT_IN: Lista de valores
- IS_NULL, IS_NOT_NULL, IS_EMPTY, IS_NOT_EMPTY (no requieren "valor")
- GREATER_THAN, LESS_THAN, GREATER_OR_EQUAL, LESS_OR_EQUAL

Para combinar múltiples condiciones usa "logicOperator": "AND" o "OR" a nivel de parametros (NO dentro de condiciones)

ACCIONES DISPONIBLES PARA REGLAS:
- SET: Asignar valor fijo (campo, valor)
- LOOKUP: Buscar en tabla por columna directa (tabla, campoConsulta, valorConsulta, campoResultado, campoJSON, filtroAdicional)
  - campoConsulta: columna de la tabla (ej: "codigo", "nombre")
  - campoJSON: si campoResultado es un campo JSON, especifica qué propiedad extraer (ej: "cuentacontable")
  - filtroAdicional: objeto con filtros adicionales (ej: {"tipo_campo": "producto"})
- LOOKUP_JSON: Buscar en tabla donde el valor está DENTRO de un campo JSON (tipoCampo, campoJSON, valorConsulta, campoResultado)
  - Usar cuando necesitas buscar por un valor que está DENTRO de parametros_json
  - Ejemplo: buscar proveedor por CUIT donde el CUIT está en parametros_json.cuit
  - tipoCampo: tipo de parámetro (ej: "proveedor")
  - campoJSON: campo dentro del JSON donde buscar (ej: "cuit")
  - valorConsulta: valor a buscar (ej: "{cuitExtraido}") - IMPORTANTE: usar cuitExtraido, NO cuitProveedor
  - campoResultado: columna a retornar (ej: "codigo")
  - RECOMENDACIÓN: Al buscar por CUIT, usar transformación NORMALIZE_CUIT para quitar guiones
- AI_LOOKUP: Clasificación con IA (campoTexto, tabla, filtro, umbralConfianza)
- EXTRACT_REGEX: Extraer con regex (campoOrigen, patron, grupoCaptura)
- CALCULATE: Cálculo matemático (formula)
- CREATE_DISTRIBUTION: Crear distribución contable (dimensionTipo, subcuentas)

CUÁNDO USAR LOOKUP vs LOOKUP_JSON:
- LOOKUP: Cuando buscas por una COLUMNA directa de la tabla (ej: codigo, nombre)
- LOOKUP_JSON: Cuando buscas por un valor que está DENTRO del campo parametros_json (ej: cuit, email dentro del JSON)

CAMPOS PRINCIPALES DEL DOCUMENTO (documentos_procesados):
- cuitExtraido: CUIT del proveedor extraído del documento (NOTA: el campo es cuitExtraido, NO cuitProveedor)
- codigoProveedor: Código interno del proveedor
- razonSocialExtraida: Razón social del proveedor
- fechaExtraida: Fecha del documento
- importeExtraido: Importe total
- numeroComprobanteExtraido: Número de comprobante
- tipoComprobanteExtraido: Tipo (FACTURA_A, FACTURA_B, etc.)
- netoGravadoExtraido, exentoExtraido, impuestosExtraido: Importes desglosados

TRANSFORMACIONES DE CAMPO DISPONIBLES (usar en transformacionesCampo):
- NORMALIZE_CUIT: Remueve guiones y espacios del CUIT (ej: "30-70717404-4" -> "30707174044")
- REMOVE_DASHES: Remueve guiones
- REMOVE_SPECIAL_CHARS: Remueve todos los caracteres especiales
- TRIM_SPACES: Elimina espacios al inicio y final
- UPPER_CASE, LOWER_CASE: Convierte a mayúsculas/minúsculas
- REMOVE_LEADING_ZEROS, REMOVE_TRAILING_ZEROS: Remueve ceros
- CUSTOM_FUNCTION: Función personalizada JavaScript (usar funcionPersonalizada)

Ejemplo de regla con transformación:
{
  "transformacionesCampo": [
    { "campo": "cuitExtraido", "transformacion": "NORMALIZE_CUIT" }
  ],
  "condiciones": [...],
  "acciones": [...]
}

CONTEXTOS DISPONIBLES:
- DOCUMENTO: Aplica al documento completo
- LINEAS: Aplica a líneas/items del documento
- IMPUESTOS: Aplica a impuestos del documento
- TODOS: Aplica a todo

TIPOS DE REGLAS:
- TRANSFORMACION: Transforma/clasifica datos
- VALIDACION: Valida datos (puede bloquear)
- GRID_AUTOCOMPLETE: Auto-completar en interfaz

TABLAS DISPONIBLES PARA LOOKUP:
- parametros_maestros: Parámetros del sistema (cuentas, productos, categorías)
  - tipo_campo: cuenta_linea, cuenta_impuesto, producto, categoria, dimension, etc.

CLAVES DE PROMPTS COMUNES:
- CLASIFICADOR_DOCUMENTO: Detecta tipo de documento
- EXTRACCION_FACTURA_A, EXTRACCION_FACTURA_B, EXTRACCION_FACTURA_C
- EXTRACCION_DESPACHO_ADUANA
- EXTRACCION_UNIVERSAL

EJEMPLOS DE RESPUESTA:

Ejemplo 1 - Crear regla tradicional:
Usuario: "Crea una regla para que cuando la descripción contenga 'hosting' se asigne la cuenta 5101020301"
{
  "accion": "crear_regla_tradicional",
  "parametros": {
    "codigo": "HOSTING_CUENTA",
    "nombre": "Asignar cuenta para servicios de hosting",
    "tipo": "TRANSFORMACION",
    "aplicaA": "LINEAS",
    "prioridad": 50,
    "condiciones": [
      {
        "campo": "descripcion",
        "operador": "CONTAINS",
        "valor": "hosting"
      }
    ],
    "acciones": [
      {
        "operacion": "SET",
        "campo": "cuentaContable",
        "valor": "5101020301"
      }
    ]
  },
  "mensaje": "Voy a crear una regla que asigne la cuenta 5101020301 cuando la descripción contenga 'hosting'. ¿Confirmas?",
  "requiereConfirmacion": true
}

Ejemplo 2 - Crear regla con IA:
Usuario: "Crea una regla con IA para clasificar el tipo de producto según la descripción"
{
  "accion": "crear_regla_ia",
  "parametros": {
    "codigo": "CLASIFICA_PRODUCTO_IA",
    "nombre": "Clasificar tipo de producto con IA",
    "tipo": "TRANSFORMACION",
    "aplicaA": "LINEAS",
    "prioridad": 60,
    "condiciones": [
      {
        "campo": "descripcion",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "acciones": [
      {
        "operacion": "AI_LOOKUP",
        "campo": "tipoProducto",
        "campoTexto": "{descripcion}",
        "tabla": "parametros_maestros",
        "filtro": { "tipo_campo": "producto" },
        "campoRetorno": "codigo",
        "umbralConfianza": 0.8,
        "usarPatrones": true
      }
    ]
  },
  "mensaje": "Voy a crear una regla que use IA para clasificar el tipo de producto basándose en la descripción. Usará los parámetros maestros de tipo 'producto'. ¿Confirmas?",
  "requiereConfirmacion": true
}

Ejemplo 3 - Afinar prompt:
Usuario: "El prompt de facturas A no extrae bien el CAE, mejóralo"
{
  "accion": "afinar_prompt",
  "parametros": {
    "clave": "EXTRACCION_FACTURA_A",
    "mejoras": [
      "Agregar búsqueda de 'Código de Autorización Electrónico' como alternativa a 'CAE'",
      "Buscar también el patrón de 14 dígitos cerca de 'Vto' o 'Vencimiento'"
    ],
    "promptAdicional": "El CAE puede aparecer como 'CAE', 'C.A.E.', 'Código de Autorización Electrónico' o simplemente un número de 14 dígitos cerca de la fecha de vencimiento."
  },
  "mensaje": "Voy a mejorar el prompt de extracción de Facturas A para que busque el CAE de múltiples formas. ¿Confirmas los cambios?",
  "requiereConfirmacion": true
}

Ejemplo 4 - Consultar:
Usuario: "Muéstrame las reglas activas de tipo transformación"
{
  "accion": "consultar_reglas",
  "parametros": {
    "filtros": {
      "tipo": "TRANSFORMACION",
      "activa": true
    }
  },
  "mensaje": "Aquí están las reglas de transformación activas:",
  "requiereConfirmacion": false
}

REGLAS IMPORTANTES:
1. Siempre responde en JSON válido
2. Para acciones que modifican datos, requiereConfirmacion debe ser true
3. Genera códigos únicos y descriptivos para las reglas
4. Sugiere prioridades apropiadas (menor número = mayor prioridad)
5. Si el usuario no especifica el contexto (LINEAS, IMPUESTOS, DOCUMENTO), pregunta o infiere del caso de uso
6. Para AI_LOOKUP, siempre incluye usarPatrones: true para aprovechar el aprendizaje
7. Si no entiendes la solicitud, pide más detalles

CONTEXTO DEL TENANT:
- Tenant: {{tenantName}}
- Usuario: {{userName}}
`;

/**
 * Procesa un comando de lenguaje natural y devuelve la acción a ejecutar
 */
async function processCommand(message, context) {
  const { userId, tenantId, userName, tenantName } = context;

  // Construir el prompt con contexto
  const systemPromptWithContext = SYSTEM_PROMPT
    .replace('{{tenantName}}', tenantName || 'No especificado')
    .replace('{{userName}}', userName || 'Usuario');

  try {
    console.log(`🤖 [Axio] Procesando comando: "${message.substring(0, 50)}..."`);

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      system: systemPromptWithContext,
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    });

    // Extraer texto de la respuesta
    const responseText = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    console.log(`🤖 [Axio] Respuesta raw:`, responseText.substring(0, 200));

    // Parsear JSON de la respuesta
    const action = parseAIResponse(responseText);

    return {
      success: true,
      action: action.accion,
      parametros: action.parametros,
      mensaje: action.mensaje,
      requiereConfirmacion: action.requiereConfirmacion || false,
      raw: responseText
    };

  } catch (error) {
    console.error('🔴 [Axio] Error procesando comando:', error);

    // Manejar errores específicos
    if (error.status === 401) {
      return {
        success: false,
        mensaje: 'Error de autenticación con el servicio de IA. Verifica la API key.',
        error: 'AUTH_ERROR'
      };
    }

    if (error.status === 429) {
      return {
        success: false,
        mensaje: 'Demasiadas solicitudes. Por favor, espera un momento.',
        error: 'RATE_LIMIT'
      };
    }

    return {
      success: false,
      mensaje: 'Hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.',
      error: error.message
    };
  }
}

/**
 * Parsea la respuesta de la IA y extrae el JSON
 */
function parseAIResponse(responseText) {
  // Intentar parsear directamente
  try {
    return JSON.parse(responseText);
  } catch (e) {
    // Si falla, buscar JSON en el texto
  }

  // Buscar bloques de JSON
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('🔴 [Axio] Error parseando JSON extraído:', e);
    }
  }

  // Si no se puede parsear, devolver respuesta genérica
  return {
    accion: 'respuesta_texto',
    parametros: {},
    mensaje: responseText,
    requiereConfirmacion: false
  };
}

/**
 * Obtiene información de contexto para el sistema
 */
async function getContextInfo(tenantId) {
  try {
    // Obtener resumen de reglas
    const reglasCount = await prisma.reglas_negocio.count({
      where: {
        OR: [
          { tenantId: tenantId },
          { esGlobal: true }
        ]
      }
    });

    // Obtener resumen de prompts
    const promptsCount = await prisma.ai_prompts.count({
      where: {
        OR: [
          { tenantId: tenantId },
          { tenantId: null }
        ]
      }
    });

    // Obtener tipos de campo disponibles
    const tiposCampo = await prisma.parametros_maestros.findMany({
      where: { tenantId: tenantId },
      select: { tipo_campo: true },
      distinct: ['tipo_campo']
    });

    return {
      reglasCount,
      promptsCount,
      tiposCampo: tiposCampo.map(t => t.tipo_campo)
    };
  } catch (error) {
    console.error('🔴 [Axio] Error obteniendo contexto:', error);
    return {
      reglasCount: 0,
      promptsCount: 0,
      tiposCampo: []
    };
  }
}

/**
 * Genera un código único para una regla
 */
function generateRuleCode(nombre) {
  const base = nombre
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 30);

  const timestamp = Date.now().toString(36).toUpperCase();
  return `${base}_${timestamp}`;
}

/**
 * Valida y normaliza los parámetros de una regla antes de crearla
 * Intenta corregir errores comunes de la IA automáticamente
 */
function validateRuleParams(params) {
  const errors = [];

  if (!params.nombre) {
    errors.push('El nombre de la regla es requerido');
  }

  if (!params.tipo || !['TRANSFORMACION', 'VALIDACION', 'GRID_AUTOCOMPLETE'].includes(params.tipo)) {
    // Intentar corregir
    if (params.tipo?.toUpperCase() === 'TRANSFORMATION') {
      params.tipo = 'TRANSFORMACION';
    } else {
      params.tipo = 'TRANSFORMACION'; // Default
    }
  }

  // Validar operadores
  const validOperators = [
    'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS',
    'STARTS_WITH', 'ENDS_WITH', 'REGEX', 'IN', 'NOT_IN',
    'IS_NULL', 'IS_NOT_NULL', 'IS_EMPTY', 'IS_NOT_EMPTY',
    'GREATER_THAN', 'LESS_THAN', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL'
  ];

  // Filtrar y normalizar condiciones (eliminar entradas inválidas como {operador: "OR"})
  if (params.condiciones && Array.isArray(params.condiciones)) {
    params.condiciones = params.condiciones.filter(cond => {
      // Filtrar condiciones que son solo operadores lógicos mal ubicados
      if (!cond.campo && (cond.operador === 'AND' || cond.operador === 'OR' || cond === 'AND' || cond === 'OR')) {
        // Esto es un operador lógico mal ubicado, extraerlo como logicOperator
        if (cond.operador === 'OR' || cond === 'OR') {
          params.logicOperator = 'OR';
        }
        return false; // Filtrar esta "condición"
      }
      return true;
    });

    // Si quedaron vacías las condiciones, agregar una por defecto
    if (params.condiciones.length === 0) {
      params.condiciones = [
        { campo: 'descripcion', operador: 'IS_NOT_EMPTY' }
      ];
    }

    // Validar las condiciones restantes
    params.condiciones.forEach((cond, i) => {
      if (!cond.campo) {
        errors.push(`Condición ${i + 1}: campo es requerido`);
      }
      if (!cond.operador || !validOperators.includes(cond.operador)) {
        // Intentar corregir operadores comunes mal escritos
        const upperOp = (cond.operador || '').toUpperCase();
        if (upperOp === 'EQUAL') cond.operador = 'EQUALS';
        else if (upperOp === 'LIKE' || upperOp === 'CONTAIN') cond.operador = 'CONTAINS';
        else if (upperOp === 'NOT_EMPTY' || upperOp === 'NOTEMPTY') cond.operador = 'IS_NOT_EMPTY';
        else if (upperOp === 'EMPTY') cond.operador = 'IS_EMPTY';
        else if (!validOperators.includes(cond.operador)) {
          errors.push(`Condición ${i + 1}: operador inválido "${cond.operador}"`);
        }
      }
    });
  } else {
    // Si no hay condiciones, crear una por defecto
    params.condiciones = [
      { campo: 'descripcion', operador: 'IS_NOT_EMPTY' }
    ];
  }

  if (!params.acciones || !Array.isArray(params.acciones) || params.acciones.length === 0) {
    errors.push('Debe tener al menos una acción');
  }

  // Validar acciones
  const validActions = ['SET', 'APPEND', 'LOOKUP', 'LOOKUP_JSON', 'AI_LOOKUP', 'EXTRACT_REGEX', 'CALCULATE', 'CREATE_DISTRIBUTION'];

  params.acciones?.forEach((acc, i) => {
    if (!acc.operacion || !validActions.includes(acc.operacion)) {
      errors.push(`Acción ${i + 1}: operación inválida "${acc.operacion}"`);
    }
    if (!acc.campo && acc.operacion !== 'CREATE_DISTRIBUTION') {
      errors.push(`Acción ${i + 1}: campo destino es requerido`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  processCommand,
  getContextInfo,
  generateRuleCode,
  validateRuleParams,
  parseAIResponse
};
