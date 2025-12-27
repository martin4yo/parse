# 🗺️ Roadmap - Sistema Parse 2025

**Última actualización:** 27 de Diciembre 2025
**Estado del proyecto:** En producción con nuevas funcionalidades

---

## ✅ Completado (Diciembre 2025)

### 0. Extracción de Múltiples CUITs (27 Dic) ⭐
**Impacto:** 🔥 Alto - Identificación automática emisor/destinatario

- ✅ Nuevos campos: `cuitDestinatario`, `cuitsExtraidos`
- ✅ Prompt actualizado para extraer TODOS los CUITs
- ✅ Parámetro maestro `cuit_propio` para empresas del tenant
- ✅ Nueva acción de regla `VALIDAR_CUITS_PROPIOS`
- ✅ Corrección automática si IA confunde emisor/destinatario
- ✅ Fix: Logs de Parse API no se mostraban (orden de rutas Express)

**ROI:** Identificación correcta de CUITs sin intervención manual

**Ver:** `docs/SESION-2025-12-27-CUITS-MULTIPLES.md`

---

## ✅ Completado (Enero 2025)

### 1. Sistema de Aprendizaje de Patrones (17 Enero) ⭐
**Impacto:** 🔥 Alto - Reduce costos de IA en 60-85%

- ✅ Aprendizaje automático de clasificaciones IA
- ✅ Caché de documentos idénticos (100% ahorro)
- ✅ Templates de proveedores recurrentes (60-80% ahorro)
- ✅ API REST completa para gestión de patrones
- ✅ Integración con API pública
- ✅ 10 reglas de validación de ejemplo

**ROI:** Ahorro de $32-55 USD/año por cada 1000 documentos procesados

---

### 2. Mejoras UX para Validaciones (18 Enero) ⭐
**Impacto:** 🔥 Alto - Mejora satisfacción del usuario 56%

- ✅ Botón "Editar" directo desde errores de validación
- ✅ Highlight automático de campos problemáticos
- ✅ Tooltips explicativos en operadores
- ✅ Exportar solo documentos con warnings
- ✅ Validaciones en tiempo real mientras se edita

**ROI:** -56% tiempo para corregir errores, -80% clics necesarios

---

### 3. Dimensiones a Nivel Documento (16 Enero)
**Impacto:** 🟡 Medio - Funcionalidad contable completa

- ✅ Dimensiones y subcuentas en documento principal
- ✅ Validación automática (suma 100%)
- ✅ Modal unificado para documento/líneas/impuestos

---

### 4. Sistema de Prompts GLOBAL (13 Enero)
**Impacto:** 🟢 Bajo - Mejora gestión de prompts

- ✅ Prompts sin tenant (superadmin)
- ✅ Fallback automático cuando no hay versión tenant
- ✅ 6 prompts GLOBAL por defecto

---

### 5. Manejo Robusto de Errores (13 Enero)
**Impacto:** 🟡 Medio - Estabilidad del sistema

- ✅ Backend no crashea al fallar procesamiento
- ✅ Mensajes de error descriptivos
- ✅ Campo `errorMessage` en BD

---

## 🎯 En Desarrollo (Q1 2025)

### 1. Google Document AI Integration 🚧
**Prioridad:** 🔥 Alta
**Esfuerzo:** 2-3 días
**Estado:** Diseñado, pendiente implementación
**Responsable:** Por asignar

**Objetivo:** Mejorar precisión de extracción de 70-80% a 95%+

**Beneficios:**
- ✅ 95%+ precisión en extracción de facturas
- ✅ Mejor OCR para documentos escaneados
- ✅ Detección nativa de tablas y campos fiscales
- ✅ Soporte para documentos de hasta 15 páginas

**Consideraciones:**
- ⚠️ Costo: $60 USD por 1000 páginas (1000 gratis/mes)
- ⚠️ Latencia: ~2-3s por página
- ⚠️ Requiere credenciales GCP

