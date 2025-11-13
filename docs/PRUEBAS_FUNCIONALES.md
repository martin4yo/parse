# 🧪 Pruebas Funcionales - Sistema de Rendiciones

## 📋 Documento de Casos de Prueba y Resultados

### **Información del Documento**
- **Proyecto**: Sistema de Rendiciones de Tarjetas de Crédito
- **Versión del Sistema**: 1.0.0
- **Fecha de Creación**: 20/09/2025
- **Responsable de Pruebas**: [Tu Nombre]
- **Ambiente de Pruebas**: Producción Linux Server

---

## 🎯 Objetivo de las Pruebas

Validar el correcto funcionamiento de todas las funcionalidades críticas del sistema de rendiciones en el ambiente de producción, asegurando que:

- ✅ Los procesos de importación DKT funcionen correctamente
- ✅ La extracción de documentos con IA (Gemini/Ollama) opere según lo esperado
- ✅ Los flujos de autorización y estados funcionen apropiadamente
- ✅ La exportación al ERP genere archivos válidos
- ✅ La interfaz de usuario responda correctamente en todos los navegadores

---

## 🏗️ Ambiente de Pruebas

### **Configuración del Servidor**
- **SO**: Linux Server
- **URL**: [URL del servidor de producción]
- **Base de Datos**: PostgreSQL
- **Node.js**: v18+
- **Variables de Entorno**:
  - `ENABLE_AI_EXTRACTION=true`
  - `GEMINI_API_KEY=configurada`
  - `USE_OLLAMA=false` (Gemini activo)

### **Navegadores Probados**
- [ ] Chrome (última versión)
- [ ] Firefox (última versión)
- [ ] Safari (última versión)
- [ ] Edge (última versión)

---

## 📝 Casos de Prueba

### **CP001 - Autenticación y Acceso**

#### **Descripción**
Verificar el sistema de login y acceso a las diferentes funcionalidades según perfiles de usuario.

#### **Precondiciones**
- Sistema desplegado y accesible
- Usuarios de prueba creados con diferentes perfiles

#### **Pasos de Prueba**
1. Acceder a la URL del sistema
2. Intentar login con credenciales válidas
3. Verificar redirección al dashboard
4. Comprobar opciones del menú según perfil
5. Cerrar sesión y verificar que se cierre correctamente

#### **Datos de Prueba**
```
Usuario Admin: admin@rendiciones.com / admin123
Usuario Operativo: operativo@rendiciones.com / operativo123
Usuario Autorizante: autorizante@rendiciones.com / autorizante123
Usuario Consulta: consulta@rendiciones.com / consulta123
```

#### **Resultado Esperado**
- Login exitoso para todos los usuarios
- Dashboard carga con métricas básicas
- Menú muestra opciones según perfil del usuario
- Logout funciona correctamente

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Observaciones**: ________________________________

---

### **CP002 - Importación de Archivos DKT**

#### **Descripción**
Validar el proceso completo de importación de archivos DKT desde la selección hasta el almacenamiento en base de datos.

#### **Precondiciones**
- Usuario con perfil operativo logueado
- Archivo DKT de prueba disponible
- Código de tarjeta configurado (ej: ICBCVC)

#### **Pasos de Prueba**
1. Navegar a "Importar Resumen"
2. Seleccionar archivo DKT de prueba
3. Configurar código de tarjeta y período
4. Revisar vista previa de datos
5. Ejecutar importación
6. Verificar resultado y registros creados

#### **Datos de Prueba**
```
Archivo: CuponesConsumo_[MES].dkt
Código Tarjeta: ICBCVC
Período: 2409 (Sep 2024)
Registros esperados: [Cantidad según archivo]
```

#### **Resultado Esperado**
- Archivo se carga correctamente
- Vista previa muestra datos estructurados
- Importación completa sin errores
- Registros se almacenan en tabla `resumen_tarjeta`
- No se permiten duplicados (mismo lote)

