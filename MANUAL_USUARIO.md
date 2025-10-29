# Manual de Usuario - Sistema de Rendiciones de Tarjetas de Crédito

## 🚀 Guía de Inicio Rápido

### Acceso al Sistema
1. **URL de Acceso**: http://localhost:3000 (desarrollo) o la URL proporcionada por su administrador
2. **Navegadores Compatibles**: Chrome, Firefox, Safari, Edge (últimas versiones)
3. **Credenciales de Prueba**:
   - Email: `admin@rendiciones.com`
   - Contraseña: `admin123`

---

## 🔐 Inicio de Sesión

### Primer Acceso
1. Abra su navegador web
2. Navegue a la URL del sistema
3. Ingrese su email y contraseña
4. Haga clic en "Iniciar Sesión"
5. Si es su primer acceso, será redirigido al dashboard principal

### Recuperar Contraseña
1. En la pantalla de login, haga clic en "¿Olvidaste tu contraseña?"
2. Ingrese su email registrado
3. Revise su bandeja de entrada para el enlace de recuperación
4. Siga las instrucciones del email para crear una nueva contraseña

---

## 🏠 Navegación Principal

### Sidebar (Menú Lateral)
El sistema cuenta con un menú lateral colapsible con las siguientes opciones:

- **🏠 Dashboard**: Panel principal con métricas y resúmenes
- **📤 Importar Resumen**: Para subir archivos DKT de tarjetas
- **📄 Rendiciones**: Gestión de rendiciones de gastos
- **🧾 Comprobantes**: Administración de comprobantes y facturas
- **🔒 Autorizaciones**: Aprobar o rechazar rendiciones
- **📤 Exportar**: Enviar datos al sistema ERP
- **💳 Tarjetas**: Configuración de tipos de tarjetas
- **👥 Usuarios**: Gestión de usuarios del sistema
- **⚙️ Parámetros**: Configuración de parámetros maestros
- **📊 Reportes**: Generar reportes y estadísticas

### Interfaz Responsive
- **Escritorio**: Sidebar siempre visible, colapsible con botón hamburguesa
- **Móvil**: Menú hamburguesa que abre sidebar como overlay
- **Tablet**: Adaptación automática según orientación

---

## 📊 Dashboard - Panel Principal

### Vista General
El dashboard muestra información clave del sistema:

#### Métricas Principales
- **Rendiciones del Mes**: Cantidad de rendiciones creadas
- **Importes Pendientes**: Total de montos esperando autorización
- **Archivos Procesados**: Cantidad de DKT importados
- **Estado del Sistema**: Conectividad con ERP y base de datos

#### Acciones Rápidas
- Botón **"Importar DKT"**: Acceso directo a importación
- Botón **"Nueva Rendición"**: Crear rendición manual
- Botón **"Ver Pendientes"**: Filtrar rendiciones pendientes

#### Actividad Reciente
Lista de las últimas 10 acciones realizadas en el sistema con:
- Usuario responsable
- Acción realizada
- Fecha y hora
- Estado resultado

---

## 📤 Importación de Archivos DKT

### Proceso Paso a Paso

#### 1. Acceder a la Importación
- Haga clic en **"Importar Resumen"** en el sidebar
- O use el botón de acceso rápido desde el Dashboard

#### 2. Seleccionar Archivo
1. Haga clic en **"Seleccionar Archivo"** o arrastre el archivo a la zona indicada
2. **Formatos aceptados**: .dkt, .csv, .txt
3. **Tamaño máximo**: 50MB por archivo
4. El sistema validará automáticamente el formato

#### 3. Configurar Importación
1. **Código de Tarjeta**: Seleccione el tipo de tarjeta (ej: ICBCVC, SANTVC)
2. **Período**: Se detecta automáticamente o ingrese manualmente (AAMM)
3. **Descripción**: Agregue una descripción opcional del lote

#### 4. Vista Previa
- El sistema muestra una vista previa de los primeros 5 registros
- Verifique que los campos se estén interpretando correctamente
- Si hay errores, ajuste la configuración antes de continuar

