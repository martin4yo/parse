# ✅ Checklist de Despliegue a Producción

**Fecha de creación**: Noviembre 4, 2025
**Versión**: 1.1.0 (con optimización Sharp + Pipeline Claude Vision)

---

## 🔍 PRE-DESPLIEGUE: Verificaciones Locales

### ✅ Código

- [x] **Sintaxis verificada**: Todos los archivos pasan `node -c`
- [x] **Dependencias instaladas**: Sharp, pdf2pic, todos los módulos
- [x] **Tests pasando**: Script de verificación ejecutado exitosamente
- [x] **No hay console.log sensibles**: Contraseñas, API keys, etc.
- [x] **Variables de entorno documentadas**: `.env.example` actualizado
- [x] **Try-catch balanceados**: Todos los async tienen manejo de errores

### ✅ Funcionalidades Nuevas

- [x] **Image Optimization Service**: Creado y testeado
- [x] **Claude Vision Pipeline**: Integrado con clasificador
- [x] **Limpieza automática**: Hook en documentos.js
- [x] **Tests actualizados**: test-claude-vision.js, test-image-optimization.js
- [x] **Documentación completa**: IMPLEMENTACION-SHARP-OPTIMIZATION.md, FIX-CLAUDE-VISION-PIPELINE.md

### ✅ Base de Datos

- [ ] **Schema actualizado**: Verificar que Prisma schema está sincronizado
- [ ] **Migraciones**: `prisma migrate deploy` listo para ejecutar
- [ ] **Backups**: Backup reciente de BD antes de deploy

```bash
# Verificar estado
cd backend
npx prisma migrate status

# Si hay pendientes
npx prisma migrate deploy
```

---

## 📦 PREPARACIÓN PARA PRODUCCIÓN

### 1. Variables de Entorno

Verificar que **TODAS** estas variables estén configuradas en producción:

#### **Críticas (Obligatorias)**
```env
# Base de datos
DATABASE_URL="postgresql://user:pass@host:5432/parse_db"

# Puerto
PORT=5050

# Seguridad
JWT_SECRET="tu-secret-muy-seguro-aqui"
NODE_ENV=production

# CORS
CORS_ORIGIN=https://tu-dominio.com
```

#### **IA (Recomendadas)**
```env
# Google Gemini
GEMINI_API_KEY=tu-api-key
ENABLE_AI_EXTRACTION=true

# Claude Vision (Nuevo)
ANTHROPIC_API_KEY=tu-api-key
USE_CLAUDE_VISION=true

# Document AI (Opcional)
USE_DOCUMENT_AI=false
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GCP_PROJECT_ID=tu-proyecto
DOCUMENT_AI_PROCESSOR_ID=tu-processor-id
DOCUMENT_AI_LOCATION=us
```

### 2. Archivos a Subir

**Incluir:**
```
backend/
  ├── src/
  │   ├── services/
  │   │   └── imageOptimizationService.js ⭐ NUEVO
  │   ├── lib/
  │   │   └── documentProcessor.js ⭐ MODIFICADO
  │   ├── routes/
  │   │   └── documentos.js ⭐ MODIFICADO
  │   └── scripts/
  │       ├── test-image-optimization.js ⭐ NUEVO
  │       ├── test-claude-vision.js ⭐ MODIFICADO
  │       └── verify-production.js ⭐ NUEVO
  ├── package.json
  ├── package-lock.json
  └── prisma/

CLAUDE.md ⭐ MODIFICADO
IMPLEMENTACION-SHARP-OPTIMIZATION.md ⭐ NUEVO
FIX-CLAUDE-VISION-PIPELINE.md ⭐ NUEVO
CHECKLIST-PRODUCCION.md ⭐ NUEVO (este archivo)
```

**NO incluir:**
```
.env
node_modules/
uploads/ (archivos, pero sí el directorio vacío)
*.log
.git/ (opcional según estrategia)
```

### 3. Permisos de Archivos

```bash
# Directorio uploads debe ser escribible
chmod 755 backend/uploads

# Scripts deben ser ejecutables
chmod +x backend/src/scripts/*.js

# .env debe ser solo lectura para el owner
chmod 600 backend/.env
```

---

## 🚀 DESPLIEGUE PASO A PASO

### PASO 1: Backup de Producción

```bash
# 1. Backup de base de datos
pg_dump -h HOST -U USER parse_db > backup_pre_deploy_$(date +%Y%m%d_%H%M%S).sql

# 2. Backup de uploads (si hay archivos importantes)
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz backend/uploads/

# 3. Backup del código actual
tar -czf code_backup_$(date +%Y%m%d_%H%M%S).tar.gz backend/
```

### PASO 2: Detener Servicios