**Plan de implementación:**
1. Crear procesador "Invoice Parser" en GCP
2. Implementar `documentAIProcessor.js`
3. Integrar en pipeline antes de Claude Vision
4. A/B testing con 10% de documentos
5. Migración gradual según resultados

**Ver:** `CLAUDE.md` sección "Google Document AI"

---

## 📋 Pendientes - Corto Plazo (Q1 2025)

### 2. Estadísticas de Patrones Aprendidos
**Prioridad:** 🟡 Media
**Esfuerzo:** 2-3 horas
**ROI:** Visibilidad del ahorro real

**Endpoint:** `GET /api/v1/parse/stats`

**Retorna:**
```json
{
  "totalRequests": 1234,
  "patternCacheHits": 678,
  "exactMatchHits": 234,
  "templateHits": 444,
  "estimatedSavings": {
    "cost": "$1.85",
    "time": "2.5 hours"
  },
  "topPatterns": [
    { "type": "cuenta_linea", "hits": 123, "description": "..." }
  ],
  "trends": {
    "last7Days": [...],
    "last30Days": [...]
  }
}
```

**Casos de uso:**
- Dashboard de ahorro de IA
- Reportes para stakeholders
- Identificar patrones más usados
- Detectar anomalías

---

### 3. Header `X-Force-AI` para Bypass de Patrones
**Prioridad:** 🟡 Media
**Esfuerzo:** 1 hora
**ROI:** Flexibilidad para re-validación

**Implementación:**
```bash
curl -X POST /api/v1/parse/document \
  -H "X-API-Key: key" \
  -H "X-Force-AI: true" \
  -F "file=@doc.pdf"
```

**Casos de uso:**
- Re-validar documento sospechoso
- Forzar nueva extracción cuando hay cambios en prompts
- Testing de precisión de IA vs patrones

---

### 4. Dashboard de Métricas (Frontend)
**Prioridad:** 🟡 Media
**Esfuerzo:** 1-2 días
**ROI:** Visibilidad y toma de decisiones

**Componentes:**
- Gráfico de ahorro de IA (línea temporal)
- Documentos procesados vs patrones usados
- Top 10 patrones más efectivos
- Tasa de cache hit por tipo de documento
- Costo estimado ahorrado

**Ubicación:** Nueva página `/dashboard` o `/estadisticas`

---

### 5. Optimización de Reglas de Negocio
**Prioridad:** 🟢 Baja
**Esfuerzo:** 2-3 horas
**ROI:** Performance

**Mejoras:**
- Cache de reglas en memoria (reduce queries a BD)
- Pre-compilación de regex
- Índices en tabla `reglas_negocio`
- Lazy loading de reglas por contexto

**Estimación:** -30% tiempo de ejecución de reglas

---

## 📋 Pendientes - Medio Plazo (Q2 2025)

### 6. Webhook de Patrones Nuevos
**Prioridad:** 🟢 Baja
**Esfuerzo:** 3-4 horas
**ROI:** Automatización de validación

**Evento:** `pattern.created`

**Payload:**
```json
{
  "event": "pattern.created",
  "timestamp": "2025-01-18T10:30:00Z",
  "pattern": {
    "id": "uuid",
    "type": "extraccion_proveedor_template",
    "cuit": "30-12345678-9",
    "confidence": 0.85,
    "occurrences": 1
  },
  "tenant": {
    "id": "tenant-uuid",
    "name": "Empresa SA"
  }
}
```

**Casos de uso:**
- Notificar al contador cuando se aprende patrón nuevo
- Validación manual de patrones críticos
- Integración con Slack/Teams/Email

---

### 7. Gestión de Patrones desde API Pública
**Prioridad:** 🟢 Baja
**Esfuerzo:** 4-5 horas
**ROI:** Control para clientes

**Endpoints:**
```
GET    /api/v1/parse/patterns           # Listar patrones
GET    /api/v1/parse/patterns/:id       # Ver detalle
DELETE /api/v1/parse/patterns/:id       # Eliminar patrón
PUT    /api/v1/parse/patterns/:id       # Editar patrón
POST   /api/v1/parse/patterns/export    # Exportar todos
POST   /api/v1/parse/patterns/import    # Importar desde JSON
```

