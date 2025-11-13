# Sistema de Parámetros Maestros

## Descripción General

El Sistema de Parámetros Maestros permite gestionar valores parametrizables de los campos de la tabla `rendicion_tarjeta`. Incluye un sistema inteligente de relaciones padre-hijo entre campos, filtrado avanzado y modales de gestión adaptativos.

## Arquitectura

### Frontend
- **Componente principal**: `ParametrosMaestros.tsx`
- **Hook de confirmación**: `useConfirm.tsx`
- **API Client**: `api.ts`

### Backend
- **Rutas**: 
  - `/api/parametros/maestros` - CRUD de parámetros
  - `/api/parametros/relaciones` - Gestión de relaciones padre-hijo
- **Base de datos**: 
  - Tabla: `parametros_maestros`
  - Tabla: `parametros_relaciones`

## Funcionalidades

### 1. Gestión de Parámetros Maestros

#### Campos de un parámetro:
- `id`: Identificador único
- `codigo`: Código del parámetro (ej: "VISA_CLASSIC")
- `nombre`: Nombre descriptivo (ej: "Visa Classic")
- `descripcion`: Descripción opcional
- `tipo_campo`: Campo de la tabla rendicion_tarjeta (snake_case)
- `valor_padre`: Código del parámetro padre (opcional)
- `orden`: Orden de visualización
- `activo`: Estado del parámetro

#### Operaciones CRUD:
- **Crear**: Nuevo parámetro con validaciones
- **Leer**: Listado con filtros avanzados
- **Actualizar**: Modificar parámetros existentes
- **Eliminar**: Eliminación con confirmación personalizada

### 2. Sistema de Relaciones Padre-Hijo

#### Conceptos:
- **Campo Padre**: Campo que contiene los valores maestros
- **Campo Hijo**: Campo que depende del padre para filtrar sus valores
- **Relación**: Define qué campo hijo depende de qué campo padre

#### Ejemplo de relación:
```
tipo_producto (padre) → codigo_producto (hijo)
```
- Los códigos de producto se filtran según el tipo de producto seleccionado

#### Validaciones de relaciones:
- No se permiten relaciones entre el mismo campo
- No se permiten relaciones circulares (A→B cuando ya existe B→A)

### 3. Filtrado Inteligente

#### Filtros disponibles:
1. **Buscar**: Búsqueda por código o nombre
2. **Campo de Rendición**: Selección del campo a gestionar
3. **Campo Padre**: Muestra el nombre del campo padre (informativo)
4. **Valor Padre**: Lista de valores específicos del padre (filtrable)
5. **Estado**: Filtrar por activo/inactivo

#### Comportamiento automático:
- Al seleccionar un campo hijo, detecta automáticamente su campo padre
- Carga los valores únicos del campo padre para filtrado opcional
- Muestra información contextual sobre las relaciones

### 4. Modal Adaptativo

#### Comportamiento en creación/edición:
- **Campo de Rendición**: Fijo al valor del filtro actual (no editable)
- **Valor Padre**: 
  - Si existe relación padre-hijo: Combo obligatorio con valores del padre
  - Si no existe relación: Campo de texto opcional

## Campos Parametrizables

### Productos y Conceptos
- `tipo_producto` - Tipo de Producto
- `codigo_producto` - Código de Producto
- `concepto_modulo` - Concepto Módulo
- `concepto_tipo` - Concepto Tipo
- `concepto_codigo` - Concepto Código

### Comercio/Proveedor
- `modulo_comprobante` - Módulo Comprobante
- `tipo_registro` - Tipo de Registro
- `comprobante_origen` - Comprobante Origen
- `codigo_origen` - Código Origen

### Información Fiscal
- `tipo_documento` - Tipo de Documento
- `codigo_pais` - Código País
- `condicion_iva` - Condición IVA
- `codigo_moneda` - Código Moneda

### Contabilidad
- `tipo_operacion` - Tipo de Operación
- `tipo_comprobante` - Tipo de Comprobante
- `codigo_dimension` - Código Dimensión
- `subcuenta` - Subcuenta

## Relaciones Configuradas

### Relaciones predefinidas en el seed:
```javascript
tipo_tarjeta → producto
banco → tipo_producto
tipo_producto → codigo_producto
modulo → submodulo
dimension → subdimension
tipo_concepto → concepto
```

## API Endpoints

### Parámetros Maestros

#### GET `/api/parametros/maestros`
Obtiene parámetros con filtros opcionales.

**Query Parameters:**
- `tipo_campo`: Filtrar por tipo de campo
- `valor_padre`: Filtrar por valor padre
- `activo`: Filtrar por estado (true/false)
- `search`: Búsqueda por código o nombre
- `page`: Página para paginación
- `limit`: Límite de resultados

**Ejemplo:**
```bash
GET /api/parametros/maestros?tipo_campo=codigo_producto&activo=true
```

#### POST `/api/parametros/maestros`
Crear nuevo parámetro maestro.

**Body:**
```json
{
  "codigo": "VISA_GOLD",
  "nombre": "Visa Gold",
  "descripcion": "Tarjeta Visa Gold",
  "tipo_campo": "codigo_producto",
  "valor_padre": "TARJETA_CREDITO",
  "orden": 1,
  "activo": true
}
```

#### PUT `/api/parametros/maestros/:id`
Actualizar parámetro existente.

