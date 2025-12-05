/**
 * Action Executor Service - Axio para Parse
 *
 * Ejecuta las acciones identificadas por el AI Assistant Service.
 * Maneja la creación de reglas, modificación de prompts, consultas, etc.
 */

const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const { generateRuleCode, validateRuleParams } = require('./aiAssistantService');

// Cache de acciones pendientes (en producción usar Redis)
const pendingActions = new Map();

/**
 * Ejecuta una acción identificada por el asistente de IA
 */
async function executeAction(action, parametros, context) {
  const { userId, tenantId } = context;

  console.log(`⚡ [ActionExecutor] Ejecutando: ${action}`);

  try {
    switch (action) {
      case 'crear_regla_tradicional':
      case 'crear_regla_ia':
        return await crearRegla(parametros, tenantId, userId);

      case 'modificar_regla':
        return await modificarRegla(parametros, tenantId, userId);

      case 'afinar_prompt':
        return await afinarPrompt(parametros, tenantId, userId);

      case 'analizar_prompt':
        return await analizarPrompt(parametros, tenantId);

      case 'consultar_reglas':
        return await consultarReglas(parametros, tenantId);

      case 'consultar_prompts':
        return await consultarPrompts(parametros, tenantId);

      case 'probar_regla':
        return await probarRegla(parametros, tenantId);

      case 'ayuda':
        return getAyuda();

      case 'respuesta_texto':
        // Respuesta directa del asistente sin acción específica
        return {
          success: true,
          message: parametros.mensaje || 'Entendido.',
          data: null
        };

      default:
        return {
          success: false,
          message: `Acción no reconocida: ${action}`,
          error: 'UNKNOWN_ACTION'
        };
    }
  } catch (error) {
    console.error(`🔴 [ActionExecutor] Error ejecutando ${action}:`, error);

    // Mensaje amigable para el usuario sin detalles técnicos
    let userMessage = 'Hubo un problema al ejecutar la acción. Por favor, intenta de nuevo.';

    // Mensajes específicos para errores comunes
    if (error.code === 'P2002') {
      userMessage = 'Ya existe un registro con esos datos. Intenta con un código o nombre diferente.';
    } else if (error.code === 'P2025') {
      userMessage = 'No se encontró el registro que intentas modificar.';
    } else if (error.message?.includes('connect')) {
      userMessage = 'Error de conexión con la base de datos. Intenta de nuevo en unos momentos.';
    }

    return {
      success: false,
      message: userMessage,
      error: 'EXECUTION_ERROR'
    };
  }
}

/**
 * Crea una nueva regla de negocio
 */
async function crearRegla(params, tenantId, userId) {
  // Validar parámetros
  const validation = validateRuleParams(params);
  if (!validation.valid) {
    return {
      success: false,
      message: `Error de validación:\n• ${validation.errors.join('\n• ')}`,
      error: 'VALIDATION_ERROR'
    };
  }

  // Generar código si no se proporciona
  const codigo = params.codigo || generateRuleCode(params.nombre);

  // Verificar que el código no exista
  const existente = await prisma.reglas_negocio.findFirst({
    where: {
      codigo,
      OR: [
        { tenantId },
        { esGlobal: true }
      ]
    }
  });

  if (existente) {
    return {
      success: false,
      message: `Ya existe una regla con el código "${codigo}". Usa otro código o modifica la existente.`,
      error: 'DUPLICATE_CODE'
    };
  }

  // Construir configuración
  const configuracion = {
    aplicaA: params.aplicaA || 'TODOS',
    condiciones: params.condiciones,
    acciones: params.acciones,
    logicOperator: params.logicOperator || 'AND',
    stopOnMatch: params.stopOnMatch || false
  };

  // Crear la regla
  const regla = await prisma.reglas_negocio.create({
    data: {
      id: uuidv4(),
      codigo,
      nombre: params.nombre,
      descripcion: params.descripcion || `Regla creada por Axio: ${params.nombre}`,
      tipo: params.tipo || 'TRANSFORMACION',
      activa: true,
      prioridad: params.prioridad || 50,
      version: 1,
      configuracion,
      tenantId,
      esGlobal: false,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: new Date()
    }
  });

  return {
    success: true,
    message: `✅ **Regla creada exitosamente**

**Código:** \`${regla.codigo}\`
**Nombre:** ${regla.nombre}
**Tipo:** ${regla.tipo}
**Prioridad:** ${regla.prioridad}
**Aplica a:** ${configuracion.aplicaA}

La regla está activa y se aplicará en el próximo procesamiento de documentos.`,
    data: {
      id: regla.id,
      codigo: regla.codigo,
      nombre: regla.nombre,
      tipo: regla.tipo
    },
    action: 'regla_creada'
  };
}

