# 📄 Plan de Implementación - Importación de Resúmenes PDF de Tarjetas de Crédito

## 🎯 Objetivo
Implementar un sistema híbrido para importar resúmenes de tarjetas de crédito en formato PDF, con detección automática de banco y templates específicos.

## 🏗️ Arquitectura

```
┌─────────────────┐
│   PDF Upload    │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Detección Banco │ ← Analiza logos, texto clave, formato
└────────┬────────┘
         ↓
    ¿Banco detectado?
         │
    ┌────┴────┐
    │ SI   NO │
    ↓         ↓
┌──────────┐  ┌──────────────┐
│ Template │  │ Extracción   │
│Específico│  │ Genérica IA  │
└────┬─────┘  └──────┬───────┘
     └────────┬───────┘
              ↓
     ┌────────────────┐
     │   Validación   │
     │   de Datos     │
     └────────┬───────┘
              ↓
     ┌────────────────┐
     │    Preview     │
     │   para User    │
     └────────┬───────┘
              ↓
     ┌────────────────┐
     │   Importación  │
     │   a BD         │
     └────────────────┘
```

## 📋 FASE 1: Sistema Base

### 1.1 Infraestructura PDF
- [ ] Instalar `pdf-parse` para extracción de texto
- [ ] Configurar endpoint `/api/dkt/import-pdf`
- [ ] Adaptar tabla `resumen_tarjeta` para origen PDF
- [ ] Agregar campo `origen` ('DKT'|'PDF'|'MANUAL')

### 1.2 Detector de Banco
```javascript
// backend/src/utils/bankDetector.js
const detectBank = (pdfText) => {
  const patterns = {
    'SANTANDER': /banco santander|santander río/i,
    'BBVA': /bbva|francés/i,
    'GALICIA': /banco galicia|galicia/i,
    'ICBC': /icbc|industrial/i,
    // ... más bancos
  };

  // Detectar por texto
  for (const [bank, pattern] of Object.entries(patterns)) {
    if (pattern.test(pdfText)) return bank;
  }

  return 'UNKNOWN';
};
```

### 1.3 Framework de Templates
```javascript
// backend/src/templates/creditCardTemplates.js
const templates = {
  'SANTANDER': {
    periodo: /Período:\s*(\d{2}\/\d{2}\/\d{4})/,
    numeroTarjeta: /Tarjeta N°.*?(\d{4})/,
    transacciones: {
      pattern: /(\d{2}\/\d{2})\s+(.*?)\s+\$?\s*([\d,]+\.\d{2})/g,
      fields: ['fecha', 'descripcion', 'importe']
    }
  },
  // ... más templates
};
```

### 1.4 Procesador Principal
```javascript
// backend/src/services/pdfProcessor.js
class PDFProcessor {
  async process(pdfBuffer) {
    // 1. Extraer texto
    const text = await pdfParse(pdfBuffer);

    // 2. Detectar banco
    const bank = detectBank(text);

    // 3. Aplicar template o IA
    let data;
    if (templates[bank]) {
      data = applyTemplate(text, templates[bank]);
    } else {
      data = await extractWithAI(text);
    }

    // 4. Validar y normalizar
    return validateAndNormalize(data);
  }
}
```

## 📋 FASE 2: Templates Específicos

### 2.1 Template Santander
- [ ] Mapear estructura del PDF
- [ ] Crear expresiones regulares para:
  - Encabezado (período, tarjeta, titular)
  - Detalle de consumos
  - Resumen de cuenta
  - Pagos y saldos

### 2.2 Template BBVA
- [ ] Análisis de formato BBVA
- [ ] Patrones específicos
- [ ] Manejo de múltiples tarjetas

### 2.3 Template Galicia
- [ ] Estructura específica
- [ ] Campos adicionales

## 📋 FASE 3: IA Fallback

