# Pre-Filtro para AI_LOOKUP

## 📋 Resumen

El pre-filtro es una optimización que reduce las opciones enviadas a la IA antes de clasificar. Útil cuando tienes muchas opciones (>100) y recibes errores de rate limit.

---

## 🎛️ Configuración en la Regla

### Campos Nuevos

Agrega estos campos en la configuración de la acción `AI_LOOKUP`:

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `usarPrefiltro` | `boolean` / `null` | `null` (auto) | Control manual del pre-filtro |
| `maxCandidatos` | `number` | `50` | Máximo de candidatos después del filtrado |

### Valores de `usarPrefiltro`

- **`null`** (default): Automático - activa pre-filtro si hay más opciones que `maxCandidatos`
- **`true`**: Siempre usar pre-filtro
- **`false`**: Nunca usar pre-filtro (envía todas las opciones a IA)

---

## 💡 Ejemplos de Configuración

### Ejemplo 1: Pre-filtro Automático (Recomendado)

```json
{
  "operacion": "AI_LOOKUP",
  "campo": "codigoProducto",
  "campoTexto": "{descripcion}",
  "tabla": "parametros_maestros",
  "filtro": {
    "tipo_campo": "codigo_producto",
    "activo": true
  },
  "campoRetorno": "codigo",
  "umbralConfianza": 0.85,
  "requiereAprobacion": false,
  "aiProvider": "anthropic",
  "aiModel": "claude-3-haiku-20240307"
}
```

**Comportamiento (con maxCandidatos por defecto = 50):**
- Si hay ≤50 opciones → Envía todas a Claude
- Si hay >50 opciones → Aplica pre-filtro automáticamente

---

### Ejemplo 2: Pre-filtro Activado Manualmente

```json
{
  "operacion": "AI_LOOKUP",
  "campo": "codigoProducto",
  "campoTexto": "{descripcion}",
  "tabla": "parametros_maestros",
  "filtro": {
    "tipo_campo": "codigo_producto",
    "activo": true
  },
  "campoRetorno": "codigo",
  "usarPrefiltro": true,      // ← Forzar pre-filtro
  "maxCandidatos": 30,        // ← Máximo 30 candidatos (más restrictivo)
  "aiProvider": "anthropic",
  "aiModel": "claude-3-haiku-20240307"
}
```

**Comportamiento:**
- **Siempre** aplica pre-filtro, incluso con pocas opciones
- Reduce a máximo 30 candidatos antes de enviar a Claude

---

### Ejemplo 3: Pre-filtro Desactivado

```json
{
  "operacion": "AI_LOOKUP",
  "campo": "codigoProducto",
  "campoTexto": "{descripcion}",
  "tabla": "parametros_maestros",
  "filtro": {
    "tipo_campo": "codigo_producto",
    "activo": true
  },
  "campoRetorno": "codigo",
  "usarPrefiltro": false,     // ← Desactivar pre-filtro
  "aiProvider": "gemini",
  "aiModel": "gemini-1.5-flash"
}
```

**Comportamiento:**
- **Nunca** aplica pre-filtro
- Envía **todas** las opciones directamente a Gemini
- ⚠️ Puede fallar con rate limit si hay muchas opciones

**Cuándo usar:**
- Tienes pocas opciones (<50)
- Usas Gemini con límite alto de tokens
- Quieres máxima precisión sin pre-filtrado

---

### Ejemplo 4: Configuración para 2500 Productos

```json
{
  "operacion": "AI_LOOKUP",
  "campo": "codigoProducto",
  "campoTexto": "{descripcion}",
  "tabla": "parametros_maestros",
  "filtro": {
    "tipo_campo": "codigo_producto",
    "activo": true
  },
  "campoRetorno": "codigo",
  "usarPrefiltro": true,      // ← Activar pre-filtro
  "maxCandidatos": 50,        // ← Top 50 más relevantes
  "umbralConfianza": 0.80,    // ← Umbral más bajo para aprobar
  "requiereAprobacion": true, // ← Revisar manualmente sugerencias
  "aiProvider": "anthropic",
  "aiModel": "claude-3-haiku-20240307",
  "instruccionesAdicionales": "Prioriza coincidencias exactas en código o nombre. Si hay duda, elige la opción más general."
}
```

