# Sesión 27 Diciembre 2025 - Extracción de Múltiples CUITs

**Fecha:** 2025-12-27
**Objetivo:** Implementar extracción y validación de múltiples CUITs (emisor/destinatario) en documentos

---

## Resumen Ejecutivo

Se implementó la funcionalidad para extraer y distinguir automáticamente entre el CUIT del emisor (proveedor) y el CUIT del destinatario (empresa propia) en las facturas procesadas.

---

## Problemas Resueltos

### 1. Bug: Logs de Parse API no se mostraban

**Problema:** La página `/sync-admin/parse-logs` no mostraba ningún log.

**Causa:** En Express, el orden de las rutas importa. La ruta `GET /:id` estaba **antes** de `GET /parse-logs`, entonces Express interpretaba "parse-logs" como el parámetro `:id`.

**Solución:** Mover las rutas `/parse-logs` y `/parse-logs/:id` **antes** de `/:id` en `backend/src/routes/syncApiKeys.js`.

**Archivo modificado:** `backend/src/routes/syncApiKeys.js`

---

## Funcionalidades Implementadas

### 2. Nuevos Campos en Documentos

**Schema Prisma** (`backend/prisma/schema.prisma`):

```prisma
model documentos_procesados {
  // ... campos existentes ...
  cuitExtraido              String?    // CUIT del emisor/proveedor
  cuitDestinatario          String?    // NUEVO: CUIT del cliente/destinatario
  cuitsExtraidos            Json?      // NUEVO: Array con todos los CUITs
  // ... resto de campos ...
}
```

**Estructura de `cuitsExtraidos`:**
```json
[
  { "valor": "30-70717404-4", "contexto": "emisor", "confianza": 0.95 },
  { "valor": "30-51596921-3", "contexto": "destinatario", "confianza": 0.90 }
]
```

---

### 3. Prompt de Extracción Actualizado (v11)

**Archivos:**
- `EXTRACCION_FACTURA_CLAUDE` (BD: ai_prompts)
- `EXTRACCION_FACTURA_GEMINI` (BD: ai_prompts)

**Script de actualización:** `backend/src/scripts/update-prompt-cuits-extraidos.js`

**Nuevos campos extraídos por IA:**
- `cuit` - CUIT del emisor/proveedor (en encabezado)
- `cuitDestinatario` - CUIT del cliente/destinatario (en sección "Cliente")
- `cuitsExtraidos` - Array con todos los CUITs encontrados
- `razonSocialDestinatario` - Nombre del cliente

**Instrucciones en prompt:**
```
⚠️ IDENTIFICACIÓN DE CUITS - MUY IMPORTANTE:

1. **CUIT EMISOR** (campo "cuit"):
   - Aparece en el ENCABEZADO SUPERIOR del documento
   - Junto al LOGO o nombre de la empresa que EMITE la factura

2. **CUIT DESTINATARIO** (campo "cuitDestinatario"):
   - Aparece en la sección "DATOS DEL CLIENTE", "Señor/es:", "Cliente:"
   - Es quien COMPRA o recibe el servicio
```

---

### 4. Parámetro Maestro `cuit_propio`

**Nuevo tipo de campo en `parametros_maestros`:**

| Campo | Valor |
|-------|-------|
| `tipo_campo` | `cuit_propio` |
| `codigo` | CUIT normalizado (sin guiones) |
| `nombre` | Razón social de la empresa |
| `parametros_json` | `{ cuitFormateado, razonSocialAlternativa }` |

**Script de configuración:** `backend/src/scripts/setup-cuit-propio.js`

**Ejemplo configurado:**
```
Código: 30515969213
Nombre: Industrias Químicas y Mineras Timbó S.A.
```

**Funciones exportadas:**
```javascript
const { agregarCuitPropio, esCuitPropio } = require('./src/scripts/setup-cuit-propio');

// Agregar nuevo CUIT propio
await agregarCuitPropio(tenantId, '30-12345678-9', 'Mi Empresa S.A.');

// Verificar si un CUIT es propio
const esPropio = await esCuitPropio(tenantId, '30-12345678-9'); // true/false
```

---

### 5. Nueva Acción de Regla: `VALIDAR_CUITS_PROPIOS`

**Archivo:** `backend/src/services/businessRulesEngine.js`

**Método:** `applyValidarCuitsPropios()`

**Lógica:**
1. Obtiene `cuitExtraido` y `cuitDestinatario` del documento
2. Busca todos los `cuit_propio` del tenant en `parametros_maestros`
3. Si `cuitExtraido` está en `cuit_propio`:
   - Significa que la IA confundió emisor con destinatario
   - Intercambia los valores: `cuitExtraido` ↔ `cuitDestinatario`
4. Si no hay `cuitDestinatario` pero sí `cuitsExtraidos`:
   - Busca el CUIT que esté en `cuit_propio` y lo asigna como destinatario

