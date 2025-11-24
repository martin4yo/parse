# Guía de Usuario - API Connectors

## Introducción

Los **API Connectors** permiten sincronizar datos automáticamente entre Parse y otros sistemas externos mediante APIs REST. Esta funcionalidad elimina la entrada manual de datos y mantiene la información actualizada en tiempo real.

---

## Casos de Uso

### 1. Importar Documentos desde ERP (PULL)
- **Problema**: Facturas ya cargadas en el ERP necesitan procesarse en Parse
- **Solución**: Conector PULL que importa documentos desde el API del ERP

### 2. Exportar Documentos a Sistema Contable (PUSH)
- **Problema**: Documentos procesados en Parse deben enviarse a contabilidad
- **Solución**: Conector PUSH que exporta a otro sistema cuando están validados

### 3. Sincronización Bidireccional (BIDIRECTIONAL)
- **Problema**: Mantener maestros (proveedores, productos, cuentas) sincronizados
- **Solución**: Conector que lee y escribe en ambas direcciones

---

## Acceso al Módulo

1. En el menú lateral, hacer clic en **"API Connectors"**
2. Verás la lista de conectores configurados (vacía si es la primera vez)

---

## Crear un Nuevo Conector (Wizard)

### Paso 1: Información Básica

**Campos:**
- **Nombre** (obligatorio): Un nombre descriptivo del conector
  - Ejemplo: "ERP Principal", "Sistema de Compras Tango"

- **Descripción** (opcional): Explica qué sincroniza este conector
  - Ejemplo: "Importa facturas procesadas en Tango para validación"

- **Dirección** (obligatorio):
  - **PULL**: Solo importar datos hacia Parse
  - **PUSH**: Solo exportar datos desde Parse
  - **BIDIRECTIONAL**: Ambas direcciones

- **URL Base de la API** (obligatorio): La raíz del API externo
  - Ejemplo: `https://api.miempresa.com/v1`

**Botón "Siguiente"** → Ir al Paso 2

---

### Paso 2: Autenticación

Selecciona el tipo de autenticación que usa el API externo:

#### A. API Key (más común)
- **Ubicación**: Header o Query Parameter
- **Nombre**: `X-API-Key`, `Authorization`, etc.
- **Valor**: La API Key provista por el sistema externo

#### B. Bearer Token
- Simplemente pega el token JWT en el campo

#### C. OAuth 2.0 Client Credentials
- **Token URL**: Donde se obtiene el token
- **Client ID**: Identificador de tu aplicación
- **Client Secret**: Secreto de autenticación
- **Scope** (opcional): Permisos solicitados

#### D. Basic Auth
- **Usuario**: Nombre de usuario
- **Contraseña**: Contraseña del API

#### E. Headers Personalizados
- Para APIs con autenticación no estándar

#### F. Sin Autenticación
- Para APIs públicas sin seguridad

**Botón "Probar Conexión"**: Valida que la autenticación funciona correctamente

**Botón "Siguiente"** → Ir al Paso 3

---

### Paso 3: Recursos a Sincronizar (solo PULL o BIDIRECTIONAL)

Configura QUÉ datos importar y DE DÓNDE vienen:

#### Agregar un Recurso

1. Clic en **"Agregar Recurso"**
2. Completar el formulario:

**Campos del Recurso:**
- **Nombre**: Identificador del recurso
  - Ejemplo: "Facturas Procesadas"

- **Tipo de Recurso**:
  - **Documentos**: Facturas, tickets, recibos
  - **Proveedores**: Maestro de proveedores
  - **Productos**: Maestro de productos
  - **Cuentas Contables**: Plan de cuentas
  - **Centros de Costo**: Dimensiones contables

- **Método HTTP**: GET o POST

- **Endpoint**: Ruta del recurso en el API
  - Ejemplo: `/facturas/procesadas`
  - La URL completa sería: `{baseUrl}{endpoint}`

- **Data Path** (opcional): Si los datos están anidados en la respuesta JSON
  - Ejemplo: `data.items` si la respuesta es `{ "data": { "items": [...] } }`

#### Configurar Paginación (opcional)

Si el endpoint devuelve muchos registros, habilita paginación:

- **Tipo de Paginación**:
  - **Page Number**: `?page=1&pageSize=100`
  - **Offset/Limit**: `?offset=0&limit=100`
  - **Cursor Based**: `?cursor=xyz123`

- **Tamaño de Página**: Cuántos registros traer por request
  - Recomendado: 100

3. **Guardar Recurso**

**Puedes agregar múltiples recursos** si el API expone varios endpoints.

**Botón "Siguiente"** → Ir al Paso 4

---

### Paso 4: Mapeo de Campos y Validación

#### Field Mapping (opcional)

Si los campos del API externo tienen nombres diferentes a Parse:

**Ejemplo:**
- API devuelve: `invoice_number` → Parse espera: `numeroComprobante`
- API devuelve: `supplier_tax_id` → Parse espera: `cuitProveedor`

