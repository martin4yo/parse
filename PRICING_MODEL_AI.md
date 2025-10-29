# Modelo de Cotización - Sistema de Rendiciones con IA

## 📊 Costos de Motores de IA (Diciembre 2024)

### 1. **Google Gemini** (Más económico para empezar)

#### Gemini 1.5 Flash
- **Gratis**: 15 RPM / 1 millón tokens/mes / 1,500 requests/día
- **Pago**: $0.075 por millón de tokens entrada
- **Pago**: $0.30 por millón de tokens salida

#### Gemini 1.5 Pro
- **Gratis**: 2 RPM / 50 requests/día
- **Pago**: $1.25 por millón tokens entrada (≤128K)
- **Pago**: $5.00 por millón tokens salida

**Cálculo para tu app:**
- Promedio por documento: ~2,000 tokens entrada, ~500 tokens salida
- **Costo por documento**: $0.00015 + $0.00015 = **$0.0003 USD**
- **1,000 documentos**: **$0.30 USD**

### 2. **OpenAI GPT** (Más popular)

#### GPT-3.5 Turbo
- **Entrada**: $0.50 por millón de tokens
- **Salida**: $1.50 por millón de tokens
- **Costo por documento**: **$0.002 USD**
- **1,000 documentos**: **$2 USD**

#### GPT-4 Turbo
- **Entrada**: $10 por millón de tokens
- **Salida**: $30 por millón de tokens
- **Costo por documento**: **$0.035 USD**
- **1,000 documentos**: **$35 USD**

#### GPT-4o (Optimizado)
- **Entrada**: $2.50 por millón de tokens
- **Salida**: $10 por millón de tokens
- **Costo por documento**: **$0.01 USD**
- **1,000 documentos**: **$10 USD**

### 3. **Anthropic Claude** (Mejor para documentos)

#### Claude 3 Haiku (Rápido y económico)
- **Entrada**: $0.25 por millón de tokens
- **Salida**: $1.25 por millón de tokens
- **Costo por documento**: **$0.0013 USD**
- **1,000 documentos**: **$1.30 USD**

#### Claude 3.5 Sonnet (Balance precio/calidad)
- **Entrada**: $3 por millón de tokens
- **Salida**: $15 por millón de tokens
- **Costo por documento**: **$0.014 USD**
- **1,000 documentos**: **$14 USD**

#### Claude 3 Opus (Máxima calidad)
- **Entrada**: $15 por millón de tokens
- **Salida**: $75 por millón de tokens
- **Costo por documento**: **$0.07 USD**
- **1,000 documentos**: **$70 USD**

### 4. **Ollama (LLaMA local)** (100% GRATIS)

#### Modelos Disponibles
- **Llama 3.2 (1B/3B)**: Ligero, rápido
- **Llama 3.1 (8B)**: Balance
- **Mistral (7B)**: Bueno para español
- **Mixtral (8x7B)**: Más preciso

**Requisitos de Hardware:**
- **Mínimo**: 8GB RAM (modelo 3B)
- **Recomendado**: 16GB RAM (modelo 7B)
- **Ideal**: GPU con 8GB VRAM

**Costos:**
- **Software**: $0
- **Hardware**: Único pago inicial o servidor con GPU

## 💰 Estructura de Precios Sugerida

### Plan 1: **BÁSICO** - Procesamiento Manual
```yaml
Precio: $29/mes por empresa
Incluye:
  - Usuarios ilimitados
  - Procesamiento manual
  - 100 documentos/mes con OCR básico
  - Sin IA
```

### Plan 2: **PROFESIONAL** - IA Económica
```yaml
Precio: $79/mes por empresa
Incluye:
  - Todo del plan Básico
  - 500 documentos/mes con IA
  - Motor: Gemini 1.5 Flash
  - Costo IA estimado: $0.15/mes
  - Margen: 99.8%
```

### Plan 3: **BUSINESS** - IA Premium
```yaml
Precio: $199/mes por empresa
Incluye:
  - Todo del plan Profesional
  - 2,000 documentos/mes con IA
  - Motor: GPT-3.5 Turbo o Claude Haiku
  - Costo IA estimado: $4/mes
  - Margen: 98%
```

### Plan 4: **ENTERPRISE** - IA Avanzada
```yaml
Precio: $499/mes por empresa
Incluye:
  - Documentos ilimitados
  - Motor: GPT-4o o Claude 3.5 Sonnet
  - Procesamiento prioritario
  - API access
  - Costo IA estimado: $20-50/mes (según uso)
  - Margen: 90-96%
```

### Plan 5: **ON-PREMISE** - Llama Local
```yaml
Precio: $2,999 único + $99/mes soporte
Incluye:
  - Instalación en servidor del cliente
  - Llama 3.2 local (sin costos de IA)
  - Documentos ilimitados
  - Privacidad total
```

## 📈 Análisis de Costos Reales

### Escenario: Empresa Mediana (500 documentos/mes)