#### 5. Confirmar Importación
1. Revise el resumen: cantidad de registros, período, código tarjeta
2. Haga clic en **"Importar"**
3. El proceso puede tomar varios minutos dependiendo del tamaño

#### 6. Resultado
- **Éxito**: Se muestra la cantidad de registros importados
- **Error**: Se detalla el problema encontrado
- **Parcial**: Se informa qué registros no pudieron procesarse

### Validaciones Automáticas
- **Formato de archivo**: Estructura correcta del DKT
- **Campos obligatorios**: Verificación de datos mínimos requeridos
- **Duplicados**: Control por lote (código_tarjeta + período)
- **Rangos de valores**: Importes, fechas, códigos válidos

---

## 📄 Gestión de Rendiciones

### Visualizar Rendiciones

#### Grilla Principal
La pantalla principal muestra una tabla con:
- **ID**: Número único de rendición
- **Usuario**: Quien creó la rendición
- **Fecha**: Fecha de creación
- **Estado**: BORRADOR, PENDIENTE, ENAUT, AUTORIZADA, EXPORTADA
- **Importe**: Monto total de la rendición
- **Acciones**: Botones para ver, editar, autorizar

#### Filtros Disponibles
- **Por Estado**: Mostrar solo rendiciones en estado específico
- **Por Fecha**: Rango de fechas de creación
- **Por Usuario**: Filtrar por creador
- **Por Importe**: Rango de montos
- **Búsqueda Libre**: Texto en cualquier campo

### Crear Nueva Rendición

#### Método 1: Desde Importación DKT
1. Importe un archivo DKT siguiendo el proceso anterior
2. Los datos se almacenan automáticamente en `resumen_tarjeta`
3. Use **"Procesar a Rendición"** para convertir los datos

#### Método 2: Manual
1. Haga clic en **"Nueva Rendición"**
2. Complete los campos obligatorios:
   - **Período**: Mes/año de la rendición
   - **Código Tarjeta**: Tipo de tarjeta
   - **Usuario**: Responsable de la rendición
   - **Centro de Costo**: Para imputación contable

3. Agregue líneas de detalle:
   - **Fecha Transacción**: Fecha del gasto
   - **Descripción**: Concepto del gasto
   - **Importe**: Monto de la transacción
   - **Rubro**: Clasificación contable

### Editar Rendición

#### Campos Editables
- **Datos de cabecera**: Centro de costo, proyecto, observaciones
- **Líneas de detalle**: Descripción, rubro, centro de costo específico
- **Estado**: Solo usuarios autorizados pueden cambiar estado

#### Proceso de Edición
1. Haga clic en **"Editar"** en la rendición deseada
2. Modifique los campos necesarios
3. Los campos con fondo amarillo son editables
4. Haga clic en **"Guardar"** para confirmar cambios

### Estados y Flujo

#### Estados Posibles
1. **BORRADOR**: Recién creada, en edición
2. **PENDIENTE**: Lista para revisión
3. **ENAUT** (En Autorización): Enviada para aprobación
4. **AUTORIZADA**: Aprobada, lista para exportar
5. **EXPORTADA**: Enviada al ERP
6. **RECHAZADA**: No aprobada, vuelve a borrador

#### Transiciones Permitidas
- BORRADOR → PENDIENTE (usuario creador)
- PENDIENTE → ENAUT (supervisor)
- ENAUT → AUTORIZADA/RECHAZADA (autorizante)
- AUTORIZADA → EXPORTADA (sistema/admin)

---

## 🧾 Gestión de Comprobantes

### Subir Comprobantes

#### Proceso de Upload
1. Navegue a **"Comprobantes"** en el sidebar
2. Haga clic en **"Subir Comprobante"**
3. **Seleccione archivo(s)**: PDF, JPG, PNG (máx. 10MB cada uno)
4. **Complete información**:
   - **Tipo**: Factura, Ticket, Recibo, Nota de Crédito
   - **Fecha**: Fecha del comprobante
   - **Importe**: Monto del documento
   - **Proveedor**: Nombre del comercio/proveedor
   - **Descripción**: Concepto o detalle adicional

