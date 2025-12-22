# IA Local con Ollama

Alternativa a Gemini/OpenAI para extracción de documentos.

## Instalación

```bash
# Instalación
curl -fsSL https://ollama.com/install.sh | sh

# Modelo recomendado para facturas argentinas
ollama pull llama3.2:3b  # 2GB disco, 4GB RAM

# Actualizar modelo
ollama pull llama3.2:3b

# Gestión
ollama list    # ver modelos
ollama rm modelo-viejo  # limpiar espacio
```

## Configuración en .env

```env
# Para usar IA local en lugar de Gemini
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
ENABLE_AI_EXTRACTION=true
USE_OLLAMA=true  # Nueva variable para alternar
```

## Ventajas

- Sin costos por token
- Funciona offline
- Datos privados (no salen del servidor)
- Sin límites de rate limiting
- Respuestas más consistentes

## Requisitos

- **Disco**: 5GB libres
- **RAM**: 4GB disponibles
- **CPU**: Cualquier procesador moderno

## Código Existente

La función `extractWithOllama()` ya existe en `documentProcessor.js:324`
Solo necesita configuración y testing.

## Estado

**Pendiente de implementación completa** - La función existe pero no está activa en producción.