| Motor IA | Costo/Doc | Costo Mensual | Precio Sugerido | Margen |
|----------|-----------|---------------|-----------------|--------|
| Gemini Flash | $0.0003 | $0.15 | $79 | 99.8% |
| GPT-3.5 | $0.002 | $1.00 | $79 | 98.7% |
| Claude Haiku | $0.0013 | $0.65 | $79 | 99.2% |
| GPT-4o | $0.01 | $5.00 | $199 | 97.5% |
| Claude Sonnet | $0.014 | $7.00 | $199 | 96.5% |
| Llama Local | $0 | $0 | $99 | 100% |

## 🎯 Estrategia de Implementación

### Fase 1: MVP (Mes 1-2)
```javascript
// Configuración inicial
const AI_CONFIG = {
  default: 'gemini', // Empezar con Gemini (gratis)
  fallback: 'local', // Fallback a regex si falla

  limits: {
    free: 50,        // 50 docs gratis con IA
    basic: 0,        // Sin IA
    professional: 500,
    business: 2000,
    enterprise: null // Ilimitado
  }
};
```

### Fase 2: Optimización (Mes 3-4)
```javascript
// Selector inteligente de motor
function selectAIEngine(document, tenant) {
  const plan = tenant.plan;
  const usage = tenant.aiUsageThisMonth;

  // Enterprise: usar el mejor disponible
  if (plan === 'enterprise') {
    return document.complexity > 0.7 ? 'gpt-4o' : 'claude-haiku';
  }

  // Business: balance costo/calidad
  if (plan === 'business') {
    return 'gpt-3.5-turbo';
  }

  // Professional: más económico
  if (plan === 'professional') {
    return usage < 450 ? 'gemini-flash' : 'regex-fallback';
  }

  return 'regex-fallback';
}
```

### Fase 3: Escala (Mes 5-6)
```javascript
// Cache de resultados para reducir costos
const cacheKey = generateHash(documentContent);
const cached = await redis.get(`ai:${cacheKey}`);

if (cached) {
  return cached; // $0 - sin costo adicional
}

const result = await processWithAI(document);
await redis.setex(`ai:${cacheKey}`, 86400, result); // 24h cache
```

## 💡 Recomendaciones para Maximizar Rentabilidad

### 1. **Empezar con Gemini**
- Usar el tier gratuito (1,500 docs/día gratis)
- Perfecto para los primeros 10-20 clientes
- Cambiar a pago solo cuando sea necesario

### 2. **Ofrecer Llama Local para Empresas Grandes**
- Sin costos recurrentes de IA
- Vender como "privacidad total"
- Cobrar más por la instalación y soporte

### 3. **Implementar Cache Inteligente**
```javascript
// Documentos similares comparten resultados
if (similarity(doc1, doc2) > 0.95) {
  return cachedResult; // Ahorro 100%
}
```

### 4. **Cobrar por Excedentes**
```javascript
const excedente = usage - plan.limit;
if (excedente > 0) {
  // Cobrar $0.10 por documento adicional
  const cargo = excedente * 0.10;
}
```

## 📊 Proyección de Ingresos

### Año 1 - 50 Clientes
| Plan | Clientes | Precio/mes | Ingreso | Costo IA | Ganancia |
|------|----------|------------|---------|----------|----------|
| Básico | 20 | $29 | $580 | $0 | $580 |
| Profesional | 20 | $79 | $1,580 | $3 | $1,577 |
| Business | 8 | $199 | $1,592 | $32 | $1,560 |
| Enterprise | 2 | $499 | $998 | $100 | $898 |
| **TOTAL** | **50** | - | **$4,750** | **$135** | **$4,615** |

**Margen Bruto: 97.2%**

### Año 2 - 200 Clientes
| Plan | Clientes | Ingreso Mensual | Costo IA | Ganancia |
|------|----------|-----------------|----------|----------|
| Básico | 50 | $1,450 | $0 | $1,450 |
| Profesional | 80 | $6,320 | $12 | $6,308 |
| Business | 50 | $9,950 | $200 | $9,750 |
| Enterprise | 20 | $9,980 | $1,000 | $8,980 |
| **TOTAL** | **200** | **$27,700** | **$1,212** | **$26,488** |

**Margen Bruto: 95.6%**

## 🚀 Ventaja Competitiva

### Flexibilidad Única
```javascript
// Tu app puede cambiar de motor según necesidad
const engines = {
  'factura-simple': 'gemini',      // Barato
  'factura-compleja': 'gpt-4o',    // Preciso
  'ticket-borroso': 'claude',      // Mejor con OCR
  'privado-sensible': 'llama'      // Local
};
```

### Propuesta de Valor
1. **"Paga solo lo que usas"** - Sin costos fijos de IA
2. **"Elige tu nivel de precisión"** - Básico a Premium
3. **"100% privado disponible"** - Opción Llama local
4. **"Sin vendor lock-in"** - Cambia de motor cuando quieras

¿Te parece bien este modelo? ¿Quieres que profundice en algún aspecto específico?