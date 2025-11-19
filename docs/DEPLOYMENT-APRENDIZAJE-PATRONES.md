# Deployment - Sistema de Aprendizaje de Patrones

**Fecha:** 17 de Enero 2025
**Versión:** 1.0
**Estado:** ✅ Listo para Producción

---

## ✅ Checklist Pre-Deployment

### Verificaciones Completadas

- [x] ✅ Prisma schema actualizado
- [x] ✅ Migración de base de datos aplicada
- [x] ✅ Prisma client generado
- [x] ✅ Todos los archivos compilan sin errores
- [x] ✅ Tests ejecutados exitosamente
- [x] ✅ Variable de entorno configurada
- [x] ✅ API pública integrada
- [x] ✅ Documentación completa

### Archivos Verificados

```
✅ backend/src/services/patternLearningService.js
✅ backend/src/routes/patrones-aprendidos.js
✅ backend/src/services/businessRulesEngine.js
✅ backend/src/lib/documentProcessor.js
✅ backend/src/index.js
✅ backend/src/routes/parseApi.js
✅ backend/test-pattern-learning.js
✅ backend/prisma/schema.prisma
```

---

## 🚀 Pasos de Deployment

### 1. Backup de Base de Datos (IMPORTANTE)

```bash
# Crear backup antes de migrar
pg_dump -U postgres -d parse_db > backup_pre_patrones_$(date +%Y%m%d).sql

# Verificar backup
ls -lh backup_pre_patrones_*.sql
```

### 2. Aplicar Migración de Base de Datos

```bash
cd backend

# Aplicar migración
npx prisma db push

# Generar cliente Prisma
npx prisma generate

# Verificar que la tabla existe
psql -U postgres -d parse_db -c "\d patrones_aprendidos"
```

**Salida esperada:**
```
Your database is now in sync with your Prisma schema. Done in XXXms
✔ Generated Prisma Client
```

### 3. Verificar Variables de Entorno

```bash
# Verificar que la variable está en .env
grep ENABLE_PATTERN_LEARNING_PROMPTS backend/.env

# Debe retornar:
# ENABLE_PATTERN_LEARNING_PROMPTS=true
```

### 4. Reiniciar Servidor

**Desarrollo:**
```bash
cd backend
npm run dev
```

**Producción (PM2):**
```bash
pm2 restart parse-backend

# Verificar logs
pm2 logs parse-backend --lines 50
```

### 5. Verificar que el Sistema Funciona

**Test 1: API de patrones**
```bash
# Verificar que el endpoint está disponible
curl http://localhost:5100/api/patrones-aprendidos/estadisticas \
  -H "Authorization: Bearer YOUR_TOKEN"

# Debe retornar:
# {"success":true,"estadisticas":{"total":0,"porTipo":[]}}
```

**Test 2: Suite de tests**
```bash
cd backend
node test-pattern-learning.js

# Debe mostrar:
# ✅ TESTING COMPLETADO EXITOSAMENTE
```

**Test 3: Procesar documento**
```bash
# Subir un documento a través de la UI o API
# Verificar logs:

# Primera vez:
# 📊 [PATTERN] Sin match exacto, procediendo con extracción IA
# ✅ Extracción exitosa con Claude Vision
# 📚 [APRENDIZAJE] Guardando patrones de extracción...
# ✅ [APRENDIZAJE] Patrón de hash exacto guardado

# Segunda vez (mismo documento):
# 🎯 [PATTERN] Documento idéntico ya procesado, usando datos guardados
```

---

## 🔍 Monitoreo Post-Deployment

### Logs a Observar

**Logs positivos (esperados):**
```
🔍 [PATTERN] Buscando patrones de extracción previos...
🎯 [PATTERN] Documento idéntico ya procesado, usando datos guardados
📋 [PATTERN] Template de proveedor encontrado
✅ [APRENDIZAJE] Patrón de hash exacto guardado
✅ [APRENDIZAJE] Template de proveedor guardado
🎯 [AI_LOOKUP] Usando patrón aprendido (ahorro de IA)
```

**Logs de advertencia (normales):**
```
📊 [PATTERN] Sin match exacto, procediendo con extracción IA
❌ [PatternLearning] No se encontró patrón con suficiente confianza
```

**Logs de error (investigar):**
```
❌ Error calculando hash de archivo
❌ [PatternLearning] Error buscando patrón
❌ [APRENDIZAJE] Error guardando patrones
```

### Queries de Monitoreo

```sql
-- Total de patrones aprendidos
SELECT COUNT(*) FROM patrones_aprendidos;

-- Patrones por tipo
SELECT tipo_patron, COUNT(*), AVG(confianza), AVG(num_ocurrencias)
FROM patrones_aprendidos
GROUP BY tipo_patron;

-- Top 10 patrones más usados
SELECT tipo_patron, input_pattern, output_value, num_ocurrencias, confianza
FROM patrones_aprendidos
ORDER BY num_ocurrencias DESC
LIMIT 10;

-- Patrones aprendidos hoy
SELECT COUNT(*)
FROM patrones_aprendidos
WHERE created_at > CURRENT_DATE;
```

