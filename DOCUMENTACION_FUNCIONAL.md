# Documentación Funcional - Sistema de Rendiciones de Tarjetas de Crédito

## 📋 Descripción General

El **Sistema de Rendiciones** es una aplicación web completa diseñada para gestionar el procesamiento de rendiciones de tarjetas de crédito corporativas. Permite importar archivos DKT (resúmenes de tarjetas), procesar la información, generar rendiciones contables y exportar los datos al ERP de la empresa.

### 🎯 Objetivo Principal
Automatizar el proceso de gestión de gastos de tarjetas de crédito corporativas, desde la importación de resúmenes hasta la generación de comprobantes contables listos para el sistema ERP.

---

## 🏗️ Arquitectura del Sistema

### Tecnologías Utilizadas
- **Frontend**: React 18 + Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Base de Datos**: PostgreSQL
- **Autenticación**: JWT (JSON Web Tokens)
- **Interfaz**: Diseño minimalista estilo ChatGPT con sidebar responsivo

### Estructura del Proyecto
```
Sistema de Rendiciones/
├── backend/          # API REST con Node.js + Express + Prisma
├── packages/
│   ├── web/         # Aplicación web React + Next.js
│   ├── mobile/      # App móvil React Native (en desarrollo)
│   └── shared/      # Librerías compartidas
└── docs/           # Documentación del sistema
```

---

## 🔐 Gestión de Usuarios y Seguridad

### Perfiles de Usuario
1. **Administrador del Sistema**
   - Acceso completo a todas las funcionalidades
   - Gestión de usuarios, parámetros y configuraciones
   - Supervisión de procesos de importación y exportación

2. **Usuario Operativo**
   - Importación de archivos DKT
   - Procesamiento de rendiciones
   - Gestión de comprobantes

3. **Autorizante**
   - Revisión y aprobación de rendiciones
   - Validación de comprobantes
   - Autorización para exportación al ERP

4. **Usuario de Consulta**
   - Solo lectura de rendiciones y reportes
   - Sin permisos de modificación

### Autenticación y Seguridad
- Sistema de login con email/contraseña
- Tokens JWT con expiración automática
- Validación de entrada con Zod
- Rate limiting y protección CORS
- Headers de seguridad con Helmet
- Sanitización de datos

---

## 🏠 Dashboard Principal

### Panel de Control
El dashboard proporciona una vista general del estado del sistema:

- **Métricas Principales**:
  - Total de rendiciones procesadas
  - Importes pendientes de autorización
  - Archivos DKT importados este mes
  - Estado de sincronización con ERP

- **Accesos Rápidos**:
  - Importar nuevo archivo DKT
  - Ver rendiciones pendientes
  - Acceder a autorizaciones
  - Generar reportes

- **Actividad Reciente**:
  - Últimas importaciones realizadas
  - Rendiciones creadas recientemente
  - Comprobantes generados
  - Acciones de usuarios

---

## 💳 Gestión de Tarjetas y Bancos

### Administración de Tipos de Tarjeta
- **CRUD Completo**: Crear, leer, actualizar y eliminar tipos de tarjeta
- **Códigos de Tarjeta**: Definición de códigos únicos (ej: ICBCVC, SANTVC)
- **Configuración de Bancos**: Asociación de tarjetas con entidades bancarias
- **Validaciones**: Control de duplicados y formatos

### Funcionalidades
- Búsqueda y filtrado avanzado
- Validaciones de negocio automáticas
- Historial de cambios
- Estados activo/inactivo

---

## 📤 Importación de Archivos DKT

### Proceso de Importación
1. **Selección de Archivo**: Soporte para formatos .dkt, .csv, .txt
2. **Validación de Formato**: Verificación automática de estructura
3. **Procesamiento**: Análisis de 37 campos por registro
4. **Control de Duplicados**: Prevención por lote usando código_tarjeta + periodo
5. **Confirmación**: Resumen de registros importados

### Campos Procesados (37 campos)
- Información bancaria (código banco, empresa, planta)
- Datos organizacionales (área, sector, sucursal)
- Información temporal (período, fecha transacción)
- Detalles de transacción (tipo, importe, moneda, descripción)
- Datos del usuario (tarjeta, nombre, cuenta)
- Información geográfica (localidad, código geográfico)
- Clasificación contable (grupo rubro, tipo consumo)

