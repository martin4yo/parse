# AI_LOOKUP - Implementación Completa

**Fecha:** 2025-11-13
**Estado:** ✅ Implementado y Funcional
**Versión:** 1.0

---

## 📋 Resumen

Se implementó la operación **AI_LOOKUP** en el sistema de reglas de negocio, permitiendo clasificación automática de textos usando IA (Gemini) para buscar coincidencias semánticas en `parametros_maestros`.

### ¿Qué hace AI_LOOKUP?

Toma un texto (ej: "NOTEBOOK LENOVO THINKPAD"), lo analiza con IA, busca en una lista de parámetros maestros (ej: categorías de gasto) y devuelve el mejor match con un score de confianza.

---

## 🏗️ Arquitectura Implementada

### Backend

#### 1. Base de Datos

**Tabla:** `sugerencias_ia`
```sql
CREATE TABLE sugerencias_ia (
  id               UUID PRIMARY KEY,
  reglaId          UUID REFERENCES reglas_negocio(id),
  entidadTipo      VARCHAR(50),       -- 'item', 'documento', 'impuesto'
  entidadId        UUID,
  campoDestino     VARCHAR(100),      -- Campo donde se guarda el resultado
  textoAnalizado   TEXT,              -- Texto que se analizó
  valorSugerido    JSONB,             -- { codigo, nombre, valor }
  confianza        DECIMAL(3,2),      -- 0.00 - 1.00
  razon            TEXT,              -- Explicación de la IA
  estado           VARCHAR(20),       -- 'pendiente', 'aprobada', 'rechazada', 'aplicada'
  revisadoPor      UUID REFERENCES users(id),
  revisadoAt       TIMESTAMP,
  valorFinal       JSONB,             -- Valor final si difiere del sugerido
  tenantId         UUID,
  createdAt        TIMESTAMP,
  updatedAt        TIMESTAMP
);
```

**Relaciones:**
- `reglas_negocio` ← `sugerencias_ia` (muchas sugerencias por regla)
- `tenants` ← `sugerencias_ia` (multi-tenant)
- `users` ← `sugerencias_ia` (auditoría de quién revisó)

#### 2. Servicio de IA

**Archivo:** `backend/src/services/aiClassificationService.js`

**Funciones principales:**
- `clasificar()` - Usa Gemini para encontrar mejor match
- `guardarSugerencia()` - Persiste sugerencias en BD
- `aplicarSugerencia()` - Aplica sugerencias aprobadas
- `extraerCampo()` - Soporta notación de punto para JSON

**Prompt Template:**
```
Eres un asistente experto en clasificación de datos financieros.

TEXTO A ANALIZAR:
"Notebook Lenovo Thinkpad 15 pulgadas"

OPCIONES DISPONIBLES:
1. Código: COMBUSTIBLE, Nombre: Combustibles y Lubricantes, ...
2. Código: TECNOLOGIA, Nombre: Tecnología e Informática, ...
3. Código: OFICINA, Nombre: Insumos de Oficina, ...
...

INSTRUCCIONES ADICIONALES:
Prioriza categorías específicas sobre genéricas...

Responde ÚNICAMENTE con JSON:
{
  "opcionElegida": 2,
  "confianza": 0.95,
  "razon": "Es un equipo de computación, corresponde a tecnología"
}
```

#### 3. Motor de Reglas

**Archivo:** `backend/src/services/businessRulesEngine.js`

**Nueva función:** `applyAILookup()`

**Lógica:**
```javascript
1. Obtener texto del campo especificado
2. Buscar opciones en parametros_maestros con filtro
3. Llamar a clasificar() del servicio IA
4. Decidir según confianza:
   - Si confianza >= umbral && !requiereAprobacion:
       → Aplicar automáticamente
   - Sino:
       → Guardar como sugerencia pendiente
5. Usar valor por defecto si hay error
```

#### 4. API Endpoints

