# 📚 GUÍA COMPLETA: SEPARACIÓN DE ARQUITECTURA MULTITENANT

## 🎯 Resumen Ejecutivo

Esta documentación describe la estrategia completa para separar la lógica común de **tenants, usuarios, parámetros y AI** del proyecto actual de Rendiciones en un ecosistema de paquetes reutilizables que permita:

✅ Compartir infraestructura de autenticación entre múltiples aplicaciones
✅ Desplegar cada aplicación en servidores independientes
✅ Mantener una administración centralizada de tenants y usuarios
✅ Escalar horizontalmente según las necesidades de cada app

---

## 📖 Documentos Disponibles

### 1. [ARQUITECTURA_SEPARACION_MONOREPO.md](./ARQUITECTURA_SEPARACION_MONOREPO.md)
**Documento principal con la estrategia completa**

**Contenido:**
- ✅ Visión general de la arquitectura objetivo
- ✅ Estructura detallada del monorepo
- ✅ Estrategias de base de datos (única vs separadas)
- ✅ Plan de migración por fases (18 semanas)
- ✅ Guías de implementación de cada paquete
- ✅ Casos de uso y recomendaciones

**Cuándo usarlo:**
- Para entender la visión completa del proyecto
- Antes de comenzar la migración
- Para tomar decisiones arquitectónicas

---

### 2. [DEPLOYMENT_MULTI_SERVIDOR.md](./DEPLOYMENT_MULTI_SERVIDOR.md)
**Guía específica para deployment distribuido**

**Contenido:**
- ✅ Arquitectura de servidores distribuidos
- ✅ Topologías de deployment (4 opciones)
- ✅ Comunicación entre servidores (API Gateway, service discovery)
- ✅ Configuración de networking y seguridad
- ✅ Monitoreo y logs centralizados
- ✅ Scripts de deployment y automatización

**Cuándo usarlo:**
- Cuando estés listo para desplegar en múltiples servidores
- Para configurar comunicación entre aplicaciones
- Para implementar monitoring

---

### 3. [EJEMPLOS_CONFIGURACION_SERVIDORES.md](./EJEMPLOS_CONFIGURACION_SERVIDORES.md)
**Configuraciones específicas paso a paso**

**Contenido:**
- ✅ Configuración completa del Servidor 1 (Core Admin)
- ✅ Configuración completa del Servidor 2 (Rendiciones)
- ✅ Configuración completa del Servidor 3 (Inventario)
- ✅ Todos los archivos .env necesarios
- ✅ Configuraciones de Nginx, PM2, PostgreSQL
- ✅ Scripts de instalación automatizados

**Cuándo usarlo:**
- Durante la instalación de cada servidor
- Como referencia para configuración específica
- Para copiar/pegar configuraciones

---

## 🚀 Cómo Empezar

### Opción A: Implementación Inmediata (Recomendada para aprender)

**Si quieres probar la arquitectura localmente:**

1. Lee **ARQUITECTURA_SEPARACION_MONOREPO.md** secciones:
   - Visión General
   - Estructura del Monorepo
   - FASE 0 y FASE 1

2. Ejecuta:
```bash
# Crear estructura básica
./scripts/setup-monorepo.sh

# Extraer primer paquete (auth-core)
./scripts/migrate-auth-core.sh

# Probar en app actual
cd apps/rendiciones
pnpm install
pnpm dev
```

3. Valida que funcione localmente antes de continuar

---

### Opción B: Planificación Completa (Recomendada para producción)

**Si vas a implementar en producción:**

1. **Semana 1-2: Análisis y Preparación**
   - Lee todos los documentos completamente
   - Ejecuta script de análisis de dependencias
   - Corrige problemas críticos (constraints de BD)
   - Define equipo y timeline

2. **Semana 3-4: Setup Monorepo**
   - Crea estructura de monorepo
   - Configura Turborepo/pnpm workspaces
   - Extrae primer paquete (@tuorg/auth-core)
   - Testing exhaustivo

3. **Semana 5-8: Extracción de Paquetes**
   - @tuorg/tenant-admin
   - @tuorg/parametros
   - @tuorg/ai-prompts
   - @tuorg/ui-components

4. **Semana 9-12: Migración de Apps**
   - Crear app core-admin
   - Migrar app rendiciones al monorepo
   - Actualizar todos los imports

5. **Semana 13-16: Separación de BDs**
   - Crear BDs separadas
   - Migrar datos
   - Validación de integridad

6. **Semana 17-18: Deployment**
   - Configurar servidores
   - Deployment en producción
   - Monitoreo y ajustes

---

## 🎓 Conceptos Clave

### ¿Qué es un Monorepo?

Un **monorepo** es un repositorio único que contiene múltiples proyectos relacionados:

```
ecosystem/
├── packages/          # Código compartido (como librerías)
│   ├── auth-core/
│   └── tenant-admin/
└── apps/             # Aplicaciones finales
    ├── rendiciones/
    └── inventario/
```

