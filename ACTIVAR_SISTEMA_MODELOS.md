# ⚡ Activar Sistema de Modelos - Guía Rápida

## 🚨 IMPORTANTE: Pasos Obligatorios

El sistema ya está implementado, pero necesitas activarlo. **Son solo 3 pasos:**

---

## ✅ Paso 1: Poblar Base de Datos (30 segundos)

```bash
cd backend
node prisma/seeds/ai-models-seed.js
```

**✅ Resultado esperado:**
```
🌱 Seeding AI models...
✅ Creado: Claude 3.7 Sonnet (anthropic)
✅ Creado: Claude 3.5 Sonnet (Oct 2024) (anthropic)
...
✅ 13 modelos creados exitosamente!
```

**❌ Si ves "Ya existen N modelos":**
- Está bien, los modelos ya están cargados
- Continúa al paso 2

---

## ✅ Paso 2: Reiniciar Backend (30 segundos)

```bash
# Detener el backend (Ctrl+C si está corriendo)

# Regenerar Prisma Client
npx prisma generate

# Iniciar backend nuevamente
npm run dev
```

**✅ Resultado esperado:**
```
✔ Generated Prisma Client
🚀 Parse Server running on port 5050
```

---

## ✅ Paso 3: Copiar Modal en Frontend (1 minuto)

### 3.1. Abrir el archivo del modal
Abre: `MODAL_GESTION_MODELOS.tsx` (en la raíz del proyecto)

### 3.2. Copiar TODO el contenido
Selecciona todo (Ctrl+A) y copia (Ctrl+C)

### 3.3. Pegar en ia-config/page.tsx

1. Abre: `frontend/src/app/(protected)/ia-config/page.tsx`
2. Ve al **FINAL del archivo**
3. Busca la línea que dice:
   ```tsx
         )}
       </div>
     );
   }
   ```
4. **ANTES** de `      )}`, pega el código del modal
5. Guarda el archivo

**Ubicación exacta:**
```tsx
...código existente...
        </div>
      )}

      {/* ⭐ PEGAR AQUÍ EL MODAL */}
      {/* Modal de Gestión de Modelos */}
      {showModelsModal && (
        ...código del modal...
      )}

    </div>  {/* ← Este div ya existe */}
  );
}
```

---

## 🎯 Verificar que Funciona

### Test 1: Ver Modelos en Dropdown

1. Ir a `/ia-config` en el navegador
2. Si ya tienes un proveedor configurado:
   - Ver sección "Cambiar modelo:"
   - Debería mostrar lista de modelos con nombres
3. ✅ **Funciona** si ves: "Claude 3.7 Sonnet ⭐", "Gemini 1.5 Flash ⭐", etc.
4. ❌ **No funciona** si el dropdown está vacío

**Si no funciona:**
- Asegúrate de haber ejecutado el paso 1 (seed)
- Asegúrate de haber reiniciado el backend (paso 2)
- Verifica en consola del browser si hay errores

### Test 2: Editar Configuración

1. En una tarjeta de proveedor, click "Editar"
2. ✅ **Funciona** si abre el modal con dropdown de modelos lleno
3. ❌ **No funciona** si el modal no abre o dropdown vacío

### Test 3: Gestionar Modelos (Requiere Paso 3)

1. En una tarjeta de proveedor, click "Modelos"
2. ✅ **Funciona** si abre modal con lista de modelos
3. ❌ **No funciona** si no pasa nada → Falta copiar el modal (Paso 3)

---

## 🐛 Problemas Comunes

### Problema: "Dropdown de modelos vacío"

**Causa:** No ejecutaste el seed o el backend no se reinició

**Solución:**
```bash
cd backend
node prisma/seeds/ai-models-seed.js
npx prisma generate
npm run dev
```

### Problema: "Botón Editar no hace nada"

**Causa 1:** Backend no reiniciado después del seed

**Solución:**
```bash
cd backend
npm run dev
```

**Causa 2:** Error en consola del navegador

**Solución:**
1. Abrir DevTools (F12)
2. Ver tab "Console"
3. Buscar errores rojos
4. Compartir el error

### Problema: "Botón Modelos no hace nada"