### 3.1 Prompt para Gemini
```javascript
const aiPrompt = `
Analiza este resumen de tarjeta de crédito y extrae:
1. Período de facturación (formato: YYYYMM)
2. Número de tarjeta (últimos 4 dígitos)
3. Lista de transacciones con:
   - Fecha (DD/MM)
   - Descripción del comercio
   - Importe
4. Total del resumen

Responde SOLO en JSON con esta estructura:
{
  "periodo": "202501",
  "numeroTarjeta": "1234",
  "transacciones": [
    {
      "fecha": "15/01",
      "descripcion": "SUPERMERCADO X",
      "importe": 1500.50
    }
  ],
  "total": 15000.00
}
`;
```

### 3.2 Validación IA
- [ ] Verificar estructura JSON
- [ ] Validar tipos de datos
- [ ] Detectar anomalías
- [ ] Solicitar confirmación usuario si confianza < 80%

## 🎨 FASE 4: Interfaz de Usuario

### 4.1 Componente Upload
```tsx
// Modificar DktImportPage para aceptar PDFs
<input
  type="file"
  accept=".csv,.txt,.pdf"
  onChange={handleFileUpload}
/>
```

### 4.2 Preview Component
```tsx
// Nuevo componente para revisar datos extraídos
<PDFPreview
  data={extractedData}
  onConfirm={handleImport}
  onEdit={handleManualEdit}
/>
```

### 4.3 Editor Manual
- [ ] Tabla editable para corregir errores
- [ ] Agregar/eliminar transacciones
- [ ] Validación en tiempo real

## 🗂️ Base de Datos

### Modificaciones necesarias:
```sql
-- Agregar campo origen
ALTER TABLE resumen_tarjeta
ADD COLUMN origen VARCHAR(10) DEFAULT 'DKT';

-- Agregar metadata del procesamiento
ALTER TABLE resumen_tarjeta
ADD COLUMN pdf_metadata JSON;

-- Índice para búsquedas
CREATE INDEX idx_resumen_origen ON resumen_tarjeta(origen);
```

## 🧪 Testing

### Test Cases:
1. **PDF válido banco conocido** → Template específico
2. **PDF válido banco desconocido** → IA fallback
3. **PDF corrupto** → Error controlado
4. **PDF sin texto (imagen)** → OCR + procesamiento
5. **Múltiples tarjetas** → Separación correcta
6. **Formato inesperado** → Validación manual

## 📊 Métricas de Éxito

- **Precisión**: > 95% en bancos con template
- **Velocidad**: < 5 seg por PDF
- **Cobertura**: 5 bancos principales
- **UX**: < 3 clicks para importar

## 🚀 Orden de Implementación

1. **Semana 1**: Sistema base + 1 banco (Santander)
2. **Semana 2**: 2 bancos más + refinamiento
3. **Semana 3**: IA fallback + validación
4. **Semana 4**: UI completa + testing

## 📝 Notas Técnicas

- **Seguridad**: PDFs se procesan en memoria, no se almacenan
- **Performance**: Procesar en background para PDFs grandes
- **Caché**: Guardar templates procesados para re-importación
- **Logs**: Registrar todos los procesamientos para debugging

## 🔧 Dependencias Necesarias

```json
{
  "pdf-parse": "^1.1.1",  // Ya instalado ✓
  "tesseract.js": "^6.0.1", // Ya instalado ✓
  "sharp": "^0.34.3" // Ya instalado ✓
}
```

## 🎯 Criterios de Aceptación

- [ ] Usuario puede subir PDF de resumen
- [ ] Sistema detecta banco automáticamente
- [ ] Datos se extraen con > 95% precisión
- [ ] Preview muestra datos antes de confirmar
- [ ] Importación genera items de rendición
- [ ] Errores se manejan gracefully
- [ ] Proceso es más rápido que captura manual

---

**LISTO PARA IMPLEMENTAR** ✅

Cuando digas "arrancamos", comenzamos con la Fase 1.