**Ventajas:**
- ✅ Cambios atómicos (un commit afecta múltiples paquetes)
- ✅ Refactoring más fácil
- ✅ Compartir código sin publicar a NPM

### ¿Qué son los Workspaces?

**Workspaces** (de pnpm/yarn/npm) permiten que múltiples paquetes en un monorepo se referencien entre sí:

```json
// package.json de rendiciones
{
  "dependencies": {
    "@tuorg/auth-core": "workspace:*"  // ← Usa versión local
  }
}
```

### ¿Cómo Funcionan los Servidores Separados?

```
Usuario → API Gateway (Servidor 1)
           ├→ /api/auth → Core API (Servidor 1)
           ├→ /api/documentos → Rendiciones API (Servidor 2)
           └→ /api/productos → Inventario API (Servidor 3)
```

Cada app puede estar en un servidor diferente, pero el **gateway** (Nginx) enruta las peticiones correctamente.

---

## 🗺️ Roadmap Visual

```
┌─────────────────────────────────────────────────────────────┐
│  FASE 0: Preparación (1-2 semanas)                         │
│  ✓ Análisis de código actual                               │
│  ✓ Corrección de problemas críticos                        │
│  ✓ Setup estructura monorepo                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 1: Extracción auth-core (2 semanas)                  │
│  ✓ Crear paquete @tuorg/auth-core                          │
│  ✓ Migrar middleware authWithTenant                        │
│  ✓ Migrar passport config                                  │
│  ✓ Testing                                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 2-4: Más Paquetes (4-6 semanas)                      │
│  ✓ @tuorg/tenant-admin                                      │
│  ✓ @tuorg/parametros                                        │
│  ✓ @tuorg/ai-prompts                                        │
│  ✓ @tuorg/ui-components                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 5-6: Apps (4 semanas)                                │
│  ✓ Crear app core-admin                                    │
│  ✓ Migrar app rendiciones                                  │
│  ✓ Testing integración                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 7: Separar BDs (2 semanas)                           │
│  ✓ Crear BD core_db                                        │
│  ✓ Crear BD rendiciones_db                                 │
│  ✓ Migrar datos                                             │
│  ✓ Validar integridad                                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 8: Deployment (2 semanas)                            │
│  ✓ Configurar Servidor 1 (Core)                            │
│  ✓ Configurar Servidor 2 (Rendiciones)                     │
│  ✓ Setup API Gateway                                       │
│  ✓ Monitoring y alertas                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                  🎉 PRODUCCIÓN 🎉
```

---

## 🤔 Preguntas Frecuentes

### ¿Puedo tener cada app en un servidor diferente?

**Sí, absolutamente.** Esa es una de las principales ventajas de esta arquitectura. Puedes tener:

- **Servidor 1:** Core Admin (gestión de tenants/usuarios)
- **Servidor 2:** Rendiciones (tu app actual)
- **Servidor 3:** Inventario (nueva app)
- **Servidor 4:** Ventas (otra app)
- etc.

Ver **DEPLOYMENT_MULTI_SERVIDOR.md** para detalles.

---

### ¿Necesito separar las bases de datos?

**No inmediatamente.** Puedes comenzar con una sola BD PostgreSQL con schemas separados:

```sql
-- BD única con schemas
core_db
├── schema: auth (users, tenants)
├── schema: rendiciones (documentos, tarjetas)
└── schema: inventario (productos, stock)
```

Luego, cuando escales, puedes separar en BDs físicamente diferentes.

---

### ¿Cómo se comunican los servidores?

**Tres opciones:**

1. **API Gateway (recomendada):** Nginx en Servidor 1 enruta a los demás
2. **Llamadas directas:** Cada backend conoce las IPs de los otros
3. **Service Discovery:** Consul/Eureka para registro dinámico

Ver sección "Comunicación entre Servidores" en **DEPLOYMENT_MULTI_SERVIDOR.md**.

---

### ¿Qué pasa con JWT entre servidores?

Si usas el **mismo JWT_SECRET** en todos los servidores, un token generado en Core funcionará en Rendiciones:

```env
# TODOS los servidores
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...  # Mismo valor
```

---

### ¿Cuánto cuesta infraestructura multi-servidor?

**Ejemplos:**

| Escenario | Servidores | Specs | Costo/mes |
|-----------|-----------|-------|-----------|
| **Startup** | 3 VPS | 4 cores, 8GB RAM | $100-150 |
| **Mediana** | 5 VPS | 8 cores, 16GB RAM | $400-600 |
| **Enterprise** | 10+ Servers | 16 cores, 32GB RAM | $2000+ |

Proveedores recomendados:
- DigitalOcean (buenos precios)
- AWS EC2 (más caro pero escalable)
- Linode (balance precio/performance)
- Vultr (económico)

---

### ¿Cuándo NO usar esta arquitectura?

**No uses multi-servidor si:**
- ❌ Tienes <1000 usuarios
- ❌ Una sola app por ahora (sin planes de más)
- ❌ Equipo muy pequeño (<3 devs)
- ❌ Presupuesto muy limitado

