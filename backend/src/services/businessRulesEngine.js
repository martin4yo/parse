const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

class BusinessRulesEngine {
  constructor(tenantId = null) {
    this.rules = [];
    this.rulesCache = new Map(); // Cache de reglas por tipo
    this.lastLoadTime = new Map(); // Último tiempo de carga por tipo
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos de cache
    this.lookupCache = new Map(); // Cache para lookups repetidos
    this.tenantId = tenantId; // TenantId para filtrar reglas
  }

  /**
   * Cargar reglas desde la base de datos
   */
  async loadRules(tipo = 'IMPORTACION_DKT', forceReload = false, prismaInstance = null) {
    const now = Date.now();

    // Usar cache si está disponible y no ha expirado PARA ESTE TIPO
    const lastLoad = this.lastLoadTime.get(tipo);
    if (!forceReload && lastLoad && (now - lastLoad) < this.cacheTimeout) {
      this.rules = this.rulesCache.get(tipo) || [];
      return this.rules;
    }

    try {
      const db = prismaInstance || prisma;

      // Construir el where con tenantId si está disponible
      const where = {
        tipo,
        activa: true,
        OR: [
          { fechaVigencia: null },
          { fechaVigencia: { lte: new Date() } }
        ]
      };

      // Filtrar por tenantId si está configurado
      if (this.tenantId) {
        where.tenantId = this.tenantId;
      }

      const rules = await db.reglas_negocio.findMany({
        where,
        orderBy: [
          { prioridad: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      // Guardar en cache por tipo
      this.rulesCache.set(tipo, rules);
      this.lastLoadTime.set(tipo, now);
      this.rules = rules;

      console.log(`Cargadas ${this.rules.length} reglas de tipo ${tipo}${this.tenantId ? ` para tenant ${this.tenantId}` : ''}`);
      return this.rules;
    } catch (error) {
      console.error('Error cargando reglas:', error);
      throw error;
    }
  }

  /**
   * Evaluar una condición contra los datos
   */
  evaluateCondition(condition, data, transformedData = null) {
    const { campo, operador, valor, valorCampo } = condition;
    
    // Si se especifica valorCampo, usar el valor de otro campo
    const testValue = valorCampo ? this.getNestedValue(data, valorCampo) : valor;
    
    // Usar datos transformados si están disponibles, sino usar datos originales
    const dataToUse = transformedData || data;
    let fieldValue = this.getNestedValue(dataToUse, campo);
    
    if (fieldValue === undefined || fieldValue === null) {
      return operador === 'IS_NULL' || operador === 'IS_EMPTY';
    }

    const fieldValueStr = String(fieldValue).toUpperCase();
    const testValueStr = String(testValue).toUpperCase();

    switch (operador) {
      case 'EQUALS':
        return fieldValueStr === testValueStr;
      
      case 'NOT_EQUALS':
        return fieldValueStr !== testValueStr;
      
      case 'CONTAINS':
        return fieldValueStr.includes(testValueStr);
      
      case 'NOT_CONTAINS':
        return !fieldValueStr.includes(testValueStr);
      
      case 'STARTS_WITH':
        return fieldValueStr.startsWith(testValueStr);
      
      case 'ENDS_WITH':
        return fieldValueStr.endsWith(testValueStr);
      
      case 'REGEX':
        try {
          const regex = new RegExp(testValue, 'i');
          return regex.test(fieldValue);
        } catch (e) {
          console.error('Error en regex:', e);
          return false;
        }
      
      case 'IN':
        const valores = Array.isArray(testValue) ? testValue : testValue.split(',').map(v => v.trim());
        return valores.some(v => String(v).toUpperCase() === fieldValueStr);
      
      case 'NOT_IN':
        const valoresNot = Array.isArray(testValue) ? testValue : testValue.split(',').map(v => v.trim());
        return !valoresNot.some(v => String(v).toUpperCase() === fieldValueStr);
      
      case 'IS_NULL':
        return fieldValue === null || fieldValue === undefined;
      
      case 'IS_NOT_NULL':
        return fieldValue !== null && fieldValue !== undefined;
      
      case 'IS_EMPTY':
        return fieldValue === '' || fieldValue === null || fieldValue === undefined;
      
      case 'IS_NOT_EMPTY':
        return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
      
      case 'GREATER_THAN':
        return parseFloat(fieldValue) > parseFloat(testValue);
      
      case 'LESS_THAN':
        return parseFloat(fieldValue) < parseFloat(testValue);
      
      case 'GREATER_OR_EQUAL':
        return parseFloat(fieldValue) >= parseFloat(testValue);
      
      case 'LESS_OR_EQUAL':
        return parseFloat(fieldValue) <= parseFloat(testValue);
      
      default:
        console.warn(`Operador desconocido: ${operador}`);
        return false;
    }
  }

  /**
   * Obtener valor anidado de un objeto usando notación de punto
   */
  getNestedValue(obj, path) {
    if (!path) return undefined;
    
    return path.split('.').reduce((current, prop) => {
      return current ? current[prop] : undefined;
    }, obj);
  }

  /**
   * Establecer valor anidado en un objeto usando notación de punto
   */
  setNestedValue(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((current, prop) => {
      if (!current[prop]) {
        current[prop] = {};
      }
      return current[prop];
    }, obj);
    
    target[last] = value;
  }

  /**
   * Aplicar transformación a un valor
   */
  applyTransformation(value, transformacion, funcionPersonalizada) {
    try {
      switch (transformacion) {
        case 'REMOVE_LEADING_ZEROS':
          return String(value).replace(/^0+/, '') || '0';
          
        case 'REMOVE_TRAILING_ZEROS':
          return String(value).replace(/0+$/, '');
          
        case 'TRIM_SPACES':
          return String(value).trim();
          
        case 'UPPER_CASE':
          return String(value).toUpperCase();
          
        case 'LOWER_CASE':
          return String(value).toLowerCase();
          
        case 'CUSTOM_FUNCTION':
          if (funcionPersonalizada) {
            // Crear función segura limitando el contexto
            const safeFunction = new Function('value', `
              try {
                return ${funcionPersonalizada};
              } catch (error) {
                console.error('Error en función personalizada:', error);
                return value;
              }
            `);
            return safeFunction(value);
          }
          return value;
          
        default:
          return value;
      }
    } catch (error) {
      console.error(`Error aplicando transformación ${transformacion}:`, error);
      return value; // Devolver valor original en caso de error
    }
  }

  /**
   * Aplicar transformaciones de campo a los datos
   */
  applyFieldTransformations(data, transformaciones) {
    if (!transformaciones || transformaciones.length === 0) {
      return data;
    }

    const transformedData = JSON.parse(JSON.stringify(data)); // Deep copy
    
    for (const transformacion of transformaciones) {
      const { campo, transformacion: tipoTransformacion, funcionPersonalizada } = transformacion;
      
      const fieldValue = this.getNestedValue(transformedData, campo);
      if (fieldValue !== undefined && fieldValue !== null) {
        const transformedValue = this.applyTransformation(fieldValue, tipoTransformacion, funcionPersonalizada);
        this.setNestedValue(transformedData, campo, transformedValue);
      }
    }
    
    return transformedData;
  }

  /**
   * Aplicar reglas a un item de rendición
   */
  async applyRules(itemData, resumenData, options = {}) {
    const { 
      logExecution = false, 
      tipo = 'IMPORTACION_DKT',
      contexto = 'DKT_IMPORT' 
    } = options;

    // Cargar reglas si es necesario
    if (this.rules.length === 0) {
      await this.loadRules(tipo);
    }

    // Combinar datos para evaluación
    // Solo agregar resumen si existe y tiene datos (para compatibilidad con rendiciones)
    const fullData = { ...itemData };
    if (resumenData && Object.keys(resumenData).length > 0) {
      fullData.resumen = resumenData;
    }

    const result = { ...itemData };
    const executedRules = [];
    const validationErrors = [];  // Array para errores de validación
    const startTime = Date.now();

    // Aplicar cada regla en orden de prioridad
    for (const rule of this.rules) {
      try {
        const config = rule.configuracion;
        const isValidationRule = rule.tipo === 'VALIDACION';
        
        // 1. Aplicar transformaciones de campo si existen
        // IMPORTANTE: usar result en lugar de fullData para que vea los cambios de reglas anteriores
        let transformedData = result;
        if (config.transformacionesCampo && config.transformacionesCampo.length > 0) {
          transformedData = this.applyFieldTransformations(result, config.transformacionesCampo);

          if (logExecution) {
            console.log(`Transformaciones aplicadas para regla "${rule.nombre}":`,
              config.transformacionesCampo.map(t => `${t.campo} -> ${t.transformacion}`));
          }
        }

        // 2. Verificar si todas las condiciones se cumplen (usando datos ya modificados por reglas anteriores)
        let shouldApply = true;

        if (config.condiciones) {
          // Si hay múltiples condiciones, verificar el operador lógico
          const logicOperator = config.logicOperator || 'AND';

          if (logicOperator === 'AND') {
            shouldApply = config.condiciones.every(cond =>
              this.evaluateCondition(cond, result, transformedData)
            );
          } else if (logicOperator === 'OR') {
            shouldApply = config.condiciones.some(cond =>
              this.evaluateCondition(cond, result, transformedData)
            );
          }
        }

        // Si la regla aplica, ejecutar las acciones
        if (shouldApply) {
          // Si es una regla de VALIDACION, significa que la validación PASÓ
          if (isValidationRule) {
            executedRules.push({
              reglaId: rule.id,
              nombre: rule.nombre,
              tipo: 'VALIDACION',
              aplicada: true,
              resultado: 'VALIDO'
            });
          } else {
            // Reglas de transformación: aplicar acciones
            if (config.acciones) {
              for (const accion of config.acciones) {
                const { campo, valor, valorCampo, operacion } = accion;

                if (operacion === 'SET') {
                  // Establecer valor directo o desde otro campo
                  const newValue = valorCampo
                    ? this.getNestedValue(transformedData, valorCampo)
                    : valor;

                  this.setNestedValue(result, campo, newValue);
                } else if (operacion === 'APPEND') {
                  // Agregar al valor existente
                  const currentValue = this.getNestedValue(result, campo) || '';
                  const appendValue = valorCampo
                    ? this.getNestedValue(transformedData, valorCampo)
                    : valor;

                  this.setNestedValue(result, campo, currentValue + appendValue);
                } else if (operacion === 'CALCULATE') {
                  // Realizar cálculos simples
                  this.applyCalculation(result, transformedData, accion);
                } else if (operacion === 'LOOKUP') {
                  // Realizar lookup dinámico desde tablas
                  await this.applyLookup(result, fullData, accion, transformedData);
                } else if (operacion === 'LOOKUP_JSON') {
                  // Realizar lookup en campos JSON
                  await this.applyLookupJSON(result, fullData, accion, transformedData);
                } else if (operacion === 'LOOKUP_CHAIN') {
                  // Realizar lookup encadenado entre múltiples tablas
                  await this.applyLookupChain(result, fullData, accion, transformedData);
                } else if (operacion === 'EXTRACT_REGEX') {
                  // Extraer valor usando expresión regular
                  this.applyExtractRegex(result, fullData, accion, transformedData);
                }
              }
            }

            executedRules.push({
              reglaId: rule.id,
              nombre: rule.nombre,
              tipo: rule.tipo,
              aplicada: true
            });
          }

          // Si la regla indica que debe detener el procesamiento
          if (config.stopOnMatch) {
            break;
          }
        } else {
          // Si NO aplica y es una regla de VALIDACION, significa que FALLÓ
          if (isValidationRule) {
            const errorMessage = config.mensajeError || `Validación fallida: ${rule.nombre}`;
            const errorDetails = {
              reglaId: rule.id,
              reglaCodigo: rule.codigo,
              nombre: rule.nombre,
              mensaje: errorMessage,
              severidad: config.severidad || 'ERROR',
              condicionesFallidas: config.condiciones.map(cond => ({
                campo: cond.campo,
                operador: cond.operador,
                valorEsperado: cond.valor,
                valorActual: this.getNestedValue(fullData, cond.campo)
              }))
            };

            validationErrors.push(errorDetails);

            executedRules.push({
              reglaId: rule.id,
              nombre: rule.nombre,
              tipo: 'VALIDACION',
              aplicada: true,
              resultado: 'INVALIDO',
              mensaje: errorMessage
            });

            // Si la severidad es BLOQUEANTE y stopOnMatch está activo, detener
            if (config.severidad === 'BLOQUEANTE' && config.stopOnMatch) {
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error aplicando regla ${rule.nombre}:`, error);
        executedRules.push({
          reglaId: rule.id,
          nombre: rule.nombre,
          aplicada: false,
          error: error.message
        });
      }
    }

    const duracionMs = Date.now() - startTime;

    // Registrar ejecución si está habilitado
    if (logExecution && executedRules.length > 0) {
      for (const executed of executedRules.filter(r => r.aplicada)) {
        try {
          await prisma.reglas_ejecuciones.create({
            data: {
              id: uuidv4(),
              reglaId: executed.reglaId,
              contexto,
              entrada: fullData,
              salida: result,
              exitosa: true,
              duracionMs
            }
          });
        } catch (error) {
          console.error('Error registrando ejecución de regla:', error);
        }
      }
    }

    return {
      data: result,
      rulesApplied: executedRules.filter(r => r.aplicada).length,
      executedRules,
      duracionMs,
      validationErrors,
      hasValidationErrors: validationErrors.length > 0,
      isValid: validationErrors.filter(e => e.severidad !== 'WARNING').length === 0
    };
  }

  /**
   * Aplicar cálculos especiales
   */
  applyCalculation(result, transformedData, accion) {
    const { campo, formula } = accion;
    
    // Reemplazar referencias a campos en la fórmula
    let calculatedValue = formula;
    const fieldRegex = /\{([^}]+)\}/g;
    
    calculatedValue = calculatedValue.replace(fieldRegex, (match, fieldPath) => {
      const value = this.getNestedValue(transformedData, fieldPath);
      return value !== undefined ? value : 0;
    });

    try {
      // Evaluar la expresión matemática de forma segura
      const evalResult = this.safeEval(calculatedValue);
      this.setNestedValue(result, campo, evalResult);
    } catch (error) {
      console.error(`Error en cálculo: ${formula}`, error);
    }
  }

  /**
   * Aplicar lookup dinámico desde tablas de parámetros
   */
  async applyLookup(result, fullData, accion, transformedData = null) {
    const {
      campo,           // Campo donde guardar el resultado
      tabla,           // Tabla a consultar (ej: 'parametros_maestros', 'user_tarjetas_credito')
      campoConsulta,   // Campo por el cual filtrar (ej: 'numero_tarjeta', 'codigo')
      valorConsulta,   // Valor a buscar o campo de donde obtenerlo (ej: 'resumen.numeroTarjeta', 'FIJO_123')
      campoResultado,  // Campo que queremos obtener (ej: 'nombre', 'codigo_dimension')
      campoJSON,       // Campo específico dentro del JSON a extraer (ej: 'cuentaContable')
      valorDefecto     // Valor por defecto si no encuentra nada
    } = accion;

    try {
      // Obtener el valor de consulta
      let valorBusqueda;
      if (valorConsulta.startsWith('{') && valorConsulta.endsWith('}')) {
        // Es una referencia a un campo: {resumen.numeroTarjeta}
        const fieldPath = valorConsulta.slice(1, -1);
        // Usar datos transformados si están disponibles, sino usar datos originales
        const dataToUse = transformedData || fullData;
        valorBusqueda = this.getNestedValue(dataToUse, fieldPath);
      } else {
        // Es un valor fijo
        valorBusqueda = valorConsulta;
      }

      if (!valorBusqueda) {
        console.warn(`Lookup: No se pudo obtener valor de consulta para ${valorConsulta}`);
        if (valorDefecto !== undefined) {
          this.setNestedValue(result, campo, valorDefecto);
        }
        return;
      }

      // Realizar la consulta según la tabla especificada
      let lookupResult = null;

      switch (tabla) {
        case 'parametros_maestros':
          lookupResult = await this.lookupParametrosMaestros(campoConsulta, valorBusqueda, campoResultado, campoJSON);
          break;
          
        case 'user_tarjetas_credito':
          lookupResult = await this.lookupUserTarjetasCredito(campoConsulta, valorBusqueda, campoResultado);
          break;
          
        case 'usuarios':
          lookupResult = await this.lookupUsuarios(campoConsulta, valorBusqueda, campoResultado);
          break;
          
        case 'banco_tipo_tarjeta':
          lookupResult = await this.lookupBancoTipoTarjeta(campoConsulta, valorBusqueda, campoResultado);
          break;
          
        default:
          // Lookup genérico para cualquier tabla
          lookupResult = await this.genericLookup(tabla, campoConsulta, valorBusqueda, campoResultado);
          break;
      }

      // Establecer el resultado
      const finalValue = lookupResult !== null ? lookupResult : valorDefecto;
      if (finalValue !== undefined) {
        this.setNestedValue(result, campo, finalValue);
        console.log(`Lookup exitoso: ${tabla}.${campoConsulta}="${valorBusqueda}" -> ${campo}="${finalValue}"`);
      }

    } catch (error) {
      console.error(`Error en lookup: ${tabla}.${campoConsulta}`, error);
      if (valorDefecto !== undefined) {
        this.setNestedValue(result, campo, valorDefecto);
      }
    }
  }

  /**
   * Aplicar lookup en campos JSON
   */
  async applyLookupJSON(result, fullData, accion, transformedData = null) {
    const {
      campo,           // Campo donde guardar el resultado
      tipoCampo,       // Tipo de campo en parametros_maestros (ej: 'proveedor')
      campoJSON,       // Campo dentro del JSON a buscar (ej: 'cuit')
      valorConsulta,   // Valor a buscar o campo de donde obtenerlo
      campoResultado,  // Campo que queremos obtener (ej: 'codigo')
      valorDefecto,    // Valor por defecto si no encuentra nada
      condicionEspecial // Para manejar casos especiales como CUIT 00000000000
    } = accion;

    try {
      // Obtener el valor de consulta
      let valorBusqueda;
      if (valorConsulta.startsWith('{') && valorConsulta.endsWith('}')) {
        // Es una referencia a un campo
        const fieldPath = valorConsulta.slice(1, -1);
        // Usar datos transformados si están disponibles, sino usar datos originales
        const dataToUse = transformedData || fullData;
        valorBusqueda = this.getNestedValue(dataToUse, fieldPath);
      } else {
        // Es un valor fijo
        valorBusqueda = valorConsulta;
      }

      if (!valorBusqueda) {
        console.warn(`LookupJSON: No se pudo obtener valor de consulta para ${valorConsulta}`);
        if (valorDefecto !== undefined) {
          this.setNestedValue(result, campo, valorDefecto);
        }
        return;
      }

      // Manejar casos especiales primero
      if (condicionEspecial && condicionEspecial.tipo === 'CUIT_ESPECIAL') {
        if (valorBusqueda === '00000000000' || valorBusqueda === '0' || valorBusqueda === '') {
          // Para migración DKT, si CUIT es todo ceros usar código por defecto
          const codigoEspecial = condicionEspecial.codigoDefault || valorDefecto;

          if (codigoEspecial) {
            this.setNestedValue(result, campo, codigoEspecial);
            console.log(`LookupJSON especial: CUIT="${valorBusqueda}" (todo ceros) -> ${campo}="${codigoEspecial}"`);
          }
          return;
        }
      }

      // Buscar en parametros_maestros con campo JSON
      const parametros = await prisma.parametros_maestros.findMany({
        where: {
          tipo_campo: tipoCampo,
          activo: true
        }
      });

      // Buscar el registro que tenga el valor en su campo JSON
      let encontrado = null;
      for (const param of parametros) {
        if (param.parametros_json) {
          // El campo JSON puede tener el valor directamente o en una propiedad anidada
          const jsonValue = param.parametros_json[campoJSON];
          if (jsonValue) {
            // Normalizar valores para comparación (remover guiones, espacios, etc.)
            const normalizedJsonValue = String(jsonValue).replace(/[-\s]/g, '').toUpperCase();
            const normalizedSearchValue = String(valorBusqueda).replace(/[-\s]/g, '').toUpperCase();

            if (normalizedJsonValue === normalizedSearchValue) {
              encontrado = param;
              break;
            }
          }
        }
      }

      if (encontrado) {
        const finalValue = encontrado[campoResultado];
        this.setNestedValue(result, campo, finalValue);
        console.log(`LookupJSON exitoso: ${tipoCampo}.JSON.${campoJSON}="${valorBusqueda}" -> ${campo}="${finalValue}"`);
      } else {
        // No se encontró, usar valor por defecto
        if (valorDefecto !== undefined) {
          this.setNestedValue(result, campo, valorDefecto);
          console.log(`LookupJSON no encontrado: ${tipoCampo}.JSON.${campoJSON}="${valorBusqueda}" -> usando defecto="${valorDefecto}"`);
        }
      }

    } catch (error) {
      console.error(`Error en lookupJSON: ${tipoCampo}.${campoJSON}`, error);
      if (valorDefecto !== undefined) {
        this.setNestedValue(result, campo, valorDefecto);
      }
    }
  }

  /**
   * Aplicar lookup encadenado entre múltiples tablas
   */
  async applyLookupChain(result, fullData, accion, transformedData = null) {
    const {
      campo,           // Campo donde guardar el resultado final
      valorConsulta,   // Valor inicial para empezar la cadena
      cadena,          // Array de pasos del lookup
      valorDefecto     // Valor por defecto si no encuentra nada
    } = accion;

    try {
      // Obtener el valor inicial
      let valorActual;
      if (valorConsulta.startsWith('{') && valorConsulta.endsWith('}')) {
        const fieldPath = valorConsulta.slice(1, -1);
        // Usar datos transformados si están disponibles, sino usar datos originales
        const dataToUse = transformedData || fullData;
        valorActual = this.getNestedValue(dataToUse, fieldPath);

      } else {
        valorActual = valorConsulta;
      }

      if (!valorActual) {
        console.warn(`LookupChain: No se pudo obtener valor inicial de ${valorConsulta}`);
        if (valorDefecto !== undefined) {
          this.setNestedValue(result, campo, valorDefecto);
        }
        return;
      }

      // Ejecutar cada paso de la cadena
      for (let i = 0; i < cadena.length; i++) {
        const paso = cadena[i];
        const { tabla, campoConsulta, campoResultado, descripcion } = paso;

        // Realizar lookup en este paso
        let resultadoPaso;
        
        switch (tabla) {
          case 'user_tarjetas_credito':
          case 'userTarjetaCredito':
            resultadoPaso = await this.lookupUserTarjetasCredito(campoConsulta, valorActual, campoResultado);
            break;
          case 'user_atributos':
          case 'userAtributo':
            // Pasar el filtro adicional si existe en el paso
            resultadoPaso = await this.lookupUserAtributos(campoConsulta, valorActual, campoResultado, paso.filtroAdicional);
            break;
          case 'valorAtributo':
          case 'valores_atributo':
            // Cache key para valorAtributo
            const valorAtribCacheKey = `valorAtributo_${valorActual}_${campoResultado}`;

            // Verificar cache
            if (this.lookupCache.has(valorAtribCacheKey)) {
              resultadoPaso = this.lookupCache.get(valorAtribCacheKey);
            } else {
              // Para valorAtributo, buscar por id y obtener codigo
              const valorAtrib = await prisma.valores_atributo.findUnique({
                where: { id: valorActual },
                select: { [campoResultado]: true }
              });
              resultadoPaso = valorAtrib ? valorAtrib[campoResultado] : null;

              // Guardar en cache
              this.lookupCache.set(valorAtribCacheKey, resultadoPaso);
            }
            break;
          case 'parametros_maestros':
            resultadoPaso = await this.lookupParametrosMaestros(campoConsulta, valorActual, campoResultado);
            break;
          default:
            resultadoPaso = await this.genericLookup(tabla, campoConsulta, valorActual, campoResultado);
            break;
        }

        if (resultadoPaso === null || resultadoPaso === undefined) {
          if (valorDefecto !== undefined) {
            this.setNestedValue(result, campo, valorDefecto);
          }
          return;
        }

        valorActual = resultadoPaso;
      }

      // Si llegamos aquí, toda la cadena fue exitosa
      this.setNestedValue(result, campo, valorActual);

    } catch (error) {
      console.error(`Error en lookupChain:`, error);
      if (valorDefecto !== undefined) {
        this.setNestedValue(result, campo, valorDefecto);
      }
    }
  }

  /**
   * Lookup específico para user_atributos
   */
  async lookupUserAtributos(campoConsulta, valorBusqueda, campoResultado, filtroAdicional = null) {
    try {
      // Caso especial: si buscamos por userId y queremos valorAtributoId con un atributo específico
      if (campoConsulta === 'userId' && campoResultado === 'valorAtributoId') {
        // Determinar qué atributo buscar (CODDIM o SUBCUE)
        let codigoAtributo = 'CODDIM'; // Por defecto CODDIM para compatibilidad

        // Si hay filtro adicional, usarlo para determinar el atributo
        if (filtroAdicional && filtroAdicional.valorAtributo &&
            filtroAdicional.valorAtributo.atributo &&
            filtroAdicional.valorAtributo.atributo.codigo) {
          codigoAtributo = filtroAdicional.valorAtributo.atributo.codigo;
        }

        // Cache key específico para este lookup
        const cacheKey = `userAtributo_${valorBusqueda}_${codigoAtributo}_${campoResultado}`;

        // Verificar cache
        if (this.lookupCache.has(cacheKey)) {
          return this.lookupCache.get(cacheKey);
        }

        const userAtributo = await prisma.user_atributos.findFirst({
          where: {
            userId: valorBusqueda,
            valores_atributo: {
              atributos: {
                codigo: codigoAtributo,
                activo: true
              }
            }
          },
          select: {
            valorAtributoId: true
          }
        });

        const result = userAtributo ? userAtributo.valorAtributoId : null;

        // Guardar en cache
        this.lookupCache.set(cacheKey, result);
        return result;
      }

      // Caso especial: si buscamos por userId y queremos un atributo específico
      if (campoConsulta === 'userId' && campoResultado.startsWith('atributo.')) {
        const nombreAtributo = campoResultado.replace('atributo.', '');

        const userAtributo = await prisma.user_atributos.findFirst({
          where: {
            userId: valorBusqueda,
            valores_atributo: {
              atributos: {
                codigo: nombreAtributo,
                activo: true
              }
            }
          },
          include: {
            valores_atributo: {
              include: {
                atributos: true
              }
            }
          }
        });

        return userAtributo ? userAtributo.valores_atributo.codigo : null;
      }

      // Lookup genérico
      return await this.genericLookup('user_atributos', campoConsulta, valorBusqueda, campoResultado);
    } catch (error) {
      console.error('Error en lookupUserAtributos:', error);
      return null;
    }
  }

  /**
   * Lookup específico para parámetros maestros
   */
  async lookupParametrosMaestros(campoConsulta, valorBusqueda, campoResultado, campoJSON = null) {
    const where = {};
    where[campoConsulta] = valorBusqueda;
    where.activo = true;

    const parametro = await prisma.parametros_maestros.findFirst({
      where,
      select: {
        [campoResultado]: true
      }
    });

    if (!parametro) return null;

    let resultado = parametro[campoResultado];

    // Si se especifica campoJSON y el resultado es un objeto, extraer el campo del JSON
    if (campoJSON && resultado && typeof resultado === 'object') {
      resultado = resultado[campoJSON] || null;
    }

    return resultado;
  }

  /**
   * Lookup específico para tarjetas de crédito de usuarios
   */
  async lookupUserTarjetasCredito(campoConsulta, valorBusqueda, campoResultado) {
    // Cache key para este lookup
    const cacheKey = `userTarjetaCredito_${campoConsulta}_${valorBusqueda}_${campoResultado}`;

    // Verificar cache
    if (this.lookupCache.has(cacheKey)) {
      return this.lookupCache.get(cacheKey);
    }

    const where = {};
    where[campoConsulta] = valorBusqueda;
    where.activo = true;

    const tarjeta = await prisma.userTarjetaCredito.findFirst({
      where,
      include: {
        user: true,
        autorizante: true
      }
    });

    let result = null;

    if (tarjeta) {
      // Permitir acceso a campos anidados
      switch (campoResultado) {
        case 'user.nombre':
          result = tarjeta.user?.nombre;
          break;
        case 'user.apellido':
          result = tarjeta.user?.apellido;
          break;
        case 'user.email':
          result = tarjeta.user?.email;
          break;
        case 'user.rol':
          result = tarjeta.user?.rol;
          break;
        case 'user.codigoDimension':
          result = tarjeta.user?.codigoDimension;
          break;
        case 'autorizante.nombre':
          result = tarjeta.autorizante?.nombre;
          break;
        case 'autorizante.apellido':
          result = tarjeta.autorizante?.apellido;
          break;
        case 'marcaTarjeta':
          result = tarjeta.marcaTarjeta;
          break;
        default:
          result = tarjeta[campoResultado];
      }
    }

    // Guardar en cache
    this.lookupCache.set(cacheKey, result);
    return result;
  }

  /**
   * Lookup específico para usuarios
   */
  async lookupUsuarios(campoConsulta, valorBusqueda, campoResultado) {
    const where = {};
    where[campoConsulta] = valorBusqueda;
    where.activo = true;

    const usuario = await prisma.user.findFirst({
      where,
      select: {
        [campoResultado]: true
      }
    });

    return usuario ? usuario[campoResultado] : null;
  }

  /**
   * Lookup específico para banco tipo tarjeta
   */
  async lookupBancoTipoTarjeta(campoConsulta, valorBusqueda, campoResultado) {
    const where = {};
    where[campoConsulta] = valorBusqueda;
    where.activo = true;

    const bancoTipo = await prisma.bancoTipoTarjeta.findFirst({
      where,
      include: {
        banco: true,
        tipoTarjeta: true
      }
    });

    if (!bancoTipo) return null;

    switch (campoResultado) {
      case 'banco.nombre':
        return bancoTipo.banco?.nombre;
      case 'tipoTarjeta.nombre':
        return bancoTipo.tipoTarjeta?.nombre;
      default:
        return bancoTipo[campoResultado];
    }
  }

  /**
   * Lookup genérico para cualquier tabla
   */
  async genericLookup(tabla, campoConsulta, valorBusqueda, campoResultado) {
    try {
      // Construir la consulta dinámicamente
      const where = {};
      where[campoConsulta] = valorBusqueda;

      // Intentar agregar filtro de activo si existe
      const tableInfo = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${tabla} AND column_name = 'activo'
      `;
      
      if (tableInfo.length > 0) {
        where.activo = true;
      }

      const result = await prisma[tabla].findFirst({
        where,
        select: {
          [campoResultado]: true
        }
      });

      return result ? result[campoResultado] : null;
    } catch (error) {
      console.error(`Error en lookup genérico de ${tabla}:`, error);
      return null;
    }
  }

  /**
   * Extraer valor usando expresión regular
   */
  applyExtractRegex(result, fullData, accion, transformedData = null) {
    const {
      campo,           // Campo donde guardar el resultado
      campoOrigen,     // Campo del cual extraer (ej: 'descripcion')
      patron,          // Patrón regex (ej: '[oO]\\.?[cC]\\.?\\s*:\\s*(\\d+)')
      grupoCaptura,    // Número de grupo a capturar (default: 1)
      valorDefecto     // Valor por defecto si no encuentra match
    } = accion;

    try {
      // Obtener el valor del campo origen
      const dataToUse = transformedData || fullData;
      const valorOrigen = this.getNestedValue(dataToUse, campoOrigen);

      if (!valorOrigen) {
        if (valorDefecto !== undefined) {
          this.setNestedValue(result, campo, valorDefecto);
        }
        return;
      }

      // Aplicar el patrón regex
      const regex = new RegExp(patron, 'i');
      const match = String(valorOrigen).match(regex);

      if (match) {
        const grupo = grupoCaptura !== undefined ? grupoCaptura : 1;
        const valorExtraido = match[grupo];

        this.setNestedValue(result, campo, valorExtraido);
        console.log(`ExtractRegex exitoso: ${campoOrigen}="${valorOrigen}" -> ${campo}="${valorExtraido}"`);
      } else {
        // No se encontró match, usar valor por defecto
        if (valorDefecto !== undefined) {
          this.setNestedValue(result, campo, valorDefecto);
        }
      }

    } catch (error) {
      console.error(`Error en ExtractRegex: ${campoOrigen}`, error);
      if (valorDefecto !== undefined) {
        this.setNestedValue(result, campo, valorDefecto);
      }
    }
  }

  /**
   * Evaluación segura de expresiones matemáticas
   */
  safeEval(expression) {
    // Remover caracteres no permitidos
    const cleaned = expression.replace(/[^0-9+\-*/().\s]/g, '');
    
    // Usar Function constructor para evaluación segura
    try {
      return Function('"use strict"; return (' + cleaned + ')')();
    } catch (error) {
      console.error('Error evaluando expresión:', error);
      return null;
    }
  }

  /**
   * Aplicar reglas a un documento completo incluyendo líneas e impuestos
   */
  async applyRulesToDocument(documento, options = {}) {
    const {
      logExecution = false,
      contexto = 'DOCUMENTO_COMPLETO'
    } = options;

    console.log(`🔄 Aplicando reglas al documento ${documento.id}...`);

    const resultado = {
      documentoTransformado: null,
      lineasTransformadas: [],
      impuestosTransformados: [],
      reglasAplicadas: {
        documento: 0,
        lineas: 0,
        impuestos: 0,
        validaciones: 0
      },
      validationErrors: [],
      allValidationErrors: {
        documento: [],
        lineas: [],
        impuestos: []
      }
    };

    try {
      // 1. Aplicar reglas al documento principal (TRANSFORMACION_DOCUMENTO)
      await this.loadRules('TRANSFORMACION_DOCUMENTO', false);
      if (this.rules.length > 0) {
        console.log(`  📄 Aplicando ${this.rules.length} reglas de transformación al documento...`);
        const docResult = await this.applyRules(
          documento,
          {},
          {
            tipo: 'TRANSFORMACION_DOCUMENTO',
            contexto,
            logExecution
          }
        );
        resultado.documentoTransformado = docResult.data;
        resultado.reglasAplicadas.documento = docResult.rulesApplied;
        console.log(`  ✅ Documento: ${docResult.rulesApplied} reglas aplicadas`);
      } else {
        resultado.documentoTransformado = documento;
        console.log(`  ℹ️ No hay reglas TRANSFORMACION_DOCUMENTO activas`);
      }

      // 1.5. Aplicar reglas de VALIDACION al documento
      await this.loadRules('VALIDACION', false);
      if (this.rules.length > 0) {
        console.log(`  🔍 Aplicando ${this.rules.length} reglas de validación al documento...`);
        const validationResult = await this.applyRules(
          resultado.documentoTransformado,
          {},
          {
            tipo: 'VALIDACION',
            contexto,
            logExecution
          }
        );

        if (validationResult.hasValidationErrors) {
          resultado.allValidationErrors.documento = validationResult.validationErrors;
          resultado.validationErrors.push(...validationResult.validationErrors.map(err => ({
            ...err,
            origen: 'documento',
            documentoId: documento.id,
            nombreArchivo: documento.nombreArchivo
          })));
          console.log(`  ⚠️ Documento: ${validationResult.validationErrors.length} validación(es) fallida(s)`);
        } else {
          console.log(`  ✅ Documento: todas las validaciones pasaron`);
        }
        resultado.reglasAplicadas.validaciones += this.rules.length;
      }

      // 2. Aplicar reglas a cada línea individual (TRANSFORMACION)
      if (documento.documento_lineas && documento.documento_lineas.length > 0) {
        await this.loadRules('TRANSFORMACION', false);
        if (this.rules.length > 0) {
          console.log(`  📋 Aplicando reglas a ${documento.documento_lineas.length} líneas...`);

          for (const linea of documento.documento_lineas) {
            const lineaResult = await this.applyRules(
              linea,
              { documento: resultado.documentoTransformado }, // Contexto del documento padre
              {
                tipo: 'TRANSFORMACION',
                contexto: 'LINEA_DOCUMENTO',
                logExecution
              }
            );
            resultado.lineasTransformadas.push(lineaResult.data);
            resultado.reglasAplicadas.lineas += lineaResult.rulesApplied;
          }

          console.log(`  ✅ Líneas: ${resultado.reglasAplicadas.lineas} reglas aplicadas en total`);
        } else {
          resultado.lineasTransformadas = documento.documento_lineas;
          console.log(`  ℹ️ No hay reglas TRANSFORMACION activas para líneas`);
        }

        // 2.5. Aplicar reglas de VALIDACION a cada línea
        await this.loadRules('VALIDACION', false);
        if (this.rules.length > 0) {
          console.log(`  🔍 Aplicando ${this.rules.length} reglas de validación a cada línea...`);

          for (let i = 0; i < resultado.lineasTransformadas.length; i++) {
            const linea = resultado.lineasTransformadas[i];
            const validationResult = await this.applyRules(
              linea,
              { documento: resultado.documentoTransformado },
              {
                tipo: 'VALIDACION',
                contexto: 'LINEA_DOCUMENTO',
                logExecution
              }
            );

            if (validationResult.hasValidationErrors) {
              resultado.allValidationErrors.lineas.push(...validationResult.validationErrors);
              resultado.validationErrors.push(...validationResult.validationErrors.map(err => ({
                ...err,
                origen: `linea ${i + 1}`,
                lineaIndex: i,
                documentoId: documento.id,
                nombreArchivo: documento.nombreArchivo
              })));
            }
          }

          const lineasConErrores = resultado.allValidationErrors.lineas.length;
          if (lineasConErrores > 0) {
            console.log(`  ⚠️ Líneas: ${lineasConErrores} validación(es) fallida(s)`);
          } else {
            console.log(`  ✅ Líneas: todas las validaciones pasaron`);
          }
        }
      }

      // 3. Aplicar reglas a cada impuesto individual (TRANSFORMACION)
      if (documento.documento_impuestos && documento.documento_impuestos.length > 0) {
        await this.loadRules('TRANSFORMACION', false);
        if (this.rules.length > 0) {
          console.log(`  💰 Aplicando reglas a ${documento.documento_impuestos.length} impuestos...`);

          for (const impuesto of documento.documento_impuestos) {
            const impuestoResult = await this.applyRules(
              impuesto,
              { documento: resultado.documentoTransformado }, // Contexto del documento padre
              {
                tipo: 'TRANSFORMACION',
                contexto: 'IMPUESTO_DOCUMENTO',
                logExecution
              }
            );
            resultado.impuestosTransformados.push(impuestoResult.data);
            resultado.reglasAplicadas.impuestos += impuestoResult.rulesApplied;
          }

          console.log(`  ✅ Impuestos: ${resultado.reglasAplicadas.impuestos} reglas aplicadas en total`);
        } else {
          resultado.impuestosTransformados = documento.documento_impuestos;
          console.log(`  ℹ️ No hay reglas TRANSFORMACION activas para impuestos`);
        }

        // 3.5. Aplicar reglas de VALIDACION a cada impuesto
        await this.loadRules('VALIDACION', false);
        if (this.rules.length > 0) {
          console.log(`  🔍 Aplicando ${this.rules.length} reglas de validación a cada impuesto...`);

          for (let i = 0; i < resultado.impuestosTransformados.length; i++) {
            const impuesto = resultado.impuestosTransformados[i];
            const validationResult = await this.applyRules(
              impuesto,
              { documento: resultado.documentoTransformado },
              {
                tipo: 'VALIDACION',
                contexto: 'IMPUESTO_DOCUMENTO',
                logExecution
              }
            );

            if (validationResult.hasValidationErrors) {
              resultado.allValidationErrors.impuestos.push(...validationResult.validationErrors);
              resultado.validationErrors.push(...validationResult.validationErrors.map(err => ({
                ...err,
                origen: `impuesto ${i + 1}`,
                impuestoIndex: i,
                documentoId: documento.id,
                nombreArchivo: documento.nombreArchivo
              })));
            }
          }

          const impuestosConErrores = resultado.allValidationErrors.impuestos.length;
          if (impuestosConErrores > 0) {
            console.log(`  ⚠️ Impuestos: ${impuestosConErrores} validación(es) fallida(s)`);
          } else {
            console.log(`  ✅ Impuestos: todas las validaciones pasaron`);
          }
        }
      }

      // Reconstruir el documento completo con datos transformados
      const documentoCompleto = {
        ...resultado.documentoTransformado,
        documento_lineas: resultado.lineasTransformadas,
        documento_impuestos: resultado.impuestosTransformados
      };

      // Resumen de validaciones
      const totalValidationErrors = resultado.validationErrors.length;
      const bloqueantes = resultado.validationErrors.filter(e => e.severidad === 'BLOQUEANTE').length;
      const errores = resultado.validationErrors.filter(e => e.severidad === 'ERROR').length;
      const warnings = resultado.validationErrors.filter(e => e.severidad === 'WARNING').length;

      if (totalValidationErrors > 0) {
        console.log(`⚠️ Documento ${documento.id}: ${totalValidationErrors} validación(es) fallida(s) (${bloqueantes} bloqueantes, ${errores} errores, ${warnings} warnings)`);
      }

      console.log(`✅ Documento ${documento.id} procesado: ${resultado.reglasAplicadas.documento} reglas doc, ${resultado.reglasAplicadas.lineas} reglas líneas, ${resultado.reglasAplicadas.impuestos} reglas impuestos, ${resultado.reglasAplicadas.validaciones} validaciones`);

      return {
        documento: documentoCompleto,
        reglasAplicadas: resultado.reglasAplicadas,
        totalReglasAplicadas:
          resultado.reglasAplicadas.documento +
          resultado.reglasAplicadas.lineas +
          resultado.reglasAplicadas.impuestos +
          resultado.reglasAplicadas.validaciones,
        validationErrors: resultado.validationErrors,
        allValidationErrors: resultado.allValidationErrors,
        hasValidationErrors: totalValidationErrors > 0,
        isValid: bloqueantes === 0 && errores === 0,
        validationSummary: {
          total: totalValidationErrors,
          bloqueantes,
          errores,
          warnings
        }
      };

    } catch (error) {
      console.error(`❌ Error aplicando reglas al documento ${documento.id}:`, error);
      throw error;
    }
  }

  /**
   * Aplicar reglas a múltiples documentos en batch
   */
  async applyRulesToDocuments(documentos, options = {}) {
    console.log(`🔄 Aplicando reglas a ${documentos.length} documentos...`);

    const resultados = [];
    let totalReglasAplicadas = 0;

    for (const documento of documentos) {
      const resultado = await this.applyRulesToDocument(documento, options);
      resultados.push(resultado);
      totalReglasAplicadas += resultado.totalReglasAplicadas;
    }

    console.log(`✅ Procesamiento completado: ${totalReglasAplicadas} reglas aplicadas en total`);

    return {
      documentos: resultados.map(r => r.documento),
      totalReglasAplicadas,
      detallesPorDocumento: resultados.map(r => ({
        documento: r.reglasAplicadas.documento,
        lineas: r.reglasAplicadas.lineas,
        impuestos: r.reglasAplicadas.impuestos,
        total: r.totalReglasAplicadas
      }))
    };
  }

  /**
   * Limpiar cache de reglas
   */
  clearCache() {
    this.rules = [];
    this.rulesCache.clear();
    this.lastLoadTime.clear();
  }

  /**
   * Limpiar cache de lookups
   */
  clearLookupCache() {
    this.lookupCache.clear();
  }

  /**
   * Obtener estadísticas del cache
   */
  getCacheStats() {
    return {
      size: this.lookupCache.size,
      keys: Array.from(this.lookupCache.keys()).slice(0, 10) // Mostrar primeros 10
    };
  }
}

module.exports = BusinessRulesEngine;