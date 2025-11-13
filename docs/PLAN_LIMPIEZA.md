# 🧹 Plan de Limpieza - Aplicación Parse

## 📋 Principio: Solo mantener lo relacionado con Parse

Parse es SOLO para:
- ✅ Subir y procesar comprobantes
- ✅ Extraer datos con IA/OCR
- ✅ Aplicar reglas de negocio y transformaciones
- ✅ Sincronizar con SQL Server externo
- ✅ Gestión de usuarios y tenants (multitenant)
- ✅ Configuración de prompts de IA

---

## 🗂️ Backend - Rutas a Mantener/Eliminar

### ✅ MANTENER (Core de Parse)

| Ruta | Propósito | Razón |
|------|-----------|-------|
| `auth.js` | Autenticación | Login/registro necesario |
| `documentos.js` | Procesamiento documentos | **CORE** de Parse |
| `prompts.js` | Gestión de prompts IA | **CORE** - prompts editables |
| `reglas.js` | Reglas de negocio | **CORE** - transformaciones |
| `parametros.js` | Parámetros maestros | **CORE** - completado de datos |
| `sync.js` | Sincronización SQL | **CORE** - integración externa |
| `syncApiKeys.js` | API keys de sync | **CORE** - autenticación sync |
| `tenants.js` | Gestión multitenant | Sistema base |
| `users.js` | Gestión usuarios | Sistema base |
| `jobs.js` | Procesamiento async | Útil para procesar lotes |
| `planes.js` | Sistema de planes | Control de features por tenant |
| `menu.js` | Menú dinámico | UI flexible |

### ❌ ELIMINAR (Heredado de rendiciones)

| Ruta | Razón para eliminar |
|------|---------------------|
| `adelantos.js` | ❌ Tesorería - no aplica a Parse |
| `atributos.js` | ❌ Gestión de atributos de usuarios - no necesario |
| `bancoTipoTarjeta.js` | ❌ Gestión de tarjetas - no aplica |
| `bancos.js` | ❌ Catálogo de bancos - no necesario |
| `cajas.js` | ❌ Tesorería - no aplica |
| `delegaciones.js` | ❌ Delegación de tarjetas - no aplica |
| `dkt.js` | ❌ Importación DKT (formato específico) - no necesario |
| `estados.js` | ❌ Estados de rendiciones - no aplica |
| `exportar.js` | ❌ Export de rendiciones - no aplica |
| `liquidacion.js` | ❌ Liquidación de lotes - no aplica |
| `mobile.js` | ❌ API móvil para rendiciones - no necesario |
| `monedas.js` | ❌ Catálogo de monedas - no necesario en Parse |
| `movimientos-tesoreria.js` | ❌ Tesorería - no aplica |
| `rendiciones.js` | ❌ Rendiciones - **NO** es parte de Parse |
| `tarjetas.js` | ❌ Gestión de tarjetas - no aplica |
| `tiposTarjeta.js` | ❌ Tipos de tarjetas - no aplica |
| `userAtributos.js` | ❌ Atributos de usuarios - no necesario |
| `userCajas.js` | ❌ Asignación de cajas - no aplica |
| `userTarjetasCredito.js` | ❌ Tarjetas de usuarios - no aplica |
| `usuarioAutorizantes.js` | ❌ Flujo de aprobación - no aplica |
| `valoresAtributo.js` | ❌ Valores de atributos - no necesario |

**Total a eliminar**: 19 archivos de rutas

---

## 🎨 Frontend - Páginas a Mantener/Eliminar

### ✅ MANTENER

| Página | Propósito | Razón |
|--------|-----------|-------|
| `auth/*` | Login/registro | Sistema base |
| `dashboard/page.tsx` | Dashboard principal | **CORE** - vista principal |
| `parse/page.tsx` | Procesamiento Parse | **CORE** - funcionalidad principal |
| `prompts-ia/page.tsx` | Editor de prompts | **CORE** - configuración IA |
| `parametros/page.tsx` | Gestión parámetros | **CORE** - tabla de completado |
| `sync-admin/*` | Admin sincronización | **CORE** - config SQL |
| `usuarios/page.tsx` | Gestión usuarios | Sistema base |
| `admin/tenants/page.tsx` | Gestión tenants | Multitenant |
| `admin/menu/page.tsx` | Configuración menú | UI dinámica |
| `configuracion/planes/page.tsx` | Gestión de planes | Control de features |
| `app-launcher/page.tsx` | Launcher | Ya existe |