**En ese caso:** Mantén todo en un servidor con la arquitectura de monorepo (que igual te da los beneficios de código compartido).

---

### ¿Puedo agregar nuevas apps fácilmente?

**Sí, muy fácil:**

```bash
# 1. Crear nueva app
mkdir -p apps/ventas/backend
mkdir -p apps/ventas/frontend

# 2. Instalar dependencias compartidas
cd apps/ventas/backend
pnpm add @tuorg/auth-core @tuorg/tenant-admin

# 3. Usar en código
import { authWithTenant } from '@tuorg/auth-core/middleware';

app.use('/api/ventas', authWithTenant, ventasRoutes);
```

La nueva app automáticamente hereda:
- ✅ Sistema de autenticación
- ✅ Gestión de tenants
- ✅ Parámetros configurables
- ✅ Sistema de AI

---

## 🎯 Próximos Pasos Recomendados

### Para Probar Localmente (1-2 días)

1. Lee **ARQUITECTURA_SEPARACION_MONOREPO.md** secciones:
   - Visión General
   - Estructura del Monorepo
   - FASE 0 y FASE 1

2. Ejecuta en tu máquina local:
```bash
# Clonar proyecto actual
cd D:\Desarrollos\React\Rendiciones

# Crear rama para pruebas
git checkout -b feature/monorepo-test

# Ejecutar script de setup
./scripts/setup-monorepo.sh

# Extraer auth-core
./scripts/migrate-auth-core.sh

# Probar
cd apps/rendiciones
pnpm dev
```

3. Si funciona, continúa con FASE 2

---

### Para Implementar en Producción (3-4 meses)

1. **Mes 1:** Preparación y setup monorepo
   - Corregir problemas críticos
   - Extraer paquetes compartidos
   - Testing local

2. **Mes 2:** Migración de apps
   - Crear core-admin
   - Migrar rendiciones
   - Testing integración

3. **Mes 3:** Separación de BDs y deployment
   - Configurar servidores
   - Migrar datos
   - Deploy gradual

4. **Mes 4:** Ajustes y nuevas apps
   - Monitoreo y optimización
   - Crear primera app nueva (inventario)
   - Documentación para equipo

---

## 📞 Soporte y Recursos

### Documentación Relacionada
- [Turborepo Docs](https://turbo.build/repo/docs)
- [PNPM Workspaces](https://pnpm.io/workspaces)
- [Prisma Multi-DB](https://www.prisma.io/docs/guides/database/multi-database)
- [Nginx Proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)

### Herramientas Útiles
- **Turborepo:** Build system para monorepos
- **Lerna:** Gestión de versiones de paquetes
- **Nx:** Alternativa enterprise a Turborepo
- **PM2:** Process manager para Node.js
- **Prometheus + Grafana:** Monitoreo

---

## ✅ Checklist Final

### Antes de Empezar
- [ ] Leí todos los documentos completamente
- [ ] Entiendo la arquitectura objetivo
- [ ] Tengo backup completo de BD y código
- [ ] Definí timeline y equipo
- [ ] Conseguí aprobación de stakeholders

### Durante Implementación
- [ ] Seguí el plan de migración por fases
- [ ] Hice testing en cada fase
- [ ] Documenté cambios importantes
- [ ] Mantuve código en Git con commits claros

### Antes de Producción
- [ ] Testing end-to-end completo
- [ ] Load testing
- [ ] Configuré monitoring y alertas
- [ ] Hice backup de BDs
- [ ] Preparé plan de rollback
- [ ] Documenté procedimientos para equipo

---

## 🎉 Conclusión

Esta arquitectura te permitirá:

✅ **Escalar:** Agregar nuevas apps sin modificar las existentes
✅ **Mantener:** Fixes de bugs en un solo lugar
✅ **Deploy:** Cada app independientemente
✅ **Costo:** Optimizar recursos por app
✅ **Equipo:** Múltiples equipos trabajando sin conflictos

**Recuerda:** Puedes implementar gradualmente. No necesitas hacer todo a la vez. Comienza con el monorepo localmente, luego separa cuando lo necesites.

---

## 📚 Orden de Lectura Recomendado

1. **Este archivo (README)** - Entender el contexto general
2. **ARQUITECTURA_SEPARACION_MONOREPO.md** - Estrategia completa
3. **DEPLOYMENT_MULTI_SERVIDOR.md** - Cuando estés listo para desplegar
4. **EJEMPLOS_CONFIGURACION_SERVIDORES.md** - Durante la configuración de cada servidor

---

**¿Preguntas?** Revisa la sección de FAQ o consulta los documentos específicos.

**¿Listo para empezar?** Comienza con FASE 0 en **ARQUITECTURA_SEPARACION_MONOREPO.md**.

---

**Última actualización:** 2025-10-23
**Versión:** 1.0.0
**Autor:** Equipo de Arquitectura
