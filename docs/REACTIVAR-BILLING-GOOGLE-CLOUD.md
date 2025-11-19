# Guía: Reactivar Cuenta de Facturación Cerrada en Google Cloud

**Problema:** Todas las cuentas de facturación están cerradas
**Solución:** Reactivar cuenta existente o crear una nueva

---

## 🚨 Paso 1: Ver Por Qué Está Cerrada

### 1.1. Ir a Billing:
```
https://console.cloud.google.com/billing
```

### 1.2. Hacer clic en cada cuenta cerrada:
- Verás el nombre de la cuenta (ej: "Axioma", "AxiomaCloud", etc.)
- Hacer clic en el nombre

### 1.3. Ver la razón del cierre:
Busca un mensaje como:
- ❌ "Método de pago inválido"
- ❌ "Tarjeta vencida"
- ❌ "Pago rechazado"
- ❌ "Cuenta suspendida por verificación"

---

## ✅ Paso 2: Reactivar la Cuenta

### Opción A: Si el problema es el método de pago

**2.1. Dentro de la cuenta cerrada, buscar "Métodos de pago"**

**2.2. Ver métodos de pago actuales:**
```
Métodos de pago → Administrar métodos de pago
```

**2.3. Eliminar métodos vencidos/inválidos:**
- Hacer clic en los 3 puntos (...) junto al método problemático
- Seleccionar "Eliminar"

**2.4. Agregar nuevo método de pago:**
```
1. Hacer clic en "+ AGREGAR MÉTODO DE PAGO"
2. Ingresar datos de tarjeta válida:
   - Número de tarjeta (16 dígitos)
   - Vencimiento (MM/AA)
   - CVV (3 dígitos)
   - Nombre del titular
   - Dirección de facturación
3. Hacer clic en "GUARDAR"
4. Google hará cargo de verificación $1 USD
```

**2.5. Reactivar la cuenta:**
```
1. Volver a la página principal de la cuenta de facturación
2. Buscar botón "REACTIVAR CUENTA" o "REACTIVATE ACCOUNT"
3. Hacer clic
4. Confirmar
5. Esperar 1-2 minutos
```

---

### Opción B: Si no ves cómo reactivar

**Crear nueva cuenta de facturación:**

```
1. Ir a: https://console.cloud.google.com/billing
2. Hacer clic en "+ CREAR CUENTA DE FACTURACIÓN"
3. Completar formulario:

   Nombre de la cuenta: [AxiomaParse]
   País: [Argentina]
   Tipo de cuenta: [Empresa]

4. Agregar información fiscal (CUIT si tienes)
5. Agregar método de pago nuevo
6. Hacer clic en "CREAR"
```

---

## 🔧 Paso 3: Vincular Proyecto con Cuenta Activa

### 3.1. Una vez que la cuenta está activa:

**Ir al proyecto:**
```
https://console.cloud.google.com/home/dashboard?project=axioma-parse
```

**3.2. Vincular billing:**
```
1. Verás banner amarillo: "Este proyecto no tiene cuenta de facturación"
2. Hacer clic en "Vincular cuenta de facturación"
3. Seleccionar la cuenta que reactivaste o creaste
4. Hacer clic en "ESTABLECER CUENTA"
5. Esperar 1-2 minutos
```

**3.3. Verificar:**
```
Ir a: https://console.cloud.google.com/billing/linkedaccount
Deberías ver tu cuenta vinculada con estado "Activa"
```

---

## 💳 Método de Pago: Recomendaciones

### Tarjetas que funcionan bien en Argentina:

| Banco | Tipo | ¿Funciona? | Notas |
|-------|------|-----------|-------|
| **Santander** | Visa/Mastercard | ✅ Excelente | Autorizar "pagos internacionales" |
| **Galicia** | Visa | ✅ Muy bien | Habilitar comercio electrónico |
| **BBVA** | Mastercard | ✅ Bien | Puede pedir autorización por SMS |
| **Brubank** | Mastercard | ✅ Bien | Usar la física, no la virtual |
| **Mercado Pago** | Mastercard | ⚠️ A veces | Puede tener restricciones |
| **Naranja** | Naranja | ❌ No | No es internacional |

