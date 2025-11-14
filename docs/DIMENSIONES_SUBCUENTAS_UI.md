# Sistema de Dimensiones y Subcuentas - Especificación UI

## 📋 Objetivo

Reemplazar los campos individuales `codigoDimension` y `subcuenta` en los formularios de edición de **Líneas** e **Impuestos** de comprobantes por un sistema completo de **Distribuciones con Dimensiones y Subcuentas**.

---

## 🎯 Ubicación

**Modal afectado:** `DocumentViewerModal.tsx` (frontend/src/components/rendiciones/modals/)

**Secciones a modificar:**
1. Modal de edición de Líneas de Comprobante (línea 710-897)
2. Modal de edición de Impuestos de Comprobante (línea 899-1020)

---

## 🔄 Cambio Conceptual

### Estado Actual

```tsx
// Líneas de Comprobante
<input label="Código Dimensión" value={codigoDimension} />
<input label="Subcuenta" value={subcuenta} />
<input label="Cuenta Contable" value={cuentaContable} />

// Impuestos de Comprobante
<input label="Código Dimensión" value={codigoDimension} />
<input label="Subcuenta" value={subcuenta} />
<input label="Cuenta Contable" value={cuentaContable} />
```

### Estado Nuevo

```tsx
// Líneas e Impuestos de Comprobante
<button>📊 Dimensiones (3)</button>  // Abre modal de distribuciones
```

---

## 🏗️ Estructura de Datos

### Modelo de Distribuciones

```typescript
interface DocumentoDistribucion {
  id: string;
  documentoLineaId?: string;      // FK a línea (XOR con documentoImpuestoId)
  documentoImpuestoId?: string;   // FK a impuesto
  tipoDimension: string;          // "CENTRO_COSTO", "SUCURSAL", "PROYECTO"
  tipoDimensionNombre?: string;   // "Centro de Costo", "Sucursal Buenos Aires"
  importeDimension: number;       // Importe asignado a esta dimensión
  orden: number;                  // Orden de presentación (1, 2, 3...)
  activo: boolean;
  subcuentas: DocumentoSubcuenta[];
}

interface DocumentoSubcuenta {
  id: string;
  distribucionId: string;         // FK a documento_distribuciones
  codigoSubcuenta: string;        // "CC001", "SUC-BA", "PROY-123"
  subcuentaNombre?: string;       // "Administración", "Sucursal BA"
  cuentaContable?: string;        // "3010101"
  porcentaje: number;             // 0-100 (debe sumar 100% por distribución)
  importe: number;                // Calculado automáticamente
  orden: number;
  activo: boolean;
}
```

---

## 🎨 Diseño de UI - Modal de Dimensiones

### Botón de Acceso