#### DELETE `/api/parametros/maestros/:id`
Eliminar parámetro.

#### GET `/api/parametros/maestros/campos-rendicion`
Obtiene la lista de campos parametrizables.

**Response:**
```json
[
  {
    "codigo": "tipo_producto",
    "nombre": "Tipo de Producto",
    "grupo": "Productos y Conceptos"
  }
]
```

### Relaciones

#### GET `/api/parametros/relaciones`
Obtiene todas las relaciones o filtra por campo hijo.

**Query Parameters:**
- `campo_hijo`: Filtrar relaciones donde este campo es hijo

#### POST `/api/parametros/relaciones`
Crear nueva relación.

**Body:**
```json
{
  "campo_padre": "tipo_producto",
  "campo_hijo": "codigo_producto",
  "descripcion": "Los códigos de producto se filtran por tipo de producto",
  "activo": true
}
```

#### PUT `/api/parametros/relaciones/:id`
Actualizar relación existente.

#### DELETE `/api/parametros/relaciones/:id`
Eliminar relación.

## Flujo de Trabajo

### 1. Configuración inicial
1. Definir relaciones entre campos usando el componente `RelacionesParametros`
2. Ejecutar el seed de parámetros para datos iniciales: `node src/seed/parameters.js`

### 2. Gestión de parámetros
1. Ir al tab "Parámetros Maestros"
2. Seleccionar el campo de rendición a gestionar
3. El sistema detecta automáticamente si tiene campo padre
4. Opcionalmente filtrar por valores específicos del padre
5. Crear, editar o eliminar parámetros según necesidad

### 3. Uso de parámetros
Los parámetros maestros se utilizan para poblar combos y validar valores en la tabla `rendicion_tarjeta`.

## Validaciones

### Frontend
- Campos obligatorios: código, nombre, tipo_campo
- Detección automática de campo padre
- Validación de relaciones circulares
- Confirmación de eliminación personalizada

### Backend
- Validación de campos obligatorios
- Prevención de relaciones circulares
- Validación de códigos únicos por tipo de campo
- Verificación de existencia en operaciones de actualización/eliminación

## Ejemplos de Uso

### Caso 1: Gestionar códigos de producto
```
1. Seleccionar "Código de Producto" en Campo de Rendición
2. El sistema muestra "Tipo Producto" como campo padre
3. El combo "Valor Padre" se llena con valores como "TARJETA_CREDITO", "TARJETA_DEBITO"
4. Opcionalmente filtrar por "TARJETA_CREDITO" para ver solo esos productos
5. Crear nuevo producto con valor padre "TARJETA_CREDITO"
```

### Caso 2: Gestionar conceptos
```
1. Seleccionar "Concepto Código" en Campo de Rendición
2. El sistema muestra "Tipo Concepto" como campo padre
3. Filtrar por "INGRESOS" para ver solo conceptos de ingresos
4. Crear nuevo concepto con tipo "INGRESOS"
```

## Base de Datos

### Tabla `parametros_maestros`
```sql
CREATE TABLE parametros_maestros (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  tipo_campo VARCHAR(100) NOT NULL,
  valor_padre VARCHAR(100),
  orden INTEGER DEFAULT 1,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tipo_campo, codigo)
);
```

### Tabla `parametros_relaciones`
```sql
CREATE TABLE parametros_relaciones (
  id SERIAL PRIMARY KEY,
  campo_padre VARCHAR(100) NOT NULL,
  campo_hijo VARCHAR(100) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campo_padre, campo_hijo)
);
```

## Configuración de Desarrollo

### Seed de datos
```bash
# Ejecutar seed de parámetros
cd backend
node src/seed/parameters.js
```

### Variables de entorno
```env
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5050

# Backend
PORT=5050
DATABASE_URL=postgresql://user:password@localhost:5432/rendiciones
```

## Consideraciones Técnicas

### Consistencia de nombres
- Todos los códigos de campos usan `snake_case` (ej: `codigo_producto`)
- Los nombres se muestran en formato legible (ej: "Código de Producto")
- Consistencia total entre frontend, backend y base de datos

### Performance
- Límite de 1000 registros en consultas de parámetros
- Índices en campos `tipo_campo` y `valor_padre`
- Consultas optimizadas con filtros específicos

### Seguridad
- Autenticación requerida en todos los endpoints
- Validación de entrada en backend
- Sanitización de datos antes de persistir

## Mantenimiento

### Agregar nuevo campo parametrizable
1. Actualizar la lista en `/api/parametros/maestros/campos-rendicion`
2. Si tiene relación padre-hijo, agregarla en el seed
3. Ejecutar seed para actualizar datos

### Modificar relaciones existentes
1. Actualizar en `src/seed/parameters.js`
2. Ejecutar seed o modificar directamente en la tabla `parametros_relaciones`

## Troubleshooting

### Error "Cannot set headers after they are sent"
- Verificar que no hay múltiples `res.json()` en el mismo endpoint
- Asegurar que todas las rutas usen `return` antes de `res.json()`

### Filtros no funcionan
- Verificar consistencia de nombres entre frontend y backend
- Revisar que los valores de `tipo_campo` coincidan exactamente

### Relaciones circulares
- El sistema previene automáticamente relaciones A→B cuando existe B→A
- Revisar la lógica de validación en el backend

---

*Documentación actualizada: $(date)*