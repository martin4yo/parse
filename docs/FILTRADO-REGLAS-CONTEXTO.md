# Filtrado de Reglas por Contexto (LINEAS vs IMPUESTOS)

**Implementado:** Noviembre 2025

Ahora puedes definir si una regla se aplica solo a líneas, solo a impuestos, o a todo el documento.

## Problema Resuelto

**Antes:** Las reglas de transformación se aplicaban indiscriminadamente a:
- Documento completo (documentos_procesados)
- Todas las líneas (documento_lineas)
- Todos los impuestos (documento_impuestos)

**Después:** Cada regla tiene un campo **"Aplica a"** que permite especificar exactamente dónde aplicar.

## Opciones Disponibles

| Opción | Se aplica a | Uso típico |
|--------|-------------|------------|
| **TODOS** | Documento + líneas + impuestos | Reglas genéricas (defecto) |
| **DOCUMENTO** | Solo documento_procesados | Validaciones del documento, extracción de orden de compra |
| **LINEAS** | Solo documento_lineas | Clasificación de productos, cuentas contables, categorías |
| **IMPUESTOS** | Solo documento_impuestos | Asignación de cuentas de IVA, IIBB, percepciones |

## Configuración

**En la UI (ReglaModal):**
1. Al crear/editar una regla, verás un nuevo selector "Aplica a"
2. Por defecto es "TODOS"
3. Cambia según necesites

**En la base de datos:**
```json
{
  "configuracion": {
    "aplicaA": "LINEAS",  // TODOS | DOCUMENTO | LINEAS | IMPUESTOS
    "condiciones": [...],
    "acciones": [...]
  }
}
```

## Ejemplos de Uso

### Regla para clasificar productos (solo líneas)
```json
{
  "codigo": "REGLA_PRODUCTO_IA",
  "configuracion": {
    "aplicaA": "LINEAS",
    "condiciones": [
      { "campo": "descripcion", "operador": "NOT_EMPTY" }
    ],
    "acciones": [
      {
        "operacion": "AI_LOOKUP",
        "campoTexto": "{descripcion}",
        "tabla": "parametros_maestros",
        "filtro": { "tipo_campo": "producto" }
      }
    ]
  }
}
```

### Regla para cuentas de impuestos (solo impuestos)
```json
{
  "codigo": "IMPUESTO_IVA_CUENTA",
  "configuracion": {
    "aplicaA": "IMPUESTOS",
    "condiciones": [
      { "campo": "tipo_impuesto", "operador": "EQUALS", "valor": "IVA" }
    ],
    "acciones": [
      {
        "operacion": "SET_VALUE",
        "campo": "cuenta_contable",
        "valor": "1105020101"
      }
    ]
  }
}
```

## Logs de Filtrado

Cuando una regla no aplica al contexto actual, verás:
```
⏭️ Regla "IMPUESTO_IVA_CUENTA" se salta (aplicaA: IMPUESTOS, contexto: LINEA_DOCUMENTO)
```

## Migración Automática

Las reglas existentes fueron migradas automáticamente con detección inteligente:
- Reglas con "producto", "item", "linea" → LINEAS
- Reglas con "impuesto", "iva", "tax" → IMPUESTOS
- Reglas con "documento", "factura" → DOCUMENTO
- Resto → TODOS

## Archivos Actualizados

- `businessRulesEngine.js` - Lógica de filtrado por contexto
- `ReglaModal.tsx` - Selector UI "Aplica a"
- `update-reglas-aplica-a.js` - Script de migración
