# ✅ Instrucciones Finales - Document AI

## 🎉 Implementación Completada!

El código está listo. Ahora solo necesitas configurar las credenciales y probar.

---

## 📋 Pasos Restantes (10-15 minutos)

### 1. Configurar Google Cloud (si aún no lo hiciste)

Sigue la guía completa: **`GUIA-SETUP-DOCUMENT-AI.md`**

**Resumen rápido:**
1. Ir a: https://console.cloud.google.com
2. Crear/seleccionar proyecto
3. Habilitar Document AI API
4. Crear Invoice Parser Processor
5. Crear Service Account con permisos
6. Descargar JSON key

**Datos que necesitas copiar:**
```
PROJECT_ID: ________________
PROCESSOR_ID: ______________
LOCATION: __________________
CREDENTIALS_FILE: __________
```

---

### 2. Colocar Credenciales en el Servidor

**Opción A: Archivo JSON (Recomendado)**

```bash
# 1. Crear carpeta de credenciales
cd D:\Desarrollos\React\parse\backend
mkdir credentials

# 2. Copiar tu archivo JSON descargado a:
# D:\Desarrollos\React\parse\backend\credentials\document-ai-credentials.json

# 3. Verificar que existe
dir credentials
# Debe aparecer: document-ai-credentials.json
```

**Opción B: Variable de entorno (Alternativa)**

Si no puedes usar archivo, puedes pegar el JSON completo en `.env`:
```env
DOCUMENT_AI_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
```

---

### 3. Configurar Variables de Entorno

**Editar:** `D:\Desarrollos\React\parse\backend\.env`

**Agregar estas líneas:**

```env
# ============================================
# GOOGLE DOCUMENT AI
# ============================================

# Habilitar Document AI
USE_DOCUMENT_AI=true

# Project ID (del paso 1)
DOCUMENT_AI_PROJECT_ID=tu-project-id-aqui

# Processor ID (del paso 1)
DOCUMENT_AI_PROCESSOR_ID=tu-processor-id-aqui

# Location (del paso 1)
DOCUMENT_AI_LOCATION=southamerica-east1

# Ruta a credenciales
GOOGLE_APPLICATION_CREDENTIALS=./credentials/document-ai-credentials.json

# Mantener estas existentes
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=AIzaSyChQdergthmXWkNDJ2xaDfyqfov3ac2fM8
```

**⚠️ IMPORTANTE:** Reemplaza los valores de ejemplo con tus datos reales.

---

### 4. Agregar al .gitignore (Seguridad)

**Editar:** `D:\Desarrollos\React\parse\backend\.gitignore`

**Agregar:**
```
# Document AI Credentials
credentials/
*.json
!package.json
!package-lock.json
!tsconfig.json
```

---

### 5. Reiniciar Backend

```bash
cd D:\Desarrollos\React\parse\backend

# Si está en desarrollo:
npm run dev

# Si está en producción (PM2):
pm2 restart parse-backend
pm2 logs parse-backend --lines 50
```

---

### 6. Probar con tu PDF Problemático

**Opción A: Desde el Frontend**

1. Ir a: http://localhost:3000/parse
2. Subir tu PDF con imágenes pegadas
3. Ver los logs en la consola del backend
4. Verificar que diga: `"🎯 Intentando extracción con Google Document AI..."`

**Opción B: Script de Prueba**

```bash
cd backend

# Crear script de prueba
node -e "
const processor = require('./src/services/documentAIProcessor');
processor.processInvoice('path/to/your/test.pdf')
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => console.error(err));
"
```

---

## 📊 ¿Cómo Verificar que Funciona?

### Logs Esperados (Backend)

Si funciona correctamente, verás:

```
🎯 ===== INICIANDO EXTRACCIÓN DE DOCUMENTO =====
👤 Tenant: abc123
📄 Longitud de texto: 1234 caracteres

🎯 ===== USANDO DOCUMENT AI (PRIORIDAD) =====
📄 [Document AI] Procesando: factura.pdf
🔧 [Document AI] Processor: projects/parse-doc.../processors/abc123...
📊 [Document AI] Tamaño archivo: 234.56 KB
✅ [Document AI] Procesado en 2345ms
   📋 fecha: "2024-01-15" (confidence: 99.2%)
   📋 cuit: "30-12345678-9" (confidence: 98.5%)
   📋 razonSocial: "EMPRESA S.A." (confidence: 97.8%)
   📋 importe: "1234.56" (confidence: 99.5%)
   📦 Line items extraídos: 3
✅ Document AI exitoso (confianza: 98.5%)
✅ ===== EXTRACCIÓN COMPLETADA CON DOCUMENT AI =====
```

### Si hay Errores:

**Error: "Document AI no configurado"**
```
ℹ️  Document AI no configurado, usando pipeline tradicional
```
→ Verificar variables de entorno en `.env`