#### **Resultado Obtenido**
```
[✅] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Observaciones**: Importación de archivos DKT funciona correctamente. Proceso completo desde carga hasta almacenamiento en base de datos opera sin errores.

---

### **CP003 - Extracción de Documentos con IA**

#### **Descripción**
Probar el sistema de extracción automática de datos de comprobantes usando Gemini AI, incluyendo el fallback a procesamiento local.

#### **Precondiciones**
- Sistema con `ENABLE_AI_EXTRACTION=true`
- API de Gemini configurada y funcionando
- Comprobantes de prueba en formato PDF/imagen

#### **Pasos de Prueba**
1. Subir comprobante (factura, ticket)
2. Verificar que se ejecute extracción con Gemini
3. Comprobar datos extraídos (fecha, importe, CUIT, etc.)
4. Probar con documento que falle en Gemini (formato raro)
5. Verificar que active fallback a regex local
6. Confirmar que documento se guarde aunque falle extracción

#### **Datos de Prueba**
```
Comprobante 1: Factura clara con datos completos
Comprobante 2: Ticket de supermercado
Comprobante 3: Documento con formato no estándar
Comprobante 4: Imagen de mala calidad
```

#### **Resultado Esperado**
- Extracción automática funciona para documentos claros
- Fallback se activa cuando Gemini falla
- Documentos se guardan siempre (incluso con datos parciales)
- Logs muestran proceso de extracción claramente

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Observaciones**: ________________________________

---

### **CP004 - Gestión de Rendiciones**

#### **Descripción**
Verificar el flujo completo de creación, edición y gestión de rendiciones.

#### **Precondiciones**
- Datos de resumen_tarjeta importados previamente
- Usuario operativo logueado

#### **Pasos de Prueba**
1. Crear rendición desde datos DKT importados
2. Editar campos permitidos (centro de costo, observaciones)
3. Agregar/quitar líneas de detalle
4. Cambiar estado de BORRADOR a PENDIENTE
5. Verificar validaciones de campos obligatorios
6. Comprobar cálculos automáticos de totales

#### **Datos de Prueba**
```
Período: 2409
Usuario: Test Usuario
Centro de Costo: CC001
Líneas: Mínimo 3 ítems con diferentes rubros
```

#### **Resultado Esperado**
- Rendición se crea con datos base de DKT
- Edición funciona solo en campos permitidos
- Estados cambian según reglas de negocio
- Totales se calculan correctamente
- Validaciones impiden datos inconsistentes

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[✅] ❌ FALLÓ - Detalle: Botón guardar cambios no funciona
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Observaciones**:
- ✅ **Creación de rendiciones funciona** desde datos DKT importados
- ❌ **Botón "Guardar Cambios" no funciona** - No se pueden guardar modificaciones en rendiciones
- ❌ **No se puede borrar contenido de campos** - Los campos no permiten limpiar/vaciar su contenido
- ❌ **Botón "Subir Excel" no funciona** - No permite subir archivos Excel en sección de rendiciones
- **Bug Crítico**: Sistema de gestión de rendiciones completamente no operativo

**Bugs Identificados**:
- Sistema de guardado de cambios no funciona
- Imposibilidad de limpiar/editar contenido de campos
- Funcionalidad de subir Excel no operativa

---

### **CP005 - Sistema de Autorizaciones**

#### **Descripción**
Validar el flujo de autorización de rendiciones, incluyendo aprobación y rechazo.

#### **Precondiciones**
- Rendición en estado PENDIENTE
- Usuario autorizante logueado
- Comprobantes asociados a la rendición

#### **Pasos de Prueba**
1. Acceder a módulo "Autorizaciones"
2. Revisar rendición pendiente
3. Verificar datos y comprobantes
4. Aprobar rendición con comentarios
5. Comprobar cambio de estado a AUTORIZADA
6. Repetir proceso pero rechazando otra rendición
7. Verificar que rechazada vuelve a BORRADOR

#### **Datos de Prueba**
```
Rendición 1: Con comprobantes completos → APROBAR
Rendición 2: Con datos faltantes → RECHAZAR
Motivo rechazo: "Falta comprobante de taxi"
```

#### **Resultado Esperado**
- Lista muestra solo rendiciones ENAUT (En Autorización)
- Aprobación cambia estado correctamente
- Rechazo vuelve a BORRADOR con comentarios
- Notificaciones se envían al usuario creador

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Observaciones**: ________________________________

---

### **CP006 - Gestión de Comprobantes**

#### **Descripción**
Probar la subida, asociación y gestión de comprobantes digitales.

#### **Precondiciones**
- Rendiciones creadas en el sistema
- Archivos de comprobantes (PDF, JPG, PNG)

#### **Pasos de Prueba**
1. Subir comprobante nuevo
2. Completar datos (tipo, fecha, importe, proveedor)
3. Asociar a una rendición existente
4. Probar asociación múltiple (un comprobante a varias rendiciones)
5. Verificar vista previa de documentos
6. Probar descarga de archivos originales

#### **Datos de Prueba**
```
Archivo 1: factura.pdf (500KB)
Archivo 2: ticket.jpg (2MB)
Archivo 3: recibo.png (1MB)
Tipos: Factura, Ticket, Recibo
```

#### **Resultado Esperado**
- Upload funciona para todos los formatos soportados
- Datos se guardan correctamente
- Asociaciones múltiples funcionan
- Vista previa muestra documentos correctamente
- Descarga devuelve archivo original

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[✅] ⚠️ PARCIAL - Detalle: Upload funciona, asociación falla
```