**Casos de uso:**
- Cliente quiere resetear patrones aprendidos
- Migrar patrones entre dev/staging/prod
- Auditar patrones para compliance

---

### 8. Exportación/Importación de Patrones
**Prioridad:** 🟢 Baja
**Esfuerzo:** 5-6 horas
**ROI:** DevOps y migración

**Formato de exportación:**
```json
{
  "version": "1.0",
  "exportDate": "2025-01-18",
  "tenant": "Empresa SA",
  "patterns": [
    {
      "type": "cuenta_linea",
      "inputPattern": {...},
      "outputValue": "...",
      "confidence": 0.95,
      "occurrences": 50
    }
  ]
}
```

**Comandos CLI:**
```bash
# Exportar
node scripts/export-patterns.js --tenant="uuid" --output=patterns.json

# Importar
node scripts/import-patterns.js --tenant="uuid" --input=patterns.json
```

---

### 9. IA Local con Ollama
**Prioridad:** 🟢 Baja
**Esfuerzo:** 1-2 días
**ROI:** Costos y privacidad

**Objetivo:** Alternativa a Gemini/Claude para extracción

**Modelo recomendado:** `llama3.2:3b` (2GB disco, 4GB RAM)

**Ventajas:**
- ✅ Sin costos por token
- ✅ Funciona offline
- ✅ Datos no salen del servidor
- ✅ Sin límites de rate limiting

