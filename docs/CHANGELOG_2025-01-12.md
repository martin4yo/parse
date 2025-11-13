# Changelog - 12 de Enero 2025

## 🎯 Resumen de Cambios

Esta sesión se enfocó en correcciones de funcionalidad multi-tenant, mejoras de UI/UX, y configuración de email de verificación.

---

## 📊 1. Sistema de Estadísticas para Prompts de IA

### Problema
Las estadísticas de prompts de IA (`vecesUsado`, `tasaExito`) no se actualizaban cuando se extraían datos de documentos con IA.

### Solución
Se integró `PromptManager` con todas las funciones de extracción de IA para registrar estadísticas.

### Archivos Modificados

#### `backend/src/lib/documentProcessor.js`

**Función `extractWithGemini` (línea ~404)**
```javascript
async extractWithGemini(text, tenantId = null, retries = 0) {
  // Obtener prompt desde PromptManager
  const prompt = await promptManager.getPromptText(
    'EXTRACCION_FACTURA_GEMINI',
    { text },
    tenantId,
    'gemini'
  );

  if (!prompt) {
    console.error('❌ Prompt EXTRACCION_FACTURA_GEMINI no encontrado');
    return null;
  }

  // ... procesamiento con Gemini ...

  // Registrar éxito
  await promptManager.registrarResultado('EXTRACCION_FACTURA_GEMINI', true, tenantId);
  return data;
}
```

**Función `extractWithClaude` (línea ~294)**
```javascript
async extractWithClaude(text, tenantId = null) {
  // Obtener prompt desde PromptManager
  const prompt = await promptManager.getPromptText(
    'EXTRACCION_FACTURA_CLAUDE',
    { text },
    tenantId,
    'anthropic'
  );

  if (!prompt) {
    console.error('❌ Prompt EXTRACCION_FACTURA_CLAUDE no encontrado');
    return null;
  }

  // ... procesamiento con Claude ...

  await promptManager.registrarResultado('EXTRACCION_FACTURA_CLAUDE', true, tenantId);
  return result;
}
```

**Función `extractResumenTarjetaWithAI` (línea ~1688)**
```javascript
async extractResumenTarjetaWithAI(text, tenantId = null) {
  const limitedText = text.substring(0, 10000);

  // Obtener prompt desde PromptManager
  const prompt = await promptManager.getPromptText(
    'EXTRACCION_RESUMEN_TARJETA',
    { text: limitedText },
    tenantId
  );

  if (!prompt) {
    console.error('❌ Prompt EXTRACCION_RESUMEN_TARJETA no encontrado');
    return null;
  }

  // Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    // ... usar prompt con Gemini ...
    if (data.metadata && data.transacciones) {
      await promptManager.registrarResultado('EXTRACCION_RESUMEN_TARJETA', true, tenantId);
      return data;
    }
  }

  // Fallback to Anthropic
  // ... similar pattern ...
}
```

**Actualización de `extractDataWithAI` (línea ~183)**
```javascript
async extractDataWithAI(text, tenantId = null) {
  // Ahora todas las funciones reciben tenantId
  const data = await this.extractWithGemini(text, tenantId, 0);
  // ...
  const data = await this.extractWithClaude(text, tenantId);
  // ...
  const data = await this.extractWithOpenAI(text, tenantId);
}
```

#### `backend/src/routes/dkt.js`

**Línea ~860**
```javascript
// Antes:
extractedData = await processor.extractResumenTarjeta(pdfResult.text);

// Después:
extractedData = await processor.extractResumenTarjeta(pdfResult.text, req.tenantId);
```

### Patrón Implementado

Todas las funciones de extracción ahora siguen este patrón:

```javascript
// 1. Obtener prompt desde PromptManager
const prompt = await promptManager.getPromptText(clave, variables, tenantId, motor);

// 2. Usar AI con el prompt
const resultado = await motorIA.procesar(prompt);

// 3. Registrar resultado (éxito o fallo)
await promptManager.registrarResultado(clave, éxito, tenantId);
return resultado;
```

### Resultado
- ✅ `vecesUsado` se incrementa cada vez que se usa un prompt
- ✅ `tasaExito` se calcula correctamente
- ✅ Visible en la página `/prompts-ia`

---

## 👥 2. Columna de Tenant en Grilla de Usuarios

### Problema
La grilla de usuarios no mostraba el nombre del tenant al que pertenecen.

### Solución
Se agregó el include del tenant en la consulta de usuarios.