```bash
# Si usas PM2
pm2 stop parse-backend

# Si usas systemd
sudo systemctl stop parse-backend

# Verificar que se detuvo
pm2 list
# o
sudo systemctl status parse-backend
```

### PASO 3: Actualizar Código

```bash
# Opción A: Git pull
cd /ruta/a/produccion
git pull origin master

# Opción B: Subir archivos manualmente
scp -r backend/ user@servidor:/ruta/a/produccion/

# Opción C: FTP/SFTP
# (usar cliente FTP)
```

### PASO 4: Instalar Dependencias

```bash
cd backend

# IMPORTANTE: Asegurarse que Sharp se compile para el servidor de producción
npm install --production

# Si hay problemas con Sharp
npm rebuild sharp

# Verificar Sharp
node -e "const sharp = require('sharp'); console.log('Sharp version:', sharp.versions);"
```

### PASO 5: Ejecutar Migraciones

```bash
cd backend

# Ver estado de migraciones
npx prisma migrate status

# Aplicar migraciones pendientes
npx prisma migrate deploy

# Regenerar cliente Prisma
npx prisma generate
```

### PASO 6: Verificar Configuración

```bash
# Ejecutar script de verificación
node src/scripts/verify-production.js

# Debe mostrar:
# ✅ ✅ ✅ TODAS LAS VERIFICACIONES PASARON ✅ ✅ ✅
```

### PASO 7: Iniciar Servicios

```bash
# Si usas PM2
pm2 start ecosystem.config.js
pm2 save

# Si usas systemd
sudo systemctl start parse-backend
sudo systemctl status parse-backend

# Verificar logs
pm2 logs parse-backend --lines 50
# o
sudo journalctl -u parse-backend -f
```

### PASO 8: Smoke Tests

```bash
# 1. Verificar que el servidor responde
curl http://localhost:5050/health
# Debe retornar: {"status":"ok"}

# 2. Verificar API
curl http://localhost:5050/api/health
# Debe retornar JSON con status

# 3. Test de upload (opcional)
# Subir un documento de prueba desde la UI
```

---

## ✅ POST-DESPLIEGUE: Verificaciones

### Inmediatamente después (0-5 minutos)

- [ ] **Servidor responde**: Endpoint de health retorna 200
- [ ] **Logs sin errores**: No hay errores críticos en logs
- [ ] **Base de datos conectada**: Queries funcionan
- [ ] **Uploads funciona**: Directorio es escribible

```bash
# Ver logs en tiempo real
pm2 logs parse-backend --lines 100

# Verificar errores
pm2 logs parse-backend --err --lines 50
```

### Primeras horas (0-2 horas)

- [ ] **Optimización Sharp funciona**: Ver logs de "✅ Imagen optimizada"
- [ ] **Claude Vision con pipeline**: Ver logs de "PASO 1: CLASIFICACIÓN"
- [ ] **Limpieza automática**: Ver logs de "🧹 Limpieza de archivos"
- [ ] **No hay memory leaks**: Monitorear uso de RAM
- [ ] **Performance OK**: Tiempos de respuesta similares o mejores

```bash
# Monitorear recursos
pm2 monit

# Ver estadísticas
pm2 show parse-backend
```

### Primer día (0-24 horas)

- [ ] **Usuarios reportan mejora**: Menos errores de extracción
- [ ] **Costos API reducidos**: Verificar en consolas de Gemini/Claude
- [ ] **Archivos temporales limpios**: No crecimiento descontrolado en uploads/

```bash
# Ver tamaño del directorio uploads
du -sh backend/uploads/

# Contar archivos temporales
find backend/uploads -name "*_optimized*" -o -name "*_enhanced*" | wc -l
# Debería ser 0 o muy bajo
```

---

## 🐛 TROUBLESHOOTING

### Problema: Sharp no funciona en producción

**Síntomas**: Error "sharp: command not found" o "Cannot find module 'sharp'"

**Solución**:
```bash
# Desinstalar Sharp
npm uninstall sharp

# Limpiar cache
npm cache clean --force

# Reinstalar con build nativo
npm install --build-from-source sharp

# O usar prebuilt
npm install sharp

# Verificar
node -e "require('sharp')"
```

### Problema: Archivos temporales se acumulan

**Síntomas**: Directorio uploads crece indefinidamente

**Solución**:
```bash
# Limpiar manualmente
cd backend/uploads
find . -name "*_optimized*" -mtime +1 -delete
find . -name "*_enhanced*" -mtime +1 -delete
find . -name "processed_*" -mtime +1 -delete

# Verificar que hook de limpieza funciona
grep "cleanTempFiles" backend/src/routes/documentos.js
```

### Problema: Claude Vision no usa pipeline

**Síntomas**: Logs no muestran "PASO 1: CLASIFICACIÓN"

