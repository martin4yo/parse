# Diseño Multitenant - Sistema de Rendiciones

## Arquitectura Recomendada: Base de Datos Única + tenant_id

### Modelo de Datos

#### Tabla Central: `tenants`
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,           -- empresa-abc
  nombre VARCHAR(200) NOT NULL,               -- "Empresa ABC S.A."
  cuit VARCHAR(11) UNIQUE NOT NULL,           -- "20-12345678-9"
  plan VARCHAR(20) DEFAULT 'basic',           -- basic, premium, enterprise
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  configuracion JSONB DEFAULT '{}',           -- configuraciones específicas
  limites JSONB DEFAULT '{
    "usuarios": 10,
    "documentos_mes": 1000,
    "storage_mb": 1000
  }'
);
```

#### Modificaciones a Tablas Existentes

```sql
-- Agregar tenant_id a todas las tablas principales
ALTER TABLE usuarios ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE rendicion_items ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE documentos_procesados ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE resumen_tarjeta ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Índices para performance
CREATE INDEX idx_usuarios_tenant ON usuarios(tenant_id);
CREATE INDEX idx_rendicion_items_tenant ON rendicion_items(tenant_id);
CREATE INDEX idx_documentos_tenant ON documentos_procesados(tenant_id);

-- Row Level Security (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rendicion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_procesados ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY tenant_isolation_usuarios ON usuarios
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_isolation_rendicion ON rendicion_items
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

### Estrategias de Acceso

#### Opción 1: Subdominios (Recomendada)
```
empresa-abc.rendiciones.com
empresa-xyz.rendiciones.com
mi-empresa.rendiciones.com
```

#### Opción 2: Path-based
```
rendiciones.com/empresa-abc
rendiciones.com/empresa-xyz
```

#### Opción 3: Custom Domains (Futuro)
```
rendiciones.empresa-abc.com
sistema.empresa-xyz.com.ar
```

### Implementación en Backend

#### 1. Middleware de Tenant Detection
```javascript
// middleware/tenantMiddleware.js
const tenantMiddleware = async (req, res, next) => {
  try {
    let tenantSlug;

    // Detectar tenant por subdomain
    const subdomain = req.headers.host?.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'rendiciones') {
      tenantSlug = subdomain;
    }

    // O por header personalizado
    tenantSlug = tenantSlug || req.headers['x-tenant'];

    // O por query param (desarrollo)
    tenantSlug = tenantSlug || req.query.tenant;

    if (!tenantSlug) {
      return res.status(400).json({ error: 'Tenant no especificado' });
    }

    // Buscar tenant en BD
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug, activo: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    // Establecer contexto de tenant
    req.tenant = tenant;
    await prisma.$executeRaw`SET app.current_tenant = ${tenant.id}`;

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error de tenant' });
  }
};
```

#### 2. Modificación de Queries
```javascript
// Antes
const usuarios = await prisma.usuario.findMany();

// Después
const usuarios = await prisma.usuario.findMany({
  where: { tenant_id: req.tenant.id }
});

// O con helper
const tenantQuery = (baseWhere = {}) => ({
  ...baseWhere,
  tenant_id: req.tenant.id
});

const usuarios = await prisma.usuario.findMany({
  where: tenantQuery({ activo: true })
});
```

### Implementación en Frontend

#### 1. Detección de Tenant
```javascript
// utils/tenant.js
export const getCurrentTenant = () => {
  const hostname = window.location.hostname;
  const subdomain = hostname.split('.')[0];

  if (subdomain === 'localhost' || subdomain === '127') {
    // En desarrollo, usar query param o localStorage
    return localStorage.getItem('dev_tenant') || 'demo';
  }

  return subdomain;
};

// Configurar API client con tenant
export const apiWithTenant = {
  get: (url, options = {}) => {
    return api.get(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-Tenant': getCurrentTenant()
      }
    });
  }
  // ... otros métodos
};
```

#### 2. Contexto de Tenant
```javascript
// contexts/TenantContext.js
const TenantContext = createContext();

export const TenantProvider = ({ children }) => {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        const tenantSlug = getCurrentTenant();
        const response = await api.get(`/tenant/info?slug=${tenantSlug}`);
        setTenant(response.data);
      } catch (error) {
        console.error('Error loading tenant:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
};
```

### Consideraciones de Seguridad

1. **Row Level Security (RLS)** - Aislamiento a nivel de BD
2. **Validación en Backend** - Nunca confiar solo en frontend
3. **Logs de Auditoría** - Trackear accesos cross-tenant
4. **Sanitización de URLs** - Evitar tenant injection

### Migración Gradual

#### Fase 1: Preparación
- Agregar tabla `tenants`
- Agregar `tenant_id` a tablas existentes
- Crear tenant "default" para datos actuales

#### Fase 2: Backend
- Implementar middleware de tenant
- Modificar queries existentes
- Agregar RLS

#### Fase 3: Frontend
- Implementar detección de tenant
- Modificar API calls
- UI de gestión de tenants

#### Fase 4: Go Live
- Configurar subdominios
- Migrar clientes uno por uno
- Monitoreo y ajustes

### Estructura de Archivos Sugerida

```
backend/
├── middleware/
│   ├── tenantMiddleware.js
│   └── tenantSecurity.js
├── models/
│   ├── Tenant.js
│   └── TenantScope.js
├── routes/
│   ├── tenant.js          # Gestión de tenants
│   └── admin.js           # Super admin
└── utils/
    └── tenantUtils.js

frontend/
├── contexts/
│   └── TenantContext.js
├── utils/
│   ├── tenant.js
│   └── apiWithTenant.js
└── components/
    ├── TenantSelector.js   # Para desarrollo
    └── TenantGuard.js      # Route protection
```

### Ventajas Específicas para tu Proyecto

1. **Configuración por Empresa**
   - Diferentes tipos de productos por rubro
   - Parámetros contables específicos
   - Flujos de aprobación personalizados

2. **Datos Compartidos**
   - Tipos de comprobantes AFIP
   - Códigos de bancos argentinos
   - Feriados nacionales

3. **Escalabilidad**
   - Fácil agregar nuevas empresas
   - Performance predecible
   - Mantenimiento simplificado

¿Te parece bien esta aproximación? ¿Quieres que detalle algún aspecto específico o prefieres que empecemos con la implementación?