### Archivos Modificados

#### `backend/src/routes/users.js`

**Líneas 30-57**
```javascript
const [users, total] = await Promise.all([
  prisma.users.findMany({
    where,
    include: {
      profiles: {
        select: {
          id: true,
          codigo: true,
          descripcion: true
        }
      },
      tenant: {                    // ← AGREGADO
        select: {
          id: true,
          nombre: true,
          slug: true
        }
      }
    },
    orderBy: [
      { apellido: 'asc' },
      { nombre: 'asc' }
    ],
    skip: parseInt(skip),
    take: parseInt(limit)
  }),
  prisma.users.count({ where })
]);
```

### Frontend (ya estaba implementado)

**`packages/web/src/app/(protected)/usuarios/page.tsx` (línea ~853)**
```tsx
<td className="px-6 py-4 whitespace-nowrap">
  <div className="text-sm text-text-secondary">
    {user.tenant ? user.tenant.nombre : 'Sin empresa'}
  </div>
</td>
```

### Resultado
- ✅ La columna "Empresa" ahora muestra el nombre del tenant
- ✅ Muestra "Sin empresa" si el usuario no tiene tenant asignado

---

## 🏦 3. Filtrado de Tipos de Tarjeta por Tenant

### Problema
Los tipos de tarjeta por banco no se filtraban por tenant. Solo los bancos son únicos, pero tarjetas, tipos de tarjeta y tipos de tarjeta por banco deben filtrarse por tenant.

### Solución
Se actualizó el backend para usar `authWithTenant` y filtrar correctamente por tenant.

### Archivos Modificados

#### `backend/src/routes/bancoTipoTarjeta.js`

**Cambio de Middleware**
```javascript
// Antes:
const authMiddleware = require('../middleware/auth');

// Después:
const { authWithTenant } = require('../middleware/authWithTenant');
```

**Ruta GET `/` - Listado de asociaciones (línea ~12)**
```javascript
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { bancoId, tipoTarjetaId } = req.query;

    const where = { activo: true };
    if (bancoId) where.bancoId = bancoId;
    if (tipoTarjetaId) where.tipoTarjetaId = tipoTarjetaId;

    // Filtrar tipos_tarjeta por tenant (bancos son únicos, sin filtro)
    where.tipos_tarjeta = req.filterByTenant({ activo: true });

    const asociaciones = await prisma.banco_tipo_tarjeta.findMany({
      where,
      include: {
        bancos: { /* ... */ },
        tipos_tarjeta: { /* ... */ }
      }
    });

    // ...
  }
});
```

**Ruta GET `/for-import` - Selector para importación (línea ~75)**
```javascript
router.get('/for-import', authWithTenant, async (req, res) => {
  try {
    // Filtrar tipos_tarjeta por tenant (bancos son únicos, sin filtro)
    const asociaciones = await prisma.banco_tipo_tarjeta.findMany({
      where: {
        activo: true,
        tipos_tarjeta: req.filterByTenant({ activo: true })
      },
      include: {
        bancos: { /* ... */ },
        tipos_tarjeta: { /* ... */ }
      }
    });

    // ...
  }
});
```

**Ruta GET `/banco/:bancoId/tipos-disponibles` - Formulario de asociación (línea ~125)**
```javascript
router.get('/banco/:bancoId/tipos-disponibles', authWithTenant, async (req, res) => {
  try {
    const { bancoId } = req.params;

    // Verificar que el banco existe
    const banco = await prisma.bancos.findUnique({
      where: { id: bancoId }
    });

    if (!banco) {
      return res.status(404).json({ error: 'Banco no encontrado' });
    }

    // Obtener tipos ya asociados
    const tiposAsociados = await prisma.banco_tipo_tarjeta.findMany({
      where: { bancoId, activo: true },
      select: { tipoTarjetaId: true }
    });

    const tiposAsociadosIds = tiposAsociados.map(a => a.tipoTarjetaId);

    // Obtener tipos disponibles (no asociados) - FILTRAR POR TENANT
    const tiposDisponibles = await prisma.tipos_tarjeta.findMany({
      where: req.filterByTenant({
        activo: true,
        id: { notIn: tiposAsociadosIds }
      }),
      include: {
        tarjetas: { /* ... */ }
      }
    });

    res.json({ tiposDisponibles });
  }
});
```