**Solución**:
```bash
# Verificar que se pasa el texto
grep "extractWithClaudeVision.*text" backend/src/lib/documentProcessor.js

# Debe mostrar:
# const data = await this.extractWithClaudeVision(filePath, tenantId, text);
```

### Problema: Alta latencia

**Síntomas**: Requests toman >10 segundos

**Solución**:
```bash
# Verificar tamaño de imágenes en logs
# Debe mostrar reducción:
# "✅ Imagen optimizada: 3.2 MB → 0.6 MB"

# Si no hay reducción, verificar que imageOptimizationService está activo
node -e "const service = require('./backend/src/services/imageOptimizationService'); console.log(service);"
```

---

## 🔄 ROLLBACK (Si es necesario)

Si algo sale mal, seguir estos pasos para volver al estado anterior:

### Rollback Rápido (Código)

```bash
# 1. Detener servicios
pm2 stop parse-backend

# 2. Restaurar código del backup
cd /ruta/a/produccion
tar -xzf code_backup_YYYYMMDD_HHMMSS.tar.gz

# 3. Reinstalar dependencias de versión anterior
cd backend
npm install

# 4. Reiniciar
pm2 start parse-backend
```

### Rollback Base de Datos (Solo si hubo migraciones)

```bash
# 1. Restaurar backup
psql -h HOST -U USER parse_db < backup_pre_deploy_YYYYMMDD_HHMMSS.sql

# 2. Verificar
psql -h HOST -U USER -d parse_db -c "\dt"
```

### Rollback Git (Si usas Git)

```bash
# Ver últimos commits
git log --oneline -10

# Volver a commit anterior
git revert HEAD
# o
git reset --hard COMMIT_ANTERIOR

# Push (con cuidado)
git push --force origin master
```

---

## 📊 MÉTRICAS A MONITOREAR

### Primeros 7 días

| Métrica | Antes | Objetivo | Cómo Medir |
|---------|-------|----------|------------|
| Tasa de éxito extracción | 85% | 95%+ | Logs de documentos procesados |
| Tiempo promedio proceso | 4s | 2s | Timestamps en logs |
| Tamaño promedio archivo | 2.5 MB | 0.5 MB | Logs de optimización |
| Costo por documento | $0.003 | $0.001 | Consola Gemini/Claude |
| Uso de disco (uploads) | ? | <500 MB | `du -sh uploads/` |
| Memoria RAM | ? | <2 GB | `pm2 monit` |

### Queries útiles para métricas

```sql
-- Tasa de éxito de extracción (últimas 24 horas)
SELECT
  estadoProcesamiento,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje
FROM documentos_procesados
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY estadoProcesamiento;

-- Tiempo promedio de procesamiento
SELECT
  AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as avg_seconds
FROM documentos_procesados
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND estadoProcesamiento = 'completado';

-- Documentos procesados por hora (últimas 24h)
SELECT
  DATE_TRUNC('hour', "createdAt") as hora,
  COUNT(*) as documentos
FROM documentos_procesados
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY hora
ORDER BY hora DESC;
```

---

## 📞 CONTACTOS DE EMERGENCIA

**Responsables del deploy**:
- Desarrollador: [Tu nombre/email]
- SysAdmin: [Nombre/email]
- DBA: [Nombre/email]

**Servicios externos**:
- Google Cloud Support: https://cloud.google.com/support
- Anthropic Support: support@anthropic.com
- Servidor: [IP/Proveedor]

---

## ✅ CHECKLIST FINAL

Antes de dar por completado el deploy:

- [ ] Código actualizado en servidor
- [ ] Dependencias instaladas (incluyendo Sharp)
- [ ] Variables de entorno configuradas
- [ ] Migraciones ejecutadas
- [ ] Script de verificación pasó
- [ ] Servicios iniciados correctamente
- [ ] Logs muestran "TODAS LAS VERIFICACIONES PASARON"
- [ ] Endpoint /health responde
- [ ] Test manual de upload funciona
- [ ] Logs muestran optimización de imágenes
- [ ] Logs muestran pipeline de Claude Vision
- [ ] No hay errores en primeros 10 minutos
- [ ] Backup guardado en lugar seguro
- [ ] Documentación actualizada
- [ ] Equipo notificado del deploy exitoso

---

## 📝 NOTAS DEL DEPLOY

```
Fecha: ___/___/2025
Hora inicio: __:__
Hora fin: __:__
Responsable: __________
Versión: 1.1.0

Incidencias:
- Ninguna / [Describir]

Rollback necesario: Sí / No

Observaciones:
[Agregar notas relevantes]
```

---

**🎉 Si todos los checks están en verde, el deploy fue exitoso!**

**Próximos pasos**: Monitorear durante 24-48 horas y ajustar según métricas.