**Comportamiento:**
1. Pre-filtra 2500 → ~50 candidatos más relevantes
2. Claude clasifica entre los 50 mejores
3. Si confianza ≥80% y no requiere aprobación → Aplica automáticamente
4. Si confianza <80% → Guarda como sugerencia pendiente

---

## 🔍 Cómo Funciona el Pre-filtro

### Algoritmo de Scoring

El pre-filtro asigna puntos a cada opción:

| Coincidencia | Puntos |
|--------------|--------|
| **Código exacto** | +100 |
| **Código contiene palabra** | +50 |
| **Nombre contiene palabra** | +20 |
| **Palabra al inicio del nombre** | +10 |
| **Descripción contiene palabra** | +5 |
| **Múltiples coincidencias** | +3 por cada una |

### Ejemplo de Scoring

**Texto:** `"Tornillo hexagonal 5mm inoxidable"`

**Palabras clave extraídas:** `["tornillo", "hexagonal", "5mm", "inoxidable"]`

**Opciones con score:**

```
1. TOR-HEX-5-INOX - "Tornillo Hexagonal 5mm Inoxidable" → Score: 200
   - "tornillo" en nombre (+20)
   - "hexagonal" en nombre (+20)
   - "5mm" en nombre (+20)
   - "inoxidable" en nombre (+20)
   - Múltiples coincidencias: 4 x 3 = +12
   - Código parcial "TOR" de "tornillo" (+50)
   - Código parcial "HEX" de "hexagonal" (+50)

2. TOR-HEX-6 - "Tornillo Hexagonal 6mm" → Score: 110
   - "tornillo" en nombre (+20)
   - "hexagonal" en nombre (+20)
   - Múltiples coincidencias: 2 x 3 = +6
   - Código parcial "TOR" (+50)
   - Código parcial "HEX" (+50)

3. TUE-HEX-5-INOX - "Tuerca Hexagonal 5mm Inoxidable" → Score: 85
   - "hexagonal" en nombre (+20)
   - "5mm" en nombre (+20)
   - "inoxidable" en nombre (+20)
   - Múltiples coincidencias: 3 x 3 = +9
```

**Resultado:** Se envían a Claude los top 50 con mayor score.

---

## 📊 Logs de Debug

Cuando el pre-filtro está activado, verás estos logs:

```
🤖 [AI Classification] Iniciando clasificación...
   Provider: anthropic
   Model: claude-3-haiku-20240307
   Texto: "Tornillo hexagonal 5mm"
   Opciones iniciales: 2500
   Campo retorno: codigo
🔍 [Pre-filtro] Activado (2500 opciones)
   Palabras clave: tornillo, hexagonal, 5mm
   Top 3 candidatos:
     1. TOR-HEX-5 - Tornillo Hexagonal 5mm (score: 185)
     2. TOR-HEX-6 - Tornillo Hexagonal 6mm (score: 110)
     3. TUE-HEX-5 - Tuerca Hexagonal 5mm (score: 85)
✅ [Pre-filtro] Reducido a 50 candidatos
🤖 [AI Classification] Enviando a Claude...
✅ [AI Classification] Clasificación exitosa
   Opción: Tornillo Hexagonal 5mm
   Valor: TOR-HEX-5
   Confianza: 0.95
```

---

## ⚙️ Configuración Óptima por Caso

### Caso 1: Pocas opciones (<50)
```json
{
  "usarPrefiltro": null  // O false
}
```

### Caso 2: Opciones medias (50-200)
```json
{
  "usarPrefiltro": null,     // Auto
  "maxCandidatos": 50
}
```

