# 📋 Guía Completa: Reglas de Validación

## 🎯 ¿Qué son las Reglas de Validación?

Las reglas de **VALIDACION** verifican que los datos cumplan ciertas condiciones ANTES de exportar. A diferencia de las reglas de **TRANSFORMACION** que modifican datos, las validaciones solo verifican y alertan.

---

## 🔑 Conceptos Clave

### Diferencia entre TRANSFORMACION y VALIDACION

```
TRANSFORMACION (modifica datos):
  ✅ Condiciones cumplen → Aplica acciones (SET, LOOKUP, etc.)
  ❌ Condiciones NO cumplen → No hace nada

VALIDACION (verifica datos):
  ✅ Condiciones cumplen → VÁLIDO (todo OK)
  ❌ Condiciones NO cumplen → INVÁLIDO (genera error)
```

### ⚠️ IMPORTANTE sobre las Condiciones

En VALIDACION, las condiciones definen **lo que DEBE ser verdadero** para que pase:

```javascript
// Ejemplo: El CUIT NO debe estar vacío
{
  "condiciones": [
    {
      "campo": "cuitExtraido",
      "operador": "IS_NOT_EMPTY"  // ✅ Esto DEBE cumplirse
    }
  ],
  "mensajeError": "El CUIT es obligatorio"  // ❌ Mensaje si falla
}
```

---

## 📊 Niveles de Severidad

| Severidad | Comportamiento | Uso Recomendado |
|-----------|----------------|-----------------|
| **BLOQUEANTE** | Detiene exportación inmediatamente | Datos críticos obligatorios (CUIT, Fecha) |
| **ERROR** | Permite exportar pero muestra modal | Datos importantes pero no críticos |
| **WARNING** | Solo informa, exporta normal | Sugerencias y recomendaciones |

---

## 📝 Estructura de una Regla de Validación

```json
{
  "codigo": "CODIGO_UNICO_REGLA",
  "nombre": "Descripción corta de la regla",
  "descripcion": "Descripción más detallada (opcional)",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 100,
  "configuracion": {
    "condiciones": [
      {
        "campo": "nombreDelCampo",
        "operador": "OPERADOR",
        "valor": "valorEsperado (opcional)"
      }
    ],
    "logicOperator": "AND",
    "mensajeError": "Mensaje que verá el usuario",
    "severidad": "ERROR",
    "stopOnMatch": false
  }
}
```

### Campos Obligatorios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tipo` | String | Siempre `"VALIDACION"` |
| `condiciones` | Array | Array de condiciones que DEBEN cumplirse |
| `mensajeError` | String | Mensaje claro para el usuario |
| `severidad` | String | `BLOQUEANTE`, `ERROR` o `WARNING` |

### Campos Opcionales

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `logicOperator` | String | `"AND"` | `"AND"` o `"OR"` para múltiples condiciones |
| `stopOnMatch` | Boolean | `false` | Si detener al fallar (recomendado con BLOQUEANTE) |

---

## 💡 Ejemplos Prácticos

### Ejemplo 1: CUIT Obligatorio (BLOQUEANTE)

**Caso de Uso**: No se puede exportar sin CUIT válido

```json
{
  "codigo": "CUIT_OBLIGATORIO",
  "nombre": "CUIT es obligatorio para exportar",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 100,
  "configuracion": {
    "condiciones": [
      {
        "campo": "cuitExtraido",
        "operador": "IS_NOT_EMPTY"
      },
      {
        "campo": "cuitExtraido",
        "operador": "NOT_EQUALS",
        "valor": "00000000000"
      }
    ],
    "logicOperator": "AND",
    "mensajeError": "El CUIT es obligatorio y no puede ser todo ceros. Complete el campo manualmente.",
    "severidad": "BLOQUEANTE",
    "stopOnMatch": true
  }
}
```

**Resultado**: Si falla, NO se exporta ningún documento y muestra el error inmediatamente.

---

### Ejemplo 2: Código de Proveedor (ERROR)

**Caso de Uso**: Advertir si falta el código de proveedor pero permitir exportar

```json
{
  "codigo": "CODIGO_PROVEEDOR_REQUERIDO",
  "nombre": "Código de proveedor es recomendado",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 90,
  "configuracion": {
    "condiciones": [
      {
        "campo": "codigoProveedor",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "mensajeError": "El código de proveedor no fue encontrado. Verifique que el CUIT esté registrado en el maestro de proveedores.",
    "severidad": "ERROR",
    "stopOnMatch": false
  }
}
```

