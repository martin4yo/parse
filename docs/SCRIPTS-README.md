# Scripts de Instalación y Mantenimiento

## 📋 Índice de Scripts

### Scripts de Instalación

| Script | Uso | Descripción |
|--------|-----|-------------|
| `install-ubuntu.sh` | Primera instalación | Instalación completa en Ubuntu 22.04 limpio |
| `fix-install.sh` | Reinstalación | Reinstala dependencias y arregla problemas comunes |
| `quick-fix.sh` | ⭐ Solución rápida | Arregla el error de React y recompila todo |

### Scripts de Diagnóstico

| Script | Uso | Descripción |
|--------|-----|-------------|
| `check-react-versions.sh` | Diagnóstico | Verifica versiones de React instaladas |

### Scripts de Limpieza

| Script | Uso | Descripción |
|--------|-----|-------------|
| `clean-react-conflict.sh` | Limpiar React | Elimina conflictos de versiones de React |

### Archivos de Configuración

| Archivo | Descripción |
|---------|-------------|
| `ecosystem.config.js` | Configuración de PM2 para producción |

### Documentación

| Archivo | Contenido |
|---------|-----------|
| `INSTALL.md` | Guía completa de instalación |
| `REACT-CONFLICT-FIX.md` | Detalles técnicos del error de React |
| `SERVIDOR-PASOS.md` | ⭐ Pasos rápidos para el servidor |
| `SCRIPTS-README.md` | Este archivo |

## 🚀 Uso Rápido

### Problema: Error de compilación en el servidor

```bash
cd /opt/rendiciones
chmod +x quick-fix.sh
./quick-fix.sh
```

### Problema: Instalación fallida

```bash
cd /opt/rendiciones
chmod +x fix-install.sh
./fix-install.sh
```

### Diagnóstico: ¿Qué versión de React tengo?

```bash
cd /opt/rendiciones
chmod +x check-react-versions.sh
./check-react-versions.sh
```

## 📦 Orden de Ejecución para Nueva Instalación

1. **Primera vez en servidor limpio:**
   ```bash
   ./install-ubuntu.sh
   ```

2. **Si falla la instalación:**
   ```bash
   ./fix-install.sh
   ```

3. **Si hay error de React después:**
   ```bash
   ./quick-fix.sh
   ```

## 🔧 Comandos Útiles PM2

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs

# Reiniciar
pm2 restart all

# Detener
pm2 stop all

# Monitor
pm2 monit
```

## 📝 Notas Importantes

- Todos los scripts están diseñados para Ubuntu 22.04
- Los scripts deben ejecutarse desde `/opt/rendiciones`
- Siempre hacer `chmod +x script.sh` antes de ejecutar
- La IP configurada es: `66.97.45.210`
- Puertos: Backend 5050, Frontend 8080
