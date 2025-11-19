# Guía: Configurar Billing en Google Cloud para Document AI

**Fecha:** 18 de Enero 2025
**Problema:** No se puede activar el billing en Google Cloud Console
**Objetivo:** Habilitar Document AI con billing correctamente configurado

---

## 🚨 Problema Común: "No puedo activar el billing"

### Causas Principales

1. **No tienes permisos de "Billing Administrator"**
2. **La cuenta de Google no está verificada**
3. **No hay método de pago agregado**
4. **La organización/proyecto tiene restricciones**
5. **La cuenta de Google Cloud es nueva (< 24 horas)**

---

## ✅ Solución Paso a Paso

### Paso 1: Verificar Permisos de la Cuenta

**1.1. Ir a Billing:**
```
https://console.cloud.google.com/billing
```

**1.2. Verificar si ves:**
- ✅ **Puedes ver "Mis cuentas de facturación"** → Tienes permisos ✓
- ❌ **Ves mensaje "No tienes permisos"** → Necesitas permisos de billing

**1.3. Si no tienes permisos:**

**Opción A: Si eres el dueño de la cuenta Google Cloud**
```
1. Ir a: https://console.cloud.google.com/iam-admin/iam
2. Buscar tu email
3. Hacer clic en el lápiz (editar)
4. Agregar rol: "Billing Account Administrator"
5. Guardar
6. Esperar 1-2 minutos y recargar página
```

**Opción B: Si la cuenta es de una organización**
```
Necesitas que un administrador de la organización te otorgue permisos:
- Rol: "Billing Account Administrator"
- O pedir que ellos configuren el billing
```

---

### Paso 2: Crear o Vincular Cuenta de Facturación

**2.1. Ir a Billing:**
```
https://console.cloud.google.com/billing
```

**2.2. Hacer clic en "CREATE ACCOUNT" o "CREAR CUENTA DE FACTURACIÓN"**

**2.3. Completar información:**

```
┌─────────────────────────────────────────┐
│ Crear cuenta de facturación             │
├─────────────────────────────────────────┤
│                                         │
│ Nombre de la cuenta:                    │
│ [Mi Cuenta Parse]                       │
│                                         │
│ País:                                   │
│ [Argentina] ← Seleccionar tu país      │
│                                         │
│ Tipo de cuenta:                         │
│ ( ) Individual                          │
│ (•) Empresa ← Recomendado              │
│                                         │
│ Información de facturación:             │
│ [Tu información fiscal]                 │
│                                         │
│ Método de pago:                         │
│ [+ Agregar tarjeta de crédito/débito]  │
│                                         │
└─────────────────────────────────────────┘
```

---

### Paso 3: Agregar Método de Pago

**3.1. ¿Qué métodos acepta Google Cloud?**

**✅ Aceptados:**
- Tarjeta de crédito (Visa, Mastercard, American Express)
- Tarjeta de débito internacional (debe tener autorización para pagos online)
- Cuenta bancaria (según país)

**❌ NO aceptados:**
- Tarjetas prepagas sin autorización internacional
- Tarjetas virtuales de un solo uso
- Cuentas PayPal directamente

**3.2. Pasos para agregar tarjeta:**

```
1. Hacer clic en "Agregar método de pago"
2. Ingresar datos de la tarjeta:
   - Número de tarjeta (16 dígitos)
   - Fecha de vencimiento (MM/AA)
   - CVV (3-4 dígitos)
   - Nombre del titular
   - Dirección de facturación
3. Google hará un cargo de verificación de $1 USD
   (Se reembolsa automáticamente)
4. Esperar confirmación (1-2 minutos)
```

---

### Paso 4: Verificar la Cuenta

**4.1. Verificación de identidad (si es necesario):**

Google puede pedir verificación adicional si:
- Es tu primera cuenta de Google Cloud
- El país tiene requisitos de verificación
- El método de pago es nuevo

**Documentos que pueden pedir:**
- DNI/Pasaporte
- Comprobante de domicilio
- CUIT/RUT (si eres empresa)

**¿Cómo verificar?**
```
1. Google enviará email con instrucciones
2. Subir fotos de los documentos
3. Esperar aprobación (1-3 días hábiles)
```

---

### Paso 5: Vincular Proyecto con Cuenta de Facturación

**5.1. Ir a tu proyecto:**
```
https://console.cloud.google.com/home/dashboard
```

**5.2. Ver el proyecto actual:**
- Arriba a la izquierda verás el nombre del proyecto
- Hacer clic para cambiar proyecto si es necesario

**5.3. Vincular billing:**

```
Opción A - Desde el Dashboard:
1. Verás un banner amarillo: "Este proyecto no tiene una cuenta de facturación"
2. Hacer clic en "Vincular cuenta de facturación"
3. Seleccionar la cuenta que creaste
4. Confirmar

Opción B - Desde Configuración del Proyecto:
1. Ir a: https://console.cloud.google.com/billing/linkedaccount
2. Hacer clic en "VINCULAR CUENTA DE FACTURACIÓN"
3. Seleccionar cuenta
4. Hacer clic en "ESTABLECER CUENTA"
```

---

## 🐛 Troubleshooting - Errores Comunes

### Error 1: "No se puede crear cuenta de facturación"

**Causas posibles:**
- Email no verificado
- Cuenta de Google muy nueva (< 24 horas)
- País no soportado para billing

**Solución:**
```
1. Verificar email en: https://myaccount.google.com/
2. Esperar 24 horas si la cuenta es muy nueva
3. Usar cuenta de Google existente con historial
```

---

### Error 2: "Tarjeta rechazada" o "No se puede agregar método de pago"