**Observaciones**:
- ✅ **Subida de comprobantes funciona correctamente** tanto individual como múltiple
- ✅ **Archivos se procesan y parsean** de manera correcta
- ✅ **Campo observaciones funciona correctamente** - Se agregan y editan comentarios sin problemas
- ❌ **Asociación general falla** - No se pueden asociar comprobantes masivamente
- ❌ **Asociación manual individual falla** - No funciona la asociación por comprobante específico

**Bug Identificado**: Sistema de asociación de comprobantes no operativo (funcionalidad de comentarios OK)

---

### **CP007 - Exportación al ERP**

#### **Descripción**
Verificar la generación y formato de archivos de exportación para el ERP.

#### **Precondiciones**
- Rendiciones en estado AUTORIZADA
- Usuario con permisos de exportación

#### **Pasos de Prueba**
1. Acceder a módulo "Exportar"
2. Seleccionar rendiciones autorizadas
3. Configurar formato de exportación (Excel/CSV)
4. Ejecutar proceso de exportación
5. Verificar archivo generado
6. Comprobar cambio de estado a EXPORTADA
7. Validar estructura del archivo

#### **Datos de Prueba**
```
Formato: Excel (.xlsx)
Rendiciones: Mínimo 3 rendiciones autorizadas
Campos esperados: [Lista de campos según especificación ERP]
```

#### **Resultado Esperado**
- Exportación genera archivo válido
- Estados cambian a EXPORTADA
- Archivo contiene todos los campos requeridos
- Formato cumple especificación ERP
- Log registra operación correctamente