**Archivo:** `backend/src/routes/sugerencias-ia.js`

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/sugerencias-ia` | GET | Listar con filtros |
| `/api/sugerencias-ia/stats` | GET | Estadísticas |
| `/api/sugerencias-ia/:id` | GET | Ver específica |
| `/api/sugerencias-ia/:id/aprobar` | POST | Aprobar sugerencia |
| `/api/sugerencias-ia/:id/rechazar` | POST | Rechazar sugerencia |
| `/api/sugerencias-ia/aprobar-batch` | POST | Aprobar múltiples |
| `/api/sugerencias-ia/:id` | DELETE | Eliminar |

#### 5. Metadatos

**Actualizado:** `/api/reglas/meta/acciones`

Ahora incluye:
```json
{
  "codigo": "AI_LOOKUP",
  "nombre": "Buscar con IA",
  "descripcion": "Usa IA para encontrar la mejor coincidencia semántica",
  "parametros": [
    "campo", "campoTexto", "tabla", "filtro",
    "campoRetorno", "umbralConfianza", "requiereAprobacion",
    "instruccionesAdicionales", "valorDefecto"
  ]
}
```

---

### Frontend

#### 1. Tipos TypeScript

**Archivo:** `frontend/src/lib/api.ts`

```typescript
export interface SugerenciaIA {
  id: string;
  reglaId: string;
  entidadTipo: string;
  entidadId: string;
  campoDestino: string;
  textoAnalizado: string;
  valorSugerido: {
    codigo?: string;
    nombre?: string;
    valor?: any;
  };
  confianza: number;
  razon?: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'aplicada';
  // ... más campos
}

export interface SugerenciaIAStats {
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  aplicadas: number;
  total: number;
  promedioConfianza: number;
}

export const sugerenciasIAApi = {
  list(), stats(), get(), aprobar(),
  rechazar(), aprobarBatch(), delete()
}
```

#### 2. Página de Sugerencias

**Archivo:** `frontend/src/app/(protected)/sugerencias-ia/page.tsx`

**Características:**
- 📊 Dashboard con estadísticas (pendientes, aprobadas, rechazadas)
- 🔍 Filtros por estado y confianza
- ✅ Aprobar/rechazar individual
- 📦 Aprobar en lote (selección múltiple)
- 🎨 UI con badges de color según confianza
- ⏱️ Timestamps de creación y revisión

**Vista previa:**
```
┌─────────────────────────────────────────────┐
│ 📊 Estadísticas                             │
│ Pendientes: 5 | Aprobadas: 12 | ...         │
├─────────────────────────────────────────────┤
│ 🔍 Filtros: [Estado ▼] [Confianza ▼]       │
├─────────────────────────────────────────────┤
│ ☐ Texto: "NOTEBOOK LENOVO THINKPAD"        │
│   💡 Sugerencia IA: Tecnología e Informática│
│   Confianza: 95% | Razón: Es un equipo...  │
│   [✓ Aprobar] [✗ Rechazar] [🗑️ Eliminar]   │
└─────────────────────────────────────────────┘
```

#### 3. Formulario AI_LOOKUP

**Archivo:** `frontend/src/components/parametros/AILookupForm.tsx`

**Campos del formulario:**
1. Campo destino (ej: `categoria`)
2. Campo de texto a analizar (ej: `{resumen.descripcionCupon}`)
3. Filtro JSON (ej: `{"tipo_campo": "categoria_gasto"}`)
4. Campo a retornar (codigo | nombre | descripcion | JSON)
5. Umbral de confianza (slider 0-100%)
6. Requiere aprobación manual (checkbox)
7. Instrucciones adicionales (textarea)
8. Valor por defecto (input)

**Vista previa en tiempo real** del JSON generado.

#### 4. Widget de Métricas

**Archivo:** `frontend/src/components/parametros/AIMetricsWidget.tsx`

Widget compacto para mostrar en otras páginas:
- Pendientes / Aprobadas
- Tasa de aprobación (%)
- Confianza promedio (%)
- Botón "Revisar X sugerencias"

---

## 🚀 Uso

### Paso 1: Crear Parámetros Maestros

```bash
cd backend
node scripts/demo-ai-lookup.js
```

Esto crea:
- 5 categorías de ejemplo (COMBUSTIBLE, ALIMENTOS, TECNOLOGIA, etc.)
- 1 regla con AI_LOOKUP
- 5 clasificaciones de prueba

### Paso 2: Crear Regla con AI_LOOKUP

**Desde la UI:**
1. Ir a Parámetros → Reglas de Negocio
2. Nueva Regla
3. Agregar acción → **Buscar con IA**
4. Configurar:
   - Campo destino: `categoria`
   - Texto a analizar: `{resumen.descripcionCupon}`
   - Filtro: `{"tipo_campo": "categoria_gasto", "activo": true}`
   - Campo a retornar: `codigo`
   - Umbral: 85%
   - Requiere aprobación: ✓

**Desde código:**
```json
{
  "codigo": "CLASIFICAR_GASTOS_IA",
  "nombre": "Clasificar Gastos con IA",
  "tipo": "IMPORTACION_DKT",
  "activa": true,
  "prioridad": 10,
  "configuracion": {
    "condiciones": [
      {
        "campo": "resumen.descripcionCupon",
        "operador": "IS_NOT_EMPTY",
        "valor": ""
      }
    ],
    "acciones": [
      {
        "campo": "categoria",
        "operacion": "AI_LOOKUP",
        "campoTexto": "{resumen.descripcionCupon}",
        "tabla": "parametros_maestros",
        "filtro": {
          "tipo_campo": "categoria_gasto",
          "activo": true
        },
        "campoRetorno": "codigo",
        "umbralConfianza": 0.85,
        "requiereAprobacion": true,
        "instruccionesAdicionales": "Prioriza categorías específicas",
        "valorDefecto": "SIN_CLASIFICAR"
      }
    ]
  }
}
```

### Paso 3: Procesar Documentos

La regla se ejecuta automáticamente al:
- Importar archivos DKT
- Procesar documentos
- Aplicar reglas manualmente

### Paso 4: Revisar Sugerencias

1. Ir a **Sugerencias IA** (menú)
2. Ver sugerencias pendientes
3. Aprobar/rechazar individualmente
4. O aprobar en lote las de alta confianza

---

## 📊 Flujo Completo

```
┌──────────────┐
│ Importar DKT │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│ Motor de Reglas ejecuta reglas   │
│ de tipo IMPORTACION_DKT           │
└──────┬───────────────────────────┘
       │
       ▼ (encuentra AI_LOOKUP)