5. **Asociar a Rendición**: Vincule con una o más rendiciones
6. Haga clic en **"Guardar"**

### Asociar Comprobantes a Rendiciones

#### Asociación Múltiple
Un comprobante puede asociarse a varias rendiciones:
1. En la pantalla de comprobantes, haga clic en **"Asociar"**
2. Seleccione las rendiciones de la lista
3. **Distribución de Importe**:
   - **Proporcional**: Se distribuye según importe de cada rendición
   - **Manual**: Especifique el importe para cada rendición
   - **Completo**: El importe total a cada rendición (gastos compartidos)

#### Validaciones
- El importe total no puede exceder el valor del comprobante
- Las fechas deben ser consistentes
- Solo se pueden asociar rendiciones no exportadas

### Gestión de Archivos
- **Visualización**: Vista previa integrada de PDF e imágenes
- **Descarga**: Descargue archivo original
- **Versionado**: Reemplace archivos manteniendo historial
- **Eliminación**: Solo posible si no está asociado a rendiciones exportadas

---

## 🔒 Sistema de Autorizaciones

### Para Autorizantes

#### Acceder a Autorizaciones
1. Haga clic en **"Autorizaciones"** en el sidebar
2. Se muestran las rendiciones **"ENAUT"** (En Autorización)
3. Use filtros para organizar por importe, fecha, usuario

#### Revisar Rendición
1. Haga clic en **"Revisar"** en la rendición deseada
2. **Información mostrada**:
   - Datos del solicitante
   - Detalle de gastos línea por línea
   - Comprobantes asociados
   - Historial de cambios
   - Comentarios anteriores

#### Aprobar Rendición
1. Revise completamente la información
2. Verifique comprobantes adjuntos
3. Si está todo correcto:
   - Haga clic en **"Aprobar"**
   - Agregue comentarios opcionales
   - La rendición pasa a estado **"AUTORIZADA"**

#### Rechazar Rendición
1. Identifique los problemas encontrados
2. Haga clic en **"Rechazar"**
3. **Complete motivo del rechazo** (obligatorio):
   - Comprobantes faltantes
   - Datos incorrectos
   - Política no cumplida
   - Otro (especificar)
4. La rendición vuelve a **"BORRADOR"** para corrección

### Para Usuarios Solicitantes

#### Solicitar Autorización
1. Asegúrese que la rendición esté completa
2. Todos los comprobantes estén adjuntos
3. Haga clic en **"Enviar a Autorización"**
4. La rendición cambia a estado **"ENAUT"**
5. Se notifica automáticamente al autorizante

#### Seguimiento
- En **"Mis Rendiciones"** puede ver el estado actual
- Recibirá notificación cuando sea autorizada o rechazada
- Si es rechazada, puede ver los comentarios del autorizante

---

## 📤 Exportación al ERP

### Proceso de Exportación

#### Selección de Rendiciones
1. Navegue a **"Exportar"** en el sidebar
2. Se muestran las rendiciones en estado **"AUTORIZADA"**
3. **Seleccione rendiciones** a exportar usando checkboxes
4. Use **"Seleccionar Todas"** para procesos masivos

#### Configurar Exportación
1. **Formato de salida**:
   - **Excel**: Planilla estructurada (.xlsx)
   - **CSV**: Archivo delimitado por comas
   - **TXT**: Formato fijo de ancho
   - **XML**: Intercambio estructurado
   - **API**: Envío directo al ERP (si configurado)

2. **Opciones adicionales**:
   - Incluir comprobantes como ZIP
   - Generar archivo de control
   - Aplicar formato específico de ERP

#### Ejecutar Exportación
1. Haga clic en **"Exportar Seleccionadas"**
2. El sistema procesará las rendiciones
3. **Durante el proceso**:
   - Se muestran barras de progreso
   - Posible interrupción si hay errores
   - Log detallado de operaciones

