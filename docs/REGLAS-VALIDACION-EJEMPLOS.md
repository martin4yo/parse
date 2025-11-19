# Reglas de Validación - Ejemplos para Testing

**Fecha:** 18 de Enero 2025
**Propósito:** Ejemplos de reglas de validación para probar las mejoras de UX

---

## 📋 Reglas de Ejemplo

### 1. VALIDACIÓN BLOQUEANTE: CUIT Obligatorio

**Propósito:** Impedir exportación sin CUIT del proveedor

```json
{
  "codigo": "VAL_CUIT_OBLIGATORIO",
  "nombre": "Validar CUIT no vacío",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 10,
  "configuracion": {
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "cuitExtraido",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "mensajeError": "El CUIT del proveedor es obligatorio para exportar el documento",
    "severidad": "BLOQUEANTE",
    "stopOnMatch": true
  }
}
```

**Prueba:**
1. Subir una factura
2. Editar y borrar el CUIT
3. Intentar exportar
4. Verás error BLOQUEANTE en el modal
5. Hacer clic en "Editar" → campo CUIT se resaltará

---

### 2. ERROR: Importe Total Mayor a Cero

**Propósito:** El importe debe ser positivo

```json
{
  "codigo": "VAL_IMPORTE_POSITIVO",
  "nombre": "Validar importe mayor a cero",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 20,
  "configuracion": {
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "importeExtraido",
        "operador": "GREATER_THAN",
        "valor": 0
      }
    ],
    "mensajeError": "El importe total debe ser mayor a $0",
    "severidad": "ERROR",
    "stopOnMatch": false
  }
}
```

**Prueba:**
1. Editar documento y poner importe en 0
2. Ver validación en tiempo real aparecer (panel amarillo/naranja)
3. Cambiar a valor positivo
4. Ver cómo desaparece la validación

---

### 3. ERROR: Fecha No Puede Ser Futura

**Propósito:** Las facturas no pueden tener fecha futura

```json
{
  "codigo": "VAL_FECHA_NO_FUTURA",
  "nombre": "Validar fecha no futura",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 30,
  "configuracion": {
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "fechaExtraida",
        "operador": "LESS_OR_EQUAL",
        "valor": "{{HOY}}"
      }
    ],
    "mensajeError": "La fecha del comprobante no puede ser futura",
    "severidad": "ERROR",
    "stopOnMatch": false
  }
}
```

**Nota:** Reemplazar `{{HOY}}` con la fecha actual en formato YYYY-MM-DD al crear la regla.

**Prueba:**
1. Editar fecha a una fecha futura
2. Ver error en tiempo real
3. Hacer clic en botón de lápiz junto al error
4. Campo fecha se resaltará automáticamente

---

### 4. WARNING: Número de Comprobante con Formato

**Propósito:** Advertir si el formato no es estándar

```json
{
  "codigo": "VAL_FORMATO_COMPROBANTE",
  "nombre": "Validar formato número comprobante",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 40,
  "configuracion": {
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "numeroComprobanteExtraido",
        "operador": "REGEX",
        "valor": "^\\d{5}-\\d{8}$"
      }
    ],
    "mensajeError": "El número de comprobante no tiene el formato esperado (00000-00000000). Se recomienda corregirlo.",
    "severidad": "WARNING",
    "stopOnMatch": false
  }
}
```

**Prueba:**
1. Editar número de comprobante a formato incorrecto (ej: "123")
2. Ver WARNING (amarillo) en tiempo real
3. Intentar exportar → verás modal con warning
4. Podrás usar botón "Exportar X con Warnings"

---

### 5. WARNING: Razón Social No Vacía

**Propósito:** Advertir si falta razón social

```json
{
  "codigo": "VAL_RAZON_SOCIAL_PRESENTE",
  "nombre": "Validar razón social presente",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 50,
  "configuracion": {
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "razonSocialExtraida",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "mensajeError": "Se recomienda completar la razón social del proveedor",
    "severidad": "WARNING",
    "stopOnMatch": false
  }
}
```

---

### 6. ERROR: Tipo de Comprobante Válido

**Propósito:** El tipo debe ser uno de los permitidos

```json
{
  "codigo": "VAL_TIPO_COMPROBANTE_VALIDO",
  "nombre": "Validar tipo de comprobante válido",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 60,
  "configuracion": {
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "tipoComprobanteExtraido",
        "operador": "IN",
        "valor": ["FACTURA A", "FACTURA B", "FACTURA C", "TICKET", "NOTA DE CREDITO", "NOTA DE DEBITO", "RECIBO"]
      }
    ],
    "mensajeError": "El tipo de comprobante debe ser uno de los valores permitidos",
    "severidad": "ERROR",
    "stopOnMatch": false
  }
}
```

