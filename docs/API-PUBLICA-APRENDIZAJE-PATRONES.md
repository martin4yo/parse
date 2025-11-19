# API Pública - Integración con Sistema de Aprendizaje de Patrones

**Endpoint:** `/api/v1/parse/document`
**Fecha:** 17 de Enero 2025
**Estado:** ✅ Integrado

---

## 📋 Resumen

La API pública de Parse **ya está completamente integrada** con el sistema de aprendizaje de patrones. Esto significa que los clientes de la API se benefician automáticamente de:

1. **Cache de documentos idénticos** (100% ahorro)
2. **Templates de proveedores recurrentes** (60-80% ahorro)
3. **Aprendizaje automático** progresivo

---

## 🚀 Beneficios para Clientes de la API

### Antes del Sistema

```
Request 1: Factura AWS mes 1 → IA completa → $0.003 → 8s
Request 2: Factura AWS mes 2 → IA completa → $0.003 → 8s  ← Documento similar
Request 3: Mismo archivo     → IA completa → $0.003 → 8s  ← Documento idéntico
```

**Costo total:** $0.009
**Tiempo total:** 24s

### Con el Sistema

```
Request 1: Factura AWS mes 1 → IA completa → $0.003 → 8s → Aprende
Request 2: Factura AWS mes 2 → Template    → $0.001 → 3s → Refuerza
Request 3: Mismo archivo     → Cache       → $0     → 1s → Sin IA
```

**Costo total:** $0.004 (56% ahorro)
**Tiempo total:** 12s (50% más rápido)

---

## 📡 Cambios en la Respuesta de la API

### Nuevos Campos en la Respuesta

```json
{
  "success": true,
  "documento": {
    "cabecera": { ... },
    "items": [ ... ],
    "impuestos": [ ... ],
    "modeloIA": "Pattern Cache (Exact Match)",
    "confianza": 0.99,

    // ============ NUEVOS CAMPOS ============
    "usedPattern": true,
    "patternInfo": {
      "type": "exact_match",
      "confidence": 0.99,
      "occurrences": 15
    }
  },
  "metadata": {
    "processingTime": 1200,
    "extractionMethod": "pattern-cache"
  }
}
```

### Descripción de Campos Nuevos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `usedPattern` | Boolean | `true` si se usó un patrón aprendido (no se llamó a IA) |
| `patternInfo` | Object\|null | Info del patrón usado (null si `usedPattern=false`) |
| `patternInfo.type` | String | `"exact_match"` o `"template"` |
| `patternInfo.confidence` | Float | Confianza del patrón (0.0-1.0) |
| `patternInfo.occurrences` | Integer | Veces que se ha usado este patrón |

---

## 🔍 Interpretación de Respuestas

### Caso 1: Documento Idéntico (Cache Hit)

```json
{
  "modeloIA": "Pattern Cache (Exact Match)",
  "confianza": 1.0,
  "usedPattern": true,
  "patternInfo": {
    "type": "exact_match",
    "confidence": 1.0,
    "occurrences": 25
  }
}
```

**Significado:**
- ✅ Documento **exactamente igual** ya procesado 25 veces
- ✅ **0% costo de IA** (gratis)
- ✅ **Ultra rápido** (~1 segundo)
- ✅ **100% confiable** (datos previamente validados)

### Caso 2: Template de Proveedor

```json
{
  "modeloIA": "Claude Vision",
  "confianza": 0.92,
  "usedPattern": true,
  "patternInfo": {
    "type": "template",
    "confidence": 0.88,
    "occurrences": 8
  }
}
```

**Significado:**
- ✅ Proveedor conocido (8 facturas previas)
- ✅ Template usado como contexto para IA
- ✅ **~60% reducción de costo** (extracción parcial)
- ✅ **Más rápido** (~3 segundos vs 8 segundos)

### Caso 3: Primera Vez / Sin Patrón

```json
{
  "modeloIA": "Claude Vision",
  "confianza": 0.91,
  "usedPattern": false,
  "patternInfo": null
}
```

