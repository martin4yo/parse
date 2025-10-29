# Lookups Dinámicos en Reglas de Negocio

## Descripción

Los **Lookups Dinámicos** permiten que las reglas de negocio consulten otras tablas de la base de datos durante la ejecución, haciendo posible que el resultado de una regla dependa de valores almacenados en parámetros, configuraciones de usuario, o cualquier otra tabla del sistema.

## ¿Cómo Funciona?

### Caso de Uso Típico
```
Número de Tarjeta → Buscar en tabla user_tarjetas_credito → Obtener código de dimensión del usuario → Asignar al campo codigoDimension
```

### Sintaxis de Lookup

```json
{
  "campo": "codigoDimension",
  "operacion": "LOOKUP",
  "tabla": "user_tarjetas_credito",
  "campoConsulta": "numeroTarjeta",
  "valorConsulta": "{resumen.numeroTarjeta}",
  "campoResultado": "user.codigoDimension",
  "valorDefecto": "DIM_DEFAULT"
}
```

### Parámetros de la Operación LOOKUP

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `campo` | Campo donde guardar el resultado | `"codigoDimension"` |
| `operacion` | Tipo de operación (siempre "LOOKUP") | `"LOOKUP"` |
| `tabla` | Tabla a consultar | `"user_tarjetas_credito"` |
| `campoConsulta` | Campo por el cual filtrar | `"numeroTarjeta"` |
| `valorConsulta` | Valor a buscar (puede ser referencia a campo) | `"{resumen.numeroTarjeta}"` |
| `campoResultado` | Campo que queremos obtener | `"user.codigoDimension"` |
| `valorDefecto` | Valor si no encuentra nada (opcional) | `"DIM_DEFAULT"` |

## Tablas Soportadas

### 1. user_tarjetas_credito
**Descripción**: Información de tarjetas de crédito y sus titulares

**Campos disponibles**:
- `numeroTarjeta`
- `user.nombre`, `user.apellido`, `user.email`
- `user.codigoDimension`, `user.rol`
- `banco.nombre`, `tipoTarjeta.nombre`

**Ejemplo**:
```json
{
  "campo": "titularNombre",
  "operacion": "LOOKUP",
  "tabla": "user_tarjetas_credito",
  "campoConsulta": "numeroTarjeta",
  "valorConsulta": "{resumen.numeroTarjeta}",
  "campoResultado": "user.nombre",
  "valorDefecto": "TITULAR DESCONOCIDO"
}
```

### 2. parametros_maestros
**Descripción**: Parámetros de configuración del sistema

**Campos disponibles**:
- `codigo`, `nombre`, `tipo_campo`
- `valor_padre`, `orden`, `activo`

**Ejemplo**:
```json
{
  "campo": "subcuenta",
  "operacion": "LOOKUP",
  "tabla": "parametros_maestros",
  "campoConsulta": "codigo",
  "valorConsulta": "{tipoProducto}",
  "campoResultado": "valor_padre",
  "valorDefecto": "SUB_DEFAULT"
}
```

### 3. usuarios
**Descripción**: Datos de usuarios del sistema

**Campos disponibles**:
- `id`, `nombre`, `apellido`, `email`
- `rol`, `activo`, `codigoDimension`

### 4. banco_tipo_tarjeta
**Descripción**: Configuración de bancos y tipos de tarjetas

**Campos disponibles**:
- `codigo`, `banco.nombre`, `tipoTarjeta.nombre`
- `activo`

### 5. Lookup Genérico
Para cualquier otra tabla del sistema, se puede usar el lookup genérico que detecta automáticamente los campos disponibles.

## Ejemplos Prácticos