/**
 * Modifica una regla existente
 */
async function modificarRegla(params, tenantId, userId) {
  const { codigo, id, cambios } = params;

  // Buscar la regla
  const regla = await prisma.reglas_negocio.findFirst({
    where: {
      OR: [
        { id: id },
        { codigo: codigo }
      ],
      OR: [
        { tenantId },
        { esGlobal: true }
      ]
    }
  });

  if (!regla) {
    return {
      success: false,
      message: `No se encontró la regla con código "${codigo || id}"`,
      error: 'NOT_FOUND'
    };
  }

  // Verificar permisos (no modificar reglas globales si no es admin)
  if (regla.esGlobal) {
    return {
      success: false,
      message: 'No se pueden modificar reglas globales directamente. Crea una regla local que la sobrescriba.',
      error: 'PERMISSION_DENIED'
    };
  }

  // Construir datos de actualización
  const updateData = {
    updatedBy: userId,
    updatedAt: new Date(),
    version: regla.version + 1
  };

  // Actualizar campos simples
  if (cambios.nombre) updateData.nombre = cambios.nombre;
  if (cambios.descripcion) updateData.descripcion = cambios.descripcion;
  if (cambios.prioridad !== undefined) updateData.prioridad = cambios.prioridad;
  if (cambios.activa !== undefined) updateData.activa = cambios.activa;

  // Actualizar configuración
  if (cambios.condiciones || cambios.acciones || cambios.aplicaA) {
    const configActual = regla.configuracion || {};
    updateData.configuracion = {
      ...configActual,
      ...(cambios.condiciones && { condiciones: cambios.condiciones }),
      ...(cambios.acciones && { acciones: cambios.acciones }),
      ...(cambios.aplicaA && { aplicaA: cambios.aplicaA })
    };
  }

  const reglaActualizada = await prisma.reglas_negocio.update({
    where: { id: regla.id },
    data: updateData
  });

  return {
    success: true,
    message: `✅ **Regla modificada exitosamente**

**Código:** \`${reglaActualizada.codigo}\`
**Versión:** ${reglaActualizada.version}

Los cambios se aplicarán en el próximo procesamiento.`,
    data: {
      id: reglaActualizada.id,
      codigo: reglaActualizada.codigo,
      version: reglaActualizada.version
    },
    action: 'regla_modificada'
  };
}

/**
 * Afina/mejora un prompt de extracción
 */
async function afinarPrompt(params, tenantId, userId) {
  const { clave, mejoras, promptAdicional, nuevoPrompt } = params;

  // Buscar el prompt
  const prompt = await prisma.ai_prompts.findFirst({
    where: {
      clave,
      OR: [
        { tenantId },
        { tenantId: null }
      ]
    },
    orderBy: [
      { tenantId: 'desc' }, // Priorizar prompts del tenant
      { version: 'desc' }
    ]
  });

  if (!prompt) {
    return {
      success: false,
      message: `No se encontró el prompt con clave "${clave}"`,
      error: 'NOT_FOUND'
    };
  }

  // Si es prompt global, crear una versión local
  const esGlobal = prompt.tenantId === null;

  let promptActualizado;

  if (esGlobal) {
    // Crear versión local del prompt
    const promptContent = nuevoPrompt || prompt.prompt;
    const systemPromptContent = prompt.systemPrompt || '';
    const userTemplateContent = prompt.userPromptTemplate || '';

    // Agregar mejoras al prompt
    let mejorasText = '';
    if (mejoras && mejoras.length > 0) {
      mejorasText = '\n\nMEJORAS ADICIONALES:\n' + mejoras.map(m => `- ${m}`).join('\n');
    }
    if (promptAdicional) {
      mejorasText += '\n\n' + promptAdicional;
    }

    promptActualizado = await prisma.ai_prompts.create({
      data: {
        id: uuidv4(),
        clave: prompt.clave,
        nombre: `${prompt.nombre} (Personalizado)`,
        descripcion: `Versión personalizada de ${prompt.clave}. ${prompt.descripcion || ''}`,
        prompt: promptContent + mejorasText,
        systemPrompt: systemPromptContent,
        userPromptTemplate: userTemplateContent + mejorasText,
        variables: prompt.variables,
        motor: prompt.motor,
        tipo: prompt.tipo,
        activo: true,
        version: 1,
        tenantId,
        createdBy: userId,
        updatedBy: userId
      }
    });
  } else {
    // Actualizar prompt existente
    let mejorasText = '';
    if (mejoras && mejoras.length > 0) {
      mejorasText = '\n\nMEJORAS ADICIONALES:\n' + mejoras.map(m => `- ${m}`).join('\n');
    }
    if (promptAdicional) {
      mejorasText += '\n\n' + promptAdicional;
    }

    promptActualizado = await prisma.ai_prompts.update({
      where: { id: prompt.id },
      data: {
        prompt: nuevoPrompt || (prompt.prompt + mejorasText),
        userPromptTemplate: prompt.userPromptTemplate
          ? prompt.userPromptTemplate + mejorasText
          : undefined,
        version: prompt.version + 1,
        updatedBy: userId,
        updatedAt: new Date()
      }
    });
  }

  return {
    success: true,
    message: `✅ **Prompt ${esGlobal ? 'personalizado' : 'actualizado'} exitosamente**

**Clave:** \`${promptActualizado.clave}\`
**Versión:** ${promptActualizado.version}
${esGlobal ? '\n_Se creó una versión local que tendrá prioridad sobre el prompt global._' : ''}

${mejoras && mejoras.length > 0 ? `**Mejoras aplicadas:**\n${mejoras.map(m => `• ${m}`).join('\n')}` : ''}

Los cambios se aplicarán en la próxima extracción de documentos.`,
    data: {
      id: promptActualizado.id,
      clave: promptActualizado.clave,
      version: promptActualizado.version,
      esNuevo: esGlobal
    },
    action: 'prompt_afinado'
  };
}

