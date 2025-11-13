# 📋 Sistema de Menú Dinámico - Guía Completa

## ✅ Implementación Completada

Sistema completo de gestión de menú del sidebar construido desde base de datos con interfaz de administración.

---

## 📦 Componentes del Sistema

### 1. **Base de Datos**

#### Tabla `menu_items`
```sql
CREATE TABLE "menu_items" (
    id TEXT PRIMARY KEY,
    parentId TEXT,                  -- NULL = nivel 1, ID = nivel 2
    title VARCHAR(100),             -- Título visible
    icon VARCHAR(50),               -- Nombre del ícono de lucide-react
    url VARCHAR(255),               -- Ruta de navegación (NULL si es contenedor)
    description VARCHAR(500),       -- Descripción del item
    orderIndex INTEGER DEFAULT 0,  -- Orden de visualización
    isActive BOOLEAN DEFAULT true, -- Activo/Inactivo
    requiresPermission VARCHAR(100), -- Permiso opcional
    superuserOnly BOOLEAN,         -- Solo visible para superusuarios
    tenantId TEXT,                 -- Multi-tenant (NULL = global)
    createdAt TIMESTAMP,
    updatedAt TIMESTAMP,
    createdBy TEXT,
    updatedBy TEXT
)
```

**Características:**
- ✅ Jerarquía de 2 niveles (padre → hijo)
- ✅ Íconos configurables de lucide-react
- ✅ URLs configurables por item
- ✅ Soporte multi-tenant
- ✅ Control de permisos y superusuarios
- ✅ Ordenamiento personalizable

**Ubicación:** `backend/prisma/schema.prisma` líneas 1116-1146

---

### 2. **Backend - API**

#### Endpoints Disponibles

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| `GET` | `/api/menu` | Obtiene menú jerárquico completo | Usuario autenticado |
| `GET` | `/api/menu/:id` | Obtiene un item específico | Usuario autenticado |
| `POST` | `/api/menu` | Crea nuevo item | Superusuario |
| `PUT` | `/api/menu/:id` | Actualiza item existente | Superusuario |
| `DELETE` | `/api/menu/:id` | Elimina item (cascada) | Superusuario |
| `PATCH` | `/api/menu/:id/reorder` | Cambia orden del item | Superusuario |
| `GET` | `/api/menu/icons/available` | Lista de íconos disponibles | Público |

**Filtros Automáticos:**
- Por tenant del usuario
- Por permisos de superusuario
- Solo items activos (`isActive = true`)

**Ubicación:** `backend/src/routes/menu.js`

---

### 3. **Frontend - Hook useMenu**

Hook personalizado para consumir la API del menú:

```typescript
import { useMenu } from '@/hooks/useMenu';

function MyComponent() {
  const { menuItems, loading, error, refetch } = useMenu();

  // menuItems: MenuItem[] - Items del menú
  // loading: boolean - Estado de carga
  // error: Error | null - Error si ocurrió
  // refetch: () => Promise<void> - Recargar menú
}
```

**Interface MenuItem:**
```typescript
interface MenuItem {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  url: string | null;
  description: string | null;
  orderIndex: number;
  isActive: boolean;
  requiresPermission: string | null;
  superuserOnly: boolean;
  tenantId: string | null;
  children?: MenuItem[];
}
```

**Ubicación:** `packages/web/src/hooks/useMenu.ts`

---

### 4. **Frontend - Sidebar Dinámico**

El componente `Sidebar.tsx` fue actualizado para consumir el menú desde la API.

**Características:**
- ✅ Carga dinámica desde base de datos
- ✅ Mapa de íconos de lucide-react
- ✅ Estados de carga
- ✅ Filtrado automático por permisos
- ✅ Mantiene funcionalidad de colapsar/expandir
- ✅ Navegación con query params preservados

**Ubicación:** `packages/web/src/components/layout/Sidebar.tsx`

**IconMap:** Resuelve dinámicamente componentes de íconos desde strings:
```typescript
const IconMap = {
  Home, FileText, CreditCard, Settings, // ... etc
};

const getIconComponent = (iconName: string) => {
  return IconMap[iconName] || FileText; // Fallback
};
```

---

### 5. **Panel de Administración**

Interfaz completa para gestionar items del menú en `/admin/menu` (solo superusuarios).

#### Componentes Creados:

**1. MenuAdminPage** - Página principal
- **Ubicación:** `packages/web/src/app/(protected)/admin/menu/page.tsx`
- Grid de 3 columnas (lista + preview)
- Botón "Nuevo Item"
- Modal de formulario