┌──────────────────────────────────┐
│ applyAILookup()                  │
│ 1. Extrae texto del campo        │
│ 2. Busca opciones en BBDD        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ aiClassificationService          │
│ → Llama a Gemini                 │
│ → Parsea respuesta JSON          │
│ → Devuelve: opción + confianza   │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ ¿Confianza >= umbral              │
│ && !requiereAprobacion?          │
└──────┬───────────────────────────┘
       │
       ├─ SÍ ──▶ Aplicar automáticamente
       │         Guardar como "aplicada"
       │
       └─ NO ──▶ Guardar como "pendiente"
                 Usuario revisa en UI
                 Aprueba/rechaza
```

---

## 🎯 Ejemplos Reales

### Ejemplo 1: Clasificar Gastos de Tarjeta

**Texto:** "YPF FULL ESTACION DE SERVICIO"

**Opciones:**
- COMBUSTIBLE (Combustibles y Lubricantes)
- ALIMENTOS (Alimentos y Bebidas)
- TECNOLOGIA (Tecnología e Informática)

**Resultado IA:**
```json
{
  "opcionElegida": 1,
  "confianza": 0.98,
  "razon": "Es una estación de servicio YPF, corresponde a combustibles"
}
```

**Acción:** Aplicado automáticamente (confianza > 85%)

---

### Ejemplo 2: Clasificar Item Ambiguo

**Texto:** "SERVICIO PROFESIONAL CONSULTORÍA"

**Opciones:** (mismas que arriba)

**Resultado IA:**
```json
{
  "opcionElegida": null,
  "confianza": 0.65,
  "razon": "No hay coincidencia clara con las opciones disponibles"
}
```

**Acción:** Sugerencia pendiente (confianza < 85%)
→ Usuario revisa manualmente
→ Puede elegir o crear nueva categoría

---

### Ejemplo 3: Campo JSON Anidado

**Configuración:**
```json
{
  "campoRetorno": "parametros_json.subcuenta"
}
```

Si `parametros_json = {"subcuenta": "5.1.02", "centro": "ADM"}`, entonces devuelve `"5.1.02"`.

---

## 💰 Costos Estimados

Usando Gemini Flash (modelo actual):

| Concepto | Cantidad | Costo Unitario | Total Mensual |
|----------|----------|----------------|---------------|
| Items procesados | 5,000 | $0.001 | **$5** |
| Documentos procesados | 1,000 | $0.003 | **$3** |
| **TOTAL** | - | - | **~$8/mes** |

**Nota:** Costos reales dependen del volumen y longitud de textos.

---

## 🔧 Configuración Avanzada

### Ajustar Umbral de Confianza

```json
{
  "umbralConfianza": 0.90  // Más estricto (solo >=90%)
  "umbralConfianza": 0.75  // Más permisivo
}
```

### Forzar Aprobación Manual

```json
{
  "requiereAprobacion": true  // Siempre a revisión manual
}
```

### Instrucciones Contextuales

```json
{
  "instruccionesAdicionales": "Si es un proveedor de tecnología (ej: Dell, HP, Lenovo), siempre clasificar como TECNOLOGIA. Si menciona 'combustible' o 'nafta', siempre COMBUSTIBLE."
}
```

### Campos JSON Anidados

```json
{
  "campoRetorno": "parametros_json.contabilidad.cuenta"
}
```

---

## 📈 Monitoreo y Métricas

### Dashboard de IA

Métricas disponibles:
- ✅ Pendientes / Aprobadas / Rechazadas / Aplicadas
- 📊 Tasa de aprobación (%)
- 📈 Confianza promedio
- 🔍 Por regla, por período

### Logs

El sistema logea:
```
🤖 [AI Classification] Iniciando clasificación...
   Texto: "NOTEBOOK LENOVO THINKPAD"
   Opciones: 5
   Campo retorno: codigo