### Validaciones
- Formato de archivo correcto
- Campos obligatorios completos
- Rangos de valores válidos
- Consistencia de datos
- Detección de registros duplicados

---

## 📊 Sistema de Rendiciones

### Flujo de Procesamiento
1. **Importación**: Datos crudos almacenados en `resumen_tarjeta`
2. **Procesamiento**: Transformación a datos contables en `rendicion_tarjeta`
3. **Validación**: Revisión automática y manual
4. **Autorización**: Aprobación por usuarios autorizantes
5. **Exportación**: Envío de datos al ERP

### Estados de Rendición
- **BORRADOR**: Rendición en proceso de creación
- **PENDIENTE**: Lista para revisión
- **ENAUT** (En Autorización): Esperando aprobación
- **AUTORIZADA**: Aprobada, lista para exportar
- **EXPORTADA**: Enviada al ERP
- **RECHAZADA**: No aprobada, requiere correcciones

### Funcionalidades
- Visualización en grilla interactiva
- Filtros por estado, fecha, importe
- Edición de campos específicos
- Notas y observaciones
- Trazabilidad de cambios

---

## 🧾 Gestión de Comprobantes

### Tipos de Comprobantes
- **Facturas**: Documentación de gastos
- **Tickets**: Comprobantes menores
- **Recibos**: Documentación de pagos
- **Notas de Crédito**: Devoluciones y ajustes

### Funcionalidades
- Upload de archivos (PDF, JPG, PNG)
- Asociación múltiple (un comprobante para varias rendiciones)
- Validación de fechas e importes
- Digitalización con OCR (futuro)
- Archivo y recuperación

---

## 🔒 Sistema de Autorizaciones

### Proceso de Autorización
1. **Revisión**: El autorizante revisa rendiciones pendientes
2. **Validación**: Verificación de comprobantes y datos
3. **Decisión**: Aprobación o rechazo con comentarios
4. **Notificación**: Comunicación automática al creador

### Niveles de Autorización
- **Primera Instancia**: Supervisor directo
- **Segunda Instancia**: Gerencia (para montos altos)
- **Autorización Técnica**: Validación de aspectos contables

### Controles
- Límites por usuario y tipo de gasto
- Validación de políticas empresariales
- Auditoría de decisiones
- Escalamiento automático

---

## 📤 Exportación al ERP

### Proceso de Exportación
1. **Selección**: Rendiciones autorizadas listas para exportar
2. **Formato**: Generación de archivos según especificación ERP
3. **Validación Final**: Verificación de integridad
4. **Transmisión**: Envío seguro al sistema ERP
5. **Confirmación**: Recepción y procesamiento confirmado

### Formatos Soportados
- **Excel**: Planillas estructuradas
- **CSV**: Archivos delimitados
- **XML**: Intercambio estructurado
- **JSON**: API REST directa

### Controles
- Validación de completitud
- Verificación de importes
- Log de exportaciones
- Recuperación ante errores

---

## ⚙️ Administración de Parámetros

### Sistema de Parametrización
El sistema utiliza una tabla maestra única para todos los parámetros:

### Tipos de Parámetros
- **Organizacionales**: Plantas, áreas, sectores, sucursales
- **Contables**: Cuentas, centros de costo, productos
- **Geográficos**: Provincias, localidades, países  
- **Clasificadores**: Rubros, tipos de gasto, monedas

### Funcionalidades
- **Combos en Cascada**: Relaciones padre-hijo automáticas
- **API Flexible**: Endpoint unificado para parámetros
- **Gestión Centralizada**: Un solo lugar para todos los parámetros
- **Relaciones Configurables**: Jerarquías dinámicas

---

## 👥 Gestión de Usuarios

### Administración de Usuarios
- **CRUD Completo**: Crear, modificar, consultar usuarios
- **Asignación de Perfiles**: Roles y permisos granulares
- **Delegaciones**: Configuración de jerarquías organizacionales
- **Autorizantes**: Definición de usuarios con permisos de aprobación