4. **Al completarse**:
   - Las rendiciones cambian a estado **"EXPORTADA"**
   - Se genera archivo descargable
   - Se registra en log de exportaciones

### Validaciones Pre-Exportación
- Todas las rendiciones deben estar autorizadas
- Comprobantes obligatorios adjuntos
- Datos contables completos
- Importes cuadrados
- Fechas en rango válido

### Manejo de Errores
- **Errores de datos**: Se muestran línea por línea para corrección
- **Errores de conectividad**: Opción de reintentar automáticamente
- **Errores de formato**: Sugerencias de configuración alternativa

---

## 💳 Administración de Tarjetas

### Gestión de Tipos de Tarjeta

#### Crear Nueva Tarjeta
1. Navegue a **"Tarjetas"** en el sidebar
2. Haga clic en **"Nueva Tarjeta"**
3. **Complete información**:
   - **Código**: Identificador único (ej: ICBCVC)
   - **Nombre**: Descripción de la tarjeta
   - **Banco**: Entidad bancaria
   - **Estado**: Activo/Inactivo
   - **Observaciones**: Notas adicionales

#### Editar Tarjeta Existente
1. Busque la tarjeta en la lista
2. Haga clic en **"Editar"**
3. Modifique los campos necesarios
4. **Atención**: Cambiar el código puede afectar importaciones futuras

#### Deshabilitar Tarjeta
- Use **"Inactivar"** en lugar de eliminar
- Las tarjetas inactivas no aparecen en nuevas importaciones
- Los datos históricos se conservan

### Gestión de Bancos

#### Administrar Entidades Bancarias
1. Vaya a la pestaña **"Bancos"**
2. **Crear nuevo banco**:
   - Código del banco
   - Nombre completo
   - Código SWIFT (opcional)
   - Estado activo/inactivo

#### Asociaciones
- Cada tarjeta debe asociarse a un banco
- Un banco puede tener múltiples tipos de tarjeta
- Validaciones de consistencia automáticas

---

## 👥 Gestión de Usuarios

### Administración de Usuarios

#### Crear Usuario
1. Navegue a **"Usuarios"** en el sidebar
2. Haga clic en **"Nuevo Usuario"**
3. **Información personal**:
   - Nombre y apellido
   - Email (será el usuario de acceso)
   - Teléfono, área, puesto

4. **Configuración de acceso**:
   - Perfil/rol del usuario
   - Estado activo/inactivo
   - Delegación organizacional
   - Permisos especiales

#### Perfiles Disponibles
- **Administrador**: Acceso completo al sistema
- **Usuario Operativo**: Importación y gestión de rendiciones
- **Autorizante**: Aprobación de rendiciones
- **Consulta**: Solo lectura de información

#### Gestión de Delegaciones
1. Vaya a la pestaña **"Delegaciones"**
2. Configure jerarquías organizacionales:
   - Estructura de áreas y sectores
   - Relaciones jefe-subordinado
   - Límites de autorización por nivel

#### Autorizantes
1. Pestaña **"Autorizantes"**
2. Configure usuarios con permisos de aprobación:
   - Límites de montos
   - Áreas de responsabilidad
   - Tipos de gasto que puede autorizar

---

## ⚙️ Administración de Parámetros

### Sistema de Parámetros Maestros

#### Acceder a Parámetros
1. Navegue a **"Parámetros"** en el sidebar
2. **Pestañas disponibles**:
   - **Parámetros Maestros**: Tabla principal
   - **Relaciones**: Jerarquías padre-hijo
   - **Estados**: Configuración de estados del sistema
   - **Atributos**: Campos adicionales por tipo

#### Gestionar Parámetros
1. **Crear nuevo parámetro**:
   - **Campo**: Tipo de parámetro (ej: PROVINCIA, RUBRO)
   - **Código**: Identificador único
   - **Descripción**: Nombre descriptivo
   - **Padre**: Si es hijo de otro parámetro
   - **Estado**: Activo/Inactivo

