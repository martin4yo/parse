# Claude Code - Rendiciones App

## Configuración de Puertos y Dominios

**Puertos Locales:**
- Backend: **5100** (API) - `backend/.env` → `PORT=5100`
- Frontend Dev: **3000** (npm run dev)
- Frontend Prod: **8087** (PM2)

**Dominios Producción:**
- Frontend: `https://parsedemo.axiomacloud.com` (Nginx → localhost:8087)
- Backend: `https://api.parsedemo.axiomacloud.com` (Nginx → localhost:5100)

**Archivos de Configuración:**
- `backend/.env` → `PORT=5100`, `FRONTEND_URL=https://parsedemo.axiomacloud.com`
- `frontend/.env` → `NEXT_PUBLIC_API_URL=https://api.parsedemo.axiomacloud.com`
- `ecosystem.config.js` → Lee variables de los .env

---

## Variables de Entorno Actuales

```env
# IA Extraction
ENABLE_AI_EXTRACTION=true
USE_CLAUDE_VISION=true
USE_DOCUMENT_AI=false

# API Keys
GEMINI_API_KEY=tu-gemini-key
ANTHROPIC_API_KEY=tu-anthropic-key

# AI Classification (AI_LOOKUP)
AI_LOOKUP_PROVIDER=gemini
AI_LOOKUP_MODEL=gemini-2.5-flash

# Axio (Asistente IA)
AXIO_MODEL=claude-sonnet-4-20250514
```

---

## Flujo de Procesamiento de Documentos

1. **Pre-procesamiento**: Optimización inteligente de imagen/PDF
2. **Document AI**: Google Document AI (si configurado)
3. **Claude Vision**: Clasificación + Extracción con prompts especializados
4. **Gemini**: Extracción con reintentos y fallback
5. **Fallback**: Procesamiento local con regex
6. **Resultado**: Documento guardado (incluso con datos parciales)
7. **Limpieza**: Archivos temporales eliminados automáticamente

---

## Campos del Documento (para reglas)

| Campo | Descripción |
|-------|-------------|
| `cuitExtraido` | CUIT del emisor/proveedor |
| `cuitDestinatario` | CUIT del cliente/destinatario (empresa propia) |
| `cuitsExtraidos` | JSON array con todos los CUITs: `[{valor, contexto, confianza}]` |
| `codigoProveedor` | Código interno del proveedor |
| `razonSocialExtraida` | Razón social del emisor |
| `fechaExtraida` | Fecha del documento |
| `importeExtraido` | Importe total |
| `tipoComprobanteExtraido` | Tipo (FACTURA_A, etc.) |

---

## Operadores para Condiciones de Reglas

```
EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS
STARTS_WITH, ENDS_WITH, REGEX
IN, NOT_IN, IS_NULL, IS_NOT_NULL
IS_EMPTY, IS_NOT_EMPTY
GREATER_THAN, LESS_THAN, GREATER_OR_EQUAL, LESS_OR_EQUAL
```

## Acciones de Reglas

```
SET, LOOKUP, LOOKUP_JSON, AI_LOOKUP
EXTRACT_REGEX, CALCULATE, CREATE_DISTRIBUTION
VALIDAR_CUITS_PROPIOS
```

### Parámetro Maestro `cuit_propio`

Para configurar CUITs de empresas propias del tenant:

```bash
node src/scripts/setup-cuit-propio.js
```

Esto permite que la regla `VALIDAR_CUITS_PROPIOS` identifique automáticamente cuál CUIT es del emisor y cuál del destinatario.

## Transformaciones de Campo

```
NORMALIZE_CUIT, REMOVE_DASHES, REMOVE_SPECIAL_CHARS
TRIM_SPACES, UPPER_CASE, LOWER_CASE
REMOVE_LEADING_ZEROS, REMOVE_TRAILING_ZEROS
```

---

## Documentación Detallada

### Sprints Completados (ver docs/ para detalles)

| Sprint | Descripción | Documentación |
|--------|-------------|---------------|
| Sprint 7 | Dashboard Métricas OAuth | `docs/SESION-2025-01-21-SPRINT7-DASHBOARD-METRICAS.md` |
| Sprint 6.5 | UI Webhooks OAuth | `docs/SESION-2025-01-21-SPRINT6.5-WEBHOOKS-UI.md` |
| Sprint 6 | Webhooks API Pública | `docs/SESION-2025-01-21-SPRINT6-WEBHOOKS-API-PUBLICA.md` |
| Sprint 5 | Testing + OpenAPI/Swagger | `docs/SESION-2025-01-21-SPRINT5-TESTING-DOCS.md` |
| Sprint 4 | OAuth 2.0 + API Pública | `docs/SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md` |
| Sprint 1-3 | API Connectors Bidireccionales | `docs/SESION-2025-01-20-COMPLETA.md` |

### Funcionalidades (ver docs/ para detalles)

| Funcionalidad | Documentación |
|---------------|---------------|
| Agente Axio (Asistente IA) | `docs/AXIO-ASISTENTE-IA.md` |
| Optimización de Imágenes | `docs/OPTIMIZACION-IMAGENES.md` |
| Migración Gemini 2.5 | `docs/MIGRACION-GEMINI-V2.md` |
| Filtrado Reglas por Contexto | `docs/FILTRADO-REGLAS-CONTEXTO.md` |
| IA Local con Ollama | `docs/IA-LOCAL-OLLAMA.md` |
| Pattern Learning | `docs/SISTEMA-APRENDIZAJE-PATRONES.md` |
| Dimensiones Documento | `docs/SESION-2025-01-16-DIMENSIONES-DOCUMENTO.md` |
| Correcciones Motor Reglas | `docs/SESION-2025-12-09.md` |

### API Pública OAuth

| Recurso | Documentación |
|---------|---------------|
| Especificación API | `docs/API-PUBLICA-PARSE.md` |
| Swagger UI | `https://api.parsedemo.axiomacloud.com/api/v1/docs` |
| Ejemplos (JS, Python, cURL) | `docs/api-examples/` |

---

## Comandos Útiles

```bash
# Backend
cd backend
npm run dev              # Desarrollo
npm test                 # Tests con coverage
npx prisma db push       # Actualizar BD
npx prisma generate      # Regenerar cliente

# Frontend
cd frontend
npm run dev              # Desarrollo (puerto 3000)
npm run build            # Build producción

# Producción (PM2)
pm2 restart ecosystem.config.js
pm2 logs parse-backend
```

---

## Logs de Debugging

- `Raw Gemini response:` - Respuesta de Gemini
- `Cleaned JSON text:` - JSON después de limpieza
- `📊 Análisis de calidad de imagen:` - Métricas de imagen
- `🔧 Optimizando imagen...` - Proceso de optimización
- `✅ Imagen optimizada: X KB → Y KB` - Resultado