---

### 7. WARNING: Coherencia de Importes

**Propósito:** Advertir si la suma no cuadra (sin bloquear)

```json
{
  "codigo": "VAL_COHERENCIA_IMPORTES",
  "nombre": "Validar coherencia entre neto, impuestos y total",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 70,
  "configuracion": {
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "importeExtraido",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "mensajeError": "Advertencia: Verificar que la suma de Neto Gravado + Exento + Impuestos sea igual al Importe Total",
    "severidad": "WARNING",
    "stopOnMatch": false
  }
}
```

**Nota:** Esta es una validación simplificada. En producción podrías usar transformaciones de campo y cálculos.

---

### 8. VALIDACIÓN EN LÍNEAS: Descripción Obligatoria

**Propósito:** Cada ítem debe tener descripción

```json
{
  "codigo": "VAL_LINEA_DESCRIPCION",
  "nombre": "Validar descripción en líneas",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 80,
  "configuracion": {
    "aplicaA": "LINEAS",
    "condiciones": [
      {
        "campo": "descripcion",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "mensajeError": "Cada línea debe tener una descripción",
    "severidad": "ERROR",
    "stopOnMatch": false
  }
}
```

**Prueba:**
1. Documento con líneas
2. Editar línea y borrar descripción
3. Ver error en modal con origen "linea X"

---

### 9. VALIDACIÓN EN IMPUESTOS: Alícuota Válida

**Propósito:** La alícuota debe estar en rango permitido

```json
{
  "codigo": "VAL_IMPUESTO_ALICUOTA",
  "nombre": "Validar alícuota de impuesto",
  "tipo": "VALIDACION",
  "activa": true,
  "prioridad": 90,
  "configuracion": {
    "aplicaA": "IMPUESTOS",
    "condiciones": [
      {
        "campo": "alicuota",
        "operador": "IN",
        "valor": ["0", "10.5", "21", "27"]
      }
    ],
    "mensajeError": "La alícuota debe ser 0%, 10.5%, 21% o 27%",
    "severidad": "ERROR",
    "stopOnMatch": false
  }
}
```

---

## 🧪 Escenarios de Prueba

### Escenario 1: Error Bloqueante Simple

**Objetivo:** Probar botón "Editar" y highlight de campo

1. Crear regla `VAL_CUIT_OBLIGATORIO` (BLOQUEANTE)
2. Subir factura con CUIT
3. Editar y borrar CUIT
4. Guardar
5. Intentar exportar
6. **Verificar:**
   - ✅ Modal de validaciones aparece
   - ✅ Error con icono ❌ rojo
   - ✅ Badge "1 Bloqueante"
   - ✅ Botón "Editar" en encabezado del documento
   - ✅ Botón de lápiz junto a "cuitExtraido: IS_NOT_EMPTY"
7. Hacer clic en botón "Editar"
8. **Verificar:**
   - ✅ Modal de validaciones se cierra
   - ✅ Modal de edición se abre
   - ✅ Campo CUIT tiene anillo amarillo pulsante
   - ✅ Auto-scroll al campo CUIT
   - ✅ Highlight desaparece después de 5 segundos

---

### Escenario 2: Validaciones en Tiempo Real

**Objetivo:** Probar validaciones mientras editas

1. Crear reglas:
   - `VAL_CUIT_OBLIGATORIO` (BLOQUEANTE)
   - `VAL_IMPORTE_POSITIVO` (ERROR)
   - `VAL_RAZON_SOCIAL_PRESENTE` (WARNING)
2. Subir factura completa (con todos los campos)
3. Abrir en edición
4. **No hay validaciones** (panel no aparece)
5. Borrar CUIT
6. Esperar 1 segundo
7. **Verificar:**
   - ✅ Panel de validaciones aparece debajo del nombre
   - ✅ Error rojo con icono ❌
   - ✅ Mensaje: "El CUIT del proveedor es obligatorio"
8. Restaurar CUIT (escribir uno válido)
9. Esperar 1 segundo
10. **Verificar:**
    - ✅ Error desaparece del panel
11. Cambiar importe a 0
12. Esperar 1 segundo
13. **Verificar:**
    - ✅ Nuevo error naranja aparece
14. Borrar razón social
15. Esperar 1 segundo
16. **Verificar:**
    - ✅ Warning amarillo aparece
    - ✅ Múltiples validaciones se muestran simultáneamente

