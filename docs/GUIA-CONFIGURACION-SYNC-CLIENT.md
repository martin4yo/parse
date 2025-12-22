# Guía de Configuración de Sync Clients

Esta guía explica paso a paso cómo configurar un cliente que suba documentos automáticamente desde una carpeta local a Parse.

---

## Resumen del Flujo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARQUITECTURA                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ADMIN (Panel Web)                    CLIENTE (PC/Servidor del cliente)    │
│   ─────────────────                    ─────────────────────────────────    │
│                                                                              │
│   1. Crear API Key         ───────►   2. Configurar sync-client-folder      │
│      /sync-admin/api-keys              con la API Key                       │
│                                                                              │
│   4. Ver cliente           ◄───────   3. Cliente se registra automático    │
│      /sync-clients                     POST /api/v1/sync-clients/register   │
│                                                                              │
│   6. Ver documentos        ◄───────   5. Cliente sube documentos           │
│      /parse                            POST /api/v1/parse/document          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Paso 1: Crear API Key en el Panel de Administración

### 1.1 Acceder a Sync API Keys

1. Iniciar sesión en Parse como administrador
2. Ir a **Integraciones → Sync API Keys** (`/sync-admin/api-keys`)

### 1.2 Crear Nueva API Key

1. Click en **"Nueva API Key"**
2. Completar los campos:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Nombre** | Identificador descriptivo | "API-Sucursal-Norte" |
| **Descripción** | Detalles del uso | "Para PC de recepción que escanea facturas" |
| **Expira en** | Fecha de expiración (opcional) | Dejar vacío para no expirar |

3. Seleccionar **permisos** según necesidad:

| Permiso | Descripción | Requerido para Sync Client |
|---------|-------------|---------------------------|
| **sync** | Permite sincronización SQL | Opcional |
| **logs** | Permite ver logs | Opcional |
| **admin** | Acceso administrativo | No |
| **parse** | Permite procesar documentos | **SÍ (Obligatorio)** |
| **applyRules** | Aplicar reglas de negocio | Recomendado |
| **saveDocs** | Guardar documentos en BD | **SÍ (Obligatorio)** |

4. Click en **"Crear"**

### 1.3 Copiar la API Key

**IMPORTANTE:** La API Key solo se muestra UNA vez al crearla.

```
sync_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

Copiarla y guardarla en un lugar seguro. Si se pierde, hay que regenerar una nueva.

---

## Paso 2: Instalar sync-client-folder en el Cliente

### Opción A: Usar Ejecutable Compilado (Recomendado para producción)

#### 2A.1 Descargar Ejecutable

Descargar el ejecutable para el sistema operativo:
- Windows: `sync-client-folder-win.exe`
- Linux: `sync-client-folder-linux`
- macOS: `sync-client-folder-macos`

#### 2A.2 Configurar Clave Maestra

```powershell
# Windows (PowerShell como Administrador)
[Environment]::SetEnvironmentVariable("SYNC_CLIENT_MASTER_KEY", "mi-clave-secreta-larga-2024", "Machine")

# Linux/Mac
export SYNC_CLIENT_MASTER_KEY="mi-clave-secreta-larga-2024"
echo 'export SYNC_CLIENT_MASTER_KEY="mi-clave-secreta-larga-2024"' >> ~/.bashrc
```

#### 2A.3 Configurar con GUI Web

```bash
# Abre el navegador con panel de configuración
./sync-client-folder config
```

Esto abre `http://localhost:9876` con un wizard visual para configurar:
- API Key
- Carpetas de entrada/salida
- Email (opcional)
- SQL Server (opcional)

#### 2A.4 Configurar Manualmente (alternativa)

Crear archivo `config/config.json`:

```json
{
  "client": {
    "name": "PC-Recepcion-Norte"
  },
  "api": {
    "url": "https://api.parsedemo.axiomacloud.com",
    "key": "sync_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  },
  "folder": {
    "enabled": true,
    "watchPath": "C:/Facturas/Entrada",
    "processedPath": "C:/Facturas/Procesados",
    "errorPath": "C:/Facturas/Errores",
    "extensions": ["pdf", "jpg", "jpeg", "png"]
  },
  "output": {
    "json": {
      "enabled": true,
      "path": "C:/Facturas/JSON"
    },
    "cloud": {
      "enabled": true
    }
  },
  "logging": {
    "level": "info",
    "sendToCloud": true
  }
}
```

