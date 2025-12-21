# Análisis Comparativo de Seguridad - Competidores

**Fecha de análisis:** 15 de Diciembre 2025
**Objetivo:** Comparar postura de seguridad de Syncro vs competidores del mercado

---

## Resumen Ejecutivo

| Empresa | Tipo | Certificaciones | Nivel Seguridad |
|---------|------|-----------------|-----------------|
| **Esker** | Enterprise Global | SOC 1/2 Type II, ISO 27001, ISO 9001 | ⭐⭐⭐⭐⭐ |
| **Cobranzas.com** | Regional | No publicadas | ⭐⭐⭐ |
| **T&E Express** | Fintech Argentina | No publicadas | ⭐⭐⭐ |
| **Syncro** | Regional | En desarrollo | ⭐⭐½ |

---

## Análisis Detallado por Competidor

### 1. Esker (esker.com)

**Perfil:**
- Empresa francesa cotizada en Euronext Paris (ESKI)
- Soluciones de automatización de procesos documentales
- Presencia global

**Certificaciones de Seguridad:**
| Certificación | Estado | Auditor |
|---------------|--------|---------|
| SOC 1 Type 2 | ✅ Certificado | A-lign |
| SOC 2 Type 2 | ✅ Certificado | A-lign |
| ISO 27001 | ✅ Certificado | A-lign |
| ISO 9001 | ✅ Certificado | - |

**Controles Documentados:**
- Conexiones encriptadas
- Firewalls redundantes
- Antivirus sistemático
- Múltiples capas de autenticación
- Exige ISO 27001 o SOC a proveedores

**Trust Center:** Sí (público)

**Fuentes:**
- https://www.esker.com/technology-solutions/security/
- https://www.esker.com/company/press-releases/esker-achieves-iso-270012013-certification/

**Conclusión:** Benchmark de la industria para compliance enterprise.

---

### 2. Cobranzas.com

**Perfil:**
- Plataforma de gestión de pagos y cobranzas
- Opera en 23 países
- +150 clientes corporativos
- +200 clientes totales
- 10 millones de pagos anuales informados

**Certificaciones de Seguridad:**
| Certificación | Estado |
|---------------|--------|
| SOC 2 | ❓ No publicado |
| ISO 27001 | ❓ No publicado |
| Auditorías | ⚠️ "Respaldado por auditorías internacionales" (sin especificar) |

**Controles Documentados:**
- Monitoreo 24/7 (automático y manual)
- Disponibilidad 24/7
- Cumplimiento Ley 27.440 (Argentina)
- Integración con SAP, Oracle, JD Edwards

**Trust Center:** No

**Fuentes:**
- https://www.cobranzas.com

**Conclusión:** Claims de seguridad sin certificaciones verificables públicamente.

---

### 3. T&E Express (tyeexpress.com)

**Perfil:**
- Fintech argentina especializada en Travel & Expense
- Única solución T&E de Sudamérica con alianza BBVA
- Ganador Visa-Finnovista (mejor startup fintech Argentina/Uruguay 2017)
- Partner de BDO (firma global de auditoría)
- Reconocido en Fintech Radar Argentina (Finnovista)

**Certificaciones de Seguridad:**
| Certificación | Estado |
|---------------|--------|
| SOC 2 | ❓ No publicado |
| ISO 27001 | ❓ No publicado |
| Auditorías externas | ❓ No documentado |

**Controles Documentados:**
- No hay página de seguridad pública
- No hay Trust Center
- No documentan MFA, cifrado ni controles específicos

**Tecnología:**
- Magic Scan: IA con 88%+ efectividad en OCR
- Bot de Telegram con IA
- Integración SAP, Oracle, JDE
- Integración tarjetas VISA, AMEX, Mastercard

**Alianzas Estratégicas:**
- **BBVA** - Alianza internacional (credibilidad implícita)
- **BDO** - Partner de auditoría y consultoría

**Reconocimientos:**
- Visa Everywhere Initiative - Semifinalista Argentina (2017)
- Buenos Aires Emprende (2011)
- Fintech Radar Argentina (Finnovista)

**Fuentes:**
- https://tyeexpress.com
- https://tyeexpress.com/blog/archive/2019/08/05/te-express-en-el-nuevo-mapa-de-fintech-finnovating

**Conclusión:** Credibilidad por alianzas (BBVA/BDO) pero sin transparencia en seguridad.

---

## Matriz Comparativa Completa

### Certificaciones y Compliance

| Aspecto | Esker | Cobranzas.com | T&E Express | Syncro |
|---------|-------|---------------|-------------|--------|
| SOC 2 Type II | ✅ | ❓ | ❓ | ❌ |
| SOC 1 Type II | ✅ | ❓ | ❓ | ❌ |
| ISO 27001 | ✅ | ❓ | ❓ | ❌ |
| ISO 9001 | ✅ | ❓ | ❓ | ❌ |
| Trust Center público | ✅ | ❌ | ❌ | ❌ |
| Auditorías documentadas | ✅ A-lign | ⚠️ Claims | ❌ | ❌ |

