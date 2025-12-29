# Sesión 28 Diciembre 2025 - Tipos de Parámetro Dinámicos

## Objetivo
Migrar los tipos de parámetros maestros de una lista hardcodeada a una tabla de BD editable, global y jerarquizada.

## Problema Original
- Los tipos de parámetros (proveedor, cuenta_contable, etc.) estaban hardcodeados en `maestros.js`
- No se podían agregar nuevos tipos sin modificar código
- Otras aplicaciones (Hub) necesitaban consultar la lista de tipos disponibles

## Solución Implementada

### 1. Nueva Tabla `tipos_parametro` (GLOBAL)

**Schema:** `backend/prisma/schema.prisma`

```prisma
model tipos_parametro {
  id          Int      @id @default(autoincrement())
  codigo      String   @unique          // proveedor, cuenta_contable, etc.
  nombre      String                    // Proveedor, Cuenta Contable, etc.
  descripcion String?
  grupo       String                    // Categoría para agrupar en UI
  orden       Int      @default(1)
  activo      Boolean  @default(true)
  icono       String?                   // Icono opcional para UI
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Características:**
- Sin tenantId → Global para todos los tenants
- Cada tenant usa los tipos que necesita para sus parámetros maestros

### 2. API Interna (Backend)

**Nuevos endpoints en `/api/parametros/tipos`:**

| Endpoint | Método | Descripción | Auth |
|----------|--------|-------------|------|
| `/api/parametros/tipos` | GET | Listar tipos (con filtros) | Usuario autenticado |
| `/api/parametros/tipos` | POST | Crear tipo | **Solo Superuser** |
| `/api/parametros/tipos/:id` | PUT | Actualizar tipo | **Solo Superuser** |
| `/api/parametros/tipos/:id` | DELETE | Eliminar tipo | **Solo Superuser** |
| `/api/parametros/tipos/grupos` | GET | Listar grupos únicos | Usuario autenticado |

**Archivo:** `backend/src/routes/parametros/tiposParametro.js`

### 3. Endpoint Modificado

**`/api/parametros/maestros/campos-rendicion`** ahora lee de la BD:

```javascript
// ANTES: Lista hardcodeada de 21 tipos
// DESPUÉS: Consulta a tipos_parametro
const tiposParametro = await prisma.tipos_parametro.findMany({
  where: { activo: true },
  orderBy: [{ grupo: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }]
});
```

### 4. API Externa para Hub

**Nuevos endpoints en `/api/v1/parse/`:**

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/parse/tipos` | Lista tipos disponibles (agrupados) |
| `GET /api/v1/parse/parametros/:tipoCampo` | Obtiene parámetros de cualquier tipo |

**Ejemplo de uso desde Hub:**
```bash
# Obtener tipos disponibles
curl -H "X-API-Key: xxx" https://api.parsedemo.../api/v1/parse/tipos

# Obtener proveedores del tenant
curl -H "X-API-Key: xxx" https://api.parsedemo.../api/v1/parse/parametros/proveedor
```

### 5. Frontend - Nueva Pestaña

**Ubicación:** Parámetros → "Tipos de Parámetro"

**Archivo:** `frontend/src/components/parametros/TiposParametro.tsx`

**Funcionalidades:**
- Lista tipos agrupados por grupo
- Crear/Editar/Eliminar tipos (solo superusers)
- Filtros por grupo, estado y búsqueda
- Validación: no permite eliminar tipos en uso

## Tipos Iniciales Migrados (22)

| Grupo | Tipos |
|-------|-------|
| Productos y Conceptos | tipo_producto, codigo_producto, concepto_modulo, concepto_tipo, concepto_codigo, concepto_liquidacion |
| Comercio/Proveedor | modulo_comprobante, tipo_registro, comprobante_origen, codigo_origen, proveedor, tipo_orden_compra |
| Información Fiscal | tipo_documento, codigo_pais, condicion_iva, codigo_moneda, cuit_propio |
| Contabilidad | tipo_operacion, tipo_comprobante, codigo_dimension, subcuenta, cuenta_contable |

## Archivos Modificados/Creados

### Backend
- `backend/prisma/schema.prisma` - Nuevo modelo tipos_parametro
- `backend/src/routes/parametros/tiposParametro.js` - **NUEVO** CRUD tipos
- `backend/src/routes/parametros/index.js` - Registro de ruta
- `backend/src/routes/parametros/maestros.js` - campos-rendicion lee de BD
- `backend/src/routes/parseApi.js` - Endpoints genéricos para API externa
- `backend/src/scripts/migrate-tipos-parametro.js` - **NUEVO** Script migración

### Frontend
- `frontend/src/lib/api.ts` - Funciones getTipos, createTipo, etc.
- `frontend/src/components/parametros/TiposParametro.tsx` - **NUEVO** Componente
- `frontend/src/app/(protected)/parametros/page.tsx` - Nueva pestaña

## Comandos de Referencia

```bash
# Ejecutar migración de tipos (si no se ejecutó)
cd backend
node src/scripts/migrate-tipos-parametro.js

# Regenerar cliente Prisma
npx prisma generate
```

## Próximos Pasos Sugeridos

1. Probar en producción que Hub puede consultar los tipos
2. Agregar más tipos según necesidad de los clientes
3. Considerar UI para reordenar tipos con drag & drop
