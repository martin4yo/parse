# Sistema de Reglas de Negocio

## Descripción

El sistema de reglas de negocio permite definir y aplicar automáticamente reglas durante la importación de archivos DKT sin necesidad de recompilar la aplicación.

## Características

- ✅ **Reglas dinámicas**: Se cargan desde la base de datos
- ✅ **Cache inteligente**: Sistema de cache con refresco automático (5 minutos)
- ✅ **Múltiples operadores**: 17 operadores diferentes (CONTAINS, EQUALS, REGEX, etc.)
- ✅ **Prioridades**: Las reglas se ejecutan en orden de prioridad
- ✅ **Auditoría**: Registro de ejecuciones con métricas de performance
- ✅ **Interfaz de administración**: Gestión desde la web
- ✅ **Validación**: Sistema de pruebas integrado

## Estructura de Base de Datos

### Tabla `reglas_negocio`
```sql
- id: Identificador único
- codigo: Código único de la regla
- nombre: Nombre descriptivo
- descripcion: Descripción detallada
- tipo: IMPORTACION_DKT, VALIDACION, TRANSFORMACION
- activa: Estado activo/inactivo
- prioridad: Orden de ejecución (menor = mayor prioridad)
- version: Control de versiones
- fechaVigencia: Fecha desde la cual es válida
- configuracion: JSON con la lógica de la regla
- createdBy/updatedBy: Auditoría de usuarios
```

### Tabla `reglas_ejecuciones`
```sql
- id: Identificador único
- reglaId: Referencia a la regla
- contexto: DKT_IMPORT, MANUAL, TEST
- entrada: Datos de entrada (JSON)
- salida: Resultado de la regla (JSON)
- exitosa: Si la ejecución fue exitosa
- mensaje: Mensaje de error si aplica
- duracionMs: Tiempo de ejecución
- createdAt: Timestamp de ejecución
```

## Configuración de Reglas

### Estructura JSON de una Regla

```json
{
  "condiciones": [
    {
      "campo": "resumen.descripcionCupon",
      "operador": "CONTAINS",
      "valor": "YPF"
    },
    {
      "campo": "resumen.importeTransaccion",
      "operador": "GREATER_THAN",
      "valor": "10000"
    }
  ],
  "logicOperator": "AND",
  "acciones": [
    {
      "campo": "tipoProducto",
      "operacion": "SET",
      "valor": "COM"
    },
    {
      "campo": "cuentaContable",
      "operacion": "SET",
      "valor": "5.1.01.02"
    }
  ],
  "stopOnMatch": false
}
```

### Operadores Disponibles

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `EQUALS` | Igual exacto | `"YPF"` |
| `NOT_EQUALS` | Diferente | `"SHELL"` |
| `CONTAINS` | Contiene texto | `"COMBUSTIBLE"` |
| `NOT_CONTAINS` | No contiene | `"PRUEBA"` |
| `STARTS_WITH` | Comienza con | `"YPF"` |
| `ENDS_WITH` | Termina con | `"S.A."` |
| `REGEX` | Expresión regular | `"(YPF\|SHELL)"` |
| `IN` | En lista | `"COM,PEA,EST"` |
| `NOT_IN` | No en lista | `"TEST,DEMO"` |
| `IS_NULL` | Es nulo | - |
| `IS_NOT_NULL` | No es nulo | - |
| `IS_EMPTY` | Está vacío | - |
| `IS_NOT_EMPTY` | No está vacío | - |
| `GREATER_THAN` | Mayor que | `"1000"` |
| `LESS_THAN` | Menor que | `"5000"` |
| `GREATER_OR_EQUAL` | Mayor o igual | `"100"` |
| `LESS_OR_EQUAL` | Menor o igual | `"10000"` |

### Tipos de Acciones

| Operación | Descripción | Ejemplo |
|-----------|-------------|---------|
| `SET` | Establecer valor | `{"campo": "tipoProducto", "operacion": "SET", "valor": "COM"}` |
| `APPEND` | Agregar al valor existente | `{"campo": "observaciones", "operacion": "APPEND", "valor": " - VALIDADO"}` |
| `CALCULATE` | Cálculo matemático | `{"campo": "total", "operacion": "CALCULATE", "formula": "{neto} + {iva}"}` |

### Campos Disponibles

#### Datos del Item (`item.*`)
- `tipoComprobante`, `numeroComprobante`, `fechaComprobante`
- `proveedorId`, `cuitProveedor`
- `tipoProducto`, `codigoProducto`
- `netoGravado`, `exento`, `moneda`
- `codigoDimension`, `subcuenta`, `cuentaContable`
- `observaciones`, `patente`, `km`
- `tipoOrdenCompra`, `ordenCompra`

#### Datos del Resumen (`resumen.*`)
- `descripcionCupon`: Descripción del comercio/transacción
- `importeTransaccion`: Importe de la transacción
- `fechaTransaccion`: Fecha de la transacción
- `numeroCupon`: Número de cupón
- `moneda`: Moneda de la transacción

## Instalación y Configuración

### 1. Migración de Base de Datos

```bash
cd backend
npx prisma generate
npx prisma db push
```

### 2. Insertar Reglas de Ejemplo

```bash
node scripts/insertar-reglas-ejemplo.js
```

### 3. Probar el Sistema

```bash
node scripts/demo-reglas.js
```

## Ejemplos de Reglas

### 1. Combustibles YPF

