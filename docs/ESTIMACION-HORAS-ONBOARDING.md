# ESTIMACIÓN DE HORAS - ONBOARDING PARSE

**Fecha:** 11 de Diciembre 2025
**Versión:** 1.0
**Tope máximo:** 180 horas

---

## 🎯 RESUMEN EJECUTIVO

| Escenario | Horas Totales | Timeline | Precio Sugerido |
|-----------|--------------|----------|-----------------|
| **BÁSICO** | 50 horas | 2-3 semanas | $4,000 - $6,000 USD |
| **MEDIO** | 98 horas | 4-6 semanas | $8,000 - $12,000 USD |
| **AVANZADO** | 160 horas | 6-8 semanas | $14,000 - $18,000 USD |

**Premisas:**
- ✅ Prompts GLOBAL ya configurados (CLASIFICADOR_DOCUMENTO, EXTRACCION_FACTURA_A/B/C, etc.)
- ✅ Axio (IA Assistant) genera reglas automáticamente desde lenguaje natural
- ✅ Cliente provee datos históricos organizados
- ✅ Implementación colaborativa (cliente participa activamente)

---

## 📋 FASE 1: SETUP TÉCNICO INICIAL

### Responsable: ✅ AXIOMA

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 1.1 | Provisionar servidor (VPS/Cloud) | 1.5h | 2h | 3h | Crear instancia, configurar acceso SSH, firewall básico |
| 1.2 | Instalar dependencias (Node.js, PostgreSQL, PM2, Nginx) | 1h | 1.5h | 2h | Script automatizado de instalación |
| 1.3 | Deploy de aplicación (Backend + Frontend) | 0.5h | 0.5h | 1h | Git clone, npm install, build production |
| 1.4 | Configurar variables de entorno | 0.5h | 0.5h | 1h | .env files con API keys, URLs, puertos |
| 1.5 | Ejecutar migraciones de BD (Prisma) | 0.5h | 0.5h | 0.5h | npx prisma migrate deploy |
| 1.6 | Configurar Nginx (reverse proxy) | 0.5h | 1h | 1.5h | SSL opcional, dominios, CORS |
| 1.7 | Configurar PM2 (process manager) | 0.25h | 0.5h | 0.5h | ecosystem.config.js, auto-restart |
| 1.8 | Setup de backups automáticos | 0.25h | 0.5h | 1h | Cronjob para BD, archivos subidos |
| 1.9 | Smoke test inicial | 0.5h | 0.5h | 0.5h | Verificar que todo esté funcionando |

**SUBTOTAL FASE 1:** | **5.5h** | **7.5h** | **11h** |

---

## 📊 FASE 2: RECOLECCIÓN Y ANÁLISIS DE DATA HISTÓRICA

### Responsable: 🔵 CLIENTE (Pre-requisitos)

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 2.1 | 🔵 Exportar datos de ERP/sistema contable a Excel/CSV | *4h* | *8h* | *12h* | Cliente extrae últimos 6-12 meses |
| 2.2 | 🔵 Organizar PDFs de documentos | *2h* | *4h* | *8h* | Cliente renombra archivos, crea carpetas |
| 2.3 | 🔵 Mapear campos (documentar qué significa cada columna) | *2h* | *3h* | *4h* | Cliente completa template de mapeo |

### Responsable: ✅ AXIOMA

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 2.4 | Kickoff meeting con cliente | 1h | 1.5h | 2h | Presentación, definición alcance, Q&A |
| 2.5 | Revisar datos históricos provistos | 0.5h | 1h | 1.5h | Validar calidad, completitud, formato |
| 2.6 | Reunión de análisis con cliente | 0.5h | 0.5h | 0.5h | Aclarar dudas sobre datos, lógica negocio |
| 2.7 | Subir datos históricos a Parse | 0.5h | 1h | 1.5h | Importar Excel, cargar PDFs al servidor |
| 2.8 | Procesamiento inicial con EXTRACCION_UNIVERSAL | 0.5h | 1h | 2h | Procesar 50-200 docs sin reglas |
| 2.9 | Exportar resultados de extracción | 0.25h | 0.5h | 0.5h | Generar Excel con datos extraídos |
| 2.10 | Análisis comparativo (IA vs Real) | 2h | 4h | 8h | Comparar campo por campo, identificar gaps |
| 2.11 | Detección de patrones con queries SQL/Excel | 1.25h | 2.5h | 3h | Análisis para detectar reglas implícitas |

**SUBTOTAL FASE 2 (AXIOMA):** | **6.5h** | **12h** | **19h** |
**SUBTOTAL FASE 2 (CLIENTE):** | *8h* | *15h* | *24h* |