📨 [AI] Respuesta raw: {"opcionElegida": 2, ...}
✅ [AI Classification] Clasificación exitosa
   Opción: Tecnología e Informática
   Valor: TECNOLOGIA
   Confianza: 0.95
💾 [AI] Sugerencia guardada: abc-123-def
```

---

## 🐛 Troubleshooting

### Problema: "No hay opciones disponibles"

**Causa:** El filtro no encuentra parámetros.

**Solución:**
```javascript
// Verificar que existan parámetros
SELECT * FROM parametros_maestros
WHERE tipo_campo = 'categoria_gasto'
AND activo = true;

// Verificar tenantId
WHERE tenantId = 'tu-tenant-id' OR tenantId IS NULL;
```

### Problema: "Error de IA: respuesta inválida"

**Causa:** Gemini devolvió texto no-JSON.

**Solución:** El servicio ya limpia automáticamente. Si persiste, revisar `aiClassificationService.js` → `limpiarRespuestaJSON()`.

### Problema: Todas las sugerencias con baja confianza

**Causa:** Opciones poco descriptivas o instrucciones ambiguas.

**Solución:**
1. Agregar `descripcion` rica en parametros_maestros
2. Usar `instruccionesAdicionales` para dar contexto
3. Bajar `umbralConfianza` temporalmente

---

## 🔮 Mejoras Futuras

### Fase 2: Embeddings
- Usar embeddings en lugar de LLM directo
- Costo: ~$0.0001 por clasificación (vs $0.001 actual)
- Velocidad: ~100ms (vs 1-2s actual)
- Implementación: Google Vertex AI Embeddings + pgvector

### Fase 3: Fine-tuning
- Entrenar modelo específico con datos históricos
- Usar feedback (aprobadas/rechazadas) para mejorar
- Precisión esperada: 95%+

### Fase 4: Multi-idioma
- Soportar clasificación en inglés/portugués
- Detección automática de idioma

---

## 📚 Referencias

- [Gemini API Docs](https://ai.google.dev/docs)
- [Prisma Schema](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [REGLAS_IA_PROPUESTA.md](./REGLAS_IA_PROPUESTA.md) - Propuesta original
- [REGLAS_NEGOCIO.md](./REGLAS_NEGOCIO.md) - Sistema de reglas base

---

## ✅ Checklist de Implementación

- [x] Tabla `sugerencias_ia` en schema Prisma
- [x] Servicio `aiClassificationService`
- [x] Operación `AI_LOOKUP` en motor de reglas
- [x] Endpoints `/api/sugerencias-ia`
- [x] Metadatos actualizados
- [x] Página de sugerencias (UI)
- [x] Formulario AI_LOOKUP (UI)
- [x] Widget de métricas (UI)
- [x] Script de demo
- [x] Item de menú
- [x] Documentación

---

**Implementado por:** Claude (Anthropic)
**Fecha:** 2025-11-13
**Proyecto:** Parse Demo - Rendiciones App