#### **Resultado Obtenido**
```
[✅] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Observaciones**: Botón de exportar funciona correctamente para rendiciones en estado AUTORIZADA

---

### **CP008 - Eliminación de DKTs**

#### **Descripción**
Verificar el proceso de eliminación de registros DKT importados, tanto individuales como por lotes completos.

#### **Precondiciones**
- Datos DKT importados en el sistema
- Usuario con permisos de administración logueado
- Algunos DKT sin rendiciones asociadas
- Algunos DKT con rendiciones ya creadas

#### **Pasos de Prueba**
1. **Eliminar DKT individual sin rendición**:
   - Buscar registro DKT que no tiene rendición asociada
   - Intentar eliminar registro individual
   - Verificar que se elimine correctamente

2. **Intentar eliminar DKT con rendición asociada**:
   - Buscar registro DKT que ya tiene rendición creada
   - Intentar eliminar el registro
   - Verificar que sistema impida la eliminación con mensaje claro

3. **Eliminar lote completo de DKT**:
   - Seleccionar lote de importación sin rendiciones
   - Ejecutar eliminación de lote completo
   - Confirmar que todos los registros del lote se eliminen

4. **Verificar integridad después de eliminación**:
   - Comprobar que otros datos no se vean afectados
   - Verificar que logs registren la operación
   - Confirmar que numeración/IDs se mantenga consistente

#### **Datos de Prueba**
```
DKT sin rendición: Lote importado recientemente sin procesar
DKT con rendición: Registros ya convertidos a rendiciones
Lote para eliminar: Importación de prueba completa
Usuario: Administrador con permisos completos
```

#### **Resultado Esperado**
- ✅ DKT sin rendición se elimina correctamente
- ✅ Sistema impide eliminar DKT con rendición asociada
- ✅ Mensaje de error claro al intentar eliminar DKT protegido
- ✅ Eliminación de lote funciona para lotes sin rendiciones
- ✅ Integridad de datos se mantiene después de eliminación
- ✅ Operación se registra en logs del sistema

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Bug Encontrado**:
- ❌ **No se puede eliminar DKT sin rendición asociada**
- **Severidad**: 🟡 Media
- **Impacto**: Dificulta limpieza de datos de prueba y corrección de importaciones erróneas

**Observaciones**: ________________________________

---

### **CP009 - Gestión de Parámetros**

#### **Descripción**
Validar la administración de parámetros maestros y combos en cascada.

#### **Precondiciones**
- Usuario administrador logueado
- Estructura básica de parámetros existente

#### **Pasos de Prueba**
1. Acceder a "Parámetros"
2. Crear nuevo parámetro padre (ej: PROVINCIA)
3. Crear parámetros hijos (ej: LOCALIDADES)
4. Probar combo en cascada en formularios
5. Editar parámetro existente
6. Inactivar parámetro y verificar efectos
7. Probar campo de búsqueda con múltiples caracteres

#### **Datos de Prueba**
```
Provincia: CORDOBA (padre)
Localidades: CORDOBA_CAPITAL, VILLA_CARLOS_PAZ (hijos)
Campo: NUEVA_PROVINCIA
Estado: ACTIVO/INACTIVO
Búsqueda: "CORDOBA", "BUENOS", etc.
```

#### **Resultado Esperado**
- CRUD de parámetros funciona completamente
- Relaciones padre-hijo se mantienen
- Combos en cascada responden automáticamente
- Inactivación no rompe datos existentes
- Campo búsqueda permite escribir palabras completas

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[✅] ❌ FALLÓ - Detalle: Campo búsqueda no permite más de un carácter
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Observaciones**:
- ❌ **Campo búsqueda en parámetros maestros falla** - Solo permite escribir un carácter
- ❌ **Pantalla se recarga** después del primer carácter, impidiendo escribir palabras completas
- **Bug crítico**: Imposibilita búsqueda eficiente en parámetros

**Bug Identificado**: Campo búsqueda en parámetros maestros no operativo

---

### **CP010 - Responsividad y UI/UX**

#### **Descripción**
Probar la adaptación de la interfaz a diferentes dispositivos y resoluciones.

#### **Precondiciones**
- Acceso desde diferentes dispositivos/navegadores

#### **Pasos de Prueba**
1. Probar en resolución de escritorio (1920x1080)
2. Probar en tablet (768x1024)
3. Probar en móvil (375x667)
4. Verificar menú hamburguesa en móvil
5. Comprobar scroll horizontal en tablas
6. Probar formularios en pantalla pequeña

#### **Datos de Prueba**
```
Resoluciones:
- Desktop: 1920x1080, 1366x768
- Tablet: 768x1024, 1024x768
- Mobile: 375x667, 414x896
```

#### **Resultado Esperado**
- Interfaz se adapta correctamente a todas las resoluciones
- Sidebar colapsible funciona apropiadamente
- Tablas mantienen usabilidad en móvil
- Formularios son completables en pantallas pequeñas

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Observaciones**: ________________________________

---

### **CP010 - Reportes de Avance de Rendiciones**

#### **Descripción**
Verificar la existencia y funcionalidad de reportes que muestren el detalle del avance de rendiciones, tanto por usuario como por resumen DKT.

#### **Precondiciones**
- Datos DKT importados en el sistema
- Rendiciones en diferentes estados (algunas completadas, otras pendientes)
- Usuarios con diferentes tarjetas asignadas

#### **Pasos de Prueba**
1. **Reporte de Avance por Usuario/Tarjeta**:
   - Buscar opción de reporte de rendiciones por usuario
   - Seleccionar usuario específico y período
   - Verificar que muestre estado de cada rendición
   - Comprobar que indique rendiciones pendientes vs completadas

2. **Reporte de Resumen DKT**:
   - Buscar opción de reporte de resumen DKT
   - Verificar qué datos DKT fueron convertidos a rendiciones
   - Identificar qué usuarios deben rendiciones pendientes
   - Mostrar datos DKT sin rendición asociada

3. **Validar información mostrada**:
   - Estados de rendiciones por usuario
   - Importes pendientes de rendir
   - Fechas de vencimiento o antigüedad
   - Datos DKT sin procesar

#### **Datos de Prueba**
```
Usuario 1: Con rendiciones completadas
Usuario 2: Con rendiciones pendientes
Usuario 3: Con datos DKT sin rendir
Período: Último mes importado
Tarjetas: Múltiples tipos (ICBCVC, SANTVC, etc.)
```

#### **Resultado Esperado**
- ✅ Existe reporte de avance por usuario/tarjeta
- ✅ Existe reporte de resumen DKT vs rendiciones
- ✅ Reportes muestran estados claros y actualizados
- ✅ Se identifican usuarios con pendientes
- ✅ Se identifican datos DKT sin procesar
- ✅ Información es precisa y útil para seguimiento

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Funcionalidad Pendiente**:
- ❌ **No existe reporte de avance de rendiciones por usuario**
- ❌ **No existe reporte de resumen DKT vs rendiciones**
- **Prioridad**: 🔴 Alta - Necesario para control de gestión

**Observaciones**: Funcionalidad crítica para seguimiento y control de rendiciones pendientes

---

### **CP011 - Performance y Carga**

#### **Descripción**
Evaluar el rendimiento del sistema con volúmenes de datos reales.

#### **Precondiciones**
- Base de datos con volumen representativo
- Archivos DKT de tamaño real

#### **Pasos de Prueba**
1. Importar archivo DKT grande (>1000 registros)
2. Medir tiempo de carga de grillas con muchos registros
3. Probar búsquedas y filtros con datos voluminosos
4. Verificar respuesta de exportaciones grandes
5. Monitorear uso de memoria y CPU

#### **Datos de Prueba**
```
Archivo DKT: >1000 registros
Grilla rendiciones: >500 registros
Exportación: >100 rendiciones
Búsquedas: Texto en datasets grandes
```

#### **Resultado Esperado**
- Importación completa en <5 minutos
- Grillas cargan en <3 segundos
- Búsquedas responden en <2 segundos
- Exportaciones procesan sin timeout

#### **Resultado Obtenido**
```
[ ] ✅ PASÓ
[ ] ❌ FALLÓ - Detalle: ___________________
[ ] ⚠️ PARCIAL - Detalle: _________________
```

**Observaciones**: ________________________________

---

## 📊 Resumen de Resultados

### **Estadísticas de Pruebas**
```
Total de Casos: 12
Pasaron: 2 / 12 (16.7%)
Fallaron: 4 / 12 (33.3%)
Parciales: 1 / 12 (8.3%)
Pendientes: 5 / 12 (41.7%)