**2. MenuItemsList** - Listado jerárquico con drag & drop
- **Ubicación:** `packages/web/src/components/admin/menu/MenuItemsList.tsx`
- Muestra items en árbol (padre → hijos)
- **Drag & Drop funcional** usando @hello-pangea/dnd
- Reordenar items padre arrastrando verticalmente
- Reordenar items hijo dentro de su sección
- Feedback visual durante arrastre (highlight azul)
- Handle de arrastre (icono ⋮⋮)
- Botones Editar/Eliminar
- Badges de estado (Activo, Superuser, Inactivo)
- Confirmación antes de eliminar
- Actualización automática del orderIndex

**3. MenuItemForm** - Formulario CRUD
- **Ubicación:** `packages/web/src/components/admin/menu/MenuItemForm.tsx`
- Crear y editar items
- Validaciones de campos requeridos
- Selector de ícono (dropdown con todos los disponibles)
- Selector de item padre (para crear sub-items)
- Checkboxes para Activo/Superuser
- Modal responsive

**4. MenuPreview** - Vista previa del sidebar
- **Ubicación:** `packages/web/src/components/admin/menu/MenuPreview.tsx`
- Simula cómo se verá el sidebar
- Íconos con emojis
- Secciones expandibles
- Badges de Superuser
- Filtrado por items activos

---

## 🚀 Datos Iniciales

28 items migrados automáticamente desde el sidebar hardcodeado:

**Nivel 1 (8 secciones):**
1. Dashboard
2. Comprobantes
3. Rendiciones
4. Autorización
5. Exportar
6. Tesorería
7. Configuración
8. Sincronización

**Nivel 2 (20 sub-items):**
- Dashboard: Dashboard, Reportes
- Comprobantes: Efectivo, Tarjeta, Extracción de datos
- Rendiciones: Efectivo, Tarjeta
- Tesorería: Adelantos, Pagos, Devoluciones, Importar Resumen, Liquidación, Estado de Cuenta
- Configuración: Usuarios, Parámetros, Prompts IA, Planes, Tarjetas, Tenants, **Gestión de Menú** (nuevo)
- Sincronización: Configuraciones, API Keys

**Script de seed:** `backend/src/seed/menu-items.js`

Para volver a ejecutar el seed:
```bash
cd backend
node src/seed/menu-items.js
```

---

## 📖 Uso del Sistema

### Para Usuarios Finales

El menú se carga automáticamente al iniciar sesión. No requiere acción adicional.

**Visibilidad:**
- Los usuarios normales ven todos los items EXCEPTO los marcados con `superuserOnly`
- Los superusuarios ven TODOS los items (incluyendo Tenants, Sincronización, Gestión de Menú)

### Para Administradores (Superusuarios)

1. **Acceder al panel de administración:**
   - Navegar a `Configuración → Gestión de Menú`
   - O directamente a `/admin/menu`

2. **Crear nuevo item:**
   - Click en "Nuevo Item"
   - Completar formulario:
     - Título (requerido)
     - Ícono (requerido)
     - URL (opcional, dejar vacío si es contenedor)
     - Descripción (opcional)
     - Item Padre (opcional, para crear sub-item)
     - Orden (número, menor = primero)
     - Activo (checkbox)
     - Solo Superusuarios (checkbox)
   - Click "Crear"

3. **Editar item existente:**
   - Click en botón "Editar" (ícono lápiz)
   - Modificar campos
   - Click "Guardar"

4. **Eliminar item:**
   - Click en botón "Eliminar" (ícono papelera)
   - Confirmar eliminación
   - **Nota:** Si tiene hijos, se eliminarán en cascada

5. **Reordenar items:**

   **Método 1: Drag & Drop (Recomendado)**
   - Hacer clic y mantener presionado en el ícono de agarrar (⋮⋮)
   - Arrastrar el item a la nueva posición
   - Soltar
   - El orden se actualiza automáticamente

   **Método 2: Manual**
   - Editar el item
   - Cambiar el campo "Orden"
   - Guardar

6. **Activar/Desactivar:**
   - Editar el item
   - Desmarcar checkbox "Activo"
   - Guardar
   - El item desaparecerá del sidebar pero se conservará en BD

---

## 🎨 Íconos Disponibles

35 íconos de lucide-react disponibles:

```
Home, Upload, CreditCard, Settings, LogOut, User, Users, FileText,
PieChart, Receipt, Shield, Send, Building2, BarChart3, FileCheck,
Banknote, CheckCircle, Folder, TrendingUp, Calculator, DollarSign,
Download, FileBarChart, ArrowUpCircle, ArrowDownCircle, RefreshCw,
Key, Sparkles, ScanText, Package
```

Para agregar más íconos:
1. Importar desde `lucide-react` en `Sidebar.tsx`
2. Agregar al objeto `IconMap`
3. Agregar al array `AVAILABLE_ICONS` en `MenuItemForm.tsx`

---

## 🔧 Casos de Uso Comunes