---

## 🤖 FASE 3: CONFIGURACIÓN DE PROMPTS IA

### Responsable: ✅ AXIOMA

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 3.1 | Validar que prompts GLOBAL funcionan con docs del cliente | 0.5h | 1h | 1.5h | Probar CLASIFICADOR + extractores |
| 3.2 | Testing de extracción con sample de 10-20 docs | 0.5h | 1h | 1.5h | Verificar precisión, campos faltantes |
| 3.3 | Ajuste fino de prompts con Axio (si necesario) | 0h | 0.5h | 1h | Usar Axio para "afinar prompt X" |
| 3.4 | Crear prompt custom para tipo doc específico (si aplica) | 0h | 1h | 3h | Solo si doc muy atípico (ej: despacho aduana custom) |
| 3.5 | Re-testing después de ajustes | 0.5h | 1h | 2h | Validar mejoras en precisión |
| 3.6 | Documentar decisiones y casos edge | 1h | 1.5h | 3h | Registro de prompts usados, ejemplos |

**SUBTOTAL FASE 3:** | **2.5h** | **6h** | **12h** |

---

## ⚙️ FASE 4: GENERACIÓN DE REGLAS DE NEGOCIO CON AXIO

### Responsable: 🔵 CLIENTE (Validaciones)

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 4.1 | 🔵 Validar lógica de reglas propuestas por Axio | *2h* | *4h* | *6h* | Cliente confirma que reglas son correctas |

### Responsable: ✅ AXIOMA

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 4.2 | Preparar prompt para Axio con datos históricos | 0.25h | 0.5h | 1h | Estructurar request con Excel + instrucciones |
| 4.3 | Ejecutar Axio: "Analiza datos y genera reglas" | 0.25h | 0.5h | 1h | Axio procesa y propone 10-50 reglas |
| 4.4 | Revisar reglas generadas (calidad, sintaxis) | 1h | 2h | 3h | Verificar que JSON sea válido y lógico |
| 4.5 | Reunión con cliente para validar reglas | 1h | 2h | 3h | Presentar reglas, explicar lógica, ajustar |
| 4.6 | Confirmar reglas en UI de Parse | 0.5h | 1h | 2h | Crear reglas en BD desde JSON generado |
| 4.7 | Cargar parámetros maestros (proveedores, cuentas, dimensiones) | 2h | 4h | 8h | Importar catálogos del cliente a BD |
| 4.8 | Testing de reglas individuales con datos de prueba | 1.5h | 3h | 6h | Probar cada regla con 5-10 ejemplos |
| 4.9 | Testing de encadenamiento de reglas (prioridades) | 0.5h | 1h | 2h | Verificar orden de ejecución correcto |
| 4.10 | Ajustes finos de reglas según resultados de testing | 1h | 2h | 4h | Iterar, corregir condiciones/acciones |

**SUBTOTAL FASE 4 (AXIOMA):** | **8h** | **16h** | **30h** |
**SUBTOTAL FASE 4 (CLIENTE):** | *2h* | *4h* | *6h* |

---

## 🔄 FASE 5: INTEGRACIÓN CON ERP (OPCIONAL)

### Responsable: 🔵 CLIENTE (Si aplica)

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 5.1 | 🔵 Proveer specs del ERP (estructura BD, API docs) | *0h* | *2h* | *4h* | Cliente entrega documentación técnica |

### Responsable: ✅ AXIOMA

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 5.2 | Configurar conector SQL/API | 0h | 4h | 8h | Configurar sync con SQL Server u otro ERP |
| 5.3 | Mapear campos Parse → ERP | 0h | 1.5h | 3h | Definir qué campo va a qué tabla/columna |
| 5.4 | Testing de sincronización con data de prueba | 0h | 2h | 4h | Validar que datos lleguen correctamente |
| 5.5 | Configurar webhooks/callbacks (si aplica) | 0h | 1.5h | 3h | Notificaciones automáticas post-export |

**SUBTOTAL FASE 5 (AXIOMA):** | **0h** | **9h** | **18h** |
**SUBTOTAL FASE 5 (CLIENTE):** | *0h* | *2h* | *4h* |

---

## ✅ FASE 6: VALIDACIÓN END-TO-END

### Responsable: 🔵 CLIENTE (UAT)

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 6.1 | 🔵 User Acceptance Testing (UAT) | *4h* | *8h* | *12h* | Cliente valida con 10-20 documentos reales |

