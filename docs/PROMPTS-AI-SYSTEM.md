# Sistema de Prompts Editables de IA

## ✅ Implementación Completa

Se ha implementado un sistema completo para gestionar prompts de IA sin modificar código:

### 📋 Componentes Creados

1. **Modelo de Base de Datos** (`schema.prisma`)
   - Tabla `ai_prompts` con soporte multi-tenant
   - Versionado automático
   - Métricas de uso (tasa de éxito, veces usado)
   - Soporte para diferentes motores (OpenAI, Gemini, Claude, Ollama)

2. **Servicio PromptManager** (`services/promptManager.js`)
   - Cache en memoria (TTL: 5 minutos configurables)
   - Sistema de fallback (tenant → global)
   - Reemplazo de variables `{{variable}}`
   - Métricas automáticas de rendimiento

3. **API REST** (`routes/prompts.js`)
   - `GET /api/prompts` - Listar prompts
   - `POST /api/prompts` - Crear prompt
   - `PUT /api/prompts/:id` - Actualizar prompt
   - `DELETE /api/prompts/:id` - Eliminar prompt
   - `POST /api/prompts/test` - Probar prompt con variables
   - `GET /api/prompts/stats/cache` - Estadísticas del cache
   - `POST /api/prompts/cache/clear` - Limpiar cache

4. **Seed de Prompts** (`prisma/seeds/prompts.js`)
   - Migración automática de prompts hardcodeados
   - 5 prompts pre-configurados:
     - Extracción facturas (OpenAI, Claude, Gemini, Ollama)
     - Extracción resúmenes de tarjeta

## 🚀 Próximos Pasos

### 1. Aplicar Migración de Prisma

```bash
cd backend
npx prisma migrate dev --name add_ai_prompts
npx prisma generate
```

### 2. Ejecutar Seed de Prompts

```bash
node prisma/seeds/prompts.js
```

### 3. Actualizar Funciones de Extracción

**YA ACTUALIZADO:** `extractWithOpenAI` ya usa PromptManager

**PENDIENTE - Actualizar estas funciones en `documentProcessor.js`:**

