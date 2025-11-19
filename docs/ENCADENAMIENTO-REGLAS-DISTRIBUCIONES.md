# Encadenamiento de Reglas: EXTRACT_JSON_FIELDS + CREATE_DISTRIBUTION

## 🎯 Objetivo

Crear distribuciones automáticamente extrayendo información de campos JSON en `parametros_maestros` o cualquier otra tabla.

## 🔧 Nuevas Acciones Implementadas

### 1. **EXTRACT_JSON_FIELDS** - Extraer Campos JSON

Extrae múltiples campos de un JSON almacenado en cualquier tabla y los guarda temporalmente en el documento.

**Parámetros:**
- `tabla`: Tabla de donde leer (default: 'parametros_maestros')
- `campoConsulta`: Campo por el cual buscar (ej: 'codigo')
- `valorConsulta`: Valor a buscar o campo con `{campo}`
- `filtroAdicional`: Filtros adicionales (ej: `{ "tipo_campo": "codigo_producto" }`)
- `campos`: Array de mappings JSON → campo destino

### 2. **CREATE_DISTRIBUTION** - Mejorado con `subcuentasCampo`

Ahora soporta leer subcuentas desde un campo JSON extraído previamente.

**Nuevos parámetros:**
- `subcuentasCampo`: Campo del cual leer array de subcuentas (ej: `"{subcuentasJSON}"`)

## 📋 Ejemplo Completo

### Estructura en parametros_maestros

```json
{
  "tipo_campo": "codigo_producto",
  "codigo": "PROD001",
  "nombre": "Producto de Prueba",
  "parametros_json": {
    "dimension": {
      "tipo": "CENTRO_COSTO",
      "nombre": "Centro de Costo"
    },
    "subcuentas": [
      {
        "codigo": "CC001",
        "nombre": "Administración",
        "porcentaje": 60
      },
      {
        "codigo": "CC002",
        "nombre": "Ventas",
        "porcentaje": 40
      }
    ]
  }
}
```

### Regla de Negocio

```json
{
  "codigo": "AUTO_DISTRIBUIR_POR_PRODUCTO",
  "nombre": "Crear distribución automática desde producto",
  "tipo": "TRANSFORMACION",
  "aplicaA": "LINEAS",
  "configuracion": {
    "condiciones": [
      {
        "campo": "codigoProducto",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "acciones": [
      {
        "operacion": "EXTRACT_JSON_FIELDS",
        "tabla": "parametros_maestros",
        "campoConsulta": "codigo",
        "valorConsulta": "{codigoProducto}",
        "filtroAdicional": {
          "tipo_campo": "codigo_producto"
        },
        "campos": [
          {
            "campoJSON": "dimension.tipo",
            "campoDestino": "dimensionTipo"
          },
          {
            "campoJSON": "dimension.nombre",
            "campoDestino": "dimensionNombre"
          },
          {
            "campoJSON": "subcuentas",
            "campoDestino": "subcuentasJSON"
          }
        ]
      },
      {
        "operacion": "CREATE_DISTRIBUTION",
        "dimensionTipoCampo": "{dimensionTipo}",
        "dimensionNombreCampo": "{dimensionNombre}",
        "subcuentasCampo": "{subcuentasJSON}"
      }
    ],
    "logicOperator": "AND",
    "stopOnMatch": false
  }
}
```

## 🔄 Flujo de Ejecución

1. **Condición**: Verifica que `codigoProducto` no esté vacío

2. **EXTRACT_JSON_FIELDS**:
   - Busca en `parametros_maestros` donde `codigo = {codigoProducto}` y `tipo_campo = 'codigo_producto'`
   - Extrae `parametros_json.dimension.tipo` → guarda en campo temporal `dimensionTipo`
   - Extrae `parametros_json.dimension.nombre` → guarda en campo temporal `dimensionNombre`
   - Extrae `parametros_json.subcuentas` (array) → guarda en campo temporal `subcuentasJSON` (como JSON string)

3. **CREATE_DISTRIBUTION**:
   - Lee `dimensionTipo` y `dimensionNombre` de los campos temporales
   - Lee y parsea el array de subcuentas desde `subcuentasJSON`
   - Crea registro en `documento_distribuciones`
   - Crea registros en `documento_subcuentas` (2 en este ejemplo: Administración 60%, Ventas 40%)

## 📊 Resultado en la Base de Datos

### documento_distribuciones
```
lineaId: "abc-123"
tipoDimension: "CENTRO_COSTO"
tipoDimensionNombre: "Centro de Costo"
importeDimension: 1000.00
```

### documento_subcuentas
```
distribucionId: "dist-001"
codigoSubcuenta: "CC001"
subcuentaNombre: "Administración"
porcentaje: 60
importe: 600.00

distribucionId: "dist-001"
codigoSubcuenta: "CC002"
subcuentaNombre: "Ventas"
porcentaje: 40
importe: 400.00
```

## 💡 Casos de Uso

