# Pasos para Resolver el Error en el Servidor

## Error Actual
```
TypeError: Cannot read properties of null (reading 'useContext')
```

## Solución en 3 Pasos

### 1. Conectarse al servidor
```bash
ssh usuario@66.97.45.210
```

### 2. Ir al directorio de la aplicación
```bash
cd /opt/rendiciones
```

### 3. Ejecutar el script de solución rápida
```bash
# Hacer el script ejecutable
chmod +x quick-fix.sh

# Ejecutar
./quick-fix.sh
```

El script te preguntará si quieres continuar. Presiona `y` y Enter.

## ¿Qué hace el script?

1. ✓ Detiene PM2
2. ✓ Elimina todos los `node_modules`
3. ✓ Reinstala dependencias correctamente (sin React en raíz)
4. ✓ Regenera Prisma
5. ✓ Compila el frontend
6. ✓ Reinicia PM2

## Verificar que funcionó

```bash
# Ver estado
pm2 status

# Ver logs (debería mostrar que frontend inició en puerto 8084)
pm2 logs --lines 50

# Acceder a la aplicación
# http://66.97.45.210:8084
```

## Si el script falla

### Opción 1: Diagnóstico
```bash
cd /opt/rendiciones
chmod +x check-react-versions.sh
./check-react-versions.sh
```

Esto te dirá exactamente dónde está el problema.

### Opción 2: Script de limpieza alternativo
```bash
cd /opt/rendiciones
chmod +x clean-react-conflict.sh
./clean-react-conflict.sh
```

### Opción 3: Reinstalación completa
```bash
cd /opt/rendiciones
chmod +x fix-install.sh
./fix-install.sh
```

## Información Técnica

El problema es que hay dos copias de React:
- Una en `/opt/rendiciones/node_modules/react` (React 19)
- Otra en `/opt/rendiciones/packages/web/node_modules/react` (React 18)

Esto causa un conflicto porque Next.js necesita una sola versión de React (18.2.0).

La solución es eliminar React del `node_modules` raíz y dejar solo la copia en `packages/web`.