### Responsable: ✅ AXIOMA

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 6.2 | Re-procesar sample completo (50-200 docs) | 1h | 2h | 3h | Pipeline completo con todas las reglas |
| 6.3 | Cálculo de métricas de precisión por campo | 0.5h | 1h | 1.5h | Tasa de acierto, cobertura, errores |
| 6.4 | Análisis de errores y casos fallidos | 0.5h | 1h | 1.5h | Identificar qué documentos/campos fallan |
| 6.5 | Iteración 1: Ajustes de reglas/prompts | 1.5h | 3h | 5h | Corregir problemas detectados |
| 6.6 | Re-testing después de iteración 1 | 1h | 2h | 3h | Validar que mejoras funcionaron |
| 6.7 | Iteración 2: Ajustes finales (si necesario) | 1h | 2h | 4h | Segunda ronda de correcciones |
| 6.8 | Testing de casos edge (documentos atípicos) | 1.5h | 3h | 4h | Probar con docs difíciles, errores comunes |
| 6.9 | Reunión de validación con cliente | 1h | 2h | 3h | Presentar resultados finales, obtener aprobación |

**SUBTOTAL FASE 6 (AXIOMA):** | **8h** | **16h** | **25h** |
**SUBTOTAL FASE 6 (CLIENTE):** | *4h* | *8h* | *12h* |

---

## 🎓 FASE 7: CAPACITACIÓN Y DOCUMENTACIÓN

### Responsable: ✅ AXIOMA

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 7.1 | Preparación de materiales de capacitación | 1h | 1.5h | 2h | Slides, guías rápidas, videos (si aplica) |
| 7.2 | Documentación customizada del cliente | 1h | 1.5h | 2h | Guía de uso específica con sus flujos |
| 7.3 | Sesión de capacitación - Usuarios finales | 2h | 3h | 4h | Cómo subir docs, revisar, exportar |
| 7.4 | Sesión de capacitación - Administradores | 1h | 2h | 3h | Gestión de reglas, prompts, parámetros |
| 7.5 | Sesión de capacitación - IT/Soporte (si aplica) | 0h | 1h | 2h | Troubleshooting, logs, monitoreo |
| 7.6 | Q&A y resolución de dudas | 1h | 1h | 1.5h | Sesión abierta de preguntas |
| 7.7 | Entrega de documentación técnica | 1h | 1h | 1.5h | Arquitectura, deployment, configuraciones |

**SUBTOTAL FASE 7:** | **7h** | **11h** | **16h** |

---

## 🚀 FASE 8: DEPLOYMENT EN PRODUCCIÓN

### Responsable: ✅ AXIOMA

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 8.1 | Limpiar datos de prueba de BD | 0.25h | 0.5h | 0.5h | DELETE de documentos de testing |
| 8.2 | Activar todas las reglas en producción | 0.25h | 0.5h | 0.5h | Marcar reglas como activas |
| 8.3 | Activar prompts especializados | 0.25h | 0.5h | 0.5h | Configurar pipeline de clasificación + extracción |
| 8.4 | Configurar alertas y monitoreo | 0.5h | 1h | 1.5h | Logs, emails de error, dashboards |
| 8.5 | Configurar backups en producción | 0.25h | 0.5h | 1h | Cronjobs diarios/semanales |
| 8.6 | Smoke testing en producción | 0.5h | 1h | 1.5h | Probar con 3-5 docs en vivo |
| 8.7 | Go-live acompañado (primer día operativo) | 2h | 3h | 4h | Estar disponible durante primera operación real |
| 8.8 | Monitoreo post-go-live (primeras 48 horas) | 1h | 2h | 3h | Revisar logs, métricas, errores |

**SUBTOTAL FASE 8:** | **5h** | **9h** | **13h** |

---

## 🛟 FASE 9: SOPORTE POST-GO-LIVE (GARANTÍA)

### Responsable: ✅ AXIOMA

| # | Tarea | Básico | Medio | Avanzado | Descripción |
|---|-------|--------|-------|----------|-------------|
| 9.1 | Disponibilidad primera semana (email/Slack) | 2h | 3h | 4h | Atención de consultas, dudas, problemas |
| 9.2 | Disponibilidad segunda semana | 1h | 2h | 2h | Soporte reducido, solo críticos |
| 9.3 | Ajustes menores (fine-tuning de reglas) | 1.5h | 2.5h | 4h | Tweaks según feedback operativo |
| 9.4 | Corrección de bugs (si aplica) | 1h | 1.5h | 3h | Hotfixes de errores encontrados |
| 9.5 | Revisión de métricas operativas | 0.5h | 1h | 1.5h | Analizar precisión, performance real |
| 9.6 | Reunión de cierre y transfer de conocimiento | 1h | 1h | 1.5h | Lecciones aprendidas, documentación final |