### Ejemplo 1: Asignar Dimensión por Titular
```json
{
  "codigo": "DIMENSION_POR_TARJETA",
  "nombre": "Asignar Dimensión por Número de Tarjeta",
  "configuracion": {
    "condiciones": [
      {
        "campo": "resumen.numeroTarjeta",
        "operador": "IS_NOT_EMPTY",
        "valor": ""
      }
    ],
    "acciones": [
      {
        "campo": "codigoDimension",
        "operacion": "LOOKUP",
        "tabla": "user_tarjetas_credito",
        "campoConsulta": "numeroTarjeta",
        "valorConsulta": "{resumen.numeroTarjeta}",
        "campoResultado": "user.codigoDimension",
        "valorDefecto": "DIM_DEFAULT"
      }
    ]
  }
}
```

### Ejemplo 2: Subcuenta Basada en Parámetros
```json
{
  "codigo": "SUBCUENTA_POR_PRODUCTO",
  "nombre": "Subcuenta por Tipo de Producto",
  "configuracion": {
    "condiciones": [
      {
        "campo": "tipoProducto",
        "operador": "IS_NOT_EMPTY",
        "valor": ""
      }
    ],
    "acciones": [
      {
        "campo": "subcuenta",
        "operacion": "LOOKUP",
        "tabla": "parametros_maestros",
        "campoConsulta": "codigo",
        "valorConsulta": "{tipoProducto}",
        "campoResultado": "valor_padre",
        "valorDefecto": "SUB_DEFAULT"
      }
    ]
  }
}
```

### Ejemplo 3: Información del Titular en Observaciones
```json
{
  "codigo": "INFO_TITULAR_TARJETA",
  "nombre": "Información del Titular",
  "configuracion": {
    "condiciones": [
      {
        "campo": "resumen.numeroTarjeta",
        "operador": "IS_NOT_EMPTY",
        "valor": ""
      }
    ],
    "acciones": [
      {
        "campo": "titularNombre",
        "operacion": "LOOKUP",
        "tabla": "user_tarjetas_credito",
        "campoConsulta": "numeroTarjeta",
        "valorConsulta": "{resumen.numeroTarjeta}",
        "campoResultado": "user.nombre",
        "valorDefecto": "TITULAR DESCONOCIDO"
      },
      {
        "campo": "titularApellido",
        "operacion": "LOOKUP",
        "tabla": "user_tarjetas_credito",
        "campoConsulta": "numeroTarjeta",
        "valorConsulta": "{resumen.numeroTarjeta}",
        "campoResultado": "user.apellido",
        "valorDefecto": ""
      },
      {
        "campo": "observaciones",
        "operacion": "APPEND",
        "valor": "TITULAR: {titularNombre} {titularApellido}"
      }
    ]
  }
}
```

### Ejemplo 4: Validación por Perfil de Usuario
```json
{
  "codigo": "LIMITE_POR_PERFIL",
  "nombre": "Límite de Gasto por Perfil",
  "configuracion": {
    "condiciones": [
      {
        "campo": "resumen.importeTransaccion",
        "operador": "GREATER_THAN",
        "valor": "50000"
      }
    ],
    "acciones": [
      {
        "campo": "perfilUsuario",
        "operacion": "LOOKUP",
        "tabla": "user_tarjetas_credito",
        "campoConsulta": "numeroTarjeta",
        "valorConsulta": "{resumen.numeroTarjeta}",
        "campoResultado": "user.rol",
        "valorDefecto": "EMPLEADO"
      },
      {
        "campo": "observaciones",
        "operacion": "SET",
        "valor": "REQUIERE APROBACION - PERFIL: {perfilUsuario}"
      }
    ]
  }
}
```

## Referencias de Campos

### Valor de Consulta Dinámico
El parámetro `valorConsulta` puede ser:

1. **Referencia a campo**: `"{resumen.numeroTarjeta}"`
2. **Valor fijo**: `"VALOR_FIJO"`
3. **Referencia a campo procesado**: `"{tipoProducto}"`

### Campos Anidados
Los lookups soportan campos anidados usando notación de punto:
- `"user.nombre"` - Nombre del usuario asociado
- `"banco.nombre"` - Nombre del banco
- `"tipoTarjeta.nombre"` - Nombre del tipo de tarjeta