---

### Opción B: Ejecutar desde Código Fuente (Desarrollo)

#### 2B.1 Requisitos

- Node.js 18+ instalado
- Acceso a Internet

#### 2B.2 Instalación

```bash
# Ir al directorio del proyecto
cd D:\Desarrollos\React\sync-client-folder

# Instalar dependencias
npm install
```

#### 2B.3 Configurar Variables de Entorno

Crear archivo `.env`:

```env
# Clave para encriptar credenciales (obligatoria)
SYNC_CLIENT_MASTER_KEY=mi-clave-secreta-larga-2024

# Alternativa: API Key directa (menos seguro)
# SYNC_CLIENT_API_KEY=sync_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# Nivel de log
SYNC_CLIENT_LOG_LEVEL=info

# Puerto GUI (opcional)
SYNC_CLIENT_GUI_PORT=9876
```

#### 2B.4 Crear config.json

```bash
# Copiar configuración de ejemplo
cp config/defaults.json config/config.json
```

Editar `config/config.json` con los valores del Paso 2A.4.

---

### 2.5 Crear Carpetas Necesarias

```bash
# Windows
mkdir C:\Facturas\Entrada
mkdir C:\Facturas\Procesados
mkdir C:\Facturas\Errores
mkdir C:\Facturas\JSON
```

---

## Paso 3: Iniciar el Cliente

### 3.1 Primera Ejecución

```bash
# Opción A: Ejecutable compilado
./sync-client-folder watch

# Opción B: Desde código fuente
cd D:\Desarrollos\React\sync-client-folder
npm start
# o en modo desarrollo con hot-reload:
npm run dev
```

El cliente hará lo siguiente automáticamente:

1. **Se conecta al servidor** usando la API Key
2. **Se registra** con el nombre configurado (`CLIENT_NAME`)
3. **Aparece en el panel** `/sync-clients` como "Online"
4. **Comienza a monitorear** la carpeta configurada

### 3.2 Log de Inicio Exitoso

```
✅ Conectado a Parse API
✅ Cliente registrado: PC-Recepcion-Norte (id: abc123...)
🔍 Monitoreando carpeta: C:\Documentos\Facturas
📁 Extensiones: pdf, jpg, jpeg, png
💓 Heartbeat cada 60 segundos
```

---

## Paso 4: Verificar en el Panel de Administración

### 4.1 Ver Cliente Registrado

1. Ir a **Integraciones → Sync Clients** (`/sync-clients`)
2. El cliente aparecerá en la lista:

| Nombre | Hostname | Estado | Último Heartbeat | Docs Procesados |
|--------|----------|--------|------------------|-----------------|
| PC-Recepcion-Norte | DESKTOP-ABC | 🟢 Online | Hace 30 seg | 0 |

### 4.2 Estados Posibles

| Estado | Indicador | Significado |
|--------|-----------|-------------|
| **Online** | 🟢 Verde | Heartbeat < 5 min |
| **Offline** | 🔴 Rojo | Heartbeat > 5 min |
| **Error** | ⚠️ Amarillo | Último procesamiento falló |

---

## Paso 5: Procesar Documentos

### 5.1 Flujo de Procesamiento

1. **Depositar archivo** en la carpeta monitoreada
   ```
   C:\Documentos\Facturas\factura-001.pdf
   ```

2. **El cliente detecta** el nuevo archivo (dentro de 5 seg)

3. **Envía al servidor** para extracción de datos
   ```
   POST /api/v1/parse/document
   Headers: X-API-Key: sync_sk_...
   Body: multipart/form-data con el archivo
   ```

4. **El servidor procesa** con IA y extrae datos

5. **El documento aparece** en `/parse` con estado "Procesado"

6. **El cliente mueve** el archivo a subcarpeta `procesados/`

### 5.2 Log de Procesamiento

```
📄 Nuevo archivo detectado: factura-001.pdf
⏳ Enviando a Parse...
✅ Procesado exitosamente (ID: doc_xyz789)
📁 Movido a: C:\Documentos\Facturas\procesados\factura-001.pdf
```

---

## Paso 6: Monitoreo y Logs

### 6.1 Ver Logs del Cliente

En el panel `/sync-clients`:

1. Click en el cliente
2. Ir a pestaña **"Logs"**
3. Filtrar por nivel: `info`, `warn`, `error`

### 6.2 Estadísticas

| Métrica | Descripción |
|---------|-------------|
| **Docs Procesados** | Total de documentos enviados exitosamente |
| **Errores** | Total de fallos de procesamiento |
| **Último Documento** | Fecha/hora del último procesamiento |
| **Último Error** | Mensaje del último error |

---

## Troubleshooting

### Error: "API key inválida"

**Causa:** La API Key es incorrecta o fue regenerada.

**Solución:**
1. Verificar que la API Key en `.env` sea correcta
2. En `/sync-admin/api-keys`, verificar que la key esté activa
3. Si es necesario, regenerar la key y actualizar `.env`

### Error: "Permiso 'parse' requerido"

**Causa:** La API Key no tiene los permisos necesarios.

**Solución:**
1. Ir a `/sync-admin/api-keys`
2. Editar la API Key
3. Activar permisos: `parse`, `saveDocs`, `applyRules`

### Cliente aparece "Offline" pero está corriendo

**Causa:** Problema de red o firewall.

**Solución:**
1. Verificar conectividad a `https://api.parsedemo.axiomacloud.com`
2. Revisar firewall/proxy
3. Verificar que el puerto 443 esté abierto

### Documentos no se procesan

**Causa posible:** Extensión no soportada o archivo corrupto.

**Solución:**
1. Verificar que la extensión esté en `FILE_EXTENSIONS`
2. Probar subir manualmente en `/documentos`
3. Revisar logs del cliente para mensajes de error

---

## Diferencia con OAuth 2.0

| Característica | API Keys (Sync) | OAuth 2.0 |
|----------------|-----------------|-----------|
| **Propósito** | Subir documentos | Consultar documentos |
| **Dirección** | IN (upload) | OUT (query) |
| **Autenticación** | Header `X-API-Key` | Header `Authorization: Bearer` |
| **Expiración** | Configurable | 1h access / 7d refresh |
| **Caso de uso** | Sync-client-folder | ERPs, apps externas |
| **Endpoints** | `/api/v1/parse/*` | `/api/v1/documents/*` |

**Nota:** Los Sync Clients usan API Keys porque:
- Son procesos de larga duración (24/7)
- Necesitan subir archivos (no solo consultar)
- Operan en entornos controlados (servidores internos)

---

## Comandos Útiles

### Desde Código Fuente (npm)

```bash
# Iniciar en modo watch (primer plano)
npm start

# Iniciar en modo desarrollo con hot-reload
npm run dev

# Abrir GUI de configuración
npm run config

# Compilar ejecutable para Windows
npm run build:win

# Compilar para todas las plataformas
npm run build:all
```

### Ejecutable Compilado (CLI)

```bash
# Configuración
./sync-client-folder config          # Abrir GUI web de configuración
./sync-client-folder init            # Wizard de configuración por terminal
./sync-client-folder validate        # Validar configuración actual

# Ejecución
./sync-client-folder watch           # Ejecutar en primer plano
./sync-client-folder start           # Iniciar en background
./sync-client-folder stop            # Detener
./sync-client-folder status          # Ver estado

# Servicio del Sistema Operativo
./sync-client-folder install         # Instalar como servicio Windows
./sync-client-folder uninstall       # Desinstalar servicio

# Testing
./sync-client-folder test api        # Probar conexión a Parse API
./sync-client-folder test email      # Probar conexión email IMAP
./sync-client-folder test sql        # Probar conexión SQL Server

# Logs
./sync-client-folder logs            # Ver logs en tiempo real
./sync-client-folder logs --tail 50  # Ver últimas 50 líneas
```

### Verificar Conectividad (cURL)

```bash
# Probar API Key
curl -H "X-API-Key: tu-api-key" https://api.parsedemo.axiomacloud.com/api/v1/sync-clients/config
```

---

## Checklist de Configuración

- [ ] API Key creada con permisos `parse` y `saveDocs`
- [ ] API Key copiada y guardada
- [ ] sync-client-folder instalado en el cliente
- [ ] Archivo `.env` configurado
- [ ] Carpeta de monitoreo creada
- [ ] Cliente iniciado y aparece "Online" en `/sync-clients`
- [ ] Prueba de procesamiento exitosa