### Caso 1: Desde Código de Producto
```json
{
  "acciones": [
    {
      "operacion": "EXTRACT_JSON_FIELDS",
      "tabla": "parametros_maestros",
      "campoConsulta": "codigo",
      "valorConsulta": "{codigoProducto}",
      "filtroAdicional": { "tipo_campo": "codigo_producto" },
      "campos": [
        { "campoJSON": "dimension.tipo", "campoDestino": "dim" },
        { "campoJSON": "subcuentas", "campoDestino": "subs" }
      ]
    },
    {
      "operacion": "CREATE_DISTRIBUTION",
      "dimensionTipoCampo": "{dim}",
      "subcuentasCampo": "{subs}"
    }
  ]
}
```

### Caso 2: Desde Atributos de Usuario
```json
{
  "acciones": [
    {
      "operacion": "EXTRACT_JSON_FIELDS",
      "tabla": "userAtributo",
      "campoConsulta": "userId",
      "valorConsulta": "{usuarioId}",
      "campos": [
        { "campoJSON": "atributo.centroCosto", "campoDestino": "cc" },
        { "campoJSON": "atributo.subcuentas", "campoDestino": "subs" }
      ]
    },
    {
      "operacion": "CREATE_DISTRIBUTION",
      "dimensionTipo": "CENTRO_COSTO",
      "dimensionNombreCampo": "{cc}",
      "subcuentasCampo": "{subs}"
    }
  ]
}
```

### Caso 3: Múltiples Lookups Antes de Distribuir
```json
{
  "acciones": [
    {
      "operacion": "LOOKUP",
      "campo": "codigoProducto",
      "tabla": "parametros_maestros",
      "campoConsulta": "nombre",
      "valorConsulta": "{descripcion}",
      "campoResultado": "codigo"
    },
    {
      "operacion": "EXTRACT_JSON_FIELDS",
      "tabla": "parametros_maestros",
      "campoConsulta": "codigo",
      "valorConsulta": "{codigoProducto}",
      "filtroAdicional": { "tipo_campo": "codigo_producto" },
      "campos": [
        { "campoJSON": "dimension.tipo", "campoDestino": "dim" },
        { "campoJSON": "subcuentas", "campoDestino": "subs" }
      ]
    },
    {
      "operacion": "CREATE_DISTRIBUTION",
      "dimensionTipoCampo": "{dim}",
      "subcuentasCampo": "{subs}"
    }
  ]
}
```

## 🎨 Formatos de Subcuentas Soportados

CREAT E_DISTRIBUTION soporta múltiples formatos de subcuentas en el JSON:

### Formato 1: Detallado
```json
[
  {
    "codigoSubcuenta": "CC001",
    "subcuentaNombre": "Administración",
    "cuentaContable": "1.1.01.001",
    "porcentaje": 100
  }
]
```

### Formato 2: Simplificado
```json
[
  {
    "codigo": "CC001",
    "nombre": "Administración",
    "cuenta": "1.1.01.001",
    "porcentaje": 100
  }
]
```

### Formato 3: Mínimo
```json
[
  {
    "codigo": "CC001",
    "porcentaje": 100
  }
]
```

Si no se proporciona `nombre`, se buscará automáticamente en `parametros_maestros` con `tipo_campo='subcuenta'`.

## 🔍 Logs de Debugging

Durante la ejecución verás logs como:

```
📦 [EXTRACT_JSON_FIELDS] Extrayendo campos de JSON...
✅ [EXTRACT_JSON_FIELDS] Registro encontrado en parametros_maestros
  ✓ dimension.tipo → dimensionTipo = CENTRO_COSTO
  ✓ dimension.nombre → dimensionNombre = Centro de Costo
  ✓ subcuentas → subcuentasJSON (array con 2 elementos)
📊 [CREATE_DISTRIBUTION] Creando distribución...
✅ [CREATE_DISTRIBUTION] Distribución creada: CENTRO_COSTO - Centro de Costo
📦 [CREATE_DISTRIBUTION] Usando subcuentas desde campo: 2 subcuentas
  ➕ Subcuenta: CC001 - Administración (60% = $600.00)
  ➕ Subcuenta: CC002 - Ventas (40% = $400.00)
✅ [CREATE_DISTRIBUTION] 2 subcuenta(s) creadas
```

## ✅ Ventajas de Este Enfoque

1. **Flexibilidad**: Funciona con cualquier tabla que tenga campos JSON
2. **Reutilizable**: Los campos extraídos pueden usarse para otras acciones
3. **Composable**: Puedes encadenar múltiples lookups
4. **Debuggeable**: Los campos temporales quedan en el documento (puedes verlos en logs)
5. **Escalable**: Agregar nuevas extracciones es trivial

## 📝 Notas Importantes

- Los campos temporales creados por EXTRACT_JSON_FIELDS **NO se guardan** en la BD, solo existen durante la ejecución de la regla
- Si el array de subcuentas está vacío, CREATE_DISTRIBUTION no creará la distribución
- Los porcentajes en las subcuentas deben sumar 100% (el sistema lo valida al guardar)
- Puedes usar tanto `{campo}` para referencias dinámicas como valores fijos

## Fecha

Noviembre 15, 2025