```tsx
// Reemplaza los 3 campos (codigoDimension, subcuenta, cuentaContable)
<div className="col-span-2 border border-gray-200 rounded-lg p-4 bg-gray-50">
  <div className="flex items-center justify-between">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Distribuciones Contables
      </label>
      <p className="text-xs text-gray-500">
        {distribuciones.length} dimensión(es) configuradas
      </p>
    </div>
    <button
      type="button"
      onClick={() => setShowDistribucionesModal(true)}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      <div className="flex items-center space-x-2">
        <Package className="w-4 h-4" />
        <span>Gestionar Dimensiones</span>
      </div>
    </button>
  </div>

  {/* Preview de distribuciones */}
  {distribuciones.length > 0 && (
    <div className="mt-3 space-y-2">
      {distribuciones.map(dist => (
        <div key={dist.id} className="text-xs bg-white p-2 rounded border">
          <div className="font-medium">{dist.tipoDimensionNombre}</div>
          <div className="text-gray-600">
            {formatCurrency(dist.importeDimension)} - {dist.subcuentas.length} subcuenta(s)
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

---

## 📐 Modal de Gestión de Dimensiones

### Estructura

```
┌────────────────────────────────────────────────────────┐
│  Dimensiones y Subcuentas                        [X]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Total de la línea: $1,000.00                         │
│  Total distribuido: $1,000.00 ✅                       │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📊 Dimensión 1: Centro de Costo       [Eliminar]│ │
│  │ Importe: $600.00 (60%)                           │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  Subcuentas:                                     │ │
│  │  • CC001 - Administración     40% = $240.00      │ │
│  │  • CC002 - Comercial          60% = $360.00      │ │
│  │  Total: 100% ✅                                   │ │
│  │  [+ Agregar Subcuenta]  [⚡ Ajustar último]      │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📊 Dimensión 2: Proyecto            [Eliminar]   │ │
│  │ Importe: $400.00 (40%)                           │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  Subcuentas:                                     │ │
│  │  • PROY-001 - Obra 2025     100% = $400.00       │ │
│  │  Total: 100% ✅                                   │ │
│  │  [+ Agregar Subcuenta]                           │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  [+ Agregar Dimensión]                                │
│                                                        │
│  ⚠️ El total distribuido debe ser igual al total      │
│     de la línea del comprobante.                      │
│                                                        │
│  [Cancelar]  [⚡ Ajustar Automático]  [Guardar]       │
└────────────────────────────────────────────────────────┘
```

---

## ⚙️ Funcionalidades Clave

### 1. Validación de Suma Total

```typescript
const validarDistribuciones = () => {
  const totalLinea = parseFloat(editingLinea.totalLinea);
  const totalDistribuido = distribuciones.reduce(
    (sum, dist) => sum + parseFloat(dist.importeDimension),
    0
  );

  const diferencia = Math.abs(totalLinea - totalDistribuido);
  const tolerancia = 0.01; // 1 centavo de tolerancia por redondeo

  return {
    valido: diferencia <= tolerancia,
    totalLinea,
    totalDistribuido,
    diferencia
  };
};
```

### 2. Validación de Subcuentas (100%)

```typescript
const validarSubcuentas = (distribucion: DocumentoDistribucion) => {
  const totalPorcentaje = distribucion.subcuentas.reduce(
    (sum, sub) => sum + parseFloat(sub.porcentaje),
    0
  );

  const totalImporte = distribucion.subcuentas.reduce(
    (sum, sub) => sum + parseFloat(sub.importe),
    0
  );

  const importeDimension = parseFloat(distribucion.importeDimension);
  const diferenciaImporte = Math.abs(importeDimension - totalImporte);

  return {
    porcentajeValido: Math.abs(totalPorcentaje - 100) <= 0.01,
    importeValido: diferenciaImporte <= 0.01,
    totalPorcentaje,
    totalImporte,
    importeDimension
  };
};
```

### 3. Ajuste Automático - Último Registro

**Botón:** "⚡ Ajustar Último"

```typescript
const ajustarUltimaSubcuenta = (distribucion: DocumentoDistribucion) => {
  if (distribucion.subcuentas.length === 0) return;

  const subcuentas = [...distribucion.subcuentas];
  const ultimaIdx = subcuentas.length - 1;

  // Calcular total sin la última
  const totalSinUltima = subcuentas
    .slice(0, -1)
    .reduce((sum, sub) => sum + parseFloat(sub.importe), 0);

  // Ajustar la última para que sume exacto
  const importeFaltante = parseFloat(distribucion.importeDimension) - totalSinUltima;
  subcuentas[ultimaIdx].importe = importeFaltante.toFixed(2);

  // Recalcular porcentaje
  const porcentajeFaltante = subcuentas
    .slice(0, -1)
    .reduce((sum, sub) => 100 - sum - parseFloat(sub.porcentaje), 0);
  subcuentas[ultimaIdx].porcentaje = Math.max(0, porcentajeFaltante).toFixed(2);

  return subcuentas;
};
```

### 4. Edición Dual: Importe ↔ Porcentaje

```typescript
// Cambio de PORCENTAJE → recalcula IMPORTE
const handlePorcentajeChange = (
  distribucion: DocumentoDistribucion,
  subcuentaIdx: number,
  nuevoPorcentaje: number
) => {
  const nuevoImporte = (parseFloat(distribucion.importeDimension) * nuevoPorcentaje) / 100;

  updateSubcuenta(distribucion.id, subcuentaIdx, {
    porcentaje: nuevoPorcentaje.toFixed(2),
    importe: nuevoImporte.toFixed(2)
  });
};