### Antes de agregar la tarjeta:

**Llamar a tu banco y decir:**
```
"Hola, necesito autorizar pagos internacionales a GOOGLE CLOUD o GOOGLE IRELAND.
Voy a hacer un pago de prueba de $1 USD"
```

**Verificar que la tarjeta tenga:**
- ✅ Habilitados "pagos online" o "e-commerce"
- ✅ Habilitados "pagos internacionales"
- ✅ Al menos $5-10 USD de saldo disponible
- ✅ Fecha de vencimiento vigente (no vencida)

---

## 🐛 Troubleshooting

### Problema 1: "No puedo reactivar, no veo el botón"

**Solución:**
```
Crear cuenta de facturación nueva en vez de reactivar.
Es más rápido y evita problemas antiguos.
```

---

### Problema 2: "Tarjeta sigue siendo rechazada"

**Solución:**
```
1. Verificar con el banco que el pago no esté bloqueado
2. Ver en homebanking si aparece intento de pago de Google
3. Autorizar ese comercio en el homebanking
4. Reintentar en Google Cloud
```

**Bancos que suelen bloquear (autorizar manualmente):**
- BBVA → Autorizar en app móvil
- Santander → Llamar y autorizar "Google Cloud"
- Galicia → Habilitar en homebanking "Compras en el exterior"

---

### Problema 3: "Google pide verificación de identidad"

**Documentos que puede pedir:**
- DNI (frente y dorso)
- CUIT (si eres empresa)
- Comprobante de domicilio

**Proceso:**
```
1. Google enviará email con link de verificación
2. Subir fotos claras de los documentos
3. Esperar aprobación (1-3 días hábiles)
4. Recibirás email cuando esté verificado
```

---

### Problema 4: "La cuenta se cierra sola después de reactivar"

**Causa:** Método de pago sigue siendo inválido

**Solución:**
```
1. Eliminar TODOS los métodos de pago antiguos
2. Agregar método de pago completamente nuevo
3. Llamar al banco y preautorizar
4. Reactivar cuenta
5. Hacer un cargo de prueba (ej: habilitar una API)
```

---

## ✅ Checklist de Reactivación

- [ ] Ir a https://console.cloud.google.com/billing
- [ ] Ver por qué cada cuenta está cerrada
- [ ] Eliminar métodos de pago vencidos/inválidos
- [ ] Agregar método de pago nuevo y válido
- [ ] Verificar con banco que pagos estén autorizados
- [ ] Reactivar cuenta (o crear nueva si no es posible)
- [ ] Vincular proyecto con cuenta activa
- [ ] Verificar que el proyecto muestre "Billing: Enabled"
- [ ] Probar habilitar Document AI API

---

## 💰 Costos y Créditos

### ¿Cuánto cuesta reactivar?

**Gratis** si:
- Solo reactivas sin deuda pendiente
- Agregas método de pago válido

**Puede haber cobro** si:
- Tenías servicios corriendo que generaron deuda
- Hay pagos pendientes de meses anteriores

### Crédito de $300 USD

**Si la cuenta es nueva:**
- ✅ $300 USD gratis por 90 días
- ✅ No se cobran hasta que lo gastes

**Si reactivas cuenta antigua:**
- ❌ No recibes $300 USD nuevamente
- ✅ Pero Document AI tiene 1000 páginas gratis/mes siempre

---

## 📞 Soporte Google Cloud

Si nada funciona:

**Chat en vivo (24/7):**
```
1. Ir a: https://console.cloud.google.com/
2. Hacer clic en "?" arriba a la derecha
3. Seleccionar "Contactar con soporte"
4. Categoría: "Facturación"
5. Describir: "Necesito reactivar cuenta de facturación cerrada"
```

**Tiempo de respuesta:** 5-15 minutos

---

## 🎯 Próximos Pasos

Una vez que tengas billing activo:

1. ✅ Habilitar Document AI API
2. ✅ Crear procesador "Invoice Parser"
3. ✅ Descargar credenciales
4. ✅ Configurar en backend Parse

---

**¡Mucha suerte con la reactivación!**

Si tienes problemas, avísame y te ayudo en tiempo real.