/**
 * Analiza un prompt y sugiere mejoras
 */
async function analizarPrompt(params, tenantId) {
  const { clave } = params;

  const prompt = await prisma.ai_prompts.findFirst({
    where: {
      clave,
      OR: [
        { tenantId },
        { tenantId: null }
      ]
    },
    orderBy: [
      { tenantId: 'desc' },
      { version: 'desc' }
    ]
  });

  if (!prompt) {
    return {
      success: false,
      message: `No se encontró el prompt con clave "${clave}"`,
      error: 'NOT_FOUND'
    };
  }

  // Análisis del prompt
  const analisis = {
    longitud: prompt.prompt?.length || 0,
    tieneSystemPrompt: !!prompt.systemPrompt,
    tieneUserTemplate: !!prompt.userPromptTemplate,
    tieneVariables: !!prompt.variables && Object.keys(prompt.variables).length > 0,
    vecesUsado: prompt.vecesUsado || 0,
    tasaExito: prompt.tasaExito ? parseFloat(prompt.tasaExito) : null,
    motor: prompt.motor || 'no especificado',
    esGlobal: prompt.tenantId === null
  };

  // Generar sugerencias
  const sugerencias = [];

  if (analisis.longitud < 500) {
    sugerencias.push('El prompt es corto. Considera agregar más ejemplos o instrucciones específicas.');
  }

  if (!analisis.tieneSystemPrompt) {
    sugerencias.push('No tiene systemPrompt definido. Agregar uno puede mejorar la consistencia.');
  }

  if (!analisis.tieneVariables) {
    sugerencias.push('No tiene variables definidas. Documenta las variables disponibles para mejor mantenimiento.');
  }

  if (analisis.tasaExito !== null && analisis.tasaExito < 80) {
    sugerencias.push(`La tasa de éxito es ${analisis.tasaExito.toFixed(1)}%. Revisa los casos de error para mejorar.`);
  }

  if (analisis.esGlobal) {
    sugerencias.push('Es un prompt global. Puedes crear una versión personalizada para tu tenant.');
  }

  // Buscar patrones comunes que podrían mejorarse
  const promptText = prompt.prompt || '';
  if (!promptText.toLowerCase().includes('ejemplo')) {
    sugerencias.push('Agregar ejemplos concretos puede mejorar la precisión de extracción.');
  }
  if (!promptText.toLowerCase().includes('json')) {
    sugerencias.push('Especificar el formato de salida JSON esperado puede reducir errores de parsing.');
  }

  return {
    success: true,
    message: `📊 **Análisis del prompt \`${clave}\`**

**Información general:**
• Versión: ${prompt.version}
• Motor: ${analisis.motor}
• Longitud: ${analisis.longitud} caracteres
• Veces usado: ${analisis.vecesUsado}
${analisis.tasaExito !== null ? `• Tasa de éxito: ${analisis.tasaExito.toFixed(1)}%` : ''}
• Tipo: ${analisis.esGlobal ? 'Global' : 'Local'}

**Sugerencias de mejora:**
${sugerencias.length > 0 ? sugerencias.map(s => `• ${s}`).join('\n') : '• El prompt parece estar bien configurado.'}

_Puedes pedirme que aplique alguna de estas mejoras._`,
    data: {
      clave: prompt.clave,
      analisis,
      sugerencias
    },
    action: 'prompt_analizado'
  };
}