Casos Críticos Pasaron: 2 / 9 (22.2%)
Casos Críticos Fallaron: 3 / 9 (33.3%)
Casos Críticos Parciales: 1 / 9 (11.1%)
```

### **Casos Críticos**
- CP001 - Autenticación ⚪ Pendiente
- CP002 - Importación DKT ✅ Pasó
- CP003 - Extracción IA ⚪ Pendiente
- CP004 - Rendiciones ❌ Falló (Botón guardar no funciona)
- CP005 - Autorizaciones ⚪ Pendiente
- CP006 - Comprobantes ⚠️ Parcial (Upload OK, Asociación falla)
- CP007 - Exportación ✅ Pasó
- CP008 - Eliminación DKTs ❌ Falló
- CP010 - Reportes Avance ❌ Falló (Funcionalidad no existe)

### **Estado General del Sistema**
```
[ ] 🟢 APROBADO - Todos los casos críticos pasan
[ ] 🟡 CONDICIONAL - Fallos menores que no impactan funcionalidad crítica
[ ] 🔴 RECHAZADO - Fallos en funcionalidad crítica
```

---

## 🐛 Registro de Bugs/Issues

### **Bug #001**
- **Título**: ____________________________
- **Severidad**: 🔴 Alta / 🟡 Media / 🟢 Baja
- **Descripción**: _______________________
- **Pasos para Reproducir**: ______________
- **Resultado Esperado**: ________________
- **Resultado Actual**: __________________
- **Estado**: 🟢 Resuelto / 🟡 En Progreso / 🔴 Abierto

### **Bug #002**
- **Título**: ____________________________
- **Severidad**: 🔴 Alta / 🟡 Media / 🟢 Baja
- **Descripción**: _______________________
- **Pasos para Reproducir**: ______________
- **Resultado Esperado**: ________________
- **Resultado Actual**: __________________
- **Estado**: 🟢 Resuelto / 🟡 En Progreso / 🔴 Abierto

*(Agregar más bugs según sea necesario)*

---

## 🔄 Recomendaciones y Mejoras

### **Funcionalidad**
1. **Implementar reportes de avance** de rendiciones por usuario y DKT
2. **Corregir sistema de asociación** de comprobantes a rendiciones
3. **Habilitar eliminación** de DKT sin rendiciones asociadas

### **Simplificación de Campos de Rendición**
**De las pruebas surge que los siguientes campos NO son útiles** y son solamente para el armado de la interfaz al ERP:
- Concepto Módulo
- Concepto Tipo
- Concepto Código
- Módulo Comprobante
- Tipo Comprobante
- Tipo de Registro
- Tipo de Comprobante

**Recomendación**: Remover estos campos de la interfaz de usuario y mantenerlos solo en el backend para exportación ERP.

### **Simplificación de Campos de Comprobantes**
**De las pruebas surge que los siguientes campos NO aportan valor**:
- **CAE** (Código de Autorización Electrónico)
- **Estado**

**Recomendación**: Remover campos CAE y Estado de la pantalla de comprobantes ya que no aportan funcionalidad útil.

### **Performance**
1. _________________________________
2. _________________________________
3. _________________________________

### **UI/UX**
1. Simplificar formulario de rendiciones removiendo campos innecesarios
2. Remover campos CAE y Estado de pantalla de comprobantes (no aportan valor)
3. _________________________________

### **Seguridad**
1. _________________________________
2. _________________________________
3. _________________________________

---

## 📋 Checklist de Deployment

### **Pre-Producción**
- [ ] Todos los casos críticos pasan
- [ ] No hay bugs de severidad alta abiertos
- [ ] Performance dentro de parámetros aceptables
- [ ] Datos de prueba limpiados
- [ ] Configuración de producción verificada

### **Post-Deployment**
- [ ] Monitoreo activo por 24hs
- [ ] Backup verificado
- [ ] Usuarios finales notificados
- [ ] Documentación actualizada
- [ ] Plan de rollback preparado

---

## 📞 Contactos

### **Equipo de Pruebas**
- **Responsable**: [Tu Nombre]
- **Email**: [tu.email@empresa.com]
- **Fecha de Pruebas**: [Fecha inicio] - [Fecha fin]

### **Soporte Técnico**
- **Desarrollador**: [Nombre desarrollador]
- **DevOps**: [Nombre DevOps]
- **QA Lead**: [Nombre QA]

---

**📝 Notas Adicionales:**

*Este documento debe actualizarse con cada ejecución de pruebas y servir como referencia histórica de la calidad del sistema.*

**Versión del Documento**: 1.0
**Última Actualización**: 20/09/2025
**Próxima Revisión**: _______________