**Causa:** No copiaste el modal (Paso 3)

**Solución:**
1. Copiar contenido de `MODAL_GESTION_MODELOS.tsx`
2. Pegar en `ia-config/page.tsx` al final (ver Paso 3)
3. Guardar archivo

### Problema: "Error al crear modelo desde UI"

**Causa:** El endpoint funciona pero hay validación de duplicados

**Solución:**
- Usa un `modelId` único
- Verifica que no exista ese modelo ya

---

## 📊 Estado Actual del Sistema

### ✅ Implementado (Backend)
- [x] Tabla `ai_models` en PostgreSQL
- [x] API CRUD `/api/ai-models`
- [x] Seed con 13 modelos
- [x] `aiConfigService` lee de BD
- [x] Endpoint `/providers` devuelve formato correcto

### ⚠️ Requiere Activación (Tu lado)
- [ ] Ejecutar seed (Paso 1)
- [ ] Reiniciar backend (Paso 2)
- [ ] Copiar modal (Paso 3)

### ✅ Una vez activado podrás:
- ✅ Ver modelos en dropdowns
- ✅ Editar configuración de proveedores
- ✅ Gestionar catálogo de modelos desde UI
- ✅ Agregar Claude 4.0 en 30 segundos
- ✅ Marcar modelos como obsoletos
- ✅ Cambiar modelo recomendado

---

## 🎬 Después de Activar

### Agregar un Nuevo Modelo

**Ejemplo: Cuando salga Claude 4.0**

1. Ir a `/ia-config`
2. Click "Modelos" en tarjeta de Anthropic
3. Click "Agregar Modelo"
4. Llenar:
   - **ID:** `claude-4-opus-20250301`
   - **Nombre:** `Claude 4 Opus`
   - **Descripción:** `Nueva generación`
   - ✅ **Recomendado**
   - ✅ **Activo**
5. Click "Crear"
6. ✅ Aparece **INMEDIATAMENTE** en todos los dropdowns
7. ✅ **0 código, 0 deploy, 0 restart**

### Marcar Modelo como Obsoleto

**Ejemplo: Claude 3.5 descontinuado**

1. Ir a `/ia-config`
2. Click "Modelos" en Anthropic
3. Localizar "Claude 3.5 Sonnet (Jun 2024)"
4. Click "Editar"
5. ✅ Marcar "Obsoleto"
6. ❌ Desmarcar "Activo"
7. Click "Actualizar"
8. ✅ Badge amarillo "Obsoleto" aparece
9. ✅ En dropdowns: ⚠️ al lado del modelo

---

## 📝 Checklist Final

Marca ✅ cuando completes cada paso:

- [ ] **Paso 1:** Seed ejecutado (`node prisma/seeds/ai-models-seed.js`)
- [ ] **Paso 2:** Backend reiniciado (`npm run dev`)
- [ ] **Paso 3:** Modal copiado en `ia-config/page.tsx`
- [ ] **Test 1:** Dropdown de modelos lleno (no vacío)
- [ ] **Test 2:** Botón "Editar" abre modal
- [ ] **Test 3:** Botón "Modelos" abre modal de gestión

**Si todos tienen ✅ → Sistema activado correctamente! 🎉**

---

## 🆘 ¿Necesitas Ayuda?

Si después de seguir estos pasos algo no funciona:

1. **Verifica logs del backend:**
   ```bash
   # En la terminal donde corre el backend, busca errores
   ```

2. **Verifica consola del navegador:**
   - F12 → Console
   - Buscar errores en rojo

3. **Verifica base de datos:**
   ```bash
   cd backend
   npx prisma studio
   # Ir a tabla "ai_models"
   # Debería haber 13 registros
   ```

4. **Comparte el error específico** para que pueda ayudarte

---

## 🔗 Archivos de Referencia

- **Instrucciones detalladas:** `INSTRUCCIONES_MODELO_BD.md`
- **Código del modal:** `MODAL_GESTION_MODELOS.tsx`
- **Documentación completa:** `docs/AI_MODEL_MANAGEMENT.md`

---

**Última actualización:** Enero 2025
**Commit:** `ace256b`