Agregar mapeos:
1. **Campo Origen**: `invoice_number`
2. **Campo Destino**: `numeroComprobante`

Si no agregas mapeos, Parse intentará usar los datos tal como vienen.

#### Requiere Validación Manual

- **☑ Activado**: Los datos se guardan en "staging" para revisión manual
  - Caso de uso: Documentos críticos que deben validarse antes de importar

- **☐ Desactivado**: Los datos se importan directamente sin intervención
  - Caso de uso: Maestros de datos confiables (proveedores, productos)

**Botón "Crear Conector"** → Finalizar

---

## Ejecutar Sincronizaciones

### Sincronización Manual (PULL)

1. En la lista de conectores, localiza el que deseas ejecutar
2. Clic en el botón **"PULL"** (icono ▶)
3. Confirmar la ejecución
4. Esperar el resultado:
   - **Éxito**: Verás cuántos registros se importaron
   - **Parcial**: Algunos fallaron (revisar logs)
   - **Fallo**: Error en la sincronización (revisar detalles)

### Sincronización Programada (futuro)

En próximas versiones podrás configurar:
- **PULL Schedule**: Importar automáticamente cada X horas/días
- **PUSH Schedule**: Exportar al cumplir ciertas condiciones

---

## Gestión de Staging (Validación Manual)

Si configuraste **"Requiere Validación"**, los datos NO se importan automáticamente.

### Acceso al Staging

1. En la lista de conectores, clic en el icono **👁️ (ojo)**
2. Verás la lista de registros pendientes de validación

### Revisar Registros

Cada registro muestra:
- **Estado de Validación**:
  - ✅ **VALID**: Pasó todas las validaciones
  - ❌ **INVALID**: Tiene errores (ver detalle)
  - ⏳ **PENDING**: Esperando validación

- **Preview**: Primeros 150 caracteres de los datos

- **Expandir** (clic en ▶): Ver datos completos
  - **Datos Originales (Raw)**: JSON como vino del API
  - **Datos Transformados**: JSON después de aplicar mapeos

### Aprobar Importación

1. **Seleccionar registros válidos**: Checkbox a la izquierda
2. Clic en **"Aprobar e Importar (N)"**
3. Confirmar
4. Los datos se importan a Parse

### Rechazar Registros

- Clic en el icono **🗑️ (basura)** de un registro
- Confirmar
- El registro se elimina del staging (NO se importa)

---

## Ver Logs de Sincronizaciones

### Logs de PULL

1. Ir a la página principal de API Connectors
2. (Futuro: Botón "Ver Logs" en cada conector)
3. Ver historial de ejecuciones:
   - Fecha/hora
   - Estado (Éxito/Fallo/Parcial)
   - Registros encontrados
   - Registros importados
   - Registros fallidos
   - Duración
   - Errores (si los hay)

---

## Buenas Prácticas

### 1. Testing
- Siempre usa **"Probar Conexión"** antes de guardar el conector
- Comienza con **validación manual habilitada** hasta asegurarte que funciona bien
- Haz un PULL manual primero antes de programar sincronizaciones automáticas

### 2. Seguridad
- **NUNCA compartas API Keys** en documentación o tickets
- Rota las claves periódicamente (cada 3-6 meses)
- Usa API Keys con permisos mínimos (solo read para PULL, solo write para PUSH)

### 3. Performance
- Si el API tiene **muchos datos**, habilita paginación
- Configura **tamaños de página razonables** (100-500 registros)
- No ejecutes PULLs masivos en horas pico

### 4. Field Mapping
- Solo mapea campos si es **estrictamente necesario**
- Si el API ya devuelve los campos correctos, déjalos sin mapear
- Documenta mapeos complejos en la descripción del conector

### 5. Validación
- Usa validación manual para:
  - Documentos contables críticos
  - Primera importación masiva
  - APIs nuevos o inestables

- Desactiva validación para:
  - Maestros de datos confiables
  - Sincronizaciones frecuentes (cada hora)
  - APIs probados y estables

---

## Tipos de Recursos Soportados

### 1. Documentos (DOCUMENTO)

**Importa:** Facturas, tickets, recibos, notas de crédito/débito

**Campos esperados en el API:**
```json
{
  "externalSystemId": "DOC-12345",
  "tipoDocumento": "FACTURA_A",
  "numeroComprobante": "0001-00012345",
  "fechaEmision": "2025-01-20",
  "cuitProveedor": "30-12345678-9",
  "razonSocialProveedor": "Proveedor SA",
  "importeTotal": 12100.50,
  "archivoUrl": "https://api.ejemplo.com/files/factura.pdf",
  "lineas": [
    {
      "numero": 1,
      "descripcion": "Producto X",
      "cantidad": 10,
      "precioUnitario": 100,
      "subtotal": 1000,
      "totalLinea": 1210
    }
  ],
  "impuestos": [
    {
      "tipoImpuesto": "IVA",
      "baseImponible": 1000,
      "alicuota": 21,
      "importe": 210
    }
  ]
}
```

