# 📄 Parse - Sistema de Extracción y Transformación de Comprobantes

**Parse** es una aplicación especializada en la extracción, transformación y envío de datos de comprobantes fiscales y comerciales argentinos.

## 🎯 Funcionalidades

- ✅ **Carga de comprobantes**: PDF e imágenes
- ✅ **Extracción con IA**: Pipeline de prompts (clasificación → extracción específica)
- ✅ **Prompts editables**: Configurables desde la UI sin tocar código
- ✅ **Reglas de negocio**: Transformaciones y validaciones configurables
- ✅ **Completado automático**: Tabla de parámetros para enriquecer datos
- ✅ **Sincronización SQL**: Integración bidireccional con sistemas externos
- ✅ **Multitenant**: Soporte para múltiples clientes/organizaciones

## 🏗️ Arquitectura

```
parse/
├── backend/          # API Node.js + Express + Prisma
│   ├── src/
│   │   ├── routes/   # Endpoints REST
│   │   ├── services/ # Lógica de negocio
│   │   └── middleware/
│   └── prisma/       # Schema y migraciones
│
├── frontend/         # Web app React/Next.js
│   ├── src/
│   │   ├── app/      # Pages (App Router)
│   │   ├── components/
│   │   └── lib/      # Utilidades
│   └── public/
│
└── docs/             # Documentación técnica completa
    ├── INDEX.md      # 📚 Índice de toda la documentación
    ├── ROADMAP-2025.md
    ├── SISTEMA-APRENDIZAJE-PATRONES.md
    └── ... (100+ documentos)
```

## 📚 Documentación

**Ver índice completo:** [`docs/INDEX.md`](./docs/INDEX.md)

**Documentos clave:**
- 🗺️ [Roadmap 2025](./docs/ROADMAP-2025.md) - Plan de desarrollo completo
- ⚙️ [Sistema de Aprendizaje de Patrones](./docs/SISTEMA-APRENDIZAJE-PATRONES.md) - Reduce costos de IA en 60-85%
- 🎨 [Mejoras UX Validaciones](./docs/MEJORAS-VALIDACIONES-UX.md) - Experiencia de usuario mejorada
- 💳 [Google Cloud Billing Setup](./docs/GOOGLE-CLOUD-BILLING-SETUP.md) - Configuración de Document AI
```

## 🚀 Inicio Rápido

### Requisitos
- Node.js >= 18
- PostgreSQL >= 14

### 1. Instalar dependencias

```bash
npm run install:all
```

### 2. Configurar variables de entorno

**Backend** (`backend/.env`):
```env
DATABASE_URL="postgresql://user:password@host:5432/parse_db"
PORT=5050
GEMINI_API_KEY=tu_api_key
ENABLE_AI_EXTRACTION=true
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5050
```

### 3. Configurar base de datos

```bash
cd backend
npx prisma db push
npx prisma generate
```

### 4. Ejecutar en desarrollo

```bash
# Opción 1: Backend y frontend juntos
npm run dev

# Opción 2: Por separado
npm run dev:backend
npm run dev:frontend
```

Accede a:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5050

## 📊 Base de Datos

**Base de datos**: `parse_db` (PostgreSQL)

**Tablas principales**:
- `documentos_procesados` - Comprobantes cargados
- `documento_lineas` - Detalle de items
- `documento_impuestos` - Impuestos extraídos
- `ai_prompts` - Prompts editables
- `reglas_negocio` - Reglas de transformación
- `parametros_maestros` - Tabla de parámetros
- `sync_configurations` - Config de sincronización SQL

## 🤖 Sistema de IA

Parse utiliza un **pipeline de prompts en 2 fases**:

1. **Clasificador**: Detecta el tipo de comprobante
   - Factura A/B/C
   - Nota de Crédito/Débito
   - Remito
   - Recibo
   - Despacho de aduana

2. **Extractor especializado**: Extrae campos según el tipo detectado
   - Cabecera: emisor, receptor, totales, impuestos
   - Detalle: items con cantidad, precio, subtotal

**Proveedores soportados**:
- Google Gemini (actual)
- OpenAI
- Anthropic Claude
- Google Document AI (roadmap)

## 🔄 Flujo de Procesamiento

```
Upload → Clasificación → Extracción → Transformación → Completado → Validación → Sync SQL
```

1. Usuario sube PDF/imagen
2. IA clasifica tipo de documento
3. IA extrae datos con prompt específico
4. Reglas de negocio transforman/validan
5. Parámetros completan datos faltantes
6. Sistema envía a SQL Server externo (opcional)

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express
- **ORM**: Prisma
- **Base de datos**: PostgreSQL
- **IA**: Google Gemini API
- **Auth**: JWT + Google OAuth

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: Shadcn/ui + Tailwind CSS
- **State**: React Context
- **Forms**: React Hook Form + Zod

## 📚 Documentación

- `PARSE_CONTEXT.md` - Contexto completo del proyecto
- `PLAN_LIMPIEZA.md` - Plan de limpieza de código heredado
- `PROMPT_RECUPERACION.md` - Prompt para recuperar contexto
- `CLAUDE.md` - Configuración de puertos y desarrollo

## 🔐 Seguridad

- Autenticación JWT
- Multitenant con aislamiento de datos
- API keys encriptadas en BD
- Rate limiting
- CORS configurado

## 📈 Roadmap

- [ ] Migración a Google Document AI
- [ ] Editor visual de reglas de negocio
- [ ] Webhooks para notificaciones
- [ ] Integración directa con AFIP
- [ ] Custom ML model con facturas argentinas

## 🧪 Testing

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## 🚀 Deployment

Ver `DEPLOYMENT.md` para instrucciones detalladas de despliegue en producción.

**Puertos recomendados**:
- Backend: 5050
- Frontend desarrollo: 3000
- Frontend producción: 8084

## 📞 Soporte

Para reportar problemas o consultas:
- GitHub Issues: [link]
- Email: [email]

## 📄 Licencia

MIT License - ver `LICENCIA.md`

---

**Última actualización**: 2025-10-29
**Versión**: 1.0.0