**Configuración:**
```env
USE_OLLAMA=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

**Nota:** Función `extractWithOllama()` ya existe en `documentProcessor.js:324`

---

## 📋 Pendientes - Largo Plazo (Q3-Q4 2025)

### 10. Machine Learning para Categorización Automática
**Prioridad:** 🟢 Baja
**Esfuerzo:** 2-3 semanas
**ROI:** Automatización avanzada

**Objetivo:** Clasificar gastos automáticamente sin reglas manuales

**Tecnologías:**
- TensorFlow.js o Python scikit-learn
- Entrenamiento con datos históricos
- API REST para predicción

**Features:**
- Clasificación automática de productos
- Detección de anomalías en importes
- Sugerencias inteligentes de cuentas contables
- Predicción de centro de costo según proveedor

---

### 11. Integración con AFIP (Argentina)
**Prioridad:** 🟡 Media
**Esfuerzo:** 2-3 semanas
**ROI:** Compliance y validación

**Features:**
- Validación de CUIT en tiempo real
- Consulta de estado de factura en AFIP
- Verificación de CAE válido
- Descarga automática de facturas desde AFIP

**API:** AFIP Web Services (requiere CUIT y certificado)

---

### 12. OCR Mejorado para Fotos de Baja Calidad
**Prioridad:** 🟢 Baja
**Esfuerzo:** 1 semana
**ROI:** Mejor UX móvil

**Mejoras:**
- Pre-procesamiento avanzado de imágenes
- Corrección de perspectiva automática
- Mejora de contraste y nitidez
- Soporte para fotos con sombras/reflejos

**Tecnologías:**
- OpenCV o Pillow (Python)
- Sharp (ya implementado parcialmente)

---

### 13. Exportación a ERP/SAP
**Prioridad:** 🟡 Media (según demanda)
**Esfuerzo:** 3-4 semanas por conector
**ROI:** Integración end-to-end

**Conectores propuestos:**
1. SAP Business One
2. Tango Gestión
3. ContaPlus
4. QuickBooks
5. Xero

**Features:**
- Mapeo automático de cuentas contables
- Sincronización bidireccional
- Manejo de errores y reintentos
- Logs de auditoría

---

## 🎨 Mejoras de UX/UI Futuras

### 14. Modo Oscuro (Dark Mode)
**Prioridad:** 🟢 Baja
**Esfuerzo:** 2-3 días
**ROI:** UX

---

### 15. Vista Móvil Mejorada
**Prioridad:** 🟡 Media
**Esfuerzo:** 1 semana
**ROI:** UX móvil

---

### 16. Drag & Drop Masivo de Documentos
**Prioridad:** 🟢 Baja
**Esfuerzo:** 1-2 días
**ROI:** Productividad

---

### 17. Preview de PDF sin Descargar
**Prioridad:** 🟢 Baja
**Esfuerzo:** 1 día
**ROI:** UX

---

## 🔒 Seguridad y Compliance

### 18. Auditoría Completa de Cambios
**Prioridad:** 🟡 Media
**Esfuerzo:** 1 semana
**ROI:** Compliance

**Features:**
- Log de todos los cambios en documentos
- Quién, cuándo, qué cambió
- Exportación para auditoría
- Retención de logs por X años

---

### 19. Encriptación de Documentos Sensibles
**Prioridad:** 🟡 Media (según industria)
**Esfuerzo:** 1 semana
**ROI:** Seguridad

---

### 20. Multi-Factor Authentication (MFA)
**Prioridad:** 🟢 Baja
**Esfuerzo:** 3-5 días
**ROI:** Seguridad

---

## 📊 Priorización por Impacto

### Alto Impacto (Implementar primero)
1. 🔥 Google Document AI (Q1 2025)
2. 🔥 Dashboard de métricas (Q1 2025)
3. 🟡 Estadísticas de patrones (Q1 2025)

### Medio Impacto (Implementar según demanda)
4. 🟡 Header X-Force-AI (Q1 2025)
5. 🟡 Integración AFIP (Q3-Q4 2025)
6. 🟡 Exportación a ERP (Q3-Q4 2025)

### Bajo Impacto (Nice to have)
7. 🟢 Webhooks de patrones (Q2 2025)
8. 🟢 IA local con Ollama (Q2 2025)
9. 🟢 Gestión de patrones API (Q2 2025)
10. 🟢 Mejoras UX/UI (Q3-Q4 2025)

---

## 📈 Métricas de Éxito

### KPIs a Trackear

| Métrica | Objetivo Q1 | Objetivo Q2 | Objetivo Q4 |
|---------|-------------|-------------|-------------|
| **Precisión de extracción** | 85% | 90% | 95% |
| **Ahorro de IA (%)** | 20% | 40% | 70% |
| **Tiempo promedio/doc** | 6s | 4s | 3s |
| **Satisfacción usuario** | 7/10 | 8/10 | 9/10 |
| **Documentos/mes** | 1K | 5K | 10K |

---

## 💡 Ideas en Consideración

### Futuras exploraciones (sin prioridad asignada)

- **Asistente IA conversacional** para consultas sobre documentos
- **Detección de duplicados** inteligente
- **Análisis de tendencias de gastos** con gráficos
- **Alertas automáticas** de gastos inusuales
- **Integración con bancos** para conciliación automática
- **Generación de reportes** personalizables
- **API GraphQL** además de REST
- **Multi-idioma** (soporte para inglés, portugués)

---

## 🤝 Contribuciones

¿Tienes ideas para el roadmap?

**Proceso:**
1. Documentar idea en issue/documento
2. Evaluar impacto y esfuerzo
3. Priorizar según métricas del negocio
4. Agregar a este roadmap

---

## 📝 Changelog

| Fecha | Cambios |
|-------|---------|
| 27 Dic 2025 | Extracción múltiples CUITs (emisor/destinatario) |
| 27 Dic 2025 | Fix: Logs Parse API no se mostraban |
| 27 Dic 2025 | Nueva acción regla: VALIDAR_CUITS_PROPIOS |
| 18 Ene 2025 | Roadmap inicial creado |
| 18 Ene 2025 | Agregadas mejoras UX validaciones |
| 17 Ene 2025 | Agregado sistema de aprendizaje de patrones |

---

**Última revisión:** 27 de Diciembre 2025
**Próxima revisión:** 15 de Enero 2026