**Causas posibles:**
- Tarjeta sin autorización para pagos internacionales
- Límite de tarjeta alcanzado
- Banco bloqueando el pago

**Solución:**
```
1. Llamar a tu banco y autorizar pagos a "Google Cloud"
2. Verificar que la tarjeta tenga al menos $1 USD disponible
3. Asegurarse de que la tarjeta sea internacional
4. Probar con otra tarjeta si es posible
5. Habilitar "pagos online" o "comercio electrónico" en tu banco
```

**Bancos argentinos que suelen funcionar:**
- ✅ Santander (Visa/Mastercard)
- ✅ Galicia (Visa)
- ✅ BBVA (Mastercard)
- ✅ Brubank (Mastercard)
- ⚠️ Mercado Pago (puede tener restricciones)

---

### Error 3: "Este proyecto ya tiene una cuenta de facturación, pero está suspendida"

**Causa:** Hubo un problema previo con el pago

**Solución:**
```
1. Ir a: https://console.cloud.google.com/billing
2. Hacer clic en la cuenta suspendida
3. Ver la razón de suspensión
4. Resolver el problema (agregar método de pago válido)
5. Hacer clic en "REACTIVAR CUENTA"
```

---

### Error 4: "No puedes activar Document AI API"

**Causa:** El billing no está correctamente vinculado

**Solución:**
```
1. Ir a: https://console.cloud.google.com/apis/library/documentai.googleapis.com
2. Verificar que el proyecto correcto esté seleccionado (arriba)
3. Si ves "Billing no habilitado", hacer clic en el link
4. Vincular cuenta de facturación
5. Esperar 1-2 minutos y recargar
6. Hacer clic en "ENABLE" o "HABILITAR"
```

---

## 🎯 Verificación: ¿Está todo correcto?

### Checklist

- [ ] Puedo acceder a https://console.cloud.google.com/billing sin errores
- [ ] Veo mi cuenta de facturación creada
- [ ] La cuenta tiene estado "Activa" (verde)
- [ ] Hay un método de pago válido agregado
- [ ] Mi proyecto está vinculado a la cuenta de facturación
- [ ] Puedo habilitar Document AI API sin errores

**Si todos los checks están ✅, estás listo para continuar con Document AI**

---

## 💰 Costos y Créditos

### Crédito Gratuito de Google Cloud

**Si eres nuevo en Google Cloud:**
- ✅ $300 USD de crédito gratis por 90 días
- ✅ 1000 páginas gratis de Document AI por mes (siempre)
- ✅ Muchos servicios tienen nivel gratuito permanente

**Para activar los $300 USD:**
```
1. Crear cuenta de facturación
2. Agregar método de pago (requerido, pero no se cobrará)
3. Los $300 se acreditan automáticamente
4. Válidos por 90 días
```

### Costos de Document AI (después del tier gratis)

| Servicio | Gratis/mes | Costo adicional |
|----------|------------|-----------------|
| **Invoice Parser** | 1000 páginas | $0.06/página |
| **Form Parser** | 1000 páginas | $0.06/página |
| **OCR** | 1000 páginas | $0.015/página |

**Ejemplo de costo real:**
- 1000 documentos/mes = 1000 páginas
- Primeras 1000 gratis = $0
- Si procesas 2000/mes = 1000 gratis + 1000 pagadas = $60 USD/mes

**Comparación con Gemini actual:**
- Gemini: ~$0.001-0.003 por documento
- Document AI: ~$0.06 por página (pero 95% precisión)
- **Recomendación:** Usar Document AI solo para documentos complejos

---

## 🔧 Alternativa: Usar Cuenta de Facturación Existente

Si ya tienes Google Cloud en otra cuenta/proyecto:

```
1. Ir a: https://console.cloud.google.com/billing
2. Ver "Mis cuentas de facturación"
3. Hacer clic en cuenta existente
4. Ir a "Proyectos vinculados"
5. Hacer clic en "VINCULAR PROYECTO"
6. Seleccionar tu proyecto de Parse
7. Confirmar
```

---

## 📞 Soporte de Google Cloud

Si nada funciona, contactar soporte:

**Opción 1: Chat en vivo (recomendado)**
```
1. Ir a: https://console.cloud.google.com/
2. Hacer clic en "?" (arriba a la derecha)
3. Seleccionar "Contactar con soporte"
4. Elegir "Facturación"
5. Describir el problema
```

**Opción 2: Foros de la comunidad**
```
https://www.googlecloudcommunity.com/
```

**Opción 3: Twitter/X**
```
@googlecloud (responden rápido)
```

---

## 📝 Próximo Paso: Configurar Document AI

Una vez que tengas el billing funcionando:

**Siguiente guía:**
- `GOOGLE-DOCUMENT-AI-SETUP.md` (por crear)

**Pasos principales:**
1. Habilitar Document AI API
2. Crear procesador "Invoice Parser"
3. Descargar credenciales JSON
4. Configurar en backend
5. Probar con documento de ejemplo

---

## ✅ Resumen de Pasos

1. **Crear cuenta de facturación** en https://console.cloud.google.com/billing
2. **Agregar método de pago** (tarjeta de crédito/débito)
3. **Verificar cuenta** (si es necesario)
4. **Vincular proyecto** con cuenta de facturación
5. **Habilitar Document AI API**
6. **Verificar** que todo funciona

**Tiempo estimado:** 10-20 minutos (si no hay problemas con verificación)

---

**¿Necesitas ayuda adicional con algún paso específico?**

Escríbeme exactamente qué error ves y te ayudo a resolverlo.