---

## 🔧 Troubleshooting

### Problema: "Cannot find module 'patternLearningService'"

**Solución:**
```bash
# Verificar que el archivo existe
ls backend/src/services/patternLearningService.js

# Reiniciar servidor
pm2 restart parse-backend
```

### Problema: "Table patrones_aprendidos does not exist"

**Solución:**
```bash
cd backend
npx prisma db push
npx prisma generate
pm2 restart parse-backend
```

### Problema: Patrones no se están guardando

**Verificar:**
1. Variable de entorno activada
   ```bash
   grep ENABLE_PATTERN_LEARNING_PROMPTS backend/.env
   ```

2. Logs del servidor
   ```bash
   pm2 logs parse-backend | grep APRENDIZAJE
   ```

3. Permisos de base de datos
   ```sql
   SELECT has_table_privilege('patrones_aprendidos', 'INSERT');
   ```

### Problema: Demasiados patrones, rendimiento lento

**Solución: Limpiar patrones viejos**
```sql
-- Eliminar patrones con 1 sola ocurrencia y más de 6 meses
DELETE FROM patrones_aprendidos
WHERE num_ocurrencias = 1
  AND ultima_fecha < NOW() - INTERVAL '6 months';

-- Ver cuántos se eliminarían (antes de ejecutar DELETE)
SELECT COUNT(*)
FROM patrones_aprendidos
WHERE num_ocurrencias = 1
  AND ultima_fecha < NOW() - INTERVAL '6 months';
```

---

## 🔄 Rollback (Si es Necesario)

### Opción 1: Desactivar sin eliminar datos

```bash
# 1. Editar .env
echo "ENABLE_PATTERN_LEARNING_PROMPTS=false" >> backend/.env

# 2. Reiniciar
pm2 restart parse-backend
```

Sistema volverá a usar IA directamente, pero los patrones se mantienen en BD.

### Opción 2: Rollback completo

```bash
# 1. Restaurar backup
pg_restore -U postgres -d parse_db backup_pre_patrones_20250117.sql

# 2. Eliminar archivos nuevos
rm backend/src/services/patternLearningService.js
rm backend/src/routes/patrones-aprendidos.js
rm backend/test-pattern-learning.js

# 3. Revertir cambios en Git
git checkout backend/src/services/businessRulesEngine.js
git checkout backend/src/lib/documentProcessor.js
git checkout backend/src/index.js
git checkout backend/prisma/schema.prisma

# 4. Regenerar Prisma
cd backend
npx prisma generate

# 5. Reiniciar
pm2 restart parse-backend
```

---

## 📈 Métricas a Trackear

### Semana 1-2

- Número de patrones creados por día
- Tasa de cache hit (debe aumentar gradualmente)
- Errores/warnings relacionados a patrones

### Mes 1

- Ahorro de IA estimado (costo)
- Ahorro de tiempo promedio
- Patrones más usados
- Tasa de confianza promedio

### Mes 3-6

- ROI del sistema
- Reducción de costo de IA vs proyección
- Feedback de usuarios sobre velocidad
- Patrones que necesitan revisión manual

---

## ✅ Criterios de Éxito

### Semana 1
- [x] Sistema desplegado sin errores
- [ ] Primeros patrones aprendidos
- [ ] No hay errores críticos en logs

### Mes 1
- [ ] 100+ patrones aprendidos
- [ ] Tasa de cache hit > 10%
- [ ] Reducción de 15-25% en costo de IA

### Mes 3
- [ ] 500+ patrones aprendidos
- [ ] Tasa de cache hit > 30%
- [ ] Reducción de 40-50% en costo de IA

### Mes 6
- [ ] 1000+ patrones aprendidos
- [ ] Tasa de cache hit > 50%
- [ ] Reducción de 60-70% en costo de IA

---

## 📞 Contacto y Soporte

**En caso de problemas:**

1. Revisar logs: `pm2 logs parse-backend`
2. Verificar documentación: `docs/SISTEMA-APRENDIZAJE-PATRONES.md`
3. Ejecutar tests: `node test-pattern-learning.js`
4. Verificar BD: Queries de monitoreo arriba

---

## 📝 Notas Finales

- ✅ El sistema es **no invasivo**: puede desactivarse sin perder datos
- ✅ **Backwards compatible**: no rompe funcionalidad existente
- ✅ **Seguro**: patrones aislados por tenant
- ✅ **Monitoreado**: logs detallados en cada paso
- ✅ **Documentado**: 1000+ líneas de documentación

**¡El sistema está listo para producción!** 🚀

---

**Fin del documento de deployment**