**Error: "Archivo de credenciales no encontrado"**
```
❌ Error inicializando Document AI client: Archivo de credenciales no encontrado...
```
→ Verificar ruta en `GOOGLE_APPLICATION_CREDENTIALS`
→ Verificar que el archivo existe

**Error: "Permission denied" o "Processor not found"**
```
❌ Error con Document AI: Processor not found
```
→ Verificar que el Service Account tenga permisos "Document AI API User"
→ Verificar que PROCESSOR_ID sea correcto

**Error: "Billing account required"**
```
❌ Error: Billing account required for project...
```
→ Necesitas habilitar billing en Google Cloud (aunque sea gratis)
→ Agregar tarjeta de crédito para verificación

---

## 🎯 Flujo de Prioridad (Después de Configurar)

**Nuevo flujo de extracción:**

```
1. Document AI (PRIORIDAD) ← 95%+ precisión, lee imágenes
   ↓ (si falla o no está configurado)
2. Gemini Flash ← 70-80% precisión
   ↓ (si falla)
3. Claude Haiku ← 70-80% precisión
   ↓ (si falla)
4. Regex Local ← 50-60% precisión
```

**Ventajas:**
- ✅ Lee imágenes embebidas en PDFs
- ✅ 95%+ precisión vs 70-80% de Gemini
- ✅ Gratis primeros 1,000 páginas/mes
- ✅ OCR avanzado (handwriting, rotado, borroso)
- ✅ Extrae line items con estructura

---

## 💰 Recordatorio de Costos

**Gratis (Tier gratuito):**
- Primeras 1,000 páginas/mes: **$0 USD**

**Pagado (Si superas 1,000/mes):**
- 1,001 - 1,000,000 páginas: **$0.06 USD/página**
- 1,000,001+ páginas: **$0.04 USD/página**

**Ejemplo:** 2,500 facturas/mes = $90 USD/mes
- 1,000 gratis = $0
- 1,500 × $0.06 = $90

**Vs Gemini actual:** ~$2 USD/mes para 2,500 facturas

---

## 🔍 Monitorear Uso

**Ver cuántas páginas has procesado:**

1. Ir a: https://console.cloud.google.com/apis/api/documentai.googleapis.com/quotas
2. O: https://console.cloud.google.com/billing
3. Ver métricas de Document AI

**⚠️ Tip:** Configura alertas de billing en Google Cloud para no tener sorpresas.

---

## 📚 Archivos Creados/Modificados

**Nuevos archivos:**
- `backend/src/services/documentAIProcessor.js` - Servicio principal
- `backend/.env.documentai.example` - Ejemplo de configuración
- `GUIA-SETUP-DOCUMENT-AI.md` - Guía de configuración
- `INSTRUCCIONES-FINALES-DOCUMENT-AI.md` - Este archivo

**Archivos modificados:**
- `backend/src/lib/documentProcessor.js` - Agregado import y soporte
- `backend/src/services/documentExtractionOrchestrator.js` - Integrado en pipeline
- `backend/src/routes/documentos.js` - Pasa filePath al orquestador
- `backend/package.json` - Agregada dependencia @google-cloud/documentai

---

## 🆘 Ayuda

**Si tienes problemas:**

1. **Verificar logs del backend:**
   ```bash
   pm2 logs parse-backend
   # O si estás en dev:
   # Ver consola donde corre npm run dev
   ```

2. **Verificar configuración:**
   ```bash
   cd backend
   node -e "console.log(process.env.DOCUMENT_AI_PROJECT_ID)"
   node -e "console.log(process.env.DOCUMENT_AI_PROCESSOR_ID)"
   ```

3. **Test de conexión:**
   ```bash
   cd backend
   node -e "
   const processor = require('./src/services/documentAIProcessor');
   console.log('Configurado:', processor.isConfigured());
   "
   ```

4. **Ver detalles del error:**
   - Revisa logs completos del backend
   - Copia el error completo
   - Busca en: https://cloud.google.com/document-ai/docs/troubleshooting

---

## 🚀 Próximos Pasos (Opcionales)

Una vez que funcione:

1. **Entrenar Custom Processor** ($300-500 one-time)
   - Sube 500-1000 de tus facturas
   - Google las etiqueta y entrena
   - Aumenta precisión a 98%+

2. **Configurar Alertas de Billing**
   - Google Cloud Console → Billing → Budgets & Alerts
   - Alerta al 50%, 75%, 100% del presupuesto

3. **Monitorear Métricas**
   - Confianza promedio
   - Tasa de error
   - Tiempo de procesamiento

4. **Desactivar Gemini** (opcional)
   - Si Document AI funciona perfecto
   - Puedes quitar la API key de Gemini
   - Ahorras los ~$2/mes de Gemini

---

**¿Listo?** Sigue los 6 pasos de arriba y avísame cuando hayas terminado para ayudarte a probar!
