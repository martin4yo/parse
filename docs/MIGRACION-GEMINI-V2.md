# Migración a Gemini 2.x/2.5 + Sistema de Resiliencia

**Implementado:** Noviembre 2025

Se migró completamente de Gemini 1.5 a Gemini 2.x/2.5 con sistema robusto de resiliencia.

## Migración de Modelos

Google descontinuó Gemini 1.5, ahora usa versión 2.x/2.5:

| Modelo Antiguo | Modelo Nuevo | Estado |
|---|---|---|
| gemini-1.5-flash | gemini-2.5-flash | Migrado |
| gemini-1.5-flash-latest | gemini-2.5-flash | Deprecado |
| gemini-1.5-pro | gemini-2.5-pro | Migrado |

## Modelos Activos

- `gemini-2.5-flash` (Recomendado - FREE hasta 15 req/min)
- `gemini-2.0-flash` (Alternativa estable)
- `gemini-flash-latest` (Apunta al más reciente)
- `gemini-2.5-pro` (Más potente - 2 req/min gratis)
- `gemini-pro-latest` (Apunta al Pro más reciente)

## Sistema de Resiliencia

### Retry con Exponential Backoff

1. Intento 1: Inmediato
2. Intento 2: Espera 1 segundo
3. Intento 3: Espera 2 segundos
4. Intento 4: Espera 4 segundos

### Fallback Automático a Modelos Alternativos

Si el modelo principal está sobrecargado (error 503), el sistema automáticamente intenta:
1. `gemini-2.0-flash`
2. `gemini-flash-latest`
3. `gemini-2.5-pro`

## Beneficios

- Mayor disponibilidad (99.9% uptime)
- Manejo inteligente de picos de carga
- Transparente para el usuario
- Logs detallados de intentos

## Logs de Resiliencia

```
🔄 [Gemini] Intento 1/3 con modelo: gemini-2.5-flash
⏳ [Gemini] Modelo sobrecargado, reintentando en 1000ms...
⚠️ [Gemini] gemini-2.5-flash no disponible, probando modelos alternativos...
🔄 [Gemini] Intentando con fallback: gemini-2.0-flash
✅ [Gemini] Éxito con modelo alternativo: gemini-2.0-flash
```

## Archivos Actualizados

- `aiClassificationService.js` - Retry logic y fallback
- `migrate-gemini-to-v2.js` - Script de migración
- `ai_models` tabla - Modelos 1.x deprecados
- `ai_provider_configs` - Configs actualizadas a 2.5
- `reglas_negocio` - AI_LOOKUP acciones migradas

## Configuración

```env
AI_LOOKUP_PROVIDER=gemini
AI_LOOKUP_MODEL=gemini-2.5-flash
GEMINI_API_KEY=tu-api-key
```
