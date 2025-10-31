/**
 * AI Rule Generator Service
 *
 * Genera reglas de negocio desde lenguaje natural usando Claude
 */

const Anthropic = require('@anthropic-ai/sdk');
const aiConfigService = require('./aiConfigService');

class AIRuleGenerator {

  /**
   * Genera una regla de negocio desde texto en lenguaje natural
   *
   * @param {string} userText - Descripción de la regla en lenguaje natural
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Object>} Regla generada en formato JSON
   */
  async generateRuleFromText(userText, tenantId) {
    try {
      console.log('🤖 Generando regla de negocio con IA...');
      console.log(`📝 Input del usuario: ${userText.substring(0, 200)}...`);

      // Obtener configuración de Anthropic
      const config = await aiConfigService.getProviderConfig('anthropic', tenantId);

      const anthropic = new Anthropic({
        apiKey: config.apiKey,
      });

      // Prompt especializado para generar reglas
      const prompt = this.buildRuleGenerationPrompt(userText);

      console.log('⏳ Llamando a Claude...');
      const startTime = Date.now();

      const response = await anthropic.messages.create({
        model: config.modelo,
        max_tokens: 2048,
        temperature: 0.1, // Baja temperatura para respuestas consistentes
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Respuesta de Claude recibida en ${duration}s`);

      // Extraer JSON de la respuesta
      let jsonText = response.content[0].text;

      // Limpiar markdown si existe
      jsonText = jsonText
        .replace(/```json\n?/g, '')
        .replace(/\n?```/g, '')
        .trim();

      const rule = JSON.parse(jsonText);

      // Validar estructura de la regla
      this.validateRuleStructure(rule);

      console.log('✅ Regla generada y validada correctamente');
      console.log('📋 Nombre de la regla:', rule.nombre);

      return {
        success: true,
        rule,
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTime: duration,
          userInput: userText
        }
      };

    } catch (error) {
      console.error('❌ Error generando regla:', error.message);
      return {
        success: false,
        error: error.message,
        rule: null
      };
    }
  }

  /**
   * Construye el prompt para que Claude genere la regla
   */
  buildRuleGenerationPrompt(userText) {
    return `Eres un experto en generar reglas de negocio para un sistema de procesamiento de documentos fiscales argentinos.

El usuario te describirá en lenguaje natural qué regla de negocio quiere aplicar. Tu tarea es convertirla en una estructura JSON ejecutable.

## ESTRUCTURA DE REGLAS

Una regla tiene este formato:

\`\`\`json
{
  "nombre": "Nombre descriptivo de la regla",
  "descripcion": "Explicación detallada de qué hace",
  "activa": true,
  "prioridad": 1,
  "condiciones": {
    "tipo": "AND" | "OR",
    "reglas": [
      {
        "campo": "nombreCampo",
        "operador": "igual" | "contiene" | "mayor" | "menor" | "entre" | "inicia_con" | "termina_con",
        "valor": "valor a comparar"
      }
    ]
  },
  "acciones": [
    {
      "tipo": "transformar" | "calcular" | "validar" | "categorizar" | "lookup",
      "campo": "campoObjetivo",
      "valor": "nuevoValor",
      "formula": "expresion matematica (si es calcular)"
    }
  ]
}
\`\`\`

## CAMPOS DISPONIBLES

Estos son los campos que puedes usar en condiciones:

- **razonSocial**: Razón social del emisor
- **cuit**: CUIT del emisor
- **tipoComprobante**: FACTURA A, FACTURA B, FACTURA C, NOTA DE CREDITO, etc.
- **fecha**: Fecha del comprobante
- **importe**: Importe total
- **netoGravado**: Neto gravado (antes de IVA)
- **impuestos**: Total de impuestos
- **numeroComprobante**: Número del comprobante
- **categoria**: Categoría del gasto
- **lineItems[].descripcion**: Descripción de items (puedes buscar palabras clave)

## OPERADORES DISPONIBLES

- **igual**: El campo es exactamente igual al valor
- **contiene**: El campo contiene el valor (busca substring)
- **mayor**: Campo numérico mayor que valor
- **menor**: Campo numérico menor que valor
- **entre**: Campo numérico entre dos valores [min, max]
- **inicia_con**: Campo comienza con el valor
- **termina_con**: Campo termina con el valor
- **existe**: El campo tiene algún valor (no es null)

## TIPOS DE ACCIONES

1. **transformar**: Cambiar el valor de un campo
   \`\`\`json
   {
     "tipo": "transformar",
     "campo": "categoria",
     "valor": "TRANSPORTE"
   }
   \`\`\`

2. **calcular**: Aplicar fórmula matemática
   \`\`\`json
   {
     "tipo": "calcular",
     "campo": "importe",
     "formula": "importe * 1.15"
   }
   \`\`\`

3. **categorizar**: Asignar categoría automática
   \`\`\`json
   {
     "tipo": "categorizar",
     "campo": "categoria",
     "valor": "SERVICIOS"
   }
   \`\`\`

4. **lookup**: Buscar valor en tabla de mapeo
   \`\`\`json
   {
     "tipo": "lookup",
     "campo": "centroCosto",
     "tabla": "LOOKUP_CENTROS",
     "clave": "razonSocial",
     "valorDefecto": "GENERAL"
   }
   \`\`\`

5. **validar**: Marcar para revisión manual
   \`\`\`json
   {
     "tipo": "validar",
     "campo": "requiereRevision",
     "valor": true,
     "motivo": "Importe supera límite"
   }
   \`\`\`

## EJEMPLOS

### Ejemplo 1: Categorización por palabras clave

**Usuario dice:**
"Todas las facturas que tengan la palabra 'transporte' o 'taxi' en la descripción, categorizarlas como MOVILIDAD"

**Tu respuesta:**
\`\`\`json
{
  "nombre": "Categorizar gastos de transporte",
  "descripcion": "Asigna categoría MOVILIDAD a facturas con palabras clave de transporte",
  "activa": true,
  "prioridad": 10,
  "condiciones": {
    "tipo": "OR",
    "reglas": [
      {
        "campo": "lineItems[].descripcion",
        "operador": "contiene",
        "valor": "transporte"
      },
      {
        "campo": "lineItems[].descripcion",
        "operador": "contiene",
        "valor": "taxi"
      },
      {
        "campo": "lineItems[].descripcion",
        "operador": "contiene",
        "valor": "uber"
      }
    ]
  },
  "acciones": [
    {
      "tipo": "categorizar",
      "campo": "categoria",
      "valor": "MOVILIDAD"
    }
  ]
}
\`\`\`

### Ejemplo 2: Aplicar descuento

**Usuario dice:**
"Si el importe es mayor a $100,000, aplicar un descuento del 10%"

**Tu respuesta:**
\`\`\`json
{
  "nombre": "Descuento por monto alto",
  "descripcion": "Aplica 10% de descuento a facturas mayores a $100,000",
  "activa": true,
  "prioridad": 5,
  "condiciones": {
    "tipo": "AND",
    "reglas": [
      {
        "campo": "importe",
        "operador": "mayor",
        "valor": 100000
      }
    ]
  },
  "acciones": [
    {
      "tipo": "calcular",
      "campo": "importe",
      "formula": "importe * 0.90"
    },
    {
      "tipo": "transformar",
      "campo": "observaciones",
      "valor": "Descuento 10% aplicado por monto alto"
    }
  ]
}
\`\`\`

### Ejemplo 3: Asignación por proveedor

**Usuario dice:**
"Todas las facturas de ACME S.A. deben ir al centro de costos 'IT-001'"

**Tu respuesta:**
\`\`\`json
{
  "nombre": "Centro de costos ACME",
  "descripcion": "Asigna centro de costos IT-001 a facturas de ACME S.A.",
  "activa": true,
  "prioridad": 20,
  "condiciones": {
    "tipo": "AND",
    "reglas": [
      {
        "campo": "razonSocial",
        "operador": "contiene",
        "valor": "ACME"
      }
    ]
  },
  "acciones": [
    {
      "tipo": "transformar",
      "campo": "centroCosto",
      "valor": "IT-001"
    }
  ]
}
\`\`\`

## INSTRUCCIONES

1. Lee cuidadosamente lo que el usuario quiere
2. Identifica las **condiciones** (cuándo se aplica la regla)
3. Identifica las **acciones** (qué hace la regla)
4. Genera el JSON con estructura válida
5. Asigna un nombre descriptivo
6. Asigna prioridad (1-100, mayor = más importante)
7. Responde SOLO con el JSON, sin texto adicional

## REGLAS DE SEGURIDAD

⚠️ **IMPORTANTE:**
- NO permitas código malicioso en fórmulas
- Solo usa operadores matemáticos básicos: +, -, *, /, ()
- NO permitas: eval, function, new, require, import
- Las fórmulas deben referenciar solo campos válidos
- Si detectas algo sospechoso, devuelve error

---

**Texto del usuario:**
${userText}

Genera la regla en formato JSON:`;
  }

  /**
   * Valida que la regla tenga la estructura correcta
   */
  validateRuleStructure(rule) {
    // Campos obligatorios
    if (!rule.nombre) {
      throw new Error('La regla debe tener un nombre');
    }

    if (!rule.condiciones || !rule.condiciones.reglas) {
      throw new Error('La regla debe tener condiciones');
    }

    if (!rule.acciones || !Array.isArray(rule.acciones) || rule.acciones.length === 0) {
      throw new Error('La regla debe tener al menos una acción');
    }

    // Validar operadores permitidos
    const operadoresValidos = ['igual', 'contiene', 'mayor', 'menor', 'entre', 'inicia_con', 'termina_con', 'existe'];

    rule.condiciones.reglas.forEach((condicion, index) => {
      if (!operadoresValidos.includes(condicion.operador)) {
        throw new Error(`Operador no válido en condición ${index + 1}: ${condicion.operador}`);
      }
    });

    // Validar tipos de acciones permitidas
    const accionesValidas = ['transformar', 'calcular', 'validar', 'categorizar', 'lookup'];

    rule.acciones.forEach((accion, index) => {
      if (!accionesValidas.includes(accion.tipo)) {
        throw new Error(`Tipo de acción no válida en acción ${index + 1}: ${accion.tipo}`);
      }

      // Si es cálculo, validar fórmula
      if (accion.tipo === 'calcular' && accion.formula) {
        this.validateFormula(accion.formula);
      }
    });

    return true;
  }

  /**
   * Valida que una fórmula sea segura (no contenga código malicioso)
   */
  validateFormula(formula) {
    // Lista negra de palabras peligrosas
    const blacklist = [
      'eval', 'function', 'Function', 'constructor',
      'require', 'import', 'export', 'module',
      'process', 'global', '__dirname', '__filename',
      'exec', 'spawn', 'child_process'
    ];

    const formulaLower = formula.toLowerCase();

    for (const palabra of blacklist) {
      if (formulaLower.includes(palabra.toLowerCase())) {
        throw new Error(`Fórmula contiene palabra no permitida: ${palabra}`);
      }
    }

    // Solo permitir caracteres seguros
    const regex = /^[a-zA-Z0-9_+\-*/(). ]+$/;
    if (!regex.test(formula)) {
      throw new Error('La fórmula contiene caracteres no permitidos');
    }

    return true;
  }

  /**
   * Prueba una regla contra un documento de ejemplo
   *
   * @param {Object} rule - Regla a probar
   * @param {Object} documento - Documento de prueba
   * @returns {Promise<Object>} Resultado de aplicar la regla
   */
  async testRule(rule, documento) {
    try {
      console.log('🧪 Probando regla contra documento...');

      // Clonar documento para no modificar el original
      const documentoClonado = JSON.parse(JSON.stringify(documento));
      const documentoOriginal = JSON.parse(JSON.stringify(documento));

      // Importar el motor de reglas
      const businessRulesEngine = require('./businessRulesEngine');

      // Evaluar condiciones
      const cumpleCondiciones = this.evaluateConditions(rule.condiciones, documentoClonado);

      let resultado = {
        cumpleCondiciones,
        cambios: [],
        documentoAntes: documentoOriginal,
        documentoDespues: documentoClonado
      };

      if (cumpleCondiciones) {
        // Aplicar acciones
        for (const accion of rule.acciones) {
          const cambio = await this.applyAction(accion, documentoClonado);
          resultado.cambios.push(cambio);
        }
      }

      console.log(`✅ Prueba completada: ${cumpleCondiciones ? 'Regla aplicada' : 'Regla no aplicada'}`);
      console.log(`📊 Cambios realizados: ${resultado.cambios.length}`);

      return {
        success: true,
        resultado
      };

    } catch (error) {
      console.error('❌ Error probando regla:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Evalúa si un documento cumple las condiciones
   */
  evaluateConditions(condiciones, documento) {
    const { tipo, reglas } = condiciones;

    const resultados = reglas.map(regla => {
      const valorCampo = this.getFieldValue(documento, regla.campo);
      return this.evaluateCondition(valorCampo, regla.operador, regla.valor);
    });

    if (tipo === 'AND') {
      return resultados.every(r => r === true);
    } else if (tipo === 'OR') {
      return resultados.some(r => r === true);
    }

    return false;
  }

  /**
   * Obtiene el valor de un campo (soporta notación de punto y arrays)
   */
  getFieldValue(obj, path) {
    // Soportar arrays: lineItems[].descripcion
    if (path.includes('[]')) {
      const [arrayField, prop] = path.split('[].');
      const array = obj[arrayField];
      if (Array.isArray(array)) {
        return array.map(item => item[prop]).join(' ');
      }
      return null;
    }

    // Notación de punto normal
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  /**
   * Evalúa una condición individual
   */
  evaluateCondition(valorCampo, operador, valorEsperado) {
    if (valorCampo === null || valorCampo === undefined) {
      return operador === 'existe' ? false : false;
    }

    switch (operador) {
      case 'igual':
        return String(valorCampo).toLowerCase() === String(valorEsperado).toLowerCase();

      case 'contiene':
        return String(valorCampo).toLowerCase().includes(String(valorEsperado).toLowerCase());

      case 'mayor':
        return Number(valorCampo) > Number(valorEsperado);

      case 'menor':
        return Number(valorCampo) < Number(valorEsperado);

      case 'entre':
        const [min, max] = valorEsperado;
        const num = Number(valorCampo);
        return num >= min && num <= max;

      case 'inicia_con':
        return String(valorCampo).toLowerCase().startsWith(String(valorEsperado).toLowerCase());

      case 'termina_con':
        return String(valorCampo).toLowerCase().endsWith(String(valorEsperado).toLowerCase());

      case 'existe':
        return valorCampo !== null && valorCampo !== undefined;

      default:
        return false;
    }
  }

  /**
   * Aplica una acción a un documento
   */
  async applyAction(accion, documento) {
    const cambio = {
      tipo: accion.tipo,
      campo: accion.campo,
      valorAnterior: this.getFieldValue(documento, accion.campo)
    };

    switch (accion.tipo) {
      case 'transformar':
      case 'categorizar':
        this.setFieldValue(documento, accion.campo, accion.valor);
        cambio.valorNuevo = accion.valor;
        break;

      case 'calcular':
        const valorActual = this.getFieldValue(documento, accion.campo);
        const valorNuevo = this.evaluateFormula(accion.formula, documento);
        this.setFieldValue(documento, accion.campo, valorNuevo);
        cambio.valorNuevo = valorNuevo;
        cambio.formula = accion.formula;
        break;

      case 'validar':
        this.setFieldValue(documento, accion.campo, accion.valor);
        cambio.valorNuevo = accion.valor;
        cambio.motivo = accion.motivo;
        break;
    }

    return cambio;
  }

  /**
   * Establece el valor de un campo (soporta notación de punto)
   */
  setFieldValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((acc, key) => {
      if (!acc[key]) acc[key] = {};
      return acc[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Evalúa una fórmula matemática de forma segura
   */
  evaluateFormula(formula, documento) {
    // Reemplazar referencias a campos con sus valores
    let formulaEvaluable = formula;

    // Buscar todos los campos referenciados (palabras que no son operadores)
    const campos = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];

    for (const campo of campos) {
      const valor = this.getFieldValue(documento, campo);
      if (valor !== null && valor !== undefined) {
        formulaEvaluable = formulaEvaluable.replace(new RegExp(`\\b${campo}\\b`, 'g'), valor);
      }
    }

    // Evaluar de forma segura (solo matemática básica)
    try {
      // Usar Function constructor de forma controlada
      const func = new Function(`return ${formulaEvaluable}`);
      return func();
    } catch (error) {
      console.error('Error evaluando fórmula:', error.message);
      throw new Error(`Fórmula inválida: ${formula}`);
    }
  }
}

module.exports = new AIRuleGenerator();
