# Parse - Aplicación de Extracción y Transformación de Comprobantes

## 📋 Descripción General

**Parse** es una aplicación especializada en la extracción, transformación y envío de datos de comprobantes fiscales y comerciales. No gestiona pagos ni rendiciones - su único propósito es procesar documentos y entregar datos estructurados.

---

## 🎯 Funcionalidades Core

### 1. Carga de Comprobantes
- Soporta **PDF** e **Imágenes**
- Upload mediante interfaz web
- Almacenamiento temporal para procesamiento

### 2. Extracción de Datos (Pipeline de IA)
- **Fase 1**: Prompt de detección → Identifica tipo de comprobante
- **Fase 2**: Prompt específico → Extrae campos según tipo detectado
- **Tecnología**: OCR + IA (actualmente Gemini, configurable)
- **Datos extraídos**:
  - **Cabecera**: Número, fecha, emisor, receptor, CUIT, totales, IVA
  - **Detalle**: Items con descripción, cantidad, precio unitario, subtotal

### 3. Prompts Editables
- Almacenados en **tabla de base de datos**
- Modificables por usuario sin tocar código
- Estructura:
  - Prompt de detección de tipo
  - Prompts específicos por tipo de comprobante (Factura A/B/C, Remito, Recibo, etc.)

### 4. Reglas de Negocio
- **Sistema de transformación** de datos extraídos
- Ejecución secuencial de reglas configurables
- Permite:
  - Normalizar formatos (fechas, números, CUIT)
  - Validar datos según estándares AFIP
  - Calcular campos derivados
  - Aplicar lógica condicional

### 5. Tabla de Parámetros
- **Completa datos faltantes** basándose en valores extraídos
- Ejemplos:
  - CUIT → Razón Social
  - Código producto → Descripción, categoría
  - Centro de costo → Cuenta contable
- Configuración dinámica sin hardcodear lógica

### 6. Sincronización SQL (Bidireccional)
- **API de entrada**: Recibe datos de sistemas externos
- **API de salida**: Envía comprobantes procesados
- Integración con ERP/contabilidad
- Endpoints ya implementados

---

## 🗄️ Base de Datos

### Información General
- **Nombre**: `parse_db`
- **Motor**: PostgreSQL (assumed, verificar)
- **Estado**: Base creada, tablas migradas desde `rendiciones_db`

### Tablas Principales

#### Procesamiento de Documentos
- `documents` - Comprobantes cargados y procesados
- `document_items` - Detalle/items de comprobantes
- `processing_logs` - Historial de procesamiento

#### Configuración de IA
- `prompts` - Prompts editables para extracción
- `prompt_types` - Tipos de comprobantes soportados

#### Reglas de Negocio
- `business_rules` - Reglas de transformación
- `parameters` - Tabla de parámetros para completado

#### Sincronización
- `sync_config` - Configuración de conexiones SQL
- `sync_logs` - Historial de sincronizaciones
- `api_endpoints` - Endpoints configurados

---

## 🚫 Funcionalidades NO Incluidas

Parse **NO** gestiona:
- ❌ Efectivo ni tarjetas
- ❌ Rendiciones de gastos
- ❌ Flujos de aprobación
- ❌ Reembolsos
- ❌ Gestión de usuarios con roles de aprobación
- ❌ Reportes financieros

Estas funcionalidades pertenecían a la aplicación anterior (`rendiciones_db`) y serán eliminadas.

---

## 🔄 Flujo de Procesamiento

```
1. UPLOAD
   ↓
2. DETECCIÓN (Prompt General)
   ↓
3. EXTRACCIÓN (Prompt Específico)
   ↓
4. TRANSFORMACIÓN (Reglas de Negocio)
   ↓
5. COMPLETADO (Tabla Parámetros)
   ↓
6. VALIDACIÓN
   ↓
7. ENVÍO A SQL (API)
```

---

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Puerto**: 5050
- **Base de datos**: PostgreSQL (`parse_db`)

### Frontend
- **Framework**: React/Next.js
- **Puerto desarrollo**: 3000
- **Puerto producción**: 8084 (PM2)

### IA/OCR
- **Actual**: Google Gemini API
- **Futuro**: Google Document AI (roadmap)
- **Fallback**: Regex local

### Variables de Entorno
```env
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/parse_db

# IA
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=AIzaSyChQdergthmXWkNDJ2xaDfyqfov3ac2fM8

# API
PORT=5050
NODE_ENV=production
```

---

## 📊 Arquitectura de Prompts

### Prompt de Detección
```
Analiza este documento y determina el tipo:
- Factura A/B/C
- Remito
- Recibo
- Nota de Crédito/Débito
- Ticket fiscal
- Otro
```

### Prompts Específicos (Ejemplos)

**Factura:**
```json
{
  "tipo": "FACTURA_A",
  "campos_extraer": [
    "punto_venta", "numero", "fecha_emision",
    "cuit_emisor", "razon_social_emisor",
    "cuit_receptor", "razon_social_receptor",
    "subtotal", "iva_21", "iva_10.5", "total",
    "items": [
      {"descripcion", "cantidad", "precio_unitario", "subtotal"}
    ]
  ]
}
```

---

## 🎯 Casos de Uso

1. **Digitalización masiva de facturas**
   - Escanear lote de facturas → Parse extrae datos → Envía a sistema contable

2. **Integración con ERP**
   - ERP envía PDF factura → Parse procesa → Devuelve JSON estructurado

3. **Validación fiscal**
   - Parse extrae CUIT → Valida contra tabla parámetros → Completa datos empresa

4. **Procesamiento híbrido**
   - Parse intenta IA → Si falla, marca para revisión manual → Usuario corrige → Re-procesa

---

## 📈 Roadmap

### Corto Plazo
- ✅ Migración a `parse_db`
- ⏳ Limpieza de funcionalidades heredadas
- ⏳ Optimización de prompts

### Mediano Plazo
- 🎯 Migración a Google Document AI
- 🎯 Editor visual de reglas de negocio
- 🎯 API webhooks para notificaciones

### Largo Plazo
- 🔮 Custom ML model con facturas argentinas
- 🔮 Integración directa con AFIP
- 🔮 Procesamiento batch automático

---

## 🔍 Debugging y Logs

### Logs de Procesamiento
```javascript
// Logs actuales en documentProcessor.js
console.log('Raw Gemini response:', response);
console.log('Cleaned JSON text:', cleanedText);
console.log('Re-cleaned JSON:', reCleanedText);
```

### Variables de Debug
```env
DEBUG_AI_RESPONSES=true
LOG_LEVEL=debug
SAVE_FAILED_EXTRACTIONS=true
```

---

## 📞 Contacto y Soporte

- **Documentación técnica**: `/docs`
- **Errores conocidos**: `CLAUDE.md`
- **Configuración**: `.env.example`

---

**Última actualización**: 2025-10-29
**Versión**: 1.0.0
**Estado**: En desarrollo - Migración desde rendiciones_db