**Significado:**
- Primera vez que se procesa este documento/proveedor
- IA completa usada
- El sistema **aprenderá** para próximas veces
- Próximas facturas de este proveedor serán más baratas/rápidas

---

## 🔧 Configuración

### No Requiere Cambios en el Cliente

El sistema es **100% transparente** para los clientes de la API:

- ✅ Misma URL
- ✅ Mismos headers
- ✅ Mismo body
- ✅ Campos existentes sin cambios
- ✅ Solo se agregan campos nuevos (no breaking changes)

### Variables de Entorno (Server-Side)

```env
# Habilitar/deshabilitar aprendizaje
ENABLE_PATTERN_LEARNING_PROMPTS=true

# Si false, la API siempre usará IA directamente
# (útil para testing o troubleshooting)
```

---

## 📊 Monitoreo y Métricas

### Recomendaciones para Clientes

Los clientes pueden trackear el ahorro observando:

```javascript
let totalRequests = 0;
let patternUsed = 0;
let totalCostSaved = 0;

responses.forEach(resp => {
  totalRequests++;

  if (resp.documento.usedPattern) {
    patternUsed++;

    if (resp.documento.patternInfo.type === 'exact_match') {
      totalCostSaved += 0.003; // 100% ahorro
    } else if (resp.documento.patternInfo.type === 'template') {
      totalCostSaved += 0.0018; // 60% ahorro
    }
  }
});

console.log(`Tasa de cache: ${(patternUsed/totalRequests*100).toFixed(1)}%`);
console.log(`Ahorro estimado: $${totalCostSaved.toFixed(4)}`);
```

### Ejemplo de Dashboard

```
┌─────────────────────────────────────────────┐
│  Parse API - Pattern Learning Stats        │
├─────────────────────────────────────────────┤
│  Total Requests:      1,234                 │
│  Pattern Cache Hits:    678 (54.9%)         │
│    - Exact Match:       234 (34.5%)         │
│    - Template:          444 (65.5%)         │
│                                             │
│  Estimated Cost:                            │
│    - Without Patterns:  $3.70               │
│    - With Patterns:     $1.85               │
│    - Savings:          $1.85 (50%)          │
│                                             │
│  Avg Processing Time:                       │
│    - Without Patterns:  7.2s                │
│    - With Patterns:     3.8s (47% faster)   │
└─────────────────────────────────────────────┘
```

---

## 🧪 Testing

### Ejemplo de Test: Documento Idéntico

```bash
# Request 1: Primera vez
curl -X POST http://localhost:5100/api/v1/parse/document \
  -H "X-API-Key: tu-api-key" \
  -F "file=@factura_aws.pdf"

# Response 1:
{
  "modeloIA": "Claude Vision",
  "usedPattern": false,
  "patternInfo": null
}

# Request 2: Mismo archivo
curl -X POST http://localhost:5100/api/v1/parse/document \
  -H "X-API-Key: tu-api-key" \
  -F "file=@factura_aws.pdf"

# Response 2:
{
  "modeloIA": "Pattern Cache (Exact Match)",
  "usedPattern": true,
  "patternInfo": {
    "type": "exact_match",
    "confidence": 1.0,
    "occurrences": 1
  }
}
```

### Ejemplo de Test: Proveedor Recurrente

```bash
# Request 1: Factura AWS Enero
curl ... -F "file=@aws_enero.pdf"
# usedPattern: false

# Request 2: Factura AWS Febrero (estructura similar)
curl ... -F "file=@aws_febrero.pdf"
# usedPattern: true
# patternInfo.type: "template"
# patternInfo.occurrences: 1
```

---

## ❓ FAQ

### ¿El patrón puede estar mal?

**Muy poco probable.** Los patrones solo se crean después de extracción exitosa con IA. Si el usuario corrige manualmente, el patrón se actualiza.

**Mitigación:** Patrones tienen confianza progresiva. Si hay inconsistencias, el sistema detecta y descarta el patrón.

### ¿Cómo sé si debo confiar en un patrón?