// Cambio de IMPORTE → recalcula PORCENTAJE
const handleImporteChange = (
  distribucion: DocumentoDistribucion,
  subcuentaIdx: number,
  nuevoImporte: number
) => {
  const nuevoPorcentaje = (nuevoImporte * 100) / parseFloat(distribucion.importeDimension);

  updateSubcuenta(distribucion.id, subcuentaIdx, {
    importe: nuevoImporte.toFixed(2),
    porcentaje: nuevoPorcentaje.toFixed(2)
  });
};
```

### 5. Agregar Nueva Dimensión

```typescript
const agregarDimension = () => {
  const nuevaDimension: DocumentoDistribucion = {
    id: generateTempId(),
    documentoLineaId: editingLinea.id, // ID de la línea del comprobante
    tipoDimension: '',
    tipoDimensionNombre: '',
    importeDimension: 0,
    orden: distribuciones.length + 1,
    activo: true,
    subcuentas: []
  };

  setDistribuciones([...distribuciones, nuevaDimension]);
};
```

### 6. Agregar Subcuenta a Dimensión

```typescript
const agregarSubcuenta = (distribucionId: string) => {
  const distribucion = distribuciones.find(d => d.id === distribucionId);
  if (!distribucion) return;

  const nuevaSubcuenta: DocumentoSubcuenta = {
    id: generateTempId(),
    distribucionId,
    codigoSubcuenta: '',
    subcuentaNombre: '',
    cuentaContable: '',
    porcentaje: 0,
    importe: 0,
    orden: distribucion.subcuentas.length + 1,
    activo: true
  };

  const updatedDistribuciones = distribuciones.map(d =>
    d.id === distribucionId
      ? { ...d, subcuentas: [...d.subcuentas, nuevaSubcuenta] }
      : d
  );

  setDistribuciones(updatedDistribuciones);
};
```

---

## 🎯 Flujo de Usuario

### Caso 1: Distribución Simple (1 dimensión, 1 subcuenta)

1. Usuario edita línea de comprobante de $1,000
2. Click en "Gestionar Dimensiones"
3. Click "+ Agregar Dimensión"
4. Selecciona tipo: "Centro de Costo"
5. Ingresa importe: $1,000 (100%)
6. Click "+ Agregar Subcuenta"
7. Selecciona: "CC001 - Administración"
8. Porcentaje auto: 100%, Importe auto: $1,000
9. ✅ Validación: Total OK
10. Click "Guardar"

### Caso 2: Distribución Múltiple (2 dimensiones, varias subcuentas)

1. Usuario edita línea de comprobante de $1,000
2. Click "Gestionar Dimensiones"
3. **Dimensión 1:** Centro de Costo - $600
   - Subcuenta 1: CC001 (40%) = $240
   - Subcuenta 2: CC002 (60%) = $360
   - Total: 100% ✅
4. **Dimensión 2:** Proyecto - $400
   - Subcuenta 1: PROY-001 (100%) = $400
   - Total: 100% ✅
5. Total dimensiones: $1,000 ✅
6. Click "Guardar"

### Caso 3: Ajuste Automático (redondeo)

1. Usuario distribuye $1,000 en 3 subcuentas al 33.33% c/u
2. Subcuenta 1: 33.33% = $333.30
3. Subcuenta 2: 33.33% = $333.30
4. Subcuenta 3: 33.33% = $333.30
5. **Total:** $999.90 ❌ (falta $0.10)
6. Click "⚡ Ajustar Último"
7. Subcuenta 3 ajustada: $333.40
8. **Total:** $1,000.00 ✅

---

## 📊 Indicadores Visuales

### Estados de Validación

```tsx
// VÁLIDO: Verde
{valido && (
  <div className="flex items-center text-green-600">
    <CheckCircle className="w-4 h-4 mr-1" />
    <span>Total correcto</span>
  </div>
)}

// INVÁLIDO: Rojo con diferencia
{!valido && (
  <div className="flex items-center text-red-600">
    <AlertCircle className="w-4 h-4 mr-1" />
    <span>Diferencia: {formatCurrency(diferencia)}</span>
  </div>
)}
```

### Barra de Progreso

```tsx
<div className="w-full bg-gray-200 rounded-full h-2">
  <div
    className={`h-2 rounded-full transition-all ${
      porcentajeDistribuido === 100 ? 'bg-green-500' :
      porcentajeDistribuido > 100 ? 'bg-red-500' :
      'bg-yellow-500'
    }`}
    style={{ width: `${Math.min(porcentajeDistribuido, 100)}%` }}
  />