**Actualización de todas las rutas POST/DELETE**
```javascript
// Todas las rutas ahora usan authWithTenant en lugar de authMiddleware
router.post('/', [authWithTenant, /* validators */], async (req, res) => { /* ... */ });
router.post('/banco/:bancoId/tipos', [authWithTenant, /* validators */], async (req, res) => { /* ... */ });
router.delete('/:id', authWithTenant, async (req, res) => { /* ... */ });
```

### Lógica de Filtrado

| Entidad | Filtro por Tenant | Motivo |
|---------|------------------|--------|
| **Bancos** | ❌ NO | Son maestros únicos compartidos entre todos los tenants |
| **Tarjetas** | ✅ SÍ | Cada tenant tiene sus propias tarjetas |
| **Tipos de Tarjeta** | ✅ SÍ | Cada tenant configura sus tipos |
| **Banco-Tipo-Tarjeta** | ✅ SÍ (indirecto) | Se filtra a través de tipos_tarjeta |

### Resultado
- ✅ Los tipos de tarjeta por banco se filtran correctamente por tenant
- ✅ El formulario de asociación solo muestra tipos del tenant actual
- ✅ Los bancos siguen siendo compartidos (maestro único)

---

## 🎨 4. Mejoras de Layout - Página Bancos

### Problema
- La grilla de "Tipos de Tarjeta Asociados" no tenía margen derecho
- Las grillas eran demasiado altas, causando scroll en la página

### Solución
Se ajustó el layout para márgenes simétricos y altura fija en las grillas.

### Archivos Modificados

#### `packages/web/src/app/(protected)/tarjetas/page.tsx`

**Línea 71**
```tsx
// Antes:
<div className="flex-1 overflow-hidden">

// Después:
<div className="flex-1 overflow-auto">
```

#### `packages/web/src/components/tarjetas/BancosTab.tsx`

**Contenedor Principal (línea ~250)**
```tsx
return (
  <div className="h-full overflow-hidden">
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Search */}
      {/* Grid con Bancos y Tipos */}
      {/* Modales */}
    </div>
  </div>
);
```

**Grilla de Bancos (línea ~281)**
```tsx
<div className="bg-white rounded-lg border border-border overflow-hidden flex flex-col h-[500px]">
  {isLoadingBancos ? (
    // Loading state
  ) : filteredBancos.length === 0 ? (
    // Empty state
  ) : (
    <>
      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-border sticky top-0 z-10">
            {/* Headers */}
          </thead>
          <tbody className="bg-white divide-y divide-border">
            {/* Rows */}
          </tbody>
        </table>
      </div>

      {/* Footer con total */}
      {filteredBancos.length > 0 && (
        <div className="bg-gray-50 border-t border-border px-6 py-3">
          <div className="text-sm text-text-secondary text-center">
            Total: {filteredBancos.length} {filteredBancos.length === 1 ? 'banco' : 'bancos'}
          </div>
        </div>
      )}
    </>
  )}
</div>
```

**Grilla de Tipos Asociados (línea ~396)**
```tsx
<div className="bg-white rounded-lg border border-border overflow-hidden flex flex-col h-[500px]">
  {!selectedBanco ? (
    // Empty state - No banco seleccionado
  ) : isLoadingAsociaciones ? (
    // Loading state
  ) : filteredAsociaciones.length === 0 ? (
    // Empty state - Sin asociaciones
  ) : (
    <>
      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-border sticky top-0 z-10">
            {/* Headers */}
          </thead>
          <tbody className="bg-white divide-y divide-border">
            {/* Rows */}
          </tbody>
        </table>
      </div>

      {/* Footer con total */}
      {filteredAsociaciones.length > 0 && (
        <div className="bg-gray-50 border-t border-border px-6 py-3">
          <div className="text-sm text-text-secondary text-center">
            Total: {filteredAsociaciones.length} {filteredAsociaciones.length === 1 ? 'tipo asociado' : 'tipos asociados'}
          </div>
        </div>
      )}
    </>
  )}
</div>
```

### Características del Layout

| Característica | Implementación |
|---------------|----------------|
| **Contenedor Principal** | `max-w-[1600px] mx-auto p-6` |
| **Margen Izquierdo** | 24px (padding) |
| **Margen Derecho** | 24px (padding) |
| **Altura de Grillas** | `h-[500px]` (fijo) |
| **Scroll de Página** | `overflow-hidden` (deshabilitado) |
| **Scroll Interno** | `overflow-y-auto flex-1` (habilitado) |
| **Headers Sticky** | `sticky top-0 z-10` |
| **Footer con Total** | Siempre visible al final |

