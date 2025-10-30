# ✅ Fix: Normalización de CUIT para Reglas de Transformación

## Problema Original

Las reglas de transformación con operación `LOOKUP_JSON` no encontraban coincidencias cuando:
- **Documento tenía CUIT con guiones:** `30-58535765-7`
- **Base de datos tenía CUIT sin guiones:** `30585357657`
- **O viceversa**

Ejemplo de error:
```
LookupJSON no encontrado: proveedor.JSON.CUIT="30-58535765-7" -> usando defecto="null"
```

## Solución Implementada

### Archivo Modificado
`backend/src/services/businessRulesEngine.js` (líneas 544-553)

### Cambios
Agregada **normalización de valores** antes de comparar CUITs:
- Remueve guiones: `-`
- Remueve espacios en blanco
- Convierte a mayúsculas

```javascript
// Normalizar valores para comparación (remover guiones, espacios, etc.)
const normalizedJsonValue = String(jsonValue).replace(/[-\s]/g, '').toUpperCase();
const normalizedSearchValue = String(valorBusqueda).replace(/[-\s]/g, '').toUpperCase();

if (normalizedJsonValue === normalizedSearchValue) {
  encontrado = param;
  break;
}
```

## Resultados de Tests

### ✅ Test 1: CUIT con guiones en ambos lados
```
📄 30585357657_fc_0028-00045226.pdf
   CUIT: 30-58535765-7
   Razón Social ANTES: "IND. QUIMICA Y MINERA TIMBO S.A."

✅ LookupJSON exitoso: proveedor.JSON.CUIT="30-58535765-7" -> razonSocialExtraida="CALZETTA HNOS."
   Razón Social DESPUÉS: "CALZETTA HNOS."
```

### ✅ Test 2: Regla con lógica OR
La regla se dispara correctamente cuando:
- `razonSocialExtraida IS_EMPTY` (está vacío)
- **O** `razonSocialExtraida CONTAINS "TIMBO"`

## Compatibilidad

La normalización funciona con **todas las combinaciones**:
- ✅ Documento `30-58535765-7` + DB `30-58535765-7` (con guiones ambos)
- ✅ Documento `30-58535765-7` + DB `30585357657` (mixto)
- ✅ Documento `30585357657` + DB `30-58535765-7` (mixto)
- ✅ Documento `30585357657` + DB `30585357657` (sin guiones ambos)

## Scripts de Test Creados

1. **test-aplicar-reglas.js** - Test de transformación básica
2. **test-regla-timbo.js** - Test de lógica OR con condición CONTAINS
3. **ver-cuits-documentos.js** - Lista CUITs en documentos procesados

## Nota sobre Valor por Defecto

⚠️ La regla actual tiene `valorDefecto: null`, lo que significa:
- Si un documento cumple las condiciones PERO el CUIT no coincide con ningún proveedor
- El campo `razonSocialExtraida` se establece en `null`
- Esto sobrescribe valores existentes

**Recomendación:**
- Remover `valorDefecto` de la configuración de la regla
- O cambiar la condición para que SOLO se dispare con `IS_EMPTY`

## Comandos para Probar

```bash
# Test de transformación
cd backend && node src/scripts/test-aplicar-reglas.js

# Test con documentos "TIMBO"
cd backend && node src/scripts/test-regla-timbo.js

# Ver CUITs en documentos
cd backend && node src/scripts/ver-cuits-documentos.js

# Ver proveedores
cd backend && node src/scripts/ver-proveedores.js

# Ver configuración de regla
cd backend && node src/scripts/ver-regla-transformacion.js
```

## Estado

✅ **COMPLETO** - La normalización de CUITs está funcionando correctamente.