---

### Escenario 3: Exportar con Warnings

**Objetivo:** Probar exportación selectiva

1. Crear 3 documentos:
   - Doc A: Sin CUIT (BLOQUEANTE)
   - Doc B: Sin razón social (WARNING)
   - Doc C: Formato comprobante incorrecto (WARNING)
2. Seleccionar los 3
3. Intentar exportar
4. **Verificar:**
   - ✅ Modal aparece con 3 documentos
   - ✅ Doc A: Badge "1 Bloqueante"
   - ✅ Doc B y C: Badge "1 Warning"
   - ✅ Footer muestra: "2 documento(s) con solo warnings pueden exportarse"
   - ✅ Botón amarillo: "Exportar 2 con Warnings"
5. Hacer clic en "Exportar 2 con Warnings"
6. **Verificar:**
   - ✅ Confirmación aparece
   - ✅ Solo Doc B y C se exportan
   - ✅ Doc A queda sin exportar
   - ✅ Toast de éxito: "2 documento(s) exportado(s) con warnings"

---

### Escenario 4: Tooltips Explicativos

**Objetivo:** Probar tooltips en operadores

1. Crear cualquier regla de validación
2. Hacer que falle (ej: borrar CUIT)
3. Intentar exportar
4. Ver modal con errores
5. En "Detalles:", pasar mouse sobre el operador (ej: `IS_NOT_EMPTY`)
6. **Verificar:**
   - ✅ Tooltip aparece: "El campo debe tener contenido"
   - ✅ Operador tiene subrayado punteado
7. Probar con otros operadores:
   - `GREATER_THAN` → "El valor numérico debe ser mayor que el especificado"
   - `IN` → "El valor debe estar en la lista de valores permitidos"

---

### Escenario 5: Validaciones en Líneas e Impuestos

**Objetivo:** Probar navegación automática a tabs

1. Crear regla `VAL_LINEA_DESCRIPCION` (aplicaA: LINEAS)
2. Subir documento con líneas
3. Editar línea 2, borrar descripción
4. Intentar exportar
5. **Verificar:**
   - ✅ Error con origen "linea 2"
6. Hacer clic en "Editar"
7. **Verificar:**
   - ✅ Modal se abre en tab "Items" (no "Encabezado")
   - ✅ Usuario ve directamente las líneas

---

## 📝 Scripts SQL para Insertar Reglas

### Insertar todas las reglas de ejemplo:

```sql
-- 1. CUIT Obligatorio (BLOQUEANTE)
INSERT INTO reglas_negocio (id, codigo, nombre, tipo, activa, prioridad, "tenantId", configuracion)
VALUES (
  gen_random_uuid(),
  'VAL_CUIT_OBLIGATORIO',
  'Validar CUIT no vacío',
  'VALIDACION',
  true,
  10,
  'TU_TENANT_ID_AQUI',
  '{
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "cuitExtraido",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "mensajeError": "El CUIT del proveedor es obligatorio para exportar el documento",
    "severidad": "BLOQUEANTE",
    "stopOnMatch": true
  }'::jsonb
);

-- 2. Importe Positivo (ERROR)
INSERT INTO reglas_negocio (id, codigo, nombre, tipo, activa, prioridad, "tenantId", configuracion)
VALUES (
  gen_random_uuid(),
  'VAL_IMPORTE_POSITIVO',
  'Validar importe mayor a cero',
  'VALIDACION',
  true,
  20,
  'TU_TENANT_ID_AQUI',
  '{
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "importeExtraido",
        "operador": "GREATER_THAN",
        "valor": 0
      }
    ],
    "mensajeError": "El importe total debe ser mayor a $0",
    "severidad": "ERROR",
    "stopOnMatch": false
  }'::jsonb
);

-- 3. Razón Social (WARNING)
INSERT INTO reglas_negocio (id, codigo, nombre, tipo, activa, prioridad, "tenantId", configuracion)
VALUES (
  gen_random_uuid(),
  'VAL_RAZON_SOCIAL_PRESENTE',
  'Validar razón social presente',
  'VALIDACION',
  true,
  50,
  'TU_TENANT_ID_AQUI',
  '{
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "razonSocialExtraida",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "mensajeError": "Se recomienda completar la razón social del proveedor",
    "severidad": "WARNING",
    "stopOnMatch": false
  }'::jsonb
);

-- 4. Formato Comprobante (WARNING)
INSERT INTO reglas_negocio (id, codigo, nombre, tipo, activa, prioridad, "tenantId", configuracion)
VALUES (
  gen_random_uuid(),
  'VAL_FORMATO_COMPROBANTE',
  'Validar formato número comprobante',
  'VALIDACION',
  true,
  40,
  'TU_TENANT_ID_AQUI',
  '{
    "aplicaA": "DOCUMENTO",
    "condiciones": [
      {
        "campo": "numeroComprobanteExtraido",
        "operador": "REGEX",
        "valor": "^\\\\d{5}-\\\\d{8}$"
      }
    ],
    "mensajeError": "El número de comprobante no tiene el formato esperado (00000-00000000). Se recomienda corregirlo.",
    "severidad": "WARNING",
    "stopOnMatch": false
  }'::jsonb
);

-- 5. Descripción en Líneas (ERROR)
INSERT INTO reglas_negocio (id, codigo, nombre, tipo, activa, prioridad, "tenantId", configuracion)
VALUES (
  gen_random_uuid(),
  'VAL_LINEA_DESCRIPCION',
  'Validar descripción en líneas',
  'VALIDACION',
  true,
  80,
  'TU_TENANT_ID_AQUI',
  '{
    "aplicaA": "LINEAS",
    "condiciones": [
      {
        "campo": "descripcion",
        "operador": "IS_NOT_EMPTY"
      }
    ],
    "mensajeError": "Cada línea debe tener una descripción",
    "severidad": "ERROR",
    "stopOnMatch": false
  }'::jsonb
);
```