## Performance y Consideraciones

### Optimización
- Los lookups se ejecutan secuencialmente dentro de cada regla
- Se recomienda usar `valorDefecto` para evitar campos vacíos
- Los lookups incluyen filtros automáticos por `activo = true` cuando el campo existe

### Cache
- Los lookups no tienen cache propio, se ejecutan en cada regla
- Para mejorar performance, considerar combinar múltiples lookups en una sola regla

### Limitaciones
- Máximo 10 lookups por regla (recomendado)
- No se permiten lookups recursivos o circulares
- Los campos anidados están limitados a 3 niveles de profundidad

## Instalación y Uso

### 1. Probar los Ejemplos
```bash
cd backend
node scripts/insertar-reglas-lookups.js
node scripts/demo-lookups.js
```

### 2. API Endpoints
```
GET /api/reglas/meta/acciones - Tipos de acciones disponibles
GET /api/reglas/meta/tablas-lookup - Tablas disponibles para lookup
```

### 3. Crear Reglas con Lookups
```javascript
const reglaConLookup = {
  codigo: "MI_REGLA_LOOKUP",
  nombre: "Mi Regla con Lookup",
  tipo: "IMPORTACION_DKT",
  prioridad: 10,
  configuracion: {
    condiciones: [
      {
        campo: "resumen.numeroTarjeta",
        operador: "IS_NOT_EMPTY",
        valor: ""
      }
    ],
    acciones: [
      {
        campo: "codigoDimension",
        operacion: "LOOKUP",
        tabla: "user_tarjetas_credito",
        campoConsulta: "numeroTarjeta",
        valorConsulta: "{resumen.numeroTarjeta}",
        campoResultado: "user.codigoDimension",
        valorDefecto: "DIM_DEFAULT"
      }
    ]
  }
};
```

## Casos de Uso Avanzados

### Lookup Condicional
```json
{
  "condiciones": [
    {
      "campo": "resumen.importeTransaccion",
      "operador": "GREATER_THAN",
      "valor": "10000"
    }
  ],
  "acciones": [
    {
      "campo": "requiereAprobacion",
      "operacion": "LOOKUP",
      "tabla": "user_tarjetas_credito",
      "campoConsulta": "numeroTarjeta", 
      "valorConsulta": "{resumen.numeroTarjeta}",
      "campoResultado": "user.rol",
      "valorDefecto": "SI"
    }
  ]
}
```

### Múltiples Lookups en Secuencia
```json
{
  "acciones": [
    {
      "campo": "tipoTarjeta",
      "operacion": "LOOKUP",
      "tabla": "user_tarjetas_credito",
      "campoConsulta": "numeroTarjeta",
      "valorConsulta": "{resumen.numeroTarjeta}",
      "campoResultado": "tipoTarjeta.nombre",
      "valorDefecto": "PERSONAL"
    },
    {
      "campo": "limiteDiario",
      "operacion": "LOOKUP",
      "tabla": "parametros_maestros",
      "campoConsulta": "codigo",
      "valorConsulta": "{tipoTarjeta}",
      "campoResultado": "valor_padre",
      "valorDefecto": "50000"
    }
  ]
}
```

## Troubleshooting

### Problemas Comunes

1. **Lookup no encuentra datos**
   - Verificar que `valorConsulta` sea correcto
   - Comprobar que existan datos en la tabla
   - Usar `valorDefecto` para evitar campos vacíos

2. **Error en campos anidados**
   - Verificar la sintaxis: `"user.nombre"` no `"user->nombre"`
   - Comprobar que las relaciones estén configuradas en Prisma

3. **Performance lenta**
   - Verificar índices en campos de consulta
   - Reducir número de lookups por regla
   - Usar `stopOnMatch` cuando sea apropiado

### Debug
```javascript
// Activar logging detallado
const result = await rulesEngine.applyRules(
  itemData, 
  resumenData,
  { 
    logExecution: true,  // Habilitar logs
    contexto: 'DEBUG'
  }
);
```