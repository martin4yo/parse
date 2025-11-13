/**
 * Servicio de Clasificación con IA
 *
 * Usa IA para encontrar la mejor coincidencia de un texto
 * contra una lista de opciones de parametros_maestros
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const prisma = require('../lib/prisma');

class AIClassificationService {

  /**
   * Clasifica un texto contra opciones de parametros_maestros
   *
   * @param {Object} params
   * @param {string} params.texto - Texto a analizar
   * @param {Array} params.opciones - Array de opciones de parametros_maestros
   * @param {string} params.campoRetorno - Campo a retornar (codigo, nombre, parametros_json.campo)
   * @param {string} params.instruccionesAdicionales - Instrucciones opcionales para la IA
   * @param {string} params.aiProvider - Proveedor de IA (gemini, openai, anthropic)
   * @param {string} params.aiModel - Modelo específico a usar
   * @param {boolean} params.usarPrefiltro - Si debe aplicar pre-filtro de texto (default: true si >100 opciones)
   * @param {number} params.maxCandidatos - Máximo de candidatos después del pre-filtro (default: 50)
   * @returns {Promise<Object>} {opcionElegida, valorRetorno, confianza, razon}
   */
  async clasificar({ texto, opciones, campoRetorno, instruccionesAdicionales = '', aiProvider = null, aiModel = null, usarPrefiltro = null, maxCandidatos = 50 }) {
    try {
      // Defaults desde variables de entorno
      const provider = aiProvider || process.env.AI_LOOKUP_PROVIDER || 'gemini';
      const model = aiModel || process.env.AI_LOOKUP_MODEL || 'gemini-1.5-flash';

      console.log('🤖 [AI Classification] Iniciando clasificación...');
      console.log(`   Provider: ${provider}`);
      console.log(`   Model: ${model}`);
      console.log(`   Texto: "${texto}"`);
      console.log(`   Opciones iniciales: ${opciones.length}`);
      console.log(`   Campo retorno: ${campoRetorno}`);

      if (!texto || texto.trim() === '') {
        throw new Error('El texto a analizar no puede estar vacío');
      }

      if (!opciones || opciones.length === 0) {
        throw new Error('No hay opciones disponibles para clasificar');
      }

      // Decidir si usar pre-filtro
      // Modo automático: activar si hay más opciones que el límite de candidatos
      const debeUsarPrefiltro = usarPrefiltro !== null
        ? usarPrefiltro
        : opciones.length > maxCandidatos;

      let opcionesParaIA = opciones;

      // Aplicar pre-filtro si está activado y hay más opciones que el límite
      if (debeUsarPrefiltro && opciones.length > maxCandidatos) {
        console.log(`🔍 [Pre-filtro] Activado (${opciones.length} opciones, límite: ${maxCandidatos})`);
        opcionesParaIA = this.prefiltrarOpciones(texto, opciones, maxCandidatos);
        console.log(`✅ [Pre-filtro] Reducido a ${opcionesParaIA.length} candidatos`);
      } else if (usarPrefiltro === false) {
        console.log(`⚠️  [Pre-filtro] Desactivado manualmente (${opciones.length} opciones)`);
      } else {
        console.log(`ℹ️  [Pre-filtro] No necesario (${opciones.length} opciones ≤ ${maxCandidatos})`);
      }

      // Construir el prompt
      const prompt = this.construirPrompt(texto, opcionesParaIA, instruccionesAdicionales);

      // Llamar a la IA según el proveedor
      const resultado = await this.llamarIA(prompt, provider, model);

      // Validar y extraer el resultado (de las opciones filtradas)
      const opcionSeleccionada = opcionesParaIA[resultado.opcionElegida - 1];

      if (!opcionSeleccionada) {
        throw new Error(`Opción ${resultado.opcionElegida} no válida`);
      }

      // Extraer el valor del campo solicitado
      const valorRetorno = this.extraerCampo(opcionSeleccionada, campoRetorno);

      console.log('✅ [AI Classification] Clasificación exitosa');
      console.log(`   Opción: ${opcionSeleccionada.nombre || opcionSeleccionada.codigo}`);
      console.log(`   Valor: ${valorRetorno}`);
      console.log(`   Confianza: ${resultado.confianza}`);

      return {
        opcionElegida: opcionSeleccionada,
        valorRetorno: valorRetorno,
        confianza: resultado.confianza,
        razon: resultado.razon
      };

    } catch (error) {
      console.error('❌ [AI Classification] Error:', error.message);
      throw error;
    }
  }

  /**
   * Construye el prompt para la IA
   */
  construirPrompt(texto, opciones, instruccionesAdicionales) {
    const opcionesFormateadas = opciones.map((opt, index) => {
      const campos = [];
      if (opt.codigo) campos.push(`Código: ${opt.codigo}`);
      if (opt.nombre) campos.push(`Nombre: ${opt.nombre}`);
      if (opt.descripcion) campos.push(`Descripción: ${opt.descripcion}`);
      if (opt.parametros_json) {
        campos.push(`Metadata: ${JSON.stringify(opt.parametros_json)}`);
      }

      return `${index + 1}. ${campos.join(', ')}`;
    }).join('\n');

    return `
Eres un experto en clasificación de datos comerciales y financieros. Tu tarea es encontrar la mejor coincidencia entre un texto y una lista de opciones predefinidas.

TEXTO A ANALIZAR:
"${texto}"

OPCIONES DISPONIBLES:
${opcionesFormateadas}

${instruccionesAdicionales ? `INSTRUCCIONES ESPECÍFICAS:\n${instruccionesAdicionales}\n\n` : ''}METODOLOGÍA DE CLASIFICACIÓN:
1. Analiza las palabras clave principales del texto
2. Identifica el tipo, categoría o naturaleza del elemento descrito
3. Busca coincidencias por:
   - Similitud semántica (significado similar aunque distintas palabras)
   - Palabras clave compartidas
   - Tipo o categoría del producto/servicio
   - Características técnicas o descriptivas
4. Prioriza coincidencias específicas sobre genéricas
5. Si hay múltiples coincidencias posibles, elige la más específica
6. Si ninguna opción es apropiada, elige la más cercana o genérica

NIVEL DE CONFIANZA:
- 0.9-1.0: Coincidencia exacta o casi exacta
- 0.7-0.89: Coincidencia clara por similitud semántica
- 0.5-0.69: Coincidencia razonable pero con dudas
- 0.3-0.49: Coincidencia débil o aproximada
- 0.0-0.29: No hay buena coincidencia, es solo una aproximación

Responde ÚNICAMENTE con JSON válido en este formato exacto:
{
  "opcionElegida": <número del 1 al ${opciones.length}>,
  "confianza": <número decimal entre 0.0 y 1.0>,
  "razon": "<explicación breve de máximo 200 caracteres>"
}
    `.trim();
  }

  /**
   * Llama al proveedor de IA correspondiente
   */
  async llamarIA(prompt, provider, model) {
    try {
      let responseText;

      switch (provider.toLowerCase()) {
        case 'gemini':
          responseText = await this.llamarGemini(prompt, model);
          break;

        case 'openai':
          responseText = await this.llamarOpenAI(prompt, model);
          break;

        case 'anthropic':
        case 'claude':
          responseText = await this.llamarClaude(prompt, model);
          break;

        default:
          throw new Error(`Proveedor de IA no soportado: ${provider}`);
      }

      console.log('📨 [AI] Respuesta raw:', responseText.substring(0, 200));

      // Limpiar y parsear respuesta JSON
      const jsonText = this.limpiarRespuestaJSON(responseText);
      const parsed = JSON.parse(jsonText);

      // Validar estructura
      if (!parsed.opcionElegida || typeof parsed.confianza !== 'number' || !parsed.razon) {
        throw new Error('Respuesta de IA con formato inválido');
      }

      // Asegurar que confianza está entre 0 y 1
      if (parsed.confianza > 1) {
        parsed.confianza = parsed.confianza / 100;
      }

      return {
        opcionElegida: parseInt(parsed.opcionElegida),
        confianza: parseFloat(parsed.confianza),
        razon: parsed.razon.substring(0, 200) // Limitar longitud
      };

    } catch (error) {
      console.error(`❌ [AI] Error al llamar a ${provider}:`, error.message);
      throw new Error(`Error de IA (${provider}): ${error.message}`);
    }
  }

  /**
   * Llama a Google Gemini con retry y fallback
   */
  async llamarGemini(prompt, model) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 segundo

    // Modelos de fallback si el principal está sobrecargado
    const fallbackModels = [
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-2.5-pro'
    ];

    // Intentar con el modelo especificado
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`🔄 [Gemini] Intento ${i + 1}/${maxRetries} con modelo: ${model}`);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const geminiModel = genAI.getGenerativeModel({
          model: model,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256
          }
        });

        const result = await geminiModel.generateContent(prompt);
        console.log(`✅ [Gemini] Éxito con ${model}`);
        return result.response.text();

      } catch (error) {
        lastError = error;
        const isOverloaded = error.message?.includes('503') || error.message?.includes('overloaded');

        if (isOverloaded && i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i); // Exponential backoff
          console.log(`⏳ [Gemini] Modelo sobrecargado, reintentando en ${delay}ms...`);
          await this.sleep(delay);
        } else if (!isOverloaded) {
          // Si no es error de sobrecarga, no reintentar
          throw error;
        }
      }
    }

    // Si todos los reintentos fallaron, intentar con modelos de fallback
    console.log(`⚠️ [Gemini] ${model} no disponible, probando modelos alternativos...`);

    for (const fallbackModel of fallbackModels) {
      // No reintentar con el mismo modelo
      if (fallbackModel === model) continue;

      try {
        console.log(`🔄 [Gemini] Intentando con fallback: ${fallbackModel}`);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const geminiModel = genAI.getGenerativeModel({
          model: fallbackModel,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256
          }
        });

        const result = await geminiModel.generateContent(prompt);
        console.log(`✅ [Gemini] Éxito con modelo alternativo: ${fallbackModel}`);
        return result.response.text();

      } catch (error) {
        console.log(`❌ [Gemini] Fallback ${fallbackModel} también falló: ${error.message}`);
        // Continuar con el siguiente modelo
      }
    }

    // Si todo falló, lanzar el último error
    throw lastError;
  }

  /**
   * Utilidad para esperar (sleep)
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Llama a OpenAI
   */
  async llamarOpenAI(prompt, model) {
    const { OpenAI } = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 256
    });

    return completion.choices[0].message.content;
  }

  /**
   * Llama a Anthropic Claude
   */
  async llamarClaude(prompt, model) {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const message = await anthropic.messages.create({
      model: model,
      max_tokens: 256,
      temperature: 0.2,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    return message.content[0].text;
  }

  /**
   * Limpia la respuesta JSON de la IA
   */
  limpiarRespuestaJSON(texto) {
    // Remover markdown code blocks
    let cleaned = texto.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Buscar el JSON entre llaves
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    // Limpiar caracteres extraños
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Extrae un campo de un objeto, soportando notación de punto para JSON
   * Ejemplos: "codigo", "nombre", "parametros_json.subcuenta"
   */
  extraerCampo(objeto, campoPath) {
    const partes = campoPath.split('.');
    let valor = objeto;

    for (const parte of partes) {
      if (valor === null || valor === undefined) {
        return null;
      }
      valor = valor[parte];
    }

    return valor;
  }

  /**
   * Guarda una sugerencia de IA en la base de datos
   */
  async guardarSugerencia({
    reglaId,
    entidadTipo,
    entidadId,
    campoDestino,
    textoAnalizado,
    resultado,
    estado = 'pendiente',
    tenantId = null
  }) {
    try {
      const crypto = require('crypto');

      const sugerencia = await prisma.sugerencias_ia.create({
        data: {
          id: crypto.randomUUID(),
          reglaId,
          entidadTipo,
          entidadId,
          campoDestino,
          textoAnalizado,
          valorSugerido: {
            codigo: resultado.opcionElegida.codigo,
            nombre: resultado.opcionElegida.nombre,
            valor: resultado.valorRetorno
          },
          confianza: resultado.confianza,
          razon: resultado.razon,
          estado,
          tenantId,
          updatedAt: new Date()
        }
      });

      console.log('💾 [AI] Sugerencia guardada:', sugerencia.id);

      return sugerencia;

    } catch (error) {
      console.error('❌ [AI] Error al guardar sugerencia:', error.message);
      throw error;
    }
  }

  /**
   * Aplica una sugerencia al item/documento
   */
  async aplicarSugerencia(sugerenciaId, valorFinal = null, revisadoPor = null) {
    try {
      const sugerencia = await prisma.sugerencias_ia.findUnique({
        where: { id: sugerenciaId }
      });

      if (!sugerencia) {
        throw new Error('Sugerencia no encontrada');
      }

      // Actualizar la sugerencia
      await prisma.sugerencias_ia.update({
        where: { id: sugerenciaId },
        data: {
          estado: 'aplicada',
          valorFinal: valorFinal || sugerencia.valorSugerido,
          revisadoPor,
          revisadoAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log('✅ [AI] Sugerencia aplicada:', sugerenciaId);

      return sugerencia;

    } catch (error) {
      console.error('❌ [AI] Error al aplicar sugerencia:', error.message);
      throw error;
    }
  }

  /**
   * Pre-filtra opciones usando búsqueda de texto
   * Reduce el número de opciones antes de enviarlas a la IA
   *
   * @param {string} texto - Texto a analizar
   * @param {Array} opciones - Todas las opciones disponibles
   * @param {number} maxResultados - Máximo de resultados a retornar
   * @returns {Array} Opciones filtradas y ordenadas por relevancia
   */
  prefiltrarOpciones(texto, opciones, maxResultados = 50) {
    // Normalizar texto de búsqueda
    const textoNormalizado = this.normalizarTexto(texto);
    const palabrasClave = textoNormalizado
      .split(/\s+/)
      .filter(p => p.length > 2); // Solo palabras de más de 2 letras

    console.log(`   Palabras clave: ${palabrasClave.join(', ')}`);

    // Calcular score para cada opción
    const opcionesConScore = opciones.map(opcion => {
      let score = 0;

      // Normalizar campos de la opción
      const codigo = this.normalizarTexto(opcion.codigo || '');
      const nombre = this.normalizarTexto(opcion.nombre || '');
      const descripcion = this.normalizarTexto(opcion.descripcion || '');

      // Texto completo para búsqueda
      const textoOpcion = `${codigo} ${nombre} ${descripcion}`;

      // 1. Coincidencia exacta del código con cualquier palabra = máxima prioridad
      palabrasClave.forEach(palabra => {
        if (codigo === palabra) {
          score += 100;
        }
      });

      // 2. Código contiene la palabra
      palabrasClave.forEach(palabra => {
        if (codigo.includes(palabra)) {
          score += 50;
        }
      });

      // 3. Coincidencias en nombre
      palabrasClave.forEach(palabra => {
        if (nombre.includes(palabra)) {
          score += 20;
        }
        // Coincidencia al inicio de una palabra en el nombre
        const palabrasNombre = nombre.split(/\s+/);
        if (palabrasNombre.some(p => p.startsWith(palabra))) {
          score += 10;
        }
      });

      // 4. Coincidencias en descripción (menor peso)
      palabrasClave.forEach(palabra => {
        if (descripcion.includes(palabra)) {
          score += 5;
        }
      });

      // 5. Bonus si coinciden múltiples palabras
      const coincidencias = palabrasClave.filter(palabra =>
        textoOpcion.includes(palabra)
      ).length;

      if (coincidencias > 1) {
        score += coincidencias * 3; // Bonus por múltiples coincidencias
      }

      return {
        ...opcion,
        _score: score
      };
    });

    // Filtrar solo opciones con score > 0 y ordenar
    let opcionesFiltradas = opcionesConScore
      .filter(o => o._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, maxResultados);

    // FALLBACK: Si no hay coincidencias, tomar las primeras N opciones aleatorias
    // para que la IA al menos tenga opciones para analizar
    if (opcionesFiltradas.length === 0) {
      console.log(`   ⚠️ [Pre-filtro] No se encontraron coincidencias. Usando fallback con ${Math.min(maxResultados, opciones.length)} opciones aleatorias`);
      // Tomar opciones aleatorias para darle variedad a la IA
      const opcionesAleatorias = [...opcionesConScore]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(maxResultados, opciones.length));
      opcionesFiltradas = opcionesAleatorias;
    }

    // Remover el campo temporal _score
    const resultado = opcionesFiltradas.map(({ _score, ...opcion }) => opcion);

    // Log de debug
    if (opcionesFiltradas.length > 0) {
      console.log(`   Top 3 candidatos:`);
      opcionesFiltradas.slice(0, 3).forEach((opt, i) => {
        console.log(`     ${i + 1}. ${opt.codigo} - ${opt.nombre} (score: ${opt._score || 0})`);
      });
    }

    return resultado;
  }

  /**
   * Normaliza texto para búsqueda
   * Convierte a minúsculas y elimina acentos
   */
  normalizarTexto(texto) {
    if (!texto) return '';

    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^\w\s]/g, ' ') // Reemplazar caracteres especiales por espacios
      .replace(/\s+/g, ' ') // Normalizar espacios múltiples
      .trim();
  }
}

module.exports = new AIClassificationService();