**Nota:** Reemplazar `TU_TENANT_ID_AQUI` con tu tenant ID real.

---

## 🎯 Checklist de Testing

### Funcionalidad 1: Botón Editar
- [ ] Botón "Editar" aparece en encabezado de documento con errores
- [ ] Botones de lápiz aparecen junto a cada condición fallida
- [ ] Hacer clic cierra modal de validaciones
- [ ] Hacer clic abre documento en edición
- [ ] Tab correcto se selecciona (Encabezado/Items/Impuestos)

### Funcionalidad 2: Highlight de Campos
- [ ] Campo problemático tiene anillo amarillo pulsante
- [ ] Auto-scroll funciona correctamente
- [ ] Highlight desaparece después de 5 segundos
- [ ] Funciona con diferentes campos (CUIT, fecha, importe)

### Funcionalidad 3: Tooltips
- [ ] Tooltip aparece al pasar mouse sobre operador
- [ ] Tooltip tiene texto explicativo correcto
- [ ] Operador tiene subrayado punteado
- [ ] Funciona con todos los operadores

### Funcionalidad 4: Exportar con Warnings
- [ ] Contador muestra documentos con solo warnings
- [ ] Botón amarillo aparece solo si hay warnings exportables
- [ ] Confirmación pide confirmación al usuario
- [ ] Solo exporta documentos con warnings (excluye bloqueantes/errores)
- [ ] Toast de éxito muestra cantidad correcta

### Funcionalidad 5: Validaciones en Tiempo Real
- [ ] Panel aparece debajo del nombre del documento
- [ ] Validaciones aparecen después de 1 segundo (debounce)
- [ ] Errores se muestran con color correcto (rojo/naranja/amarillo)
- [ ] Validaciones desaparecen al corregir
- [ ] Múltiples validaciones se muestran simultáneamente
- [ ] No aparece en modo solo lectura

---

## 🐛 Troubleshooting

### El panel de validaciones en tiempo real no aparece

**Verificar:**
1. Endpoint `/api/documentos/:id/validate` existe y responde
2. Hay reglas tipo `VALIDACION` activas en la BD
3. El documento tiene errores según las reglas
4. No estás en modo "Solo lectura"
5. Esperaste 1 segundo después de editar (debounce)

**Test manual del endpoint:**
```bash
curl -X POST http://localhost:5100/api/documentos/DOC_ID/validate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "datosActuales": {
      "cuitExtraido": "",
      "importeExtraido": 0
    }
  }'
```

### El highlight no funciona

**Verificar:**
1. Campo tiene atributo `data-field="nombreCampo"`
2. `highlightedField` state tiene el valor correcto
3. useEffect de auto-scroll se ejecuta
4. Clases CSS de Tailwind están disponibles

### Botón "Exportar con Warnings" no aparece

**Verificar:**
1. Hay documentos con `severidad: "WARNING"`
2. Esos documentos NO tienen bloqueantes ni errores
3. `documentsWithErrors` Map está poblado correctamente

---

**¡Listo para probar!** 🚀