### Crear sección de nivel 1 sin hijos

```
Título: Reportes
Ícono: BarChart3
URL: /reportes
Item Padre: Ninguno
Orden: 9
```

### Crear sección de nivel 1 CON hijos (contenedor)

```
Título: Administración
Ícono: Settings
URL: (vacío)
Item Padre: Ninguno
Orden: 10
```

### Crear sub-item (nivel 2)

```
Título: Logs del Sistema
Ícono: FileText
URL: /admin/logs
Item Padre: Administración
Orden: 1
```

### Item solo para superusuarios

```
Título: Gestión de Tenants
Ícono: Building2
URL: /admin/tenants
Solo Superusuarios: ✓ (marcado)
```

### Desactivar temporalmente un item

```
Editar el item
Activo: ☐ (desmarcado)
Guardar
```

---

## 🔐 Seguridad

- ✅ Todos los endpoints requieren autenticación (`authWithTenant`)
- ✅ Endpoints de escritura (POST/PUT/DELETE) requieren `superuser = true`
- ✅ Filtrado automático por `tenantId` del usuario
- ✅ Filtrado automático por `superuserOnly`
- ✅ Validación de permisos en backend
- ✅ Confirmación antes de eliminar items

---

## 🎯 Funcionalidades Implementadas

- ✅ Carga dinámica del menú desde BD
- ✅ CRUD completo de items
- ✅ Interfaz de administración
- ✅ Preview en tiempo real
- ✅ Soporte multi-tenant
- ✅ Control de permisos
- ✅ Ordenamiento personalizable
- ✅ **Drag & Drop para reordenar** (tanto padres como hijos)
- ✅ Estados activo/inactivo
- ✅ Jerarquía de 2 niveles
- ✅ Íconos configurables
- ✅ URLs configurables
- ✅ Feedback visual durante arrastre

## ⏳ Pendiente (Futuro)

- ⏸️ Soporte para más de 2 niveles
- ⏸️ Sistema de permisos granular por rol
- ⏸️ Duplicar items
- ⏸️ Importar/exportar configuración de menú
- ⏸️ Historial de cambios

---

## 🐛 Troubleshooting

### El menú no aparece

1. Verificar que el backend esté corriendo
2. Verificar que existe data en la tabla `menu_items`:
   ```sql
   SELECT COUNT(*) FROM menu_items WHERE "isActive" = true;
   ```
3. Ejecutar seed si no hay datos:
   ```bash
   cd backend && node src/seed/menu-items.js
   ```

### Los items de superusuario no aparecen

1. Verificar que el usuario esté marcado como superusuario:
   ```sql
   SELECT id, nombre, apellido, superuser FROM users WHERE email = 'tu@email.com';
   ```
2. Si `superuser` es `false`, actualizar:
   ```sql
   UPDATE users SET superuser = true WHERE email = 'tu@email.com';
   ```

### El item se guarda pero no aparece

1. Verificar que `isActive = true`
2. Verificar que el usuario tenga permisos (si es `superuserOnly`)
3. Forzar recarga del menú (F5 en navegador)

### Error "Item de menú no encontrado"

El item fue eliminado de la BD. Verificar con:
```sql
SELECT * FROM menu_items WHERE id = 'el-id-del-item';
```

---

## 📝 Notas Adicionales

- El menú se cachea en memoria del componente para performance
- Los cambios en BD requieren refetch o recarga de página
- La eliminación es en cascada (borra hijos automáticamente)
- El orden se aplica ascendente (1, 2, 3...)
- Los items con `url = NULL` solo funcionan como contenedores

---

## 🎓 Arquitectura Técnica

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
├─────────────────────────────────────────────────┤
│  Sidebar.tsx                                     │
│    ↓ useMenu()                                   │
│  MenuAdminPage.tsx                               │
│    ├─ MenuItemsList.tsx                          │
│    ├─ MenuItemForm.tsx                           │
│    └─ MenuPreview.tsx                            │
└────────────────┬────────────────────────────────┘
                 │ HTTP (axios)
                 ↓
┌─────────────────────────────────────────────────┐
│                   Backend                        │
├─────────────────────────────────────────────────┤
│  /api/menu (routes/menu.js)                     │
│    ↓ authWithTenant                              │
│  Prisma Client                                   │
└────────────────┬────────────────────────────────┘
                 │ SQL
                 ↓
┌─────────────────────────────────────────────────┐
│              PostgreSQL                          │
├─────────────────────────────────────────────────┤
│  menu_items                                      │
│    - Jerarquía (parentId)                        │
│    - Multi-tenant (tenantId)                     │
│    - Permisos (superuserOnly)                    │
└─────────────────────────────────────────────────┘
```

---

**Sistema implementado exitosamente** ✅

Última actualización: 2025-01-24
