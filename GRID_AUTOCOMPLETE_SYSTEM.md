# Sistema de Auto-Complete para Grillas

## Resumen

El sistema de auto-complete para grillas permite completar automáticamente campos relacionados cuando el usuario selecciona un valor en un campo específico. Está basado en reglas de negocio configurables y utiliza el motor de reglas existente.

## Arquitectura

### Backend Components

1. **Endpoint de Auto-Complete**: `POST /api/rendiciones/auto-complete`
2. **Función executeAutoCompleteLookup**: Procesa reglas de tipo `GRID_AUTOCOMPLETE`  
3. **Motor de Reglas de Negocio**: Reutiliza `businessRulesEngine.js` existente
4. **Tipo de Regla**: Nuevo tipo `GRID_AUTOCOMPLETE` en `reglas_negocio`

### Frontend Components

1. **API Client**: `rendicionesApi.autoComplete()` en `api.ts`
2. **Hook Personalizado**: `useGridAutoComplete.ts`
3. **Componentes de Ejemplo**: `GridAutoCompleteExample.tsx`

## Implementación Backend

### Endpoint Principal

```javascript
// backend/src/routes/rendiciones.js
router.post('/auto-complete', authMiddleware, async (req, res) => {
  try {
    const { campo, valor, itemData } = req.body;
    
    // Buscar reglas de auto-complete activas
    const autoCompleteRules = await prisma.reglaNegocio.findMany({
      where: { 
        tipo: 'GRID_AUTOCOMPLETE', 
        activa: true 
      },
      orderBy: { prioridad: 'asc' }
    });

    const result = await executeAutoCompleteLookup(
      campo, 
      valor, 
      itemData, 
      autoCompleteRules
    );

    res.json(result);
  } catch (error) {
    console.error('Error en auto-complete:', error);
    res.status(500).json({ 
      found: false, 
      values: {}, 
      message: 'Error interno del servidor' 
    });
  }
});
```

### Función de Procesamiento

```javascript
async function executeAutoCompleteLookup(campo, valor, itemData, rules) {
  const BusinessRulesEngine = require('../services/businessRulesEngine');
  const engine = new BusinessRulesEngine();
  
  // Datos simulados para el motor de reglas
  const mockResumen = {
    [campo]: valor,
    ...itemData
  };
  
  const mockItem = { ...itemData, [campo]: valor };
  const result = { found: false, values: {}, appliedRules: 0 };
  
  // Procesar cada regla
  for (const rule of rules) {
    try {
      await engine.loadRule(rule);
      
      const ruleResult = await engine.applyRules(
        mockItem, 
        mockResumen, 
        { logExecution: false }
      );
      
      if (ruleResult.rulesApplied > 0) {
        // Obtener campos que fueron modificados por la regla
        const changedFields = {};
        Object.keys(ruleResult.data).forEach(key => {
          if (ruleResult.data[key] !== mockItem[key] && 
              key !== campo) { // No incluir el campo trigger
            changedFields[key] = ruleResult.data[key];
          }
        });
        
        if (Object.keys(changedFields).length > 0) {
          Object.assign(result.values, changedFields);
          result.found = true;
          result.appliedRules++;
        }
        
        // Actualizar datos mock con los cambios para la siguiente regla
        Object.assign(mockItem, ruleResult.data);
        Object.assign(mockResumen, ruleResult.data);
        
        if (rule.detenerEnCoincidencia) {
          break;
        }
      }
    } catch (error) {
      console.error(`Error aplicando regla ${rule.codigo}:`, error);
    }
  }
  
  return result;
}
```

## Implementación Frontend

### API Client

```typescript
// packages/web/src/lib/api.ts
export interface AutoCompleteRequest {
  campo: string;
  valor: any;
  itemData: Record<string, any>;
}

export interface AutoCompleteResponse {
  found: boolean;
  values: Record<string, any>;
  message?: string;
}

export const rendicionesApi = {
  autoComplete: async (data: AutoCompleteRequest): Promise<AutoCompleteResponse> => {
    const response = await api.post('/rendiciones/auto-complete', data);
    return response.data;
  }
};
```

### Hook Personalizado

```typescript
// packages/web/src/hooks/useGridAutoComplete.ts
export const useGridAutoComplete = (options: UseGridAutoCompleteOptions = {}) => {
  const { onFieldChange, onMultipleFieldsChange, enableLogging = false } = options;
  
  const executeAutoComplete = useCallback(async (
    campo: string,
    valor: any,
    itemData: Record<string, any>
  ): Promise<AutoCompleteResponse | null> => {
    // Validaciones y lógica de auto-complete
    const response = await rendicionesApi.autoComplete({
      campo, valor, itemData
    });
    
    if (response.found && response.values) {
      // Aplicar cambios usando callbacks
      if (Object.keys(response.values).length === 1 && onFieldChange) {
        const [fieldName, fieldValue] = Object.entries(response.values)[0];
        onFieldChange(fieldName, fieldValue);
      } else if (onMultipleFieldsChange) {
        onMultipleFieldsChange(response.values);
      }
    }
    
    return response;
  }, [onFieldChange, onMultipleFieldsChange]);

  return { executeAutoComplete, isLoading, error };
};
```

## Configuración de Reglas

### Estructura de Regla