**Parámetros de la acción:**
```json
{
  "operacion": "VALIDAR_CUITS_PROPIOS",
  "tipoCampoValidacion": "cuit_propio",
  "campoEmisor": "cuitExtraido",
  "campoDestinatario": "cuitDestinatario",
  "campoCuitsExtraidos": "cuitsExtraidos",
  "intercambiarSiNecesario": true
}
```

---

### 6. Regla de Negocio Automática

**Script:** `backend/src/scripts/crear-regla-validar-cuits.js`

**Regla creada:**
```
Código: VALIDAR_CUITS_PROPIOS
Nombre: Validar y corregir CUITs emisor/destinatario
Tipo: DOCUMENTO
Prioridad: 5 (alta)
```

**Configuración:**
```json
{
  "condiciones": [
    { "campo": "cuitExtraido", "operador": "IS_NOT_NULL" }
  ],
  "acciones": [
    {
      "operacion": "VALIDAR_CUITS_PROPIOS",
      "tipoCampoValidacion": "cuit_propio",
      "intercambiarSiNecesario": true
    }
  ]
}
```

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/prisma/schema.prisma` | Agregados campos `cuitDestinatario`, `cuitsExtraidos` |
| `backend/src/routes/syncApiKeys.js` | Reordenadas rutas (fix parse-logs) |
| `backend/src/routes/documentos.js` | Guardar nuevos campos CUIT |
| `backend/src/routes/parseApi.js` | Guardar nuevos campos CUIT |
| `backend/src/services/businessRulesEngine.js` | Nueva acción `VALIDAR_CUITS_PROPIOS` |
| `CLAUDE.md` | Documentación actualizada |

## Archivos Creados

| Archivo | Propósito |
|---------|-----------|
| `backend/src/scripts/update-prompt-cuits-extraidos.js` | Actualizar prompt de extracción |
| `backend/src/scripts/setup-cuit-propio.js` | Configurar CUITs propios del tenant |
| `backend/src/scripts/crear-regla-validar-cuits.js` | Crear regla de validación |

---

## Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│  1. EXTRACCIÓN IA                                           │
│     - Claude/Gemini extrae todos los CUITs del documento    │
│     - Intenta identificar emisor vs destinatario            │
│     - Guarda en: cuitExtraido, cuitDestinatario,           │
│       cuitsExtraidos                                        │
├─────────────────────────────────────────────────────────────┤
│  2. REGLA VALIDAR_CUITS_PROPIOS                            │
│     - Se ejecuta automáticamente post-extracción           │
│     - Busca cuitExtraido en parametros_maestros            │
│       (tipo_campo = 'cuit_propio')                         │
├─────────────────────────────────────────────────────────────┤
│  3. CORRECCIÓN AUTOMÁTICA                                   │
│     - Si cuitExtraido es del tenant:                       │
│       → INTERCAMBIAR con cuitDestinatario                  │
│     - Si no hay cuitDestinatario:                          │
│       → Buscar en cuitsExtraidos                           │
├─────────────────────────────────────────────────────────────┤
│  4. RESULTADO FINAL                                         │
│     - cuitExtraido = CUIT del proveedor (emisor real)      │
│     - cuitDestinatario = CUIT de la empresa propia         │
└─────────────────────────────────────────────────────────────┘
```

---

## Comandos Útiles

```bash
# Actualizar prompt de extracción
node src/scripts/update-prompt-cuits-extraidos.js

# Configurar CUITs propios (editar script primero)
node src/scripts/setup-cuit-propio.js

# Crear regla de validación
node src/scripts/crear-regla-validar-cuits.js

# Aplicar migración de BD
npx prisma db push
npx prisma generate
```

---

## Logs de Debug

Al procesar un documento, buscar en logs:

```
Datos extraídos: {
  fecha: 'SÍ',
  importe: 'SÍ',
  cuit: 'SÍ',
  cuitDestinatario: 'SÍ',      ← NUEVO
  cuitsExtraidos: 2,            ← NUEVO (cantidad)
  numeroComprobante: 'SÍ'
}
```

Al ejecutar la regla:
```
🔍 [VALIDAR_CUITS] Verificando CUITs:
   Emisor actual: 30-51596921-3
   Destinatario actual: N/A
   CUITs extraídos: 2
   📋 CUITs propios del tenant: 30515969213
   🔎 ¿Emisor es propio? SÍ
   🔄 INTERCAMBIANDO: El CUIT 30-51596921-3 es del destinatario
   ✅ Nuevo emisor: 30-70717404-4
   ✅ Nuevo destinatario: 30-51596921-3
```

---

## Próximos Pasos Sugeridos

1. **Agregar más CUITs propios** para cada tenant/empresa
2. **Validar en producción** con documentos reales
3. **Monitorear logs** para ver si la IA distingue correctamente
4. **Crear UI** para gestionar CUITs propios desde el frontend

---

## Referencias

- CLAUDE.md - Documentación principal
- ROADMAP-2025.md - Planificación
- docs/SESION-2025-12-09.md - Correcciones motor reglas
