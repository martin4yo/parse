# Scripts de Configuración - Rendiciones

## 🏢 Configuración Inicial (seed-default.js)

Script para crear un tenant por defecto y un usuario superuser en el sistema.

### Uso Básico

```bash
# Ejecutar desde el directorio backend
npm run db:seed-default

# O directamente
node scripts/seed-default.js
```

### Datos por Defecto

El script crea:

**Tenant:**
- **Nombre:** "Empresa Demo"
- **CUIT:** "20123456789"
- **Slug:** "empresa-demo"
- **Plan:** Enterprise
- **Estado:** Activo

**Usuario Superuser:**
- **Email:** admin@rendiciones.com
- **Password:** Admin123!
- **Nombre:** Super Admin
- **Permisos:** Superuser (acceso a todos los tenants)

### Personalización

Puedes personalizar los datos usando variables de entorno:

```bash
# Ejemplo con datos personalizados
SUPERUSER_EMAIL="mi@empresa.com" \
SUPERUSER_PASSWORD="MiPassword123!" \
TENANT_NAME="Mi Empresa S.A." \
TENANT_CUIT="20987654321" \
npm run db:seed-default
```

### Variables de Entorno Disponibles

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `SUPERUSER_EMAIL` | Email del usuario superuser | admin@rendiciones.com |
| `SUPERUSER_PASSWORD` | Contraseña del superuser | Admin123! |
| `TENANT_NAME` | Nombre del tenant | "Empresa Demo" |
| `TENANT_CUIT` | CUIT del tenant | "20123456789" |
| `TENANT_RAZON_SOCIAL` | Razón social del tenant | "Empresa Demo S.A." |

### Características

✅ **Seguro:** No sobreescribe datos existentes
✅ **Flexible:** Configurable con variables de entorno
✅ **Completo:** Crea tenant con configuración empresarial
✅ **Robusto:** Manejo de errores y validaciones

### Casos de Uso

1. **Primera instalación:** Configuración inicial del sistema
2. **Desarrollo:** Crear datos de prueba consistentes
3. **Producción:** Setup rápido para nuevos despliegues
4. **Testing:** Datos base para pruebas automatizadas

### Qué hace el script

1. **Verifica** si ya existe el tenant o usuario
2. **Crea** el tenant con configuración completa si no existe
3. **Crea** el usuario superuser con contraseña hasheada
4. **Asocia** el usuario al tenant
5. **Muestra** un resumen de la configuración

### Estructura del Tenant Creado

```json
{
  "configuracion": {
    "moneda_defecto": "ARS",
    "iva_defecto": 21,
    "logo_url": null
  },
  "limites": {
    "max_usuarios": 100,
    "max_rendiciones_mes": 1000,
    "storage_mb": 10240
  }
}
```

### Ayuda

```bash
node scripts/seed-default.js --help
```

### Requisitos

- Base de datos configurada
- Prisma Client generado
- Dependencia `bcrypt` instalada

### Para Producción

```bash
# En el servidor de producción
cd /root/apps/rendiciones/backend

# Configurar credenciales empresariales
SUPERUSER_EMAIL="admin@miempresa.com" \
SUPERUSER_PASSWORD="ContraseñaSegura123!" \
TENANT_NAME="Mi Empresa S.A." \
TENANT_CUIT="20123456789" \
npm run db:seed-default
```