```sql
INSERT INTO reglas_negocio (
    codigo,
    nombre,
    descripcion,
    tipo,
    condiciones,
    acciones,
    prioridad,
    activa,
    detener_en_coincidencia
) VALUES (
    'GRID_AUTOCOMPLETE_EJEMPLO',
    'Auto-completar Ejemplo',
    'Descripción de la regla',
    'GRID_AUTOCOMPLETE', -- Tipo específico
    '[
        {
            "campo": "campoTrigger",
            "operador": "NOT_EMPTY",
            "valor": ""
        }
    ]',
    '[
        {
            "tipo": "LOOKUP_JSON",
            "campo_origen": "campoTrigger",
            "tabla": "parametros_maestros",
            "condiciones": [...],
            "campo_busqueda": "extras",
            "campo_busqueda_json": "propiedadJSON",
            "campo_destino": "campoDestino",
            "valor_por_defecto": null
        }
    ]',
    10,
    true,
    false
);
```

### Tipos de Acciones Soportadas

1. **LOOKUP_JSON**: Buscar valor en campo JSON de otra tabla
2. **LOOKUP**: Buscar valor en tabla relacionada
3. **SET**: Establecer valor fijo o calculado
4. **CALCULATE**: Realizar cálculos matemáticos
5. **APPEND**: Concatenar valores

## Integración con SmartSelector

### Modificación del handleSelectorSelect

```typescript
// En el componente de grilla existente
const { executeAutoComplete } = useGridAutoComplete({
  onFieldChange: (field, value) => {
    updateCell(selectorField.rowId, field, value);
  },
  onMultipleFieldsChange: (fields) => {
    Object.entries(fields).forEach(([field, value]) => {
      updateCell(selectorField.rowId, field, value);
    });
  }
});

const handleSelectorSelect = async (codigo: string, nombre: string) => {
  if (selectorField) {
    // Lógica original del selector
    updateCell(selectorField.rowId, selectorField.field, codigo);
    
    // Ejecutar auto-complete
    const currentRow = rows.find(r => r.id === selectorField.rowId);
    if (currentRow) {
      await executeAutoComplete(selectorField.field, codigo, {
        ...currentRow,
        [selectorField.field]: codigo
      });
    }
  }
  
  setShowSmartSelector(false);
  setSelectorField(null);
};
```

## Ejemplos de Reglas

### 1. Auto-completar Tipo Producto

```sql
-- Cuando se selecciona codigoProducto, completar tipoProducto
INSERT INTO reglas_negocio (...) VALUES (
    'GRID_AUTOCOMPLETE_TIPO_PRODUCTO',
    'Auto-completar Tipo Producto',
    'Completar tipo de producto basado en código',
    'GRID_AUTOCOMPLETE',
    '[{"campo": "codigoProducto", "operador": "NOT_EMPTY"}]',
    '[{
        "tipo": "LOOKUP_JSON",
        "campo_origen": "codigoProducto",
        "tabla": "parametros_maestros",
        "campo_busqueda": "extras",
        "campo_busqueda_json": "tipoProducto",
        "campo_destino": "tipoProducto"
    }]',
    10, true, false
);
```

### 2. Múltiples Campos

```sql
-- Completar varios campos a la vez
INSERT INTO reglas_negocio (...) VALUES (
    'GRID_AUTOCOMPLETE_PRODUCTO_COMPLETO',
    'Datos Completos del Producto',
    'Completar tipo, categoría y cuenta contable',
    'GRID_AUTOCOMPLETE',
    '[{"campo": "codigoProducto", "operador": "NOT_EMPTY"}]',
    '[
        {
            "tipo": "LOOKUP_JSON",
            "campo_origen": "codigoProducto",
            "campo_destino": "tipoProducto",
            "campo_busqueda_json": "tipoProducto"
        },
        {
            "tipo": "LOOKUP_JSON", 
            "campo_origen": "codigoProducto",
            "campo_destino": "categoria",
            "campo_busqueda_json": "categoria"
        }
    ]',
    20, true, false
);
```

## Casos de Uso

### 1. Rendiciones de Tarjeta
- **Trigger**: Usuario selecciona `codigoProducto`
- **Auto-complete**: `tipoProducto`, `cuentaContable`, `categoria`
- **Fuente**: JSON en `parametros_maestros.extras`

### 2. Proveedores por CUIT
- **Trigger**: Usuario ingresa/modifica `cuitProveedor` 
- **Auto-complete**: `proveedorId`, `razonSocial`
- **Fuente**: Tabla `proveedores`

### 3. Cuentas Contables Inteligentes
- **Trigger**: `tipoProducto` + `codigoDimension`
- **Auto-complete**: `cuentaContable` específica
- **Fuente**: Reglas de mapeo en JSON

## Beneficios

1. **Reducción de Errores**: Auto-completion consistente
2. **Velocidad de Carga**: Menos clicks para completar formularios
3. **Flexibilidad**: Reglas configurables sin código
4. **Reutilización**: Mismas reglas para múltiples grillas
5. **Mantenibilidad**: Cambios solo en base de datos

## Extensiones Futuras

1. **Auto-complete Condicional**: Reglas basadas en múltiples campos
2. **Validaciones en Tiempo Real**: Alertas durante el auto-complete  
3. **Cache Inteligente**: Optimización de consultas frecuentes
4. **Interfaz de Configuración**: UI para crear/editar reglas
5. **Logs de Auditoría**: Tracking de reglas aplicadas

## Testing

### Backend Test
```bash
curl -X POST http://localhost:5050/api/rendiciones/auto-complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "campo": "codigoProducto", 
    "valor": "PROD001",
    "itemData": {"netoGravado": 1500}
  }'
```

### Frontend Integration Test
```typescript
// En el componente
const testAutoComplete = async () => {
  const result = await executeAutoComplete('codigoProducto', 'PROD001', {
    netoGravado: 1500,
    rowId: 'test-row-1'
  });
  console.log('Auto-complete result:', result);
};
```

Este sistema proporciona una base sólida y extensible para auto-completar campos en grillas basado en reglas de negocio configurables.