Observar `patternInfo.confidence` y `patternInfo.occurrences`:

- **Confidence > 0.95 y Occurrences > 10:** Muy confiable
- **Confidence > 0.85 y Occurrences > 5:** Confiable
- **Confidence < 0.80 o Occurrences < 3:** Revisar manualmente

### ¿Qué pasa si subo un PDF corrupto pero idéntico a uno previo?

El hash detectará que es idéntico y usará cache. **Pero** el cliente debería validar que `confianza` sea alta antes de confiar ciegamente.

### ¿Puedo desactivar el uso de patrones para un request específico?

**No directamente.** Pero puedes:

1. Pedir al servidor que desactive `ENABLE_PATTERN_LEARNING_PROMPTS`
2. O filtrar en el cliente: si `usedPattern=true`, re-procesar con IA forzada

### ¿Los patrones se comparten entre diferentes API keys del mismo tenant?

**Sí.** Los patrones son por **tenant**, no por API key. Esto maximiza el aprendizaje.

---

## 🔒 Seguridad y Privacidad

### Aislamiento de Patrones

- ✅ Patrones son **por tenant** (aislados)
- ✅ Tenant A **nunca** verá patrones de Tenant B
- ✅ Hash SHA-256 es **one-way** (no se puede reconstruir el archivo)

### Datos Almacenados

Los patrones almacenan:
- ✅ Hash del archivo (SHA-256)
- ✅ Datos extraídos (JSON)
- ❌ **NO** almacenan el archivo original
- ❌ **NO** almacenan contenido sensible raw

---

## 📝 Changelog de la API

### Versión 1.1 (17 Enero 2025)

**Agregado:**
- ✅ Campo `usedPattern` en respuesta
- ✅ Campo `patternInfo` en respuesta
- ✅ Sistema de aprendizaje automático
- ✅ Cache de documentos idénticos
- ✅ Templates de proveedores

**Sin cambios:**
- Estructura de `cabecera`, `items`, `impuestos`
- Headers requeridos
- Body format

**Breaking changes:** Ninguno

---

## 🚀 Roadmap

### 📋 Mejoras Futuras (Pendientes)

#### 1. Endpoint de Estadísticas de Patrones
**Prioridad:** Media
**Esfuerzo:** 2-3 horas

```
GET /api/v1/parse/stats
```

**Retornar:**
```json
{
  "totalRequests": 1234,
  "patternCacheHits": 678,
  "exactMatchHits": 234,
  "templateHits": 444,
  "estimatedSavings": {
    "cost": "$1.85",
    "time": "2.5 hours"
  },
  "topPatterns": [...]
}
```

#### 2. Webhook de Patrones Nuevos
**Prioridad:** Baja
**Esfuerzo:** 3-4 horas

**Uso:** Notificar cuando se aprende un patrón nuevo (útil para validación manual)

```json
{
  "event": "pattern.created",
  "pattern": {
    "type": "extraccion_proveedor_template",
    "cuit": "30-12345678-9",
    "confidence": 0.85
  }
}
```

#### 3. Header de Control `X-Force-AI`
**Prioridad:** Media
**Esfuerzo:** 1 hora

**Implementación:**
```bash
curl -X POST /api/v1/parse/document \
  -H "X-API-Key: key" \
  -H "X-Force-AI: true" \  # Bypass patrones
  -F "file=@doc.pdf"
```

**Uso:** Forzar uso de IA cuando se necesite re-validar un documento

#### 4. Endpoint de Gestión de Patrones
**Prioridad:** Baja
**Esfuerzo:** 4-5 horas

```
DELETE /api/v1/parse/patterns/:type
GET /api/v1/parse/patterns
```

**Uso:** Permitir a clientes gestionar sus propios patrones aprendidos

#### 5. Exportación/Importación de Patrones
**Prioridad:** Baja
**Esfuerzo:** 5-6 horas

**Uso:** Migrar patrones entre entornos (dev/staging/prod)

---

**Nota:** Estas mejoras se implementarán según demanda de clientes y feedback de producción.

---

**Fin de la documentación**
