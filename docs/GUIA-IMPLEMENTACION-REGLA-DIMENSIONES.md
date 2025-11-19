# Guía de Implementación: REGLA_DIMENSIONES

## 🎯 Objetivo

Crear distribuciones automáticamente para cada línea de documento, leyendo la configuración desde `parametros_maestros` según el código de producto.

## 📋 Pasos de Implementación

### Paso 1: Configurar Productos en parametros_maestros

1. **Ir a Parámetros → Parámetros Maestros**
2. **Crear un nuevo parámetro** (o editar uno existente):
   - Tipo Campo: `codigo_producto`
   - Código: `PROD001` (o el que uses)
   - Nombre: Nombre descriptivo del producto

3. **Configurar el JSON** con dimensión y subcuentas:

```json
{
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
```

**Campos requeridos:**
- `dimension.tipo`: Código de la dimensión (CENTRO_COSTO, SUCURSAL, PROYECTO, etc.)
- `subcuentas`: Array con al menos una subcuenta
- `subcuentas[].codigo`: Código de la subcuenta
- `subcuentas[].porcentaje`: Porcentaje (debe sumar 100 en total)

**Campos opcionales:**
- `dimension.nombre`: Si no se provee, se buscará en parametros_maestros con tipo_campo='dimension'
- `subcuentas[].nombre`: Si no se provee, se buscará en parametros_maestros con tipo_campo='subcuenta'
- `subcuentas[].cuenta`: Cuenta contable (opcional)

### Paso 2: Crear la Regla REGLA_DIMENSIONES

1. **Ir a Parámetros → Reglas de Negocio**
2. **Click en "Nueva Regla"**
3. **Completar los datos:**

**Tab General:**
- Código: `REGLA_DIMENSIONES`
- Nombre: `Crear distribuciones desde código de producto`
- Descripción: `Extrae dimensión y subcuentas desde parametros_maestros según codigoProducto y crea las distribuciones automáticamente`
- Tipo: `TRANSFORMACION`
- Activa: ✅
- Prioridad: `100`
- Aplica a: `LINEAS`

**Tab Condiciones:**
- **Agregar Condición:**
  - Campo: `codigoProducto`
  - Operador: `No está vacío`

**Tab Acciones:**

- **Acción 1: Extraer Campos JSON**
  - Operación: `EXTRACT_JSON_FIELDS`
  - Tabla: `parametros_maestros`
  - Campo Consulta: `codigo`
  - Valor Consulta: `{codigoProducto}`
  - Filtro Adicional:
    ```json
    {
      "tipo_campo": "codigo_producto",
      "activo": true
    }
    ```
  - Campos a extraer:
    ```json
    [
      {
        "campoJSON": "dimension.tipo",
        "campoDestino": "_dimensionTipo"
      },
      {
        "campoJSON": "dimension.nombre",
        "campoDestino": "_dimensionNombre"
      },
      {
        "campoJSON": "subcuentas",
        "campoDestino": "_subcuentasJSON"
      }
    ]
    ```

- **Acción 2: Crear Distribución**
  - Operación: `CREATE_DISTRIBUTION`
  - Tipo Dimensión (Campo): `{_dimensionTipo}`
  - Nombre Dimensión (Campo): `{_dimensionNombre}`
  - Subcuentas (Campo): `{_subcuentasJSON}`

4. **Guardar la regla**

### Paso 3: Probar la Regla

1. **Procesar un documento** que tenga líneas con `codigoProducto`
2. **Aplicar reglas** desde la página Parse
3. **Verificar en la línea** que se hayan creado las distribuciones:
   - Click en el botón "Distribuciones" de la línea
   - Deberías ver la dimensión creada con sus subcuentas

### Paso 4: Verificar en la Base de Datos (Opcional)

```sql
-- Ver distribuciones creadas
SELECT
  dl.id,
  dl.descripcion as linea_descripcion,
  dd.tipoDimension,
  dd.tipoDimensionNombre,
  dd.importeDimension,
  ds.codigoSubcuenta,
  ds.subcuentaNombre,
  ds.porcentaje,
  ds.importe
FROM documento_lineas dl
JOIN documento_distribuciones dd ON dd."lineaId" = dl.id
JOIN documento_subcuentas ds ON ds."distribucionId" = dd.id
WHERE dl."codigoProducto" = 'PROD001'
ORDER BY dl.id, dd.orden, ds.orden;
```

## 🔍 Troubleshooting

### La regla no se aplica

**Verificar:**
1. ✅ La regla está activa
2. ✅ El campo `codigoProducto` no está vacío en la línea
3. ✅ Existe un registro en `parametros_maestros` con:
   - `tipo_campo = 'codigo_producto'`
   - `codigo = [valor de codigoProducto]`
   - `activo = true`

### No se crean las distribuciones

**Verificar logs del backend:**
```
📦 [EXTRACT_JSON_FIELDS] Extrayendo campos de JSON...
```

Si ves:
- `No se encontró registro` → El producto no existe en parametros_maestros
- `campo no encontrado en el JSON` → El JSON no tiene la estructura correcta

### Las subcuentas no tienen nombre

**Solución:**
- Agregar campo `nombre` en el JSON de subcuentas, O
- Crear registros en `parametros_maestros` con:
  - `tipo_campo = 'subcuenta'`
  - `codigo = [código de la subcuenta]`
  - `nombre = [nombre descriptivo]`

## 📊 Ejemplo Completo de Flujo

**1. Registro en parametros_maestros:**
```json
{
  "tipo_campo": "codigo_producto",
  "codigo": "PROD001",
  "nombre": "Laptop Dell",
  "parametros_json": {
    "dimension": {
      "tipo": "CENTRO_COSTO",
      "nombre": "Centro de Costo"
    },
    "subcuentas": [
      { "codigo": "CC001", "nombre": "IT", "porcentaje": 70 },
      { "codigo": "CC002", "nombre": "Admin", "porcentaje": 30 }
    ]
  }
}
```

**2. Línea de documento:**
```json
{
  "codigoProducto": "PROD001",
  "descripcion": "Laptop Dell XPS 15",
  "cantidad": 1,
  "precioUnitario": 1000,
  "subtotal": 1000
}
```

**3. Después de aplicar REGLA_DIMENSIONES:**

Se crean automáticamente:

**documento_distribuciones:**
```
tipoDimension: "CENTRO_COSTO"
tipoDimensionNombre: "Centro de Costo"
importeDimension: 1000
```

**documento_subcuentas:**
```
CC001 - IT - 70% - $700
CC002 - Admin - 30% - $300
```

## 🎉 Resultado

Cada línea que tenga un `codigoProducto` configurado en parametros_maestros obtendrá automáticamente su distribución de dimensiones y subcuentas, sin intervención manual.

## 📝 Notas Importantes

- Los campos que empiezan con `_` (como `_dimensionTipo`) son campos **temporales** que solo existen durante la ejecución de la regla
- La regla se ejecuta **cada vez que aplicas reglas** desde la página Parse
- Puedes tener múltiples productos con diferentes configuraciones de dimensiones
- Los porcentajes **deben sumar 100** en cada producto, sino dará error al guardar

## Fecha

Noviembre 15, 2025
