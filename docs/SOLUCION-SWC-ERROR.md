# Solución al Error de SWC en Next.js

## Problema

```
⚠ Attempted to load @next/swc-win32-x64-msvc, but it was not installed
⨯ Failed to load SWC binary for win32/x64
```

## Causa

El error ocurre cuando se ejecuta `npm run build` (build de producción) y luego se intenta arrancar el servidor de desarrollo (`npm run dev`). El cache de `.next` queda corrupto con archivos del build de producción.

## Solución Completa

```bash
cd frontend

# 1. Limpiar cache de Next.js
rm -rf .next

# 2. Reinstalar Next.js
npm uninstall next
npm install next@14.2.32

# 3. Limpiar cache nuevamente
rm -rf .next

# 4. Arrancar servidor de desarrollo
npm run dev
```

## Solución Rápida (Si vuelve a pasar)

```bash
cd frontend
rm -rf .next
npm run dev
```

## Prevención

**NO ejecutar** `npm run build` mientras el servidor de desarrollo está corriendo o si planeás usar `npm run dev` después.

Si necesitás verificar compilación:
1. Usar `npx tsc --noEmit --skipLibCheck` para verificar TypeScript
2. O hacer el build en una copia separada del proyecto

## Notas

- El paquete SWC (`@next/swc-win32-x64-msvc`) sí está instalado correctamente
- El problema es el cache corrupto de `.next`, no la instalación
- Afecta principalmente a proyectos Next.js en Windows

## Fecha

Noviembre 15, 2025
