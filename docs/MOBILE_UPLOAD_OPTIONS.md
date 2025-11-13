# Opciones para Subida de Comprobantes desde Móvil

## Contexto
Definir la mejor estrategia para que usuarios puedan subir comprobantes desde dispositivos móviles.

## Opciones Evaluadas

### 1. Página Web Móvil (RECOMENDADA)
**Capacidades:**
- ✅ Acceso directo a cámara del teléfono desde navegador
- ✅ Input file con `capture="environment"` abre cámara automáticamente
- ✅ Soporte para imágenes y PDFs: `accept="image/*,application/pdf"`
- ✅ Media Devices API para control avanzado

**Ventajas:**
- No requiere instalación
- Funciona en todos los dispositivos
- Mismo backend existente
- Desarrollo más rápido
- Cero fricción para el usuario

**Limitaciones:**
- Requiere HTTPS para acceso a cámara
- Experiencia menos nativa que app

### 2. PWA (Progressive Web App)
**Características:**
- Comportamiento similar a app nativa
- Instalable en home screen
- Capacidad offline (opcional)
- Acceso completo a cámara

### 3. App Móvil Nativa
**Solo necesaria para:**
- Funciones muy específicas del OS
- Trabajo completamente offline
- Máxima performance requerida

## Implementación Técnica (Opción 1)

```html
<!-- Input básico con acceso a cámara -->
<input type="file" accept="image/*" capture="environment" />

<!-- Input para imágenes y PDFs -->
<input type="file" accept="image/*,application/pdf" />
```

## Decisión
**Empezar con página web móvil responsive:**
1. Adaptar modal de upload existente para móvil
2. Implementar captura directa de cámara
3. Mantener funcionalidad actual de procesamiento con IA
4. Si es necesario, evolucionar a PWA posteriormente

## Próximos Pasos
1. Completar asociación de comprobantes (actual)
2. Crear versión móvil de página de comprobantes
3. Implementar captura de cámara
4. Testing en dispositivos móviles
5. Evaluar conversión a PWA si es necesario

## Notas Técnicas
- Requiere HTTPS en producción para acceso a cámara
- Navegadores modernos soportan Camera API
- File Input con capture funciona en iOS Safari y Chrome Android