# 🚀 Guía de Setup: Google Document AI

## Paso 1: Configurar Google Cloud Project (5 minutos)

### A. Crear/Seleccionar Proyecto

1. Ve a: https://console.cloud.google.com
2. Inicia sesión con tu cuenta de Google Workspace
3. En el selector de proyectos (arriba izquierda), haz click
4. Opciones:
   - **Si ya tienes un proyecto:** Selecciónalo
   - **Si no:** Click "NEW PROJECT"
     - Nombre: "Parse Document Processing"
     - Location: Sin organización (o tu org)
     - Click "CREATE"

### B. Habilitar Facturación (REQUERIDO pero gratis)

⚠️ **IMPORTANTE:** Google Cloud requiere tarjeta para verificación, pero NO te cobrará en el tier gratuito.

1. En el menú lateral: "Billing"
2. Si no tienes billing account:
   - Click "CREATE ACCOUNT"
   - Completa datos (tarjeta de crédito para verificación)
   - Acepta términos
3. Asocia billing account al proyecto

**Costo real:** $0 USD/mes para primeros 1,000 páginas

### C. Habilitar Document AI API

1. Ve a: https://console.cloud.google.com/apis/library/documentai.googleapis.com
2. Asegúrate que el proyecto correcto esté seleccionado (arriba)
3. Click **"ENABLE"** (Habilitar)
4. Espera 1-2 minutos a que se active

---

## Paso 2: Crear Invoice Parser Processor (3 minutos)

### A. Ir a Document AI

1. Ve a: https://console.cloud.google.com/ai/document-ai
2. O en el menú: "Artificial Intelligence" → "Document AI"

### B. Crear Processor

1. Click **"CREATE PROCESSOR"**
2. Selecciona:
   - **Processor type:** "Invoice Parser" (buscar en la lista)
   - **Processor name:** "Parse Invoice Processor"
   - **Region:** "southamerica-east1" (São Paulo - menor latencia para Argentina)
     - O "us" si no está disponible
3. Click **"CREATE"**

### C. Copiar Datos del Processor

Después de crear, verás la página de detalles:

```
Processor ID: abcd1234567890  ← COPIAR ESTE
Location: southamerica-east1   ← COPIAR ESTE
Project ID: parse-doc-12345    ← COPIAR ESTE (arriba en la barra)
```

**Guarda estos 3 valores**, los necesitaremos para el .env

---

## Paso 3: Crear Service Account (5 minutos)

Las credenciales permiten que tu backend acceda a Document AI.

### A. Ir a Service Accounts

1. Ve a: https://console.cloud.google.com/iam-admin/serviceaccounts
2. O en el menú: "IAM & Admin" → "Service Accounts"

### B. Crear Service Account

1. Click **"CREATE SERVICE ACCOUNT"**
2. Detalles:
   - **Service account name:** "parse-document-ai"
   - **Service account ID:** (se genera automáticamente)
   - **Description:** "Service account para Document AI en Parse app"
3. Click **"CREATE AND CONTINUE"**

### C. Asignar Permisos

1. En "Grant this service account access to project":
   - Role: **"Document AI API User"**
   - Click "CONTINUE"
2. En "Grant users access to this service account":
   - Skip (opcional)
   - Click **"DONE"**

### D. Generar Key (JSON)

1. En la lista de service accounts, encuentra "parse-document-ai"
2. Click en los 3 puntos (⋮) → "Manage keys"
3. Click **"ADD KEY"** → "Create new key"
4. Tipo: **JSON**
5. Click **"CREATE"**

**Se descarga automáticamente:** `parse-doc-12345-abc123.json`

⚠️ **IMPORTANTE:**
- Guarda este archivo en un lugar seguro
- NO lo subas a Git
- Lo necesitarás en el siguiente paso

---

## Paso 4: Verificar Configuración

### Checklist de Verificación:

- [ ] Google Cloud Project creado
- [ ] Billing habilitado (aunque sea gratis)
- [ ] Document AI API habilitada
- [ ] Invoice Parser Processor creado
- [ ] Service Account creado con permisos
- [ ] JSON key descargado

### Datos que debes tener:

```
PROJECT_ID: parse-doc-12345
LOCATION: southamerica-east1  (o us)
PROCESSOR_ID: abcd1234567890
CREDENTIALS_FILE: parse-doc-12345-abc123.json
```

---

## ✅ Siguiente Paso

Una vez que tengas todo esto, vuelve a Claude Code y continúa con la implementación del código.

**Tiempo estimado total:** 10-15 minutos

---

## 🆘 Troubleshooting

### "Billing account required"
- Necesitas agregar tarjeta de crédito para verificación
- No te cobrarán en el tier gratuito (1K páginas/mes)
- Es un requisito de Google Cloud Platform

### "Document AI API not enabled"
- Espera 2-3 minutos después de habilitar
- Refresca la página
- Verifica que el proyecto correcto esté seleccionado

### "Permission denied"
- Asegúrate de que el Service Account tenga el rol "Document AI API User"
- Verifica que el JSON key sea del proyecto correcto

### "Processor not found"
- Verifica que PROCESSOR_ID sea correcto (sin espacios)
- Verifica que LOCATION coincida con donde creaste el processor
- Usa el formato: `projects/PROJECT_ID/locations/LOCATION/processors/PROCESSOR_ID`

---

## 📚 Referencias

- **Document AI Console:** https://console.cloud.google.com/ai/document-ai
- **Pricing:** https://cloud.google.com/document-ai/pricing
- **Docs:** https://cloud.google.com/document-ai/docs
- **Invoice Parser:** https://cloud.google.com/document-ai/docs/processors-list#processor_invoice-processor
