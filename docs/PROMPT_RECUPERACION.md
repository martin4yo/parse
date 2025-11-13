# 🔄 Prompt de Recuperación de Contexto - Parse

Copia y pega este prompt al iniciar una nueva sesión:

---

## Contexto de la Aplicación Parse

**Parse** es una aplicación especializada en extracción, transformación y envío de datos de comprobantes fiscales. **NO** gestiona pagos, rendiciones ni flujos de dinero.

### Funcionalidades Core:
1. ✅ Carga de comprobantes (PDF/Imágenes)
2. ✅ Extracción de datos con pipeline de IA:
   - Prompt clasificador → detecta tipo de comprobante
   - Prompt especializado → extrae campos específicos
3. ✅ Prompts editables guardados en tabla `ai_prompts`
4. ✅ Transformación con reglas de negocio (tabla `reglas_negocio`)
5. ✅ Completado de datos según parámetros (tabla `parametros_maestros`)
6. ✅ Sincronización bidireccional con SQL vía API (ya implementado)

### Base de Datos:
- **Nombre**: `parse_db` (PostgreSQL)
- **Estado**: Migrada desde `rendiciones_db` con todas las tablas y datos

### Tablas Principales de Parse:
- `ai_prompts` - Prompts editables para pipeline de extracción (11 configurados)
- `documentos_procesados` - Comprobantes cargados (30 existentes)
- `documento_lineas` - Detalle/items de comprobantes (43 líneas)
- `documento_impuestos` - Impuestos extraídos (46 registros)
- `reglas_negocio` - Reglas de transformación (vacía, por configurar)
- `parametros_maestros` - Tabla de parámetros para completado (39 registros)
- `sync_configurations` - Config de sincronización SQL (1 configurada)
- `sync_api_keys` - API keys para sync (1 configurada)

### Variables de Entorno Actuales:
```env
DATABASE_URL="postgresql://postgres:Q27G4B98@149.50.148.198:5432/parse_db"
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=AIzaSyB1tACPbJXzXcvd0LEE-uxpwCG0Qh0nGB8
PORT=5050
```

### Stack Tecnológico:
- Backend: Node.js + Express (puerto 5050)
- Frontend: React/Next.js (dev: 3000, prod: 8084)
- ORM: Prisma
- IA: Gemini (actual), Google Document AI (roadmap)

### Funcionalidades Heredadas a ELIMINAR:
- ❌ Gestión de efectivo y tarjetas
- ❌ Módulos de rendiciones/gastos
- ❌ Flujos de aprobación y reembolsos

### Archivos de Contexto:
- `PARSE_CONTEXT.md` - Documentación completa del proyecto
- `CLAUDE.md` - Configuración de puertos y notas de desarrollo
- `ARQUITECTURA_MONOREPO.md` - Arquitectura del monorepo

**¿Por dónde empezamos?**

---

**Nota**: Lee `PARSE_CONTEXT.md` para más detalles técnicos y arquitectura completa.