**Resultado**: Se exporta pero muestra modal con el error.

---

### Ejemplo 3: Validar Importe Mínimo (WARNING)

**Caso de Uso**: Solo informar si el importe es sospechosamente bajo

```json
{
  "codigo": "IMPORTE_MINIMO",
  "nombre": "Verificar importe mínimo razonable",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 50,
  "configuracion": {
    "condiciones": [
      {
        "campo": "importeExtraido",
        "operador": "GREATER_THAN",
        "valor": "100"
      }
    ],
    "mensajeError": "El importe es menor a $100. Verifique si el valor es correcto.",
    "severidad": "WARNING",
    "stopOnMatch": false
  }
}
```

**Resultado**: Se exporta pero muestra el warning en el modal.

---

### Ejemplo 4: Datos Fiscales Completos (BLOQUEANTE múltiple)

**Caso de Uso**: Verificar que todos los datos fiscales obligatorios estén presentes

```json
{
  "codigo": "DATOS_FISCALES_COMPLETOS",
  "nombre": "Todos los datos fiscales son obligatorios",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 100,
  "configuracion": {
    "condiciones": [
      {
        "campo": "tipoComprobanteExtraido",
        "operador": "IS_NOT_EMPTY"
      },
      {
        "campo": "numeroComprobanteExtraido",
        "operador": "IS_NOT_EMPTY"
      },
      {
        "campo": "fechaExtraida",
        "operador": "IS_NOT_NULL"
      },
      {
        "campo": "razonSocialExtraida",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "logicOperator": "AND",
    "mensajeError": "Faltan datos fiscales obligatorios. Complete: tipo de comprobante, número, fecha y razón social.",
    "severidad": "BLOQUEANTE",
    "stopOnMatch": true
  }
}
```

**Resultado**: Si falta CUALQUIERA de los campos, NO se exporta.

---

### Ejemplo 5: Validación en Líneas (ERROR)

**Caso de Uso**: Cada línea debe tener cuenta contable

```json
{
  "codigo": "LINEA_CUENTA_CONTABLE",
  "nombre": "Cuenta contable obligatoria en líneas",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 80,
  "configuracion": {
    "condiciones": [
      {
        "campo": "cuentaContable",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "mensajeError": "La cuenta contable es obligatoria en todas las líneas de factura",
    "severidad": "ERROR",
    "stopOnMatch": false
  }
}
```

**Aplicación**: Esta regla se aplica automáticamente a cada `documento_lineas` fila por fila.

---

## 🎨 Cómo se Muestra en el Frontend

### Modal de Validaciones

Cuando hay errores de validación, se muestra un modal con:

#### Header
- Título: "Errores de Validación"
- Contador: "Se encontraron X documento(s) con errores"

#### Por Cada Documento
- **Nombre del archivo**
- **Badges de resumen**:
  - 🔴 X Bloqueantes (rojo)
  - 🟠 X Errores (naranja)
  - 🟡 X Warnings (amarillo)

#### Por Cada Error
- **Título de la regla**
- **Mensaje del error**
- **Origen**: documento / línea / impuesto
- **Detalles de campos fallidos**:
  ```
  campo: operador → Actual: valor | Esperado: valor
  ```
- **Código de la regla**

---

## 🔄 Flujo Completo

### 1. Usuario Intenta Exportar

```
Usuario selecciona 5 documentos
  ↓
Click en "Exportar"
  ↓
POST /api/documentos/exportar
```

### 2. Backend Aplica Reglas

```
Por cada documento:
  ↓
1. Aplica reglas TRANSFORMACION_DOCUMENTO
  ↓
2. Aplica reglas VALIDACION al documento  ⭐
  ↓
3. Aplica reglas TRANSFORMACION a líneas
  ↓
4. Aplica reglas VALIDACION a líneas  ⭐
  ↓
5. Aplica reglas TRANSFORMACION a impuestos
  ↓
6. Aplica reglas VALIDACION a impuestos  ⭐
```

### 3. Decisión de Exportación

#### ✅ **Caso A: Sin Errores o Solo Warnings**
```json
Response 200:
{
  "success": true,
  "message": "5 documentos exportados. 2 warnings",
  "validaciones": {
    "totalWarnings": 2,
    "totalErrors": 0,
    "detalles": [...]
  }
}
```
- Se exportan los documentos
- Se muestra modal con warnings
- Toast amarillo