### Resultado
- ✅ Márgenes simétricos (24px en ambos lados)
- ✅ Sin scroll en la página completa
- ✅ Scroll interno en cada grilla cuando hay muchos elementos
- ✅ Headers sticky permanecen visibles al hacer scroll
- ✅ Layout profesional y consistente

---

## 🎥 5. Videos en el Sitio Web Estático

### Problema
El sitio web tenía placeholders para videos demo pero no estaban embebidos.

### Solución
Se embebieron los videos usando la etiqueta HTML5 `<video>`.

### Archivos Modificados

#### `website/index.html`

**Demo Web App**
```html
<!-- Antes: -->
<div class="bg-white rounded-lg h-48 flex items-center justify-center border">
  <div class="text-center">
    <i class="fas fa-play-circle text-gray-400 text-4xl mb-2 icon-relief"></i>
    <p class="text-secondary text-sm">Demo de la aplicación web</p>
  </div>
</div>

<!-- Después: -->
<div class="bg-black rounded-lg overflow-hidden shadow-lg">
  <video controls class="w-full" preload="metadata">
    <source src="Axioma demo web.mp4" type="video/mp4">
    Tu navegador no soporta el elemento de video.
  </video>
</div>
```

**Demo Mobile App**
```html
<!-- Antes: -->
<div class="bg-white rounded-lg h-48 flex items-center justify-center border">
  <div class="text-center">
    <i class="fas fa-play-circle text-gray-400 text-4xl mb-2 icon-relief"></i>
    <p class="text-secondary text-sm">Demo de la aplicación móvil</p>
  </div>
</div>

<!-- Después: -->
<div class="bg-black rounded-lg overflow-hidden shadow-lg">
  <video controls class="w-full" preload="metadata">
    <source src="Mobile Demo.mp4" type="video/mp4">
    Tu navegador no soporta el elemento de video.
  </video>
</div>
```

### Características del Video Player

| Atributo | Valor | Descripción |
|----------|-------|-------------|
| `controls` | - | Muestra controles nativos del navegador |
| `class="w-full"` | - | Ancho 100% del contenedor |
| `preload="metadata"` | - | Carga solo metadatos (más rápido) |
| `type="video/mp4"` | - | Formato del video |

### Ventajas de la Solución

- ✅ **Simple**: No requiere librerías externas
- ✅ **Rápido**: Los videos se cargan directamente desde el servidor
- ✅ **Compatible**: Funciona en todos los navegadores modernos
- ✅ **Responsive**: Se adapta a móviles y tablets
- ✅ **Controles nativos**: Los usuarios ya conocen los controles

### Cómo servir el sitio web

```bash
# Opción 1: Python
python -m http.server 8080

# Opción 2: Node.js
npx http-server website -p 8080
```

Luego acceder a `http://localhost:8080`

---

## 📧 6. Configuración de FRONTEND_URL para Emails

### Problema
La dirección de retorno en los emails de verificación usaba la IP del servidor en lugar del dominio, causando errores de cookies y CORS.

### Solución
Se documentó la configuración correcta de `FRONTEND_URL` y su importancia.

### Archivos Creados/Modificados

#### `FRONTEND_URL_CONFIG.md` (NUEVO)

Guía completa sobre:
- ¿Qué es FRONTEND_URL?
- Regla de oro: Debe coincidir con la URL que usan los usuarios
- Diagnóstico paso a paso
- Configuración para diferentes escenarios
- Troubleshooting completo
- Mejores prácticas

#### `backend/.env.example`

**Agregado (línea ~19)**
```env
# CORS - URL del Frontend (IMPORTANTE: Debe coincidir con la URL que usan los usuarios)
# ⚠️ CRÍTICO: Los emails de verificación usan esta URL. Si los usuarios acceden por dominio,
#    configura el dominio aquí. Si acceden por IP, usa la IP. ¡Deben coincidir!
# Desarrollo:
FRONTEND_URL="http://localhost:3000"
# Producción con dominio (RECOMENDADO):
# FRONTEND_URL="https://app.tu-empresa.com"
# Producción con IP (solo si no tienes dominio):
# FRONTEND_URL="http://192.168.1.100:8084"
```

#### `DEPLOYMENT.md`