**SUBTOTAL FASE 9:** | **7h** | **11h** | **16h** |

---

## 📊 RESUMEN TOTAL DE HORAS

### HORAS AXIOMA (Facturables)

| Fase | Básico | Medio | Avanzado |
|------|--------|-------|----------|
| 1. Setup Técnico | 5.5h | 7.5h | 11h |
| 2. Análisis Data | 6.5h | 12h | 19h |
| 3. Prompts IA | 2.5h | 6h | 12h |
| 4. Reglas con Axio | 8h | 16h | 30h |
| 5. Integración ERP | 0h | 9h | 18h |
| 6. Validación E2E | 8h | 16h | 25h |
| 7. Capacitación | 7h | 11h | 16h |
| 8. Deployment | 5h | 9h | 13h |
| 9. Soporte/Garantía | 7h | 11h | 16h |
| **TOTAL AXIOMA** | **49.5h** | **97.5h** | **160h** |

### HORAS CLIENTE (Pre-requisitos - No facturables)

| Fase | Básico | Medio | Avanzado |
|------|--------|-------|----------|
| 2. Recolección Data | 8h | 15h | 24h |
| 4. Validación Reglas | 2h | 4h | 6h |
| 5. Specs ERP | 0h | 2h | 4h |
| 6. UAT | 4h | 8h | 12h |
| **TOTAL CLIENTE** | **14h** | **29h** | **46h** |

---

## 💰 ESTRUCTURA DE PRICING

### Opción 1: Precio por Hora

| Escenario | Horas | Tarifa/Hora | Precio Total |
|-----------|-------|-------------|--------------|
| Básico | 50h | $80 - $120 USD | $4,000 - $6,000 USD |
| Medio | 98h | $82 - $122 USD | $8,000 - $12,000 USD |
| Avanzado | 160h | $88 - $113 USD | $14,000 - $18,000 USD |

### Opción 2: Paquete Cerrado (Recomendado)

| Escenario | Precio Fijo | Incluye | Garantía |
|-----------|-------------|---------|----------|
| **Básico** | **$5,000 USD** | Todo hasta 50h | 1 semana |
| **Medio** | **$10,000 USD** | Todo hasta 98h | 2 semanas |
| **Avanzado** | **$16,000 USD** | Todo hasta 160h | 1 mes |

**Beneficio paquete cerrado:**
- ✅ Precio predecible para el cliente
- ✅ Margen de seguridad para nosotros
- ✅ Incentiva colaboración (cliente no ve "cuenta corriendo")

---

## 🎯 FACTORES QUE PUEDEN SUMAR HORAS

### Adicionales no incluidos en el paquete:

| Concepto | Horas Estimadas | Precio Sugerido |
|----------|-----------------|-----------------|
| **Documentos muy atípicos** (requieren prompts 100% custom) | +10 - 20h | +$1,000 - $2,000 USD |
| **Integraciones complejas** (APIs sin docs, legacy systems) | +20 - 30h | +$2,000 - $3,000 USD |
| **Migración masiva de datos** (>5,000 documentos históricos) | +10 - 15h | +$1,000 - $1,500 USD |
| **Capacitaciones adicionales** (más de las incluidas) | +4h por sesión | +$500 USD/sesión |
| **Desarrollo de features custom** | Variable | $100 - $150 USD/hora |
| **SLA Premium** (soporte 24/7, tiempo respuesta <2h) | +20 - 30h/mes | +$2,000 USD/mes |

---

## 📅 CRONOGRAMA ESTIMADO

### BÁSICO (50 horas - 2-3 semanas)

| Semana | Actividades | Horas |
|--------|-------------|-------|
| **Semana 0** (Pre-kickoff) | Cliente prepara datos históricos | *8h cliente* |
| **Semana 1** | Setup (5.5h) + Análisis (6.5h) + Prompts (2.5h) | 14.5h |
| **Semana 2** | Reglas (8h) + Validación (8h) + Capacitación (7h) | 23h |
| **Semana 3** | Deployment (5h) + Go-live + Soporte (7h) | 12h |

### MEDIO (98 horas - 4-6 semanas)

| Semana | Actividades | Horas |
|--------|-------------|-------|
| **Semana 0** | Cliente prepara datos | *15h cliente* |
| **Semana 1-2** | Setup (7.5h) + Análisis (12h) + Prompts (6h) | 25.5h |
| **Semana 3-4** | Reglas (16h) + Integración ERP (9h) | 25h |
| **Semana 5** | Validación (16h) + Capacitación (11h) | 27h |
| **Semana 6** | Deployment (9h) + Go-live + Soporte (11h) | 20h |

