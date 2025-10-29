# Sistema de Filtrado Jerárquico de Parámetros

## Descripción General

El sistema de filtrado jerárquico de parámetros permite establecer relaciones padre-hijo entre campos parametrizables, donde la selección de un campo padre filtra automáticamente las opciones disponibles en sus campos hijos, garantizando la coherencia de los datos.

## Características Principales

### ✅ Filtrado Automático
- Los campos hijos se filtran automáticamente basándose en el valor seleccionado en el campo padre
- Solo se muestran opciones válidas para el contexto actual
- Previene selecciones inválidas o inconsistentes

### ✅ Limpieza Automática
- Cuando se cambia el valor de un campo padre, todos sus campos hijos se limpian automáticamente
- Evita mantener valores obsoletos que ya no son válidos para el nuevo contexto
- Garantiza la integridad de los datos

### ✅ Rendimiento Optimizado
- Carga única de relaciones al inicio del componente
- Llamadas API eficientes con filtros dinámicos
- Detección automática de relaciones sin consultas adicionales

## Arquitectura del Sistema

### Componentes Principales

1. **Tabla de Relaciones** (`parametros_relaciones`)
   - Almacena las relaciones padre-hijo entre tipos de campos
   - Estructura: `campo_padre`, `campo_hijo`, `descripcion`, `activo`

2. **Frontend - Página de Rendiciones**
   - Maneja la lógica de detección de relaciones padre-hijo
   - Coordina la limpieza automática de campos hijos
   - Gestiona el estado de filtrado en tiempo real

3. **SmartSelector Component**
   - Recibe el parámetro `parentValue` para filtrado
   - Incluye el filtro en las llamadas API
   - Muestra solo opciones válidas para el contexto

4. **Backend API**
   - Endpoint `/parametros/relaciones` para obtener relaciones
   - Endpoint `/parametros/maestros` con soporte para `valor_padre`
   - Filtrado eficiente en base de datos

### Flujo de Datos

```
1. Carga inicial → /parametros/relaciones
2. Detección de campo padre → Búsqueda en relaciones cargadas
3. Extracción de valor padre → Desde la fila actual
4. Filtrado API → /parametros/maestros?valor_padre=X
5. Actualización automática → Limpieza de campos hijos
```

## Configuración de Relaciones

### Estructura de la Base de Datos

```sql
-- Tabla: parametros_relaciones
CREATE TABLE parametros_relaciones (
  id SERIAL PRIMARY KEY,
  campo_padre VARCHAR(50) NOT NULL,
  campo_hijo VARCHAR(50) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(campo_padre, campo_hijo)
);
```

### Ejemplo de Relaciones

```sql
-- Tipo de producto es padre de código de producto
INSERT INTO parametros_relaciones (campo_padre, campo_hijo, descripcion)
VALUES ('tipo_producto', 'codigo_producto', 'Los códigos de producto dependen del tipo seleccionado');
```

### Estructura de Parámetros Maestros

```sql
-- Los parámetros hijo deben tener valor_padre
INSERT INTO parametros_maestros (codigo, nombre, tipo_campo, valor_padre)
VALUES 
  ('COMB', 'Combustible', 'codigo_producto', 'GA'),
  ('ALOJ', 'Alojamiento', 'codigo_producto', 'GA'),
  ('REPR', 'Representación', 'codigo_producto', 'VR'),
  ('OFIC', 'Oficina', 'codigo_producto', 'VR');
```

## Implementación Técnica

### Frontend - Configuración de Campos

```typescript
// Mapeo de campos con selector
const fieldsWithSelector = {
  'tipoProducto': 'tipo_producto',      // Campo padre
  'codigoProducto': 'codigo_producto',  // Campo hijo
} as const;
```

### Carga de Relaciones

```typescript
const loadParameterRelations = async () => {
  try {
    const response = await api.get('/parametros/relaciones');
    const relations: {[key: string]: string} = {};
    
    // Mapear relaciones campo_hijo -> campo_padre
    response.data.forEach((rel: any) => {
      relations[rel.campo_hijo] = rel.campo_padre;
    });
    
    setParameterRelations(relations);
  } catch (error) {
    console.error('Error loading parameter relations:', error);
  }
};
```

### Detección de Valor Padre

```typescript
const handleCellEdit = (itemId: string, field: string, currentValue: string) => {
  // Obtener tipo de campo y buscar si tiene padre
  const fieldType = fieldsWithSelector[field as keyof typeof fieldsWithSelector];
  const parentField = parameterRelations[fieldType];
  
  if (parentField) {
    // Encontrar campo padre en camelCase
    const parentFieldCamelCase = Object.keys(fieldsWithSelector).find(
      key => fieldsWithSelector[key as keyof typeof fieldsWithSelector] === parentField
    );
    
    // Extraer valor del padre de la fila actual
    if (parentFieldCamelCase) {
      const currentItem = items.find(item => item.id === itemId);
      const parentValue = currentItem?.[parentFieldCamelCase] || null;
      
      setSelectorParentValue(parentValue);
    }
  }
};
```

### Limpieza de Campos Hijos

```typescript
const handleSelectorSelect = (codigo: string, nombre: string) => {
  // Detectar campos hijos del campo actual
  const currentFieldType = fieldsWithSelector[selectorField.field];
  const childFields = Object.keys(parameterRelations).filter(childType => 
    parameterRelations[childType] === currentFieldType
  );
  
  setItems(prevItems => 
    prevItems.map(item => {
      if (item.id === selectorField.itemId) {
        const updatedItem = { ...item, [selectorField.field]: codigo };
        
        // Limpiar campos hijos
        if (childFields.length > 0) {
          childFields.forEach(childType => {
            const childField = Object.keys(fieldsWithSelector).find(
              key => fieldsWithSelector[key] === childType
            );
            if (childField) {
              updatedItem[childField] = '';
              updatedItem[`${childField}_descripcion`] = '';
            }
          });
        }
        
        return updatedItem;
      }
      return item;
    })
  );
};
```