#### Tipos de Parámetros Comunes
- **PROVINCIA**: Provincias del país
- **LOCALIDAD**: Ciudades (hijo de PROVINCIA)
- **BANCO**: Entidades bancarias
- **RUBRO**: Clasificación de gastos
- **CENTRO_COSTO**: Centros de costo contable
- **MONEDA**: Tipos de moneda (ARS, USD, EUR)

### Relaciones Jerárquicas

#### Configurar Combos en Cascada
1. **Ejemplo**: Provincia → Localidad
   - PROVINCIA padre: BUENOS_AIRES
   - LOCALIDAD hijos: CABA, LA_PLATA, MAR_DEL_PLATA

2. **En formularios**: 
   - Al seleccionar provincia, se cargan sus localidades
   - Funciona automáticamente en toda la aplicación

#### API de Parámetros
- Endpoint unificado: `/api/parametros/campo/:campo`
- Parámetros hijos: `/api/parametros/hijos/:padreId`
- Utilizado automáticamente por todos los formularios

---

## 📊 Sistema de Reportes

### Reportes Disponibles

#### Acceder a Reportes
1. Navegue a **"Reportes"** en el sidebar
2. **Categorías de reportes**:
   - **Operativos**: Rendiciones, importaciones, comprobantes
   - **Gerenciales**: Resúmenes por área, usuario, período
   - **Contables**: Distribución por centro de costo, cuenta
   - **Auditoría**: Trazabilidad de operaciones

#### Reporte de Rendiciones
1. **Filtros disponibles**:
   - **Período**: Fecha desde/hasta
   - **Estado**: Todos, específicos, múltiples
   - **Usuario**: Individual o por área
   - **Importe**: Rango de montos
   - **Centro de Costo**: Filtro contable

2. **Información mostrada**:
   - Lista detallada de rendiciones
   - Totales por estado
   - Promedios y estadísticas
   - Gráficos de distribución

#### Reporte de Gastos por Rubro
1. **Configuración**:
   - Período de análisis
   - Agrupación (mensual, trimestral, anual)
   - Comparativa con períodos anteriores

2. **Visualización**:
   - Tabla de importes por rubro
   - Gráfico de torta por participación
   - Evolución temporal
   - Top 10 rubros de mayor gasto

### Exportación de Reportes
- **Excel**: Datos tabulares con formato
- **PDF**: Reporte formateado para impresión
- **CSV**: Datos para análisis externo
- **Email**: Envío automático programado

### Reportes Programados
1. Configure reportes para ejecución automática
2. **Frecuencia**: Diaria, semanal, mensual
3. **Destinatarios**: Lista de emails
4. **Formato**: Excel, PDF o ambos

---

## 🔍 Búsqueda y Filtros

### Búsqueda Global
- **Ubicación**: Barra superior de navegación
- **Alcance**: Busca en rendiciones, usuarios, comprobantes
- **Sintaxis**: Texto libre, busca en múltiples campos

### Filtros Avanzados
Disponibles en la mayoría de las pantallas:

#### Filtros Comunes
- **Fecha**: Rangos, últimos 7/30/90 días
- **Estado**: Selección múltiple
- **Usuario**: Autocompletado
- **Importe**: Desde/hasta con operadores (>, <, =)

#### Filtros Específicos
- **Por pantalla**: Cada sección tiene filtros específicos
- **Guardado**: Guarde combinaciones de filtros frecuentes
- **Compartido**: Comparta filtros con otros usuarios

### Tips de Búsqueda
- **Comodines**: Use * para búsquedas parciales
- **Exacta**: Use comillas para búsqueda exacta "texto completo"
- **Múltiple**: Separe términos con espacios (AND lógico)
- **Exclusión**: Use - antes de la palabra para excluir

---

## 📱 Uso en Dispositivos Móviles

### Adaptación Responsive

#### Teléfonos (< 768px)
- Sidebar se oculta automáticamente
- Menú hamburguesa en header superior
- Tablas se convierten en tarjetas apilables
- Botones de acción agrupados

#### Tablets (768px - 1024px)
- Sidebar colapsible manual
- Grillas con scroll horizontal
- Formularios en una columna
- Touch-friendly (botones más grandes)