**Agregado al final (línea ~237)**
```markdown
## ⚠️ CRÍTICO: Configuración de FRONTEND_URL

### El Problema
Los emails de verificación de usuario y notificaciones contienen enlaces que usan `FRONTEND_URL`.
Si esta variable tiene una IP pero los usuarios acceden por dominio (o viceversa), habrá errores de:
- Cookies bloqueadas (SameSite policy)
- CORS errors
- Links rotos en emails

### La Solución
**FRONTEND_URL DEBE COINCIDIR CON LA URL QUE USAN LOS USUARIOS PARA ACCEDER**

#### Opción A: Tienes un dominio configurado
```env
# backend/.env
FRONTEND_URL="https://rendiciones.tu-empresa.com"
```

#### Opción B: Solo acceso por IP (actual)
```env
# backend/.env
FRONTEND_URL="http://149.50.148.198:8084"
```

### Verificar Configuración
1. ¿Cómo acceden los usuarios? → Usa esa misma URL en `FRONTEND_URL`
2. Reinicia el backend después de cambiar: `pm2 restart rendiciones-backend`
3. Prueba registrando un usuario nuevo y verificando el link del email
```

### Uso en el Código

**`backend/src/services/emailService.js` (línea ~148)**
```javascript
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const verificationUrl = `${frontendUrl}/auth/verify-email?token=${verificationToken}`;
```

### Configuraciones Comunes

| Escenario | FRONTEND_URL |
|-----------|--------------|
| **Desarrollo** | `http://localhost:3000` |
| **Producción con dominio** | `https://rendiciones.empresa.com` |
| **Producción con IP** | `http://149.50.148.198:8084` |
| **Con Nginx Proxy** | `https://empresa.com/rendiciones` |

### Resultado
- ✅ Documentación completa del problema y su solución
- ✅ Ejemplos para diferentes escenarios
- ✅ Guía de troubleshooting
- ✅ Mejores prácticas documentadas

---

## 📝 Archivos Modificados - Resumen

### Backend

| Archivo | Líneas | Cambios |
|---------|--------|---------|
| `backend/src/lib/documentProcessor.js` | ~294, 404, 1688 | Integración de PromptManager con funciones de extracción IA |
| `backend/src/routes/dkt.js` | ~860 | Paso de `tenantId` a función de extracción |
| `backend/src/routes/users.js` | 30-57 | Include de tenant en consulta de usuarios |
| `backend/src/routes/bancoTipoTarjeta.js` | Todo el archivo | Cambio a `authWithTenant` y filtrado por tenant |

### Frontend

| Archivo | Líneas | Cambios |
|---------|--------|---------|
| `packages/web/src/app/(protected)/tarjetas/page.tsx` | 71 | Cambio de `overflow-hidden` a `overflow-auto` |
| `packages/web/src/components/tarjetas/BancosTab.tsx` | 250-610 | Layout con márgenes simétricos y altura fija |

### Documentación

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `FRONTEND_URL_CONFIG.md` | ✨ NUEVO | Guía completa de configuración de FRONTEND_URL |
| `backend/.env.example` | 📝 ACTUALIZADO | Advertencias sobre FRONTEND_URL |
| `DEPLOYMENT.md` | 📝 ACTUALIZADO | Sección crítica sobre FRONTEND_URL |

### Website

| Archivo | Líneas | Cambios |
|---------|--------|---------|
| `website/index.html` | ~65-80 | Embebido de videos demo |

---

## 🧪 Testing Recomendado

### 1. Estadísticas de Prompts IA
```bash
# Test
1. Ir a la página de importación de DKT
2. Subir un PDF de factura o resumen de tarjeta
3. Verificar que se extraen los datos con IA
4. Ir a /prompts-ia
5. Verificar que "Veces Usado" se incrementó
6. Verificar que "Tasa de Éxito" se actualizó
```

### 2. Filtrado por Tenant
```bash
# Test
1. Login como usuario del Tenant A
2. Ir a Tarjetas > Bancos
3. Seleccionar un banco
4. Click en "Asociar Tipos"
5. Verificar que solo se muestran tipos del Tenant A
6. Login como usuario del Tenant B
7. Repetir pasos 2-5
8. Verificar que solo se muestran tipos del Tenant B
```

### 3. Layout de Bancos
```bash
# Test
1. Ir a Tarjetas > Bancos
2. Verificar que hay margen izquierdo y derecho simétricos
3. Verificar que las grillas tienen ~500px de alto
4. Verificar que NO hay scroll vertical en la página
5. Agregar muchos bancos (>20)
6. Verificar que la grilla de bancos hace scroll interno
7. Seleccionar un banco con muchos tipos asociados
8. Verificar que la grilla de tipos hace scroll interno
```