#### ❌ **Caso B: Con Errores no Bloqueantes**
```json
Response 200:
{
  "success": true,
  "message": "5 documentos exportados. 3 errores",
  "validaciones": {
    "totalWarnings": 0,
    "totalErrors": 3,
    "detalles": [...]
  }
}
```
- Se exportan los documentos
- Se muestra modal con errores
- Toast naranja

#### 🚫 **Caso C: Con Errores BLOQUEANTES**
```json
Response 400:
{
  "success": false,
  "error": "Existen validaciones bloqueantes",
  "validationErrors": [...],
  "totalErrors": 1
}
```
- **NO se exporta nada**
- Se muestra modal con errores bloqueantes
- Toast rojo
- Usuario debe corregir y reintentar

---

## 📐 Operadores Disponibles

| Operador | Descripción | Requiere valor |
|----------|-------------|----------------|
| `IS_EMPTY` | Campo vacío o null | No |
| `IS_NOT_EMPTY` | Campo tiene valor | No |
| `IS_NULL` | Campo es null | No |
| `IS_NOT_NULL` | Campo no es null | No |
| `EQUALS` | Igual a valor | Sí |
| `NOT_EQUALS` | Diferente a valor | Sí |
| `CONTAINS` | Contiene texto | Sí |
| `NOT_CONTAINS` | No contiene texto | Sí |
| `STARTS_WITH` | Comienza con texto | Sí |
| `ENDS_WITH` | Termina con texto | Sí |
| `GREATER_THAN` | Mayor que número | Sí |
| `LESS_THAN` | Menor que número | Sí |
| `GREATER_THAN_OR_EQUAL` | Mayor o igual | Sí |
| `LESS_THAN_OR_EQUAL` | Menor o igual | Sí |

---

## 🎯 Mejores Prácticas

### 1. **Mensajes Claros y Accionables**

❌ **Mal**:
```json
"mensajeError": "Error en CUIT"
```

✅ **Bien**:
```json
"mensajeError": "El CUIT es obligatorio y no puede estar vacío. Complete el campo manualmente antes de exportar."
```

### 2. **Usar Severidades Apropiadas**

- `BLOQUEANTE`: Solo para datos que REALMENTE impiden continuar
- `ERROR`: Para datos importantes pero no críticos
- `WARNING`: Para sugerencias y recomendaciones

### 3. **Agrupar Validaciones Relacionadas**

Si varios campos son obligatorios, crear UNA regla con múltiples condiciones (AND):

```json
{
  "condiciones": [
    {"campo": "campo1", "operador": "IS_NOT_EMPTY"},
    {"campo": "campo2", "operador": "IS_NOT_EMPTY"},
    {"campo": "campo3", "operador": "IS_NOT_EMPTY"}
  ],
  "logicOperator": "AND"
}
```

### 4. **Prioridad Correcta**

- Validaciones bloqueantes: 100
- Validaciones de error: 50-90
- Validaciones de warning: 1-49

### 5. **stopOnMatch Solo con BLOQUEANTE**

```json
{
  "severidad": "BLOQUEANTE",
  "stopOnMatch": true  // ✅ Detiene inmediatamente
}

{
  "severidad": "ERROR",
  "stopOnMatch": false  // ✅ Continúa validando todo
}
```

---

## 🚀 Cómo Crear una Regla de Validación

### Paso 1: Definir Qué Validar

- ¿Qué campo debe validarse?
- ¿Qué condición debe cumplir?
- ¿Qué tan crítico es?

### Paso 2: Crear la Regla

Usar el endpoint `POST /api/reglas` o desde la UI de configuración.

### Paso 3: Probar

1. Crear documento de prueba que FALLE la validación
2. Intentar exportar
3. Verificar que se muestra el error correcto

### Paso 4: Ajustar Mensaje

Basándose en feedback de usuarios, mejorar el mensaje para que sea claro.

---

## 🐛 Troubleshooting

### "La validación no se ejecuta"

✅ Verificar:
- `tipo: "VALIDACION"` (no TRANSFORMACION)
- `activa: true`
- La regla está guardada en la BD

### "El mensaje no se muestra"

✅ Verificar:
- `mensajeError` está configurado
- Las condiciones están fallando (invertir lógica si es necesario)

### "Se exporta aunque haya error"

✅ Verificar:
- Si quieres bloquear: usar `severidad: "BLOQUEANTE"`
- Errores ERROR y WARNING permiten exportar

---

## 📞 Soporte

Para más información o problemas:
1. Revisar logs del backend (buscar 🔍 y ⚠️)
2. Verificar respuesta del endpoint en DevTools
3. Consultar esta guía

---

**✨ Sistema implementado y listo para usar! ✨**
