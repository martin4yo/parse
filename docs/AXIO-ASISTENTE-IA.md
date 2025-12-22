# Agente Axio - Asistente de IA para Parse

**Implementado:** 5 de Diciembre 2025

Se implementó **Axio**, un asistente de IA conversacional integrado en Parse que ayuda a:
- Crear y modificar **reglas de negocio** (tradicionales y con IA)
- **Optimizar prompts** de extracción de datos de documentos
- Consultar configuraciones existentes

## Características

- **Widget flotante** estilo chat disponible en todas las pantallas (esquina inferior derecha)
- **Motor IA**: Claude Sonnet 4 (Anthropic)
- **Confirmación de acciones**: Las acciones que modifican datos requieren confirmación del usuario
- **Sugerencias contextuales**: Propone comandos útiles al hacer clic en el ícono de bombilla
- **Validación inteligente**: Corrige automáticamente errores comunes en la generación de reglas
- **Mensajes amigables**: Los errores técnicos se muestran de forma clara al usuario

## Acciones Disponibles

| Acción | Descripción |
|--------|-------------|
| `crear_regla_tradicional` | Crear regla con condiciones y acciones SET/LOOKUP/REGEX |
| `crear_regla_ia` | Crear regla con AI_LOOKUP para clasificación inteligente |
| `modificar_regla` | Modificar una regla existente |
| `afinar_prompt` | Mejorar un prompt de extracción (crea versión local si es global) |
| `analizar_prompt` | Analizar y sugerir mejoras a un prompt |
| `consultar_reglas` | Listar reglas existentes con filtros |
| `consultar_prompts` | Listar prompts disponibles |
| `probar_regla` | Testear una regla con datos de ejemplo |
| `ayuda` | Mostrar comandos disponibles |

## Ejemplos de Uso

```
"Crea una regla para que cuando la descripción contenga 'hosting'
 se asigne la cuenta 5101020301"

"Crea una regla para clasificar gastos de combustible"

"Crea una regla con IA para clasificar el tipo de producto
 según la descripción"

"El prompt de facturas A no extrae bien el CAE, mejóralo para
 que busque también 'Código de Autorización'"

"Muéstrame las reglas activas de transformación"

"Analiza el prompt EXTRACCION_FACTURA_B"

"¿Qué puedes hacer?"
```

## Archivos del Sistema

**Frontend:**
- `frontend/src/components/chat/ChatWidget.tsx` - Widget principal con UI completa
- `frontend/src/components/chat/ChatMessage.tsx` - Componente de mensaje con formato markdown
- `frontend/src/components/chat/ChatWidgetWrapper.tsx` - Wrapper que verifica autenticación
- `frontend/src/components/chat/index.ts` - Exports del módulo
- `frontend/src/lib/chatService.ts` - Servicio HTTP con tipos TypeScript

**Backend:**
- `backend/src/routes/chat.js` - Endpoints REST con autenticación
- `backend/src/services/aiAssistantService.js` - Procesamiento con Claude, system prompt especializado
- `backend/src/services/actionExecutorService.js` - Ejecución de acciones con manejo de errores

**Modificados:**
- `backend/src/index.js` - Registro de ruta `/api/chat`
- `frontend/src/app/layout.tsx` - Integración de `ChatWidgetWrapper`

## Configuración

Variables de entorno en `backend/.env`:
```env
# Requerida
ANTHROPIC_API_KEY=sk-ant-...

# Opcional (usa claude-sonnet-4-20250514 por defecto)
AXIO_MODEL=claude-sonnet-4-20250514
```

## Endpoints API

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/chat` | Procesar mensaje del usuario | JWT |
| POST | `/api/chat/confirm-action` | Confirmar/cancelar acción pendiente | JWT |
| GET | `/api/chat/health` | Estado del servicio | No |
| GET | `/api/chat/suggestions` | Obtener sugerencias de comandos | JWT |
| GET | `/api/chat/context` | Información de contexto del tenant | JWT |

## Flujo de Creación de Reglas

1. Usuario escribe comando en lenguaje natural
2. Axio procesa con Claude y genera estructura de regla
3. Sistema valida y normaliza parámetros (corrige errores comunes)
4. Se muestra preview al usuario con botones Confirmar/Cancelar
5. Si confirma, se crea la regla en BD
6. Se muestra mensaje de éxito con código de la regla

## Operadores Soportados en Condiciones

```
EQUALS, NOT_EQUALS      - Comparación exacta
CONTAINS, NOT_CONTAINS  - Contiene texto
STARTS_WITH, ENDS_WITH  - Inicia/termina con
REGEX                   - Expresión regular
IN, NOT_IN              - Lista de valores
IS_NULL, IS_NOT_NULL    - Nulo/no nulo
IS_EMPTY, IS_NOT_EMPTY  - Vacío/no vacío
GREATER_THAN, LESS_THAN - Comparación numérica
GREATER_OR_EQUAL, LESS_OR_EQUAL
```

## Acciones Soportadas en Reglas

```
SET                 - Asignar valor fijo
LOOKUP              - Buscar en tabla por columna directa
LOOKUP_JSON         - Buscar en tabla donde el valor está DENTRO de un campo JSON
AI_LOOKUP           - Clasificación con IA
EXTRACT_REGEX       - Extraer con expresión regular
CALCULATE           - Cálculo matemático
CREATE_DISTRIBUTION - Crear distribución contable
```

## Transformaciones de Campo (transformacionesCampo)

Las reglas pueden incluir transformaciones que se aplican ANTES de evaluar condiciones:

```
NORMALIZE_CUIT        - Remueve guiones y espacios del CUIT (30-70717404-4 → 30707174044)
REMOVE_DASHES         - Remueve guiones
REMOVE_SPECIAL_CHARS  - Remueve todos los caracteres especiales
TRIM_SPACES           - Elimina espacios al inicio y final
UPPER_CASE            - Convierte a mayúsculas
LOWER_CASE            - Convierte a minúsculas
REMOVE_LEADING_ZEROS  - Remueve ceros a la izquierda
REMOVE_TRAILING_ZEROS - Remueve ceros a la derecha
CUSTOM_FUNCTION       - Función JavaScript personalizada
```

**Ejemplo de uso:**
```json
{
  "transformacionesCampo": [
    { "campo": "cuitExtraido", "transformacion": "NORMALIZE_CUIT" }
  ],
  "condiciones": [...],
  "acciones": [...]
}
```

## Campos Importantes del Documento

| Campo | Descripción | Nota |
|-------|-------------|------|
| `cuitExtraido` | CUIT del proveedor | NO usar "cuitProveedor" (no existe) |
| `codigoProveedor` | Código interno del proveedor | |
| `razonSocialExtraida` | Razón social | |
| `fechaExtraida` | Fecha del documento | |
| `importeExtraido` | Importe total | |
| `tipoComprobanteExtraido` | Tipo (FACTURA_A, etc.) | |

## Notas Técnicas

- Las acciones pendientes de confirmación expiran después de 10 minutos
- El sistema normaliza automáticamente operadores mal escritos (EQUAL→EQUALS, LIKE→CONTAINS)
- Si la IA genera condiciones con operadores lógicos mal ubicados (AND/OR), se extraen como `logicOperator`
- Los prompts globales no se modifican directamente; se crea una versión local del tenant