### 4. Videos en Website
```bash
# Test
1. Abrir website/index.html en un navegador
2. Verificar que se ven los reproductores de video
3. Hacer click en play en "Demo WebApp"
4. Verificar que el video reproduce
5. Hacer click en play en "Demo Mobile App"
6. Verificar que el video reproduce
```

### 5. FRONTEND_URL y Emails
```bash
# Test
1. Configurar FRONTEND_URL en .env del backend
2. Reiniciar backend: pm2 restart rendiciones-backend
3. Registrar un usuario de prueba con email real
4. Revisar el email recibido
5. Verificar que la URL en el email coincide con FRONTEND_URL
6. Hacer click en el link del email
7. Verificar que la página carga correctamente
8. Verificar que NO hay errores de cookies en la consola
```

---

## 🚀 Comandos de Deploy

### Backend
```bash
# Conectar al servidor
ssh root@149.50.148.198

# Navegar al proyecto
cd /var/www/Rendiciones

# Pull cambios
git pull origin master

# Instalar dependencias si hay cambios
cd backend && npm install

# Generar Prisma Client
npm run db:generate

# Reiniciar backend
pm2 restart rendiciones-backend

# Ver logs
pm2 logs rendiciones-backend
```

### Frontend
```bash
# En el servidor
cd /var/www/Rendiciones/packages/web

# Build
npm run build

# Reiniciar frontend
pm2 restart rendiciones-frontend

# Ver logs
pm2 logs rendiciones-frontend
```

### Verificar
```bash
# Ver estado de procesos
pm2 status

# Ver logs en tiempo real
pm2 logs

# Verificar puertos
netstat -tlnp | grep -E '3000|5050|8084'
```

---

## 📚 Documentación Relacionada

| Documento | Descripción |
|-----------|-------------|
| `FRONTEND_URL_CONFIG.md` | Guía completa de configuración de FRONTEND_URL |
| `DEPLOYMENT.md` | Guía de despliegue en producción |
| `DEPLOYMENT_ENV_VARS.md` | Variables de entorno para producción |
| `MANUAL_USUARIO.md` | Manual de usuario del sistema |
| `CLAUDE.md` | Instrucciones para Claude Code |

---

## 🎯 Próximos Pasos Sugeridos

### Corto Plazo
- [ ] Configurar dominio real en lugar de usar IP
- [ ] Habilitar HTTPS con Let's Encrypt
- [ ] Configurar backup automático de base de datos
- [ ] Implementar monitoreo de errores (Sentry)

### Mediano Plazo
- [ ] Implementar Document AI de Google para mejorar extracción
- [ ] Agregar logs de auditoría más detallados
- [ ] Implementar sistema de notificaciones push
- [ ] Optimizar performance de consultas grandes

### Largo Plazo
- [ ] Integración con AFIP para validación automática
- [ ] Machine Learning para categorización de gastos
- [ ] Aplicación móvil nativa
- [ ] API pública para integraciones

---

## 👥 Contacto y Soporte

**Equipo de Desarrollo**: Axioma - Rendiciones
**Última Actualización**: 12 de Enero 2025
**Versión del Sistema**: 1.5.0

---

## 📌 Notas Adicionales

### Consideraciones de Multi-tenancy

El sistema ahora tiene una separación clara:

| Recurso | Compartido | Por Tenant | Notas |
|---------|-----------|------------|-------|
| Bancos | ✅ | ❌ | Maestro único |
| Tarjetas | ❌ | ✅ | Por tenant |
| Tipos de Tarjeta | ❌ | ✅ | Por tenant |
| Banco-Tipo-Tarjeta | ❌ | ✅ | Por tenant (filtrado indirecto) |
| Usuarios | ❌ | ✅ | Por tenant |
| Documentos | ❌ | ✅ | Por tenant |
| Prompts IA | Ambos | Ambos | Pueden ser globales o por tenant |

### Compatibilidad con Versiones Anteriores

Todos los cambios son **retro-compatibles**:
- ✅ Funciones existentes siguen funcionando
- ✅ Parámetros opcionales (tenantId tiene default null)
- ✅ No se eliminaron endpoints
- ✅ No se cambiaron estructuras de datos del frontend

### Performance

Los cambios implementados **NO afectan negativamente** el performance:
- Filtrado por tenant usa índices existentes
- PromptManager tiene cache implementado
- Las consultas siguen siendo eficientes
- No se agregaron joins innecesarios

---

**Fin del Documento**