/**
 * Consulta reglas existentes
 */
async function consultarReglas(params, tenantId) {
  const { filtros } = params || {};

  const where = {
    OR: [
      { tenantId },
      { esGlobal: true }
    ]
  };

  if (filtros?.tipo) where.tipo = filtros.tipo;
  if (filtros?.activa !== undefined) where.activa = filtros.activa;
  if (filtros?.codigo) where.codigo = { contains: filtros.codigo, mode: 'insensitive' };
  if (filtros?.nombre) where.nombre = { contains: filtros.nombre, mode: 'insensitive' };

  const reglas = await prisma.reglas_negocio.findMany({
    where,
    orderBy: [
      { prioridad: 'asc' },
      { nombre: 'asc' }
    ],
    take: 20,
    select: {
      id: true,
      codigo: true,
      nombre: true,
      tipo: true,
      activa: true,
      prioridad: true,
      esGlobal: true,
      configuracion: true
    }
  });

  if (reglas.length === 0) {
    return {
      success: true,
      message: 'No se encontraron reglas con los filtros especificados.',
      data: { reglas: [] }
    };
  }

  const listaReglas = reglas.map(r => {
    const config = r.configuracion || {};
    return `• \`${r.codigo}\` - ${r.nombre}
  Tipo: ${r.tipo} | Prioridad: ${r.prioridad} | ${r.activa ? '✅ Activa' : '❌ Inactiva'}${r.esGlobal ? ' | 🌐 Global' : ''}
  Aplica a: ${config.aplicaA || 'TODOS'}`;
  }).join('\n\n');

  return {
    success: true,
    message: `📋 **Reglas encontradas (${reglas.length}):**

${listaReglas}

_Puedes pedirme más detalles de una regla específica o modificarla._`,
    data: { reglas }
  };
}

/**
 * Consulta prompts disponibles
 */
async function consultarPrompts(params, tenantId) {
  const { filtros } = params || {};

  const where = {
    OR: [
      { tenantId },
      { tenantId: null }
    ]
  };

  if (filtros?.clave) where.clave = { contains: filtros.clave, mode: 'insensitive' };
  if (filtros?.motor) where.motor = filtros.motor;
  if (filtros?.activo !== undefined) where.activo = filtros.activo;

  const prompts = await prisma.ai_prompts.findMany({
    where,
    orderBy: [
      { clave: 'asc' }
    ],
    take: 20,
    select: {
      id: true,
      clave: true,
      nombre: true,
      motor: true,
      activo: true,
      version: true,
      tenantId: true,
      vecesUsado: true,
      tasaExito: true
    }
  });

  if (prompts.length === 0) {
    return {
      success: true,
      message: 'No se encontraron prompts con los filtros especificados.',
      data: { prompts: [] }
    };
  }

  const listaPrompts = prompts.map(p => {
    const esGlobal = p.tenantId === null;
    const exito = p.tasaExito ? `${parseFloat(p.tasaExito).toFixed(0)}%` : 'N/A';
    return `• \`${p.clave}\` - ${p.nombre}
  Motor: ${p.motor || 'auto'} | v${p.version} | ${p.activo ? '✅' : '❌'}${esGlobal ? ' | 🌐 Global' : ''}
  Usado: ${p.vecesUsado || 0} veces | Éxito: ${exito}`;
  }).join('\n\n');

  return {
    success: true,
    message: `📝 **Prompts disponibles (${prompts.length}):**

${listaPrompts}

_Puedes pedirme analizar o afinar cualquiera de estos prompts._`,
    data: { prompts }
  };
}

/**
 * Prueba una regla con datos de ejemplo
 */