### Controles Técnicos

| Control | Esker | Cobranzas.com | T&E Express | Syncro |
|---------|-------|---------------|-------------|--------|
| MFA | ✅ Múltiples capas | ❓ | ❓ | ❌ (planificado) |
| Cifrado en tránsito | ✅ | ❓ | ❓ | ✅ Helmet/TLS |
| Cifrado en reposo | ✅ | ❓ | ❓ | ✅ AES-256-GCM |
| RBAC | ✅ | ❓ | ❓ | ✅ |
| Rate Limiting | ✅ | ❓ | ❓ | ✅ |
| Logging centralizado | ✅ | ❓ | ❓ | ❌ (planificado) |
| IRP documentado | ✅ | ❓ | ❓ | ❌ (planificado) |

### Credibilidad y Mercado

| Aspecto | Esker | Cobranzas.com | T&E Express | Syncro |
|---------|-------|---------------|-------------|--------|
| Años en mercado | +35 años | +10 años | +10 años | <5 años |
| Cotiza en bolsa | ✅ Euronext | ❌ | ❌ | ❌ |
| Alianzas bancarias | - | - | ✅ BBVA | ❌ |
| Partner Big 4/Audit | - | - | ✅ BDO | ❌ |
| Premios fintech | - | - | ✅ Visa-Finnovista | ❌ |
| Clientes enterprise | ✅ Global | ✅ Regional | ✅ Regional | En desarrollo |
| Países de operación | Global | 23 | LATAM | Argentina |

### Infraestructura

| Aspecto | Esker | Cobranzas.com | T&E Express | Syncro |
|---------|-------|---------------|-------------|--------|
| Cloud Provider | Propio + Partners | ❓ | ❓ | Digital Ocean |
| Certificación infra | SOC 2 | ❓ | ❓ | DO SOC 2 Type II |
| Backups documentados | ✅ | ❓ | ❓ | ⚠️ Via DO |
| DR/BCP | ✅ | ❓ | ❓ | ❌ |

---

## Análisis de Brechas - Syncro vs Competidores

### Para alcanzar nivel Cobranzas.com / T&E Express

| Brecha | Esfuerzo | Impacto |
|--------|----------|---------|
| Implementar MFA | Medio | Alto |
| Documentar IRP | Bajo | Alto |
| Crear Trust Center público | Bajo | Medio |
| Logging centralizado | Medio | Alto |

### Para alcanzar nivel Esker

| Brecha | Esfuerzo | Costo Estimado |
|--------|----------|----------------|
| ISO 27001 | 6-12 meses | $15,000-30,000 USD |
| SOC 2 Type II | 6-9 meses | $20,000-50,000 USD |
| Trust Center completo | 2-4 semanas | $2,000-5,000 USD |
| Pentest anual | 4 semanas | $3,000-8,000 USD |

---

## Ventajas Competitivas de Syncro

A pesar de las brechas, Syncro tiene fortalezas:

1. **Infraestructura certificada** - Digital Ocean tiene SOC 2 Type II e ISO 27001
2. **Controles técnicos sólidos** - RBAC, cifrado AES-256-GCM, rate limiting, Prisma ORM
3. **Arquitectura moderna** - Stack actual (Node.js, React, Prisma, PostgreSQL)
4. **Transparencia potencial** - Puede documentar controles que competidores no publican
5. **Agilidad** - Como empresa más pequeña, puede implementar cambios rápidamente

---

## Recomendaciones Estratégicas

### Corto Plazo (0-3 meses)
1. Implementar MFA → Igualar nivel implícito de competidores
2. Crear Trust Center público → Diferenciarse en transparencia
3. Documentar IRP → Requisito básico para seguros

### Mediano Plazo (3-6 meses)
1. Logging centralizado (SIEM)
2. Pentest profesional
3. Evaluar ISO 27001 readiness

### Largo Plazo (6-12 meses)
1. Certificación ISO 27001 (si mercado lo requiere)
2. SOC 2 Type II (para clientes enterprise/USA)

---

## Notas para Futuras Actualizaciones

- **Última actualización:** 15 de Diciembre 2025
- **Próxima revisión sugerida:** Marzo 2026
- **Fuentes a monitorear:**
  - Trust Centers de competidores
  - Noticias de certificaciones
  - Cambios regulatorios Argentina (AAIP)
  - Requisitos de aseguradoras de ciberriesgo

---

## Contactos de Competidores (para benchmarking)

| Empresa | Web | Contacto |
|---------|-----|----------|
| Esker | esker.com | Via web |
| Cobranzas.com | cobranzas.com | Via web |
| T&E Express | tyeexpress.com | info@tyeexpress.com / +54 11 7078-0323 |

---

*Documento generado para uso interno - Confidencial*