### AVANZADO (160 horas - 6-8 semanas)

| Semana | Actividades | Horas |
|--------|-------------|-------|
| **Semana 0-1** | Cliente prepara datos | *24h cliente* |
| **Semana 2** | Setup (11h) + Análisis inicial (19h) | 30h |
| **Semana 3-4** | Prompts (12h) + Reglas parte 1 (15h) | 27h |
| **Semana 5-6** | Reglas parte 2 (15h) + Integración ERP (18h) | 33h |
| **Semana 7** | Validación (25h) | 25h |
| **Semana 8** | Capacitación (16h) + Deployment (13h) + Soporte (16h) | 45h |

---

## ✅ CHECKLIST DE ENTREGABLES

Al finalizar la implementación, el cliente recibe:

### Técnicos
- [ ] Sistema Parse instalado y configurado en servidor
- [ ] Base de datos PostgreSQL con schema completo
- [ ] Backups automáticos configurados
- [ ] Monitoreo y alertas activos
- [ ] SSL/HTTPS configurado (si aplica)

### Configuración
- [ ] Prompts IA validados y activos
- [ ] 10-100 reglas de negocio configuradas (según paquete)
- [ ] Parámetros maestros cargados (proveedores, cuentas, dimensiones)
- [ ] Integración ERP funcional (si aplica)
- [ ] Usuarios y permisos configurados

### Documentación
- [ ] Manual de usuario customizado
- [ ] Documentación técnica (arquitectura, deployment)
- [ ] Guía de troubleshooting
- [ ] Grabaciones de capacitaciones (si aplica)
- [ ] Listado de reglas y prompts activos

### Soporte
- [ ] 1-4 semanas de soporte post-go-live (según paquete)
- [ ] Canal de comunicación (email, Slack, WhatsApp)
- [ ] SLA de respuesta definido

---

## 📞 CONDICIONES COMERCIALES

### Forma de Pago Sugerida

**Opción A: 3 Pagos**
- 40% al firmar contrato (antes del kickoff)
- 40% al completar UAT exitoso (Fase 6)
- 20% al go-live en producción (Fase 8)

**Opción B: 2 Pagos**
- 50% al firmar contrato
- 50% al go-live en producción

### Garantía
- **Básico:** 1 semana de soporte sin costo adicional
- **Medio:** 2 semanas de soporte sin costo adicional
- **Avanzado:** 1 mes de soporte sin costo adicional

### Fuera de Alcance (No Incluido)
- ❌ Soporte mensual continuado (cotizar aparte)
- ❌ Desarrollo de features nuevos no contemplados
- ❌ Capacitaciones adicionales a las incluidas
- ❌ Migración de datos históricos >500 documentos
- ❌ Integraciones con sistemas no especificados inicialmente

---

## 📝 NOTAS FINALES

### Pre-requisitos Críticos del Cliente

Para que la implementación sea exitosa en el tiempo estimado, el cliente **DEBE:**

1. **Proveer datos históricos completos** en Semana 0:
   - Excel/CSV con 50-200 registros representativos
   - PDFs correspondientes organizados
   - Mapeo de campos documentado

2. **Designar usuarios clave** disponibles:
   - 1 usuario operativo (para UAT y capacitación)
   - 1 administrador/IT (para validaciones técnicas)
   - 1 sponsor/decisor (para aprobaciones)

3. **Responder validaciones en <48 horas**:
   - Aprobación de reglas generadas por Axio
   - Feedback de UAT
   - Validación de resultados

4. **Proveer accesos necesarios**:
   - Credenciales de servidor (si deploy en su infra)
   - Acceso a BD de ERP (si integración)
   - VPN/acceso remoto (si aplica)

### Riesgos que Pueden Extender Timeline

⚠️ **Riesgos Comunes:**
- Cliente demora en proveer datos → +1-2 semanas
- Documentos muy atípicos requieren prompts custom → +1 semana
- Integraciones con APIs legacy sin documentación → +2-3 semanas
- Cliente solicita cambios de alcance mid-project → Variable

🛡️ **Mitigaciones:**
- Acuerdo de SLA de respuestas (cliente max 48h)
- Change control process para cambios de alcance
- Reuniones semanales de seguimiento
- Buffer de 10-20% en timeline para imprevistos

---

**Documento generado:** 11 de Diciembre 2025
**Válido hasta:** 28 de Febrero 2026
**Contacto:** info@axioma.com

---