### Funcionalidades
- Búsqueda y filtrado avanzado
- Estados activo/inactivo
- Historial de accesos
- Políticas de contraseñas
- Recuperación de cuentas

---

## 📈 Sistema de Reportes

### Reportes Disponibles
- **Resumen de Rendiciones**: Por período, usuario, estado
- **Análisis de Gastos**: Por rubro, centro de costo, proyecto
- **Control de Gestión**: Indicadores y métricas
- **Auditoría**: Trazabilidad de operaciones

### Funcionalidades
- Filtros dinámicos y flexibles
- Exportación a Excel/PDF
- Programación de reportes automáticos
- Dashboard con gráficos interactivos

---

## 🔍 Auditoría y Trazabilidad

### Log de Operaciones
- **Acciones de Usuario**: Login, logout, operaciones
- **Cambios de Estado**: Transiciones de rendiciones
- **Modificaciones**: Ediciones de datos
- **Exportaciones**: Registros de envío al ERP

### Información Capturada
- Usuario responsable
- Fecha y hora exacta
- Datos modificados (antes/después)
- IP y navegador
- Resultado de la operación

---

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+
- PostgreSQL 13+
- Git

### Variables de Entorno
```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/rendiciones
JWT_SECRET=tu_clave_secreta_muy_segura
API_PORT=3001
WEB_PORT=3000
```

### Comandos de Inicio
```bash
# Instalar dependencias
npm install

# Configurar base de datos
npm run db:push
npm run db:seed

# Iniciar desarrollo
npm run dev
```

---

## 🔧 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `GET /api/auth/me` - Perfil actual

### Tarjetas
- `GET /api/tarjetas` - Lista de tarjetas
- `POST /api/tarjetas` - Crear tarjeta
- `PUT /api/tarjetas/:id` - Actualizar tarjeta

### DKT/Importación
- `POST /api/dkt/importar` - Importar archivo DKT
- `GET /api/dkt/por-tarjeta/:codigo` - Consultar por tarjeta
- `GET /api/dkt/lote/:loteId` - Detalle de lote

### Rendiciones
- `GET /api/rendiciones` - Lista de rendiciones
- `POST /api/rendiciones` - Crear rendición
- `PUT /api/rendiciones/:id` - Actualizar rendición
- `POST /api/rendiciones/:id/autorizar` - Autorizar rendición

### Parámetros
- `GET /api/parametros/campo/:campo` - Parámetros por campo
- `GET /api/parametros/hijos/:padreId` - Parámetros hijos

---

## 🛡️ Seguridad y Cumplimiento

### Medidas de Seguridad
- Autenticación robusta con JWT
- Validación estricta de entrada
- Sanitización de datos
- Rate limiting
- Logs de auditoría completos

### Cumplimiento
- Trazabilidad completa de operaciones
- Segregación de funciones
- Controles de autorización
- Backup automático de datos

---

## 📱 Accesibilidad y Usabilidad

### Diseño Responsive
- Adaptación automática a dispositivos móviles
- Sidebar colapsible
- Touch-friendly en pantallas táctiles

### Experiencia de Usuario
- Interfaz intuitiva estilo ChatGPT
- Notificaciones toast informativas
- Confirmaciones para acciones críticas
- Shortcuts de teclado

---

## 🔄 Estados del Sistema

### Estados de Datos
- **ACTIVO**: En uso normal
- **INACTIVO**: Deshabilitado temporalmente
- **HISTORICO**: Archivado, solo consulta

### Estados de Proceso
- **EN_PROCESO**: Operación en ejecución
- **COMPLETADO**: Proceso finalizado exitosamente
- **ERROR**: Falló, requiere intervención
- **CANCELADO**: Interrumpido por usuario

---

## 📞 Soporte y Mantenimiento

### Logs del Sistema
- Ubicación: `/logs/`
- Rotación automática diaria
- Niveles: ERROR, WARN, INFO, DEBUG

### Monitoreo
- Estado de servicios
- Performance de base de datos
- Uso de memoria y CPU
- Disponibilidad de la aplicación

### Backup
- Backup automático de base de datos
- Retención por 30 días
- Recuperación point-in-time

---

**Desarrollado con ❤️ para optimizar la gestión de rendiciones corporativas**