### ❌ ELIMINAR

| Página | Razón |
|--------|-------|
| `autorizaciones/page.tsx` | ❌ Aprobación de rendiciones |
| `comprobantes/page.tsx` | ❌ Comprobantes de tarjeta (específico rendiciones) |
| `comprobantes-efectivo/page.tsx` | ❌ Efectivo |
| `dkt/importar/page.tsx` | ❌ Import DKT |
| `exportar/page.tsx` | ❌ Export rendiciones |
| `rendicion-efectivo/page.tsx` | ❌ Rendiciones efectivo |
| `rendiciones/page.tsx` | ❌ Rendiciones tarjeta |
| `reportes/page.tsx` | ❌ Reportes de rendiciones |
| `tarjetas/page.tsx` | ❌ Gestión de tarjetas |
| `tesoreria/*` | ❌ Todo el módulo de tesorería (5 páginas) |

**Total a eliminar**: 15 páginas

---

## 🗄️ Base de Datos - Tablas a Mantener/Eliminar

### ✅ MANTENER (Esenciales para Parse)

**Sistema Base**:
- `tenants` - Multitenant
- `users` - Usuarios
- `profiles` - Perfiles de usuario
- `planes` - Sistema de planes
- `plan_features` - Features por plan
- `ai_provider_configs` - Config de proveedores IA por tenant
- `menu_items` - Menú dinámico

**Core Parse**:
- `documentos_procesados` - **CORE** - documentos subidos
- `documento_lineas` - **CORE** - detalle de items
- `documento_impuestos` - **CORE** - impuestos extraídos
- `ai_prompts` - **CORE** - prompts editables
- `reglas_negocio` - **CORE** - reglas de transformación
- `reglas_ejecuciones` - Logs de reglas
- `parametros_maestros` - **CORE** - tabla de parámetros
- `parametros_relaciones` - Relaciones entre parámetros
- `processing_jobs` - Jobs de procesamiento async

**Sincronización SQL**:
- `sync_configurations` - **CORE** - config de sync
- `sync_logs` - Logs de sincronización
- `sync_api_keys` - API keys para sync

**Total tablas a mantener**: 20

### ❌ ELIMINAR (Heredado de rendiciones)

**Tarjetas y Bancos**:
- `tarjetas`
- `tipos_tarjeta`
- `bancos`
- `banco_tipo_tarjeta`
- `user_tarjetas_credito`
- `delegacion_tarjetas`

**Rendiciones**:
- `rendicion_tarjeta_cabecera`
- `rendicion_tarjeta_items`
- `rendicion_tarjeta_detalle`
- `resumen_tarjeta`
- `resumen_tarjeta_concepto`
- `documentos_asociados` (específico de rendiciones)
- `estados` (estados de rendición)

**Tesorería**:
- `cajas`
- `monedas`
- `movimientos_tesoreria`
- `detalle_movimientos_tesoreria`
- `saldos_cajas`
- `user_cajas`

**Atributos de Usuarios**:
- `atributos`
- `valores_atributo`
- `user_atributos`
- `usuario_autorizantes`

**Total tablas a eliminar**: 24 tablas

---

## 📊 Resumen de Limpieza

| Categoría | Mantener | Eliminar |
|-----------|----------|----------|
| **Rutas Backend** | 12 | 19 |
| **Páginas Frontend** | 11 | 15 |
| **Tablas BD** | 20 | 24 |

---

## 🔄 Orden de Ejecución Propuesto

1. ✅ **Análisis** (completado)
2. 🔜 **Backend** - Eliminar rutas y actualizar index
3. 🔜 **Frontend** - Eliminar páginas y componentes
4. 🔜 **Menú** - Actualizar navegación
5. 🔜 **Schema Prisma** - Comentar/eliminar modelos no usados
6. 🔜 **Verificación** - Probar que todo funcione

---

## ⚠️ Consideraciones

- **No borrar físicamente archivos aún** - primero comentar para probar
- **Backup antes de tocar BD** - aunque ya está en `rendiciones_db`
- **Probar después de cada paso**
- **Mantener logs de sync** - útil para debug

¿Procedemos con este plan?