### Backend - API con Filtrado

```javascript
// GET /api/parametros/maestros
router.get('/', authenticateToken, async (req, res) => {
  const { tipo_campo, valor_padre, search, limit = 100 } = req.query;
  
  const where = {};
  
  if (tipo_campo) where.tipo_campo = tipo_campo;
  if (valor_padre) where.valor_padre = valor_padre;  // ← Filtro jerárquico
  if (search) {
    where.OR = [
      { codigo: { contains: search, mode: 'insensitive' } },
      { nombre: { contains: search, mode: 'insensitive' } }
    ];
  }
  
  const parametros = await prisma.parametroMaestro.findMany({
    where,
    orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
    take: parseInt(limit)
  });
  
  res.json(parametros);
});
```

## Casos de Uso

### Ejemplo 1: Tipo de Producto → Código de Producto

1. **Usuario selecciona** `tipo_producto = "GA" (Gastos)`
2. **Sistema detecta** que `codigo_producto` es hijo de `tipo_producto`
3. **Al abrir selector** de `codigo_producto`:
   - Se extrae `parentValue = "GA"` de la fila actual
   - API call: `/parametros/maestros?tipo_campo=codigo_producto&valor_padre=GA`
   - Solo muestra: COMB, ALOJ, ALIM, TRAN

4. **Si cambia** `tipo_producto` a `"VR" (Varios)`:
   - Se limpia automáticamente `codigo_producto`
   - Próxima selección mostrará: REPR, OFIC, TECN, CAPA

### Ejemplo 2: Múltiples Niveles de Jerarquía

```
tipo_comprobante → subtipo_comprobante → codigo_autorizacion
       ↓                    ↓                    ↓
    "FACTURA"         "ELECTRONICA"          "E001", "E002"
    "RECIBO"          "MANUAL"               "M001", "M002"
```

## Ventajas del Sistema

### 🚀 Experiencia de Usuario
- **Selecciones intuitivas**: Solo opciones válidas disponibles
- **Prevención de errores**: Imposible crear combinaciones inválidas
- **Limpieza automática**: No hay valores obsoletos tras cambios

### 🛡️ Integridad de Datos
- **Consistencia garantizada**: Relaciones siempre coherentes
- **Validación automática**: No requiere validación manual
- **Mantenimiento simplificado**: Cambios centralizados en base de datos

### ⚡ Rendimiento
- **Carga única**: Relaciones se cargan una sola vez
- **Filtrado eficiente**: Consultas optimizadas en base de datos
- **Memoria optimizada**: Estado mínimo en frontend

## Debugging y Monitoreo

### Logs Disponibles

El sistema incluye logs detallados para debugging:

```javascript
// Carga de relaciones
console.log('Parameter relations loaded:', relations);

// Detección de campo padre
console.log('DEBUG: Field detection:', {
  field, fieldType, parentField, availableRelations
});

// Filtrado API
console.log('SmartSelector making API call:', {
  fieldType, parentValue, params
});

// Limpieza de campos hijos
console.log('DEBUG: Parent field change detected:', {
  currentField, childFields, willClearChildren
});
```

### Verificación de Funcionamiento

1. **Consola del navegador**: Verificar logs de detección y filtrado
2. **Network tab**: Confirmar parámetro `valor_padre` en llamadas API
3. **Backend logs**: Ver consultas con filtros aplicados

## Mantenimiento

### Agregar Nueva Relación

1. **Insertar en base de datos**:
   ```sql
   INSERT INTO parametros_relaciones (campo_padre, campo_hijo)
   VALUES ('nuevo_padre', 'nuevo_hijo');
   ```

2. **Agregar campo al frontend**:
   ```typescript
   const fieldsWithSelector = {
     // ... campos existentes
     'nuevoCampo': 'nuevo_hijo'
   } as const;
   ```

3. **Configurar parámetros hijo**:
   ```sql
   INSERT INTO parametros_maestros (codigo, nombre, tipo_campo, valor_padre)
   VALUES ('COD1', 'Opción 1', 'nuevo_hijo', 'PADRE1');
   ```

### Eliminar Relación

1. **Desactivar relación**: `UPDATE parametros_relaciones SET activo = false WHERE id = X`
2. **Limpiar valor_padre**: `UPDATE parametros_maestros SET valor_padre = NULL WHERE tipo_campo = 'campo_hijo'`

## Consideraciones Técnicas

### Limitaciones Actuales
- Solo soporta relaciones padre-hijo simples (no múltiples padres)
- Requiere autenticación para cargar relaciones
- No soporta jerarquías circulares

### Posibles Mejoras Futuras
- Soporte para múltiples padres por campo
- Cache de relaciones en localStorage
- Validación de jerarquías circulares
- Interface de administración de relaciones

---

## Resumen

El sistema de filtrado jerárquico de parámetros proporciona una solución robusta y escalable para manejar relaciones complejas entre campos parametrizables, garantizando la integridad de los datos y mejorando significativamente la experiencia del usuario.

La implementación combina eficiencia en el backend, inteligencia en el frontend y simplicidad en el uso, resultando en un sistema que es tanto potente como fácil de mantener.