```javascript
// extractWithClaude (línea ~294)
async extractWithClaude(text, tenantId = null) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = await promptManager.getPromptText(
      'EXTRACCION_FACTURA_CLAUDE',
      { text },
      tenantId,
      'anthropic'
    );

    if (!prompt) {
      console.error('❌ Prompt EXTRACCION_FACTURA_CLAUDE no encontrado');
      return null;
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const result = JSON.parse(response.content[0].text);
    await promptManager.registrarResultado('EXTRACCION_FACTURA_CLAUDE', true, tenantId);
    return result;
  } catch (error) {
    console.error('Error with Claude extraction:', error);
    await promptManager.registrarResultado('EXTRACCION_FACTURA_CLAUDE', false, tenantId).catch(() => {});
    return null;
  }
}

// extractWithGemini (línea ~402)
async extractWithGemini(text, tenantId = null, retries = 0) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = await promptManager.getPromptText(
        'EXTRACCION_FACTURA_GEMINI',
        { text },
        tenantId,
        'gemini'
      );

      if (!prompt) {
        console.error('❌ Prompt EXTRACCION_FACTURA_GEMINI no encontrado');
        return null;
      }

      const result = await model.generateContent(prompt);
      let jsonText = result.response.text();

      // Limpiar respuesta (mantener lógica existente)
      jsonText = jsonText
        .replace(/```json\n?/g, '')
        .replace(/\n?```/g, '')
        .replace(/^[^{]*{/, '{')
        .replace(/}[^}]*$/, '}')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

      const data = JSON.parse(jsonText);
      await promptManager.registrarResultado('EXTRACCION_FACTURA_GEMINI', true, tenantId);
      return data;

    } catch (error) {
      console.error(`Error with Gemini extraction (attempt ${attempt + 1}):`, error);

      if (error.status === 503 && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Gemini service unavailable, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (attempt === retries) {
        await promptManager.registrarResultado('EXTRACCION_FACTURA_GEMINI', false, tenantId).catch(() => {});
        return null;
      }
    }
  }
  return null;
}

// extractResumenTarjetaWithAI (línea ~1684)
async extractResumenTarjetaWithAI(text, tenantId = null) {
  try {
    const limitedText = text.substring(0, 10000);

    const prompt = await promptManager.getPromptText(
      'EXTRACCION_RESUMEN_TARJETA',
      { text: limitedText },
      tenantId
    );

    if (!prompt) {
      console.error('❌ Prompt EXTRACCION_RESUMEN_TARJETA no encontrado');
      return null;
    }

    // Intentar con Gemini primero
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'tu-api-key-aqui') {
      try {
        console.log('🤖 [RESUMEN TARJETA] Intentando con Gemini...');
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await model.generateContent(prompt);
        let jsonText = result.response.text();

        // Limpiar respuesta
        jsonText = jsonText
          .replace(/```json\n?/g, '')
          .replace(/\n?```/g, '')
          .replace(/^[^{]*{/, '{')
          .replace(/}[^}]*$/, '}')
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .trim();

        const data = JSON.parse(jsonText);

        if (data.metadata && data.transacciones && Array.isArray(data.transacciones)) {
          await promptManager.registrarResultado('EXTRACCION_RESUMEN_TARJETA', true, tenantId);
          return data;
        }
      } catch (error) {
        console.error('⚠️ [RESUMEN TARJETA] Error con Gemini:', error.message);
      }
    }

    // Intentar con Anthropic como fallback
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'tu-api-key-aqui') {
      try {
        console.log('🤖 [RESUMEN TARJETA] Intentando con Anthropic...');
        const Anthropic = require('@anthropic-ai/sdk');
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const message = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });

        const responseText = message.content[0].text;
        let jsonText = responseText;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }

        const data = JSON.parse(jsonText);

        if (data.metadata && data.transacciones && Array.isArray(data.transacciones)) {
          await promptManager.registrarResultado('EXTRACCION_RESUMEN_TARJETA', true, tenantId);
          return data;
        }
      } catch (error) {
        console.error('⚠️ [RESUMEN TARJETA] Error con Anthropic:', error.message);
      }
    }

    await promptManager.registrarResultado('EXTRACCION_RESUMEN_TARJETA', false, tenantId);
    return null;

  } catch (error) {
    console.error('Error in extractResumenTarjetaWithAI:', error);
    await promptManager.registrarResultado('EXTRACCION_RESUMEN_TARJETA', false, tenantId).catch(() => {});
    return null;
  }
}
```

### 4. Pasar tenantId a las Funciones de Extracción

En los lugares donde se llama a las funciones de extracción (ej: `routes/documentos.js`), pasar el `tenantId`:

```javascript
// Antes
const data = await processor.extractWithGemini(text);

// Después
const data = await processor.extractWithGemini(text, req.tenantId);
```

## 📊 Uso del Sistema

### API Ejemplos

#### Listar Prompts
```bash
curl http://localhost:5050/api/prompts \
  -H "Authorization: Bearer TOKEN"
```

#### Crear Prompt Personalizado (por tenant)
```bash
curl -X POST http://localhost:5050/api/prompts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "clave": "EXTRACCION_FACTURA_GEMINI",
    "nombre": "Extracción Personalizada Tenant X",
    "prompt": "Mi prompt personalizado con {{text}}",
    "descripcion": "Versión customizada para mi empresa",
    "motor": "gemini",
    "variables": {
      "text": "Texto del documento"
    }
  }'
```

#### Probar Prompt
```bash
curl -X POST http://localhost:5050/api/prompts/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "clave": "EXTRACCION_FACTURA_GEMINI",
    "variables": {
      "text": "Texto de prueba..."
    },
    "motor": "gemini"
  }'
```

#### Ver Estadísticas del Cache
```bash
curl http://localhost:5050/api/prompts/stats/cache \
  -H "Authorization: Bearer TOKEN"
```

## 🎯 Beneficios

1. **Sin Modificar Código**: Prompts editables desde API/UI
2. **Multi-tenant**: Cada cliente puede tener sus propios prompts
3. **Versionado**: Historial automático de cambios
4. **Performance**: Cache en memoria con TTL configurable
5. **Métricas**: Tasa de éxito automática
6. **Fallback**: Sistema de tenant → global
7. **Variables**: Reemplazo dinámico tipo `{{variable}}`

## 🔧 Variables de Entorno

```env
# Cache de prompts (opcional)
PROMPT_CACHE_TTL=300000  # 5 minutos en ms (default)
```

## 📝 Variables Disponibles en Prompts

- `{{text}}` - Texto completo del documento
- (Puedes agregar más según necesites)

## 🚀 UI Futura (Recomendado)

Crear en el frontend:
- Página `/admin/prompts` con lista de prompts
- Editor de prompts con preview
- Selector de motor de IA
- Comparación de versiones
- Métricas visuales (gráficos de tasa de éxito)
- Test en tiempo real

## ✨ Estructura Final

```
backend/
├── prisma/
│   ├── schema.prisma         # ✅ Modelo ai_prompts agregado
│   └── seeds/
│       └── prompts.js         # ✅ Seed de prompts
├── src/
│   ├── services/
│   │   └── promptManager.js   # ✅ Gestor con cache
│   ├── routes/
│   │   └── prompts.js         # ✅ API REST
│   ├── lib/
│   │   └── documentProcessor.js # 🔄 Actualizar funciones restantes
│   └── index.js               # ✅ Rutas registradas
```

## 🎉 ¡Listo!

El sistema está funcionalmente completo. Solo falta:
1. Aplicar migración
2. Ejecutar seed
3. Actualizar las funciones restantes de documentProcessor.js
4. (Opcional) Crear UI de administración