### Funcionalidades Móviles
- **Upload de fotos**: Cámara directa para comprobantes
- **Notificaciones push**: Alertas de autorizaciones
- **Sincronización offline**: Trabajo sin conexión
- **Geolocalización**: Para gastos de viáticos

### App Mobile (React Native)
- Disponible en desarrollo
- Funcionalidades básicas de consulta
- Upload de comprobantes con cámara
- Notificaciones push nativas

---

## 🚨 Solución de Problemas

### Problemas Comunes

#### No Puedo Iniciar Sesión
1. **Verificar credenciales**: Email exacto, contraseña correcta
2. **Limpiar caché**: Ctrl+F5 para recargar completo
3. **Probar navegador diferente**: Chrome, Firefox, Edge
4. **Contactar administrador**: Si persiste el problema

#### Error al Importar DKT
1. **Verificar formato**: Archivo .dkt válido
2. **Revisar tamaño**: Máximo 50MB
3. **Comprobar duplicados**: Período ya importado
4. **Validar estructura**: 37 campos correctos

#### Rendición No Se Guarda
1. **Campos obligatorios**: Completar todos los campos requeridos
2. **Validación de fechas**: Fechas en formato correcto
3. **Rangos de importes**: Valores positivos y realistas
4. **Conexión de red**: Verificar conectividad

#### Exportación Falla
1. **Estado correcto**: Solo rendiciones autorizadas
2. **Comprobantes**: Todos los adjuntos requeridos
3. **Datos completos**: Información contable completa
4. **Permisos de usuario**: Usuario autorizado para exportar

### Contacto y Soporte
- **Administrador del Sistema**: admin@empresa.com
- **Soporte Técnico**: soporte@empresa.com
- **Teléfono**: +54 11 1234-5678
- **Horarios**: Lunes a Viernes 9:00 a 18:00

### Logs y Diagnóstico
- Los usuarios pueden acceder a sus logs de actividad
- Información de diagnóstico disponible en Perfil de Usuario
- Reporte automático de errores al equipo técnico

---

## 📋 Mejores Prácticas

### Para Usuarios Operativos
1. **Importación regular**: No acumular archivos DKT
2. **Validación inmediata**: Revisar importaciones apenas se completen
3. **Comprobantes oportunos**: Adjuntar documentación sin demora
4. **Descripción clara**: Detallar conceptos de gastos específicamente

### Para Autorizantes
1. **Revisión completa**: Verificar todos los comprobantes
2. **Comentarios claros**: Si rechaza, explicar motivo específico
3. **Política empresarial**: Aplicar criterios consistentes
4. **Tiempo de respuesta**: Autorizar dentro de plazos establecidos

### Para Administradores
1. **Backup regular**: Verificar respaldos de base de datos
2. **Monitoreo**: Revisar logs de error y performance
3. **Capacitación**: Entrenar usuarios en nuevas funcionalidades
4. **Parámetros actualizados**: Mantener catálogos al día

### Seguridad de Datos
1. **Contraseñas seguras**: Mínimo 8 caracteres, mayúsculas, números
2. **Cerrar sesión**: Especialmente en equipos compartidos
3. **Información confidencial**: No compartir credenciales
4. **Reportar incidentes**: Comunicar problemas de seguridad

---

## 📞 Información de Contacto

### Soporte Técnico
- **Email**: soporte.rendiciones@empresa.com
- **Teléfono**: +54 11 1234-5678
- **Horario**: Lunes a Viernes 9:00 a 18:00

### Administración Funcional
- **Email**: admin.rendiciones@empresa.com
- **Responsable**: [Nombre del Administrador]
- **Extensión**: 1234

### Capacitación
- **Sesiones grupales**: Primer viernes de cada mes
- **Capacitación individual**: Con cita previa
- **Material de apoyo**: Disponible en portal interno

---

**¡Gracias por utilizar el Sistema de Rendiciones!** 
*Este manual se actualiza regularmente. Versión: 1.0 - Fecha: Septiembre 2025*