async function probarRegla(params, tenantId) {
  const { codigo, id, datosEjemplo } = params;

  // Buscar la regla
  const regla = await prisma.reglas_negocio.findFirst({
    where: {
      OR: [
        { id },
        { codigo }
      ],
      OR: [
        { tenantId },
        { esGlobal: true }
      ]
    }
  });

  if (!regla) {
    return {
      success: false,
      message: `No se encontró la regla "${codigo || id}"`,
      error: 'NOT_FOUND'
    };
  }

  // Si no hay datos de ejemplo, usar datos genéricos
  const datos = datosEjemplo || {
    descripcion: 'Servicio de hosting mensual',
    cantidad: 1,
    precioUnitario: 5000,
    subtotal: 5000
  };

  // Simular evaluación de condiciones
  const config = regla.configuracion || {};
  const condiciones = config.condiciones || [];
  const acciones = config.acciones || [];

  let cumpleCondiciones = true;
  const resultadosCondiciones = [];

  for (const cond of condiciones) {
    const valor = datos[cond.campo];
    let cumple = false;

    switch (cond.operador) {
      case 'EQUALS':
        cumple = valor === cond.valor;
        break;
      case 'CONTAINS':
        cumple = String(valor || '').toLowerCase().includes(String(cond.valor || '').toLowerCase());
        break;
      case 'IS_NOT_EMPTY':
        cumple = valor !== null && valor !== undefined && valor !== '';
        break;
      case 'IS_EMPTY':
        cumple = valor === null || valor === undefined || valor === '';
        break;
      default:
        cumple = true; // Asumir que pasa si no conocemos el operador
    }

    resultadosCondiciones.push({
      campo: cond.campo,
      operador: cond.operador,
      valorEsperado: cond.valor,
      valorActual: valor,
      cumple
    });

    if (!cumple && (config.logicOperator || 'AND') === 'AND') {
      cumpleCondiciones = false;
    }
    if (cumple && config.logicOperator === 'OR') {
      cumpleCondiciones = true;
      break;
    }
  }

  // Mostrar resultado
  const condicionesTexto = resultadosCondiciones.map(r =>
    `• ${r.campo} ${r.operador} "${r.valorEsperado || ''}" → ${r.cumple ? '✅' : '❌'} (valor: "${r.valorActual || ''}")`
  ).join('\n');

  const accionesTexto = acciones.map(a =>
    `• ${a.operacion}: ${a.campo} ${a.valor ? `= "${a.valor}"` : ''}`
  ).join('\n');

  return {
    success: true,
    message: `🧪 **Prueba de regla \`${regla.codigo}\`**

**Datos de entrada:**
\`\`\`json
${JSON.stringify(datos, null, 2)}
\`\`\`

**Evaluación de condiciones:**
${condicionesTexto}

**Resultado:** ${cumpleCondiciones ? '✅ Las condiciones se cumplen' : '❌ Las condiciones NO se cumplen'}

${cumpleCondiciones ? `**Acciones que se ejecutarían:**
${accionesTexto}` : '_Las acciones no se ejecutarían porque las condiciones no se cumplen._'}`,
    data: {
      regla: regla.codigo,
      cumpleCondiciones,
      resultadosCondiciones
    },
    action: 'regla_probada'
  };
}

/**
 * Muestra ayuda sobre comandos disponibles
 */
function getAyuda() {
  return {
    success: true,
    message: `🤖 **Comandos disponibles de Axio**

**Reglas de Negocio:**
• "Crea una regla para [condición] entonces [acción]"
• "Crea una regla con IA para clasificar [campo]"
• "Modifica la regla [código] para [cambios]"
• "Muéstrame las reglas activas"
• "Prueba la regla [código] con [datos]"

**Prompts de Extracción:**
• "Analiza el prompt [clave]"
• "Mejora el prompt [clave] para que [mejora]"
• "Muéstrame los prompts disponibles"

**Ejemplos:**
• "Crea una regla para que cuando la descripción contenga 'combustible' se asigne la cuenta 5101010101"
• "Crea una regla con IA para clasificar el tipo de producto según la descripción"
• "El prompt de facturas A no extrae bien el CAE, mejóralo"
• "Analiza el prompt EXTRACCION_FACTURA_B"

_Soy flexible con el lenguaje, intenta describir lo que necesitas y te ayudaré._`,
    data: null
  };
}

/**
 * Guarda una acción pendiente de confirmación
 */
function savePendingAction(actionId, action, params, context) {
  pendingActions.set(actionId, {
    action,
    params,
    context,
    timestamp: Date.now()
  });

  // Limpiar acciones antiguas (más de 10 minutos)
  const tenMinutes = 10 * 60 * 1000;
  for (const [key, value] of pendingActions.entries()) {
    if (Date.now() - value.timestamp > tenMinutes) {
      pendingActions.delete(key);
    }
  }
}

/**
 * Obtiene y elimina una acción pendiente
 */
function getPendingAction(actionId) {
  const action = pendingActions.get(actionId);
  if (action) {
    pendingActions.delete(actionId);
  }
  return action;
}

module.exports = {
  executeAction,
  savePendingAction,
  getPendingAction,
  crearRegla,
  modificarRegla,
  afinarPrompt,
  analizarPrompt,
  consultarReglas,
  consultarPrompts,
  probarRegla
};