### Caso 3: Muchas opciones (200-1000)
```json
{
  "usarPrefiltro": true,
  "maxCandidatos": 50
}
```

### Caso 4: Muchísimas opciones (>1000)
```json
{
  "usarPrefiltro": true,
  "maxCandidatos": 30,       // Más restrictivo
  "umbralConfianza": 0.80,   // Más permisivo
  "requiereAprobacion": true // Revisar sugerencias
}
```

---

## 🚨 Troubleshooting

### Error: "Rate limit exceeded"

**Causa:** Demasiadas opciones enviadas a Claude

**Solución:**
```json
{
  "usarPrefiltro": true,
  "maxCandidatos": 30  // Reducir candidatos
}
```

---

### Pre-filtro no encuentra candidatos

**Logs:**
```
🔍 [Pre-filtro] Activado (2500 opciones)
   Palabras clave: abc, xyz
⚠️ [Pre-filtro] No se encontraron coincidencias. Usando fallback con 50 opciones aleatorias
✅ [Pre-filtro] Reducido a 50 candidatos
```

**Comportamiento:** Cuando el pre-filtro no encuentra coincidencias por palabras clave, automáticamente envía una muestra aleatoria de opciones a la IA como fallback. Esto asegura que la clasificación siempre tenga opciones para analizar semánticamente.

**¿Por qué es seguro?**
- La IA aún puede encontrar coincidencias semánticas aunque no haya palabras clave comunes
- Es mejor que la IA analice 50 opciones aleatorias a que falle completamente
- El fallback solo se activa cuando NO hay coincidencias de texto

**Soluciones adicionales si el fallback no es suficiente:**

1. **Desactivar pre-filtro temporalmente:**
```json
{
  "usarPrefiltro": false
}
```

2. **Aumentar candidatos del fallback:**
```json
{
  "maxCandidatos": 100
}
```

3. **Mejorar descripción del producto en la factura**

---

### Clasificación incorrecta

**Causa:** Pre-filtro eliminó la opción correcta

**Solución 1: Aumentar candidatos**
```json
{
  "maxCandidatos": 100  // De 50 a 100
}
```

**Solución 2: Desactivar pre-filtro**
```json
{
  "usarPrefiltro": false
}
```

**Solución 3: Mejorar instrucciones para la IA**
```json
{
  "instruccionesAdicionales": "Si el código del producto coincide parcialmente, priorízalo sobre coincidencias en nombre"
}
```

---

## 📈 Métricas de Rendimiento

### Sin Pre-filtro (2500 opciones)
- **Tokens:** ~50,000
- **Velocidad:** 3-5 segundos
- **Costo:** $0.015 por clasificación
- **Rate Limit:** ❌ Falla con 50k/min

### Con Pre-filtro (50 candidatos)
- **Tokens:** ~2,000
- **Velocidad:** 1-2 segundos
- **Costo:** $0.001 por clasificación
- **Rate Limit:** ✅ OK
- **Precisión:** 95%+ (igual o mejor)

**Ahorro:** **93% en tokens, 15x en costo**

---

## 🎯 Recomendación Final

Para tu caso con 2500 productos, usa esta configuración:

```json
{
  "operacion": "AI_LOOKUP",
  "campo": "codigoProducto",
  "campoTexto": "{descripcion}",
  "tabla": "parametros_maestros",
  "filtro": {
    "tipo_campo": "codigo_producto",
    "activo": true
  },
  "campoRetorno": "codigo",
  "usarPrefiltro": true,
  "maxCandidatos": 50,
  "umbralConfianza": 0.85,
  "requiereAprobacion": false,
  "aiProvider": "anthropic",
  "aiModel": "claude-3-haiku-20240307",
  "instruccionesAdicionales": "Prioriza coincidencias exactas en código. Si hay múltiples opciones similares, elige la más específica."
}
```

Esto debería resolver tu problema de rate limit y mantener alta precisión.