</div>
<div className="text-xs text-gray-600 mt-1">
  {porcentajeDistribuido.toFixed(2)}% distribuido
</div>
```

---

## 🔌 Endpoints Backend Necesarios

### 1. Obtener Distribuciones de una Línea de Comprobante

```
GET /api/documentos/lineas/:lineaId/distribuciones
Response: DocumentoDistribucion[]
```

### 2. Obtener Distribuciones de un Impuesto de Comprobante

```
GET /api/documentos/impuestos/:impuestoId/distribuciones
Response: DocumentoDistribucion[]
```

### 3. Guardar Distribuciones de Línea (Batch)

```
POST /api/documentos/lineas/:lineaId/distribuciones
Body: {
  distribuciones: DocumentoDistribucion[]
}
Response: { success: true, distribuciones: DocumentoDistribucion[] }
```

### 4. Actualizar Distribución Individual

```
PUT /api/documentos/distribuciones/:id
Body: DocumentoDistribucion
Response: { success: true, distribucion: DocumentoDistribucion }
```

### 5. Eliminar Distribución

```
DELETE /api/documentos/distribuciones/:id
Response: { success: true }
```

---

## 📝 Tareas de Implementación

### Frontend

- [ ] Crear componente `DistribucionesModal.tsx`
- [ ] Crear componente `DistribucionCard.tsx` (tarjeta de dimensión)
- [ ] Crear componente `SubcuentaRow.tsx` (fila editable)
- [ ] Implementar estado de distribuciones en `DocumentViewerModal`
- [ ] Agregar botón "Dimensiones" en modal de edición de líneas de comprobante
- [ ] Agregar botón "Dimensiones" en modal de edición de impuestos de comprobante
- [ ] Implementar validaciones de suma
- [ ] Implementar ajuste automático
- [ ] Agregar indicadores visuales de validación
- [ ] Testing completo con diferentes casos

### Backend

- [ ] Crear endpoint GET distribuciones por línea
- [ ] Crear endpoint GET distribuciones por impuesto
- [ ] Crear endpoint POST guardar distribuciones (batch)
- [ ] Crear endpoint PUT actualizar distribución
- [ ] Crear endpoint DELETE eliminar distribución
- [ ] Agregar validaciones de suma en backend
- [ ] Agregar constraint check en BD (suma = total)
- [ ] Testing de endpoints

### Base de Datos

- [x] Tablas `documento_distribuciones` creadas (schema.prisma:557-578)
- [x] Tablas `documento_subcuentas` creadas (schema.prisma:580-597)
- [ ] Aplicar migración con `prisma migrate dev`
- [ ] Regenerar Prisma Client
- [ ] Verificar índices y constraints

---

## 🚀 Prioridad de Implementación

1. **Alta:** Backend endpoints + migración BD
2. **Alta:** Componente `DistribucionesModal` básico
3. **Media:** Validaciones y ajuste automático
4. **Media:** Indicadores visuales avanzados
5. **Baja:** Optimizaciones de UX

---

## 🎨 Mockup Visual (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│ Editar Línea de Comprobante #1                            [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Descripción: [Gastos de Oficina                          ]     │
│                                                                 │
│ Cantidad: [10      ] Unidad: [UN  ] P.Unit: [$100.00    ]     │
│                                                                 │
│ Total Línea: $1,000.00                                          │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📊 Distribuciones Contables                               │ │
│ │ 2 dimensión(es) configuradas                              │ │
│ │                                                           │ │
│ │ • Centro de Costo: $600.00 (2 subcuentas)                │ │
│ │ • Proyecto: $400.00 (1 subcuenta)                         │ │
│ │                                                           │ │
│ │                         [🔧 Gestionar Dimensiones]        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                       [Cancelar] [💾 Guardar]   │
└─────────────────────────────────────────────────────────────────┘
```

---

**Fin de la especificación**