**¿Qué hace Parse?**
- Crea registro en `documentos_procesados`
- Crea líneas en `documento_lineas`
- Crea impuestos en `documento_impuestos`
- Guarda `externalSystemId` para evitar duplicados
- Si hay `archivoUrl`, podría descargarlo (futuro)

---

### 2. Proveedores (PROVEEDOR)

**Importa:** Maestro de proveedores

**Campos esperados:**
```json
{
  "codigo": "PROV001",
  "nombre": "Proveedor SA",
  "cuit": "30-12345678-9",
  "descripcion": "Proveedor de insumos"
}
```

**¿Qué hace Parse?**
- Crea registro en `parametros_maestros` con `tipoCampo: 'proveedor'`
- Evita duplicados por `codigo`

---

### 3. Productos (PRODUCTO)

**Importa:** Maestro de productos/servicios

**Campos esperados:**
```json
{
  "codigo": "PROD123",
  "nombre": "Notebook Dell Latitude",
  "descripcion": "15.6 pulgadas, 8GB RAM, SSD 256GB"
}
```

**¿Qué hace Parse?**
- Crea registro en `parametros_maestros` con `tipoCampo: 'producto'`
- Evita duplicados por `codigo`

---

### 4. Cuentas Contables (CUENTA_CONTABLE)

**Importa:** Plan de cuentas

**Campos esperados:**
```json
{
  "codigo": "1105020101",
  "nombre": "IVA Crédito Fiscal",
  "descripcion": "Impuesto al Valor Agregado - Crédito"
}
```

**¿Qué hace Parse?**
- Crea registro en `parametros_maestros` con `tipoCampo: 'cuenta_contable'`
- Evita duplicados por `codigo`

---

### 5. Centros de Costo (CENTRO_COSTO)

**Importa:** Dimensiones contables

**Campos esperados:**
```json
{
  "codigo": "CC001",
  "nombre": "Administración",
  "descripcion": "Gastos administrativos generales"
}
```

**¿Qué hace Parse?**
- Crea registro en `parametros_maestros` con `tipoCampo: 'centro_costo'`
- Evita duplicados por `codigo`

---

## Solución de Problemas

### Error: "No se pudieron extraer datos suficientes"

**Causa**: El API devolvió datos incompletos o en formato incorrecto

**Solución**:
1. Verifica que el endpoint devuelva todos los campos requeridos
2. Revisa el **Data Path** si los datos están anidados
3. Agrega **Field Mapping** si los nombres de campos son diferentes

---

### Error: "Request failed with status code 401"

**Causa**: Autenticación incorrecta

**Solución**:
1. Verifica que la API Key/Token sea correcta
2. Usa **"Probar Conexión"** para validar
3. Verifica que la API Key no haya expirado
4. Contacta al proveedor del API para regenerar credenciales

---

### Error: "Request failed with status code 429"

**Causa**: Excediste el límite de requests del API (rate limiting)

**Solución**:
1. Espera unos minutos y reintenta
2. Reduce la frecuencia de sincronizaciones
3. Contacta al proveedor del API para aumentar el límite
4. Habilita paginación para hacer requests más pequeños

---

### Los datos se importan pero están incompletos

**Causa**: Field Mapping incorrecto o Data Path mal configurado

**Solución**:
1. Habilita **validación manual**
2. Ejecuta PULL y revisa el staging
3. Expande un registro y compara **Raw Data** vs **Transformed Data**
4. Ajusta el **Data Path** o **Field Mapping** según corresponda
5. Guarda cambios y reintenta

---

### Duplicados al ejecutar PULL múltiples veces

**Comportamiento esperado**: Parse detecta duplicados automáticamente

**Para Documentos**: Usa `externalSystemId` único
**Para Maestros**: Usa `codigo` único

Si ves duplicados:
1. Verifica que el API devuelva `externalSystemId` o `codigo`
2. Si no lo devuelve, agrega Field Mapping para crearlo desde otro campo

---

## Próximas Funcionalidades (Roadmap)

### Sprint 3 - PUSH (Exportación)
- Exportar documentos validados a sistemas contables
- Marcar documentos como "exportados"
- Logs de exportación

### Sprint 4 - API Pública
- Permitir que sistemas externos hagan PULL desde Parse
- Autenticación OAuth 2.0 para clientes externos
- Rate limiting por plan

### Sprint 5 - Orquestación
- Sincronizaciones programadas (cron jobs)
- Webhooks para notificaciones
- Retry automático en fallos
- Dashboard de estadísticas

---

## Soporte

**Documentación Técnica**: Ver `docs/CONECTOR-API-BIDIRECCIONAL.md`

**Problemas o Sugerencias**: Contactar al equipo de desarrollo

---

**Última actualización**: Enero 2025