```json
{
  "codigo": "COMBUSTIBLE_YPF",
  "nombre": "Clasificación de Combustibles YPF",
  "tipo": "IMPORTACION_DKT",
  "prioridad": 10,
  "configuracion": {
    "condiciones": [
      {
        "campo": "resumen.descripcionCupon",
        "operador": "CONTAINS",
        "valor": "YPF"
      },
      {
        "campo": "resumen.descripcionCupon",
        "operador": "CONTAINS",
        "valor": "COMBUSTIBLE"
      }
    ],
    "logicOperator": "AND",
    "acciones": [
      {
        "campo": "tipoProducto",
        "operacion": "SET",
        "valor": "COM"
      },
      {
        "campo": "cuentaContable",
        "operacion": "SET",
        "valor": "5.1.01.02"
      }
    ]
  }
}
```

### 2. Validación de Importes Altos

```json
{
  "codigo": "IMPORTE_ALTO_VALIDACION",
  "nombre": "Validación de Importes Altos",
  "tipo": "IMPORTACION_DKT",
  "prioridad": 5,
  "configuracion": {
    "condiciones": [
      {
        "campo": "resumen.importeTransaccion",
        "operador": "GREATER_THAN",
        "valor": "100000"
      }
    ],
    "acciones": [
      {
        "campo": "observaciones",
        "operacion": "SET",
        "valor": "REQUIERE VALIDACION - IMPORTE ALTO"
      }
    ]
  }
}
```

### 3. Categorización por Regex

```json
{
  "codigo": "RESTAURANTES_REGEX",
  "nombre": "Categorización de Restaurantes",
  "tipo": "IMPORTACION_DKT",
  "prioridad": 20,
  "configuracion": {
    "condiciones": [
      {
        "campo": "resumen.descripcionCupon",
        "operador": "REGEX",
        "valor": "(RESTAURANT|REST\\\\.|PARRILLA|PIZZA|CAFE|BAR)"
      }
    ],
    "acciones": [
      {
        "campo": "tipoProducto",
        "operacion": "SET",
        "valor": "GAS"
      },
      {
        "campo": "cuentaContable",
        "operacion": "SET",
        "valor": "5.1.05.01"
      }
    ]
  }
}
```

## Administración Web

### Acceder a la Interfaz

1. Ir a la página de **Parámetros** en la aplicación web
2. Seleccionar la pestaña **"Reglas de Negocio"**
3. Desde ahí se puede:
   - Ver todas las reglas
   - Filtrar por tipo, estado o búsqueda
   - Crear nuevas reglas
   - Editar reglas existentes
   - Probar reglas con datos de ejemplo
   - Ver historial de ejecuciones

### Funcionalidades

- **Listado**: Vista completa con filtros y búsqueda
- **Estados**: Activa, Inactiva, Programada (por fecha)
- **Prioridades**: Control del orden de ejecución
- **Pruebas**: Simulador con datos de ejemplo
- **Auditoría**: Historial completo de ejecuciones
- **Métricas**: Estadísticas de uso y performance

## API Endpoints

### Gestión de Reglas
- `GET /api/reglas` - Listar reglas con filtros
- `GET /api/reglas/:id` - Obtener regla específica
- `POST /api/reglas` - Crear nueva regla
- `PUT /api/reglas/:id` - Actualizar regla
- `DELETE /api/reglas/:id` - Eliminar regla

### Pruebas y Auditoría
- `POST /api/reglas/:id/test` - Probar regla con datos
- `GET /api/reglas/:id/ejecuciones` - Historial de ejecuciones

### Metadatos
- `GET /api/reglas/meta/tipos` - Tipos de reglas disponibles
- `GET /api/reglas/meta/operadores` - Operadores disponibles

## Performance y Escalabilidad

### Cache
- **Duración**: 5 minutos por defecto
- **Invalidación**: Automática al crear/editar/eliminar reglas
- **Estrategia**: En memoria por tipo de regla

### Optimizaciones
- Las reglas se cargan una vez por sesión de importación
- Ejecución secuencial por prioridad con opción de `stopOnMatch`
- Logging configurable para auditoría
- Métricas de tiempo de ejecución

### Límites Recomendados
- **Máximo de reglas activas**: 50 por tipo
- **Complejidad de regex**: Evitar backtracking excesivo
- **Condiciones por regla**: Máximo 10 para mantener performance

## Troubleshooting

### Reglas No Se Aplican
1. Verificar que la regla esté **activa**
2. Comprobar la **fecha de vigencia**
3. Revisar las **condiciones** con datos reales
4. Verificar la **prioridad** (menor número = mayor prioridad)

### Performance Lenta
1. Revisar reglas con **regex complejas**
2. Optimizar **número de condiciones**
3. Usar **stopOnMatch** cuando sea apropiado
4. Verificar logs de ejecución para identificar reglas lentas

### Errores en Logs
- Revisar la sintaxis JSON de la configuración
- Verificar que los campos referenciados existan
- Comprobar operadores y valores compatibles

## Desarrollo Futuro

### Funcionalidades Planificadas
- [ ] Editor visual de reglas (drag & drop)
- [ ] Templates de reglas comunes
- [ ] Versionado automático de reglas
- [ ] Backup/restore de configuraciones
- [ ] Dashboard de métricas avanzadas
- [ ] Integración con notificaciones
- [ ] API para importar/exportar reglas

### Extensibilidad
- Nuevos tipos de reglas (VALIDACION, TRANSFORMACION)
- Operadores personalizados
- Acciones custom con JavaScript
- Integración con servicios externos
- Webhooks para eventos de reglas