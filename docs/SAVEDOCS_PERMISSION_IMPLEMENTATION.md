# Implementación del Permiso `saveDocs`

**Fecha**: 16 de Enero 2025
**Estado**: ✅ Completado

---

## 🎯 Objetivo

Agregar un nuevo permiso `saveDocs` al sistema de API keys que permita a aplicaciones externas guardar documentos procesados directamente en la plataforma Parse.

---

## 📝 Resumen de Cambios

### Nuevo Permiso: `saveDocs`

**Propósito**: Permite que aplicaciones externas guarden documentos procesados en la base de datos de Parse, haciéndolos visibles en la aplicación web.

**Diferencia con otros permisos**:
- `parse`: Procesa documentos y devuelve JSON (sin guardar en BD)
- `applyRules`: Aplica reglas de negocio a documentos parseados
- `saveDocs`: **NUEVO** - Guarda documentos procesados en la plataforma

---

## 🔧 Archivos Modificados

### Frontend

#### 1. `frontend/src/app/(protected)/sync-admin/api-keys/page.tsx`

**Cambios**:
- ✅ Agregado `saveDocs` a la interfaz `ApiKey`
- ✅ Agregado `saveDocs` al estado `formData` (crear API key)
- ✅ Agregado `saveDocs` al estado `editFormData` (editar API key)
- ✅ Agregado checkbox "Save Docs" en modal de creación
- ✅ Agregado checkbox "Save Docs" en modal de edición
- ✅ Agregado badge "Save" en tabla de permisos
- ✅ Actualizado `openEditModal` para incluir `saveDocs`

**Líneas modificadas**: ~50 líneas

---

### Backend

#### 2. `backend/src/routes/parseApi.js`

**Nuevo endpoint agregado**: `POST /api/v1/parse/save`

**Características**:
```javascript
router.post('/save', authenticateSyncClient, upload.single('file'), async (req, res) => {
  // 1. Validar permiso saveDocs
  if (!req.syncClient.permisos.saveDocs) {
    return res.status(403).json({
      success: false,
      error: 'Sin permiso "saveDocs"'
    });
  }

  // 2. Procesar documento con IA
  const resultado = await documentProcessor.processFileForAPI(
    file.path,
    req.syncClient.tenantId,
    tipoDocumento
  );

  // 3. Guardar en base de datos
  const documentoGuardado = await prisma.documentos_procesados.create({
    data: {
      tenantId: req.syncClient.tenantId,
      nombreArchivo: file.originalname,
      pathArchivo: file.path,
      tipoDocumento: resultado.tipoDocumento,
      estadoProcesamiento: 'completado',
      datosExtraidos: {
        cabecera: resultado.cabecera,
        items: resultado.items,
        impuestos: resultado.impuestos,
        metadata: metadata
      }
    }
  });

  // 4. Aplicar reglas (opcional)
  if (aplicarReglas) {
    const engine = new BusinessRulesEngine(tenantId);
    await engine.loadRules('TRANSFORMACION', true, prisma);
    const resultadoReglas = await engine.applyRulesToDocument(docParaReglas);

    // Actualizar documento con datos transformados
    await prisma.documentos_procesados.update({
      where: { id: documentoGuardado.id },
      data: {
        datosExtraidos: {
          ...documentoGuardado.datosExtraidos,
          transformado: documentoTransformado,
          reglasAplicadas: reglasAplicadas
        }
      }
    });
  }

  // 5. Retornar documento guardado con ID
  res.status(201).json({
    success: true,
    documento: {
      id: documentoGuardado.id,
      nombreArchivo: documentoGuardado.nombreArchivo,
      ...
    },
    message: 'Documento guardado exitosamente'
  });
});
```

**Parámetros del endpoint**:
- `file`: Archivo PDF o imagen (requerido)
- `tipoDocumento`: "AUTO" | "FACTURA_A" | "FACTURA_B" | "FACTURA_C" (opcional)
- `aplicarReglas`: "true" | "false" (opcional, default: false)
- `metadata`: JSON string con metadata adicional (opcional)

**Response**:
- Status: `201 Created`
- Retorna ID del documento guardado
- Incluye datos parseados
- Si `aplicarReglas=true`, incluye datos transformados

**Líneas agregadas**: ~161 líneas

---

### Documentación

#### 3. `docs/PARSE_API_DOCUMENTATION.md`

**Cambios**:
- ✅ Actualizada sección de permisos para incluir `saveDocs`
- ✅ Agregado endpoint `POST /save` con especificación completa
- ✅ Agregados ejemplos en cURL
- ✅ Agregados ejemplos en JavaScript/Node.js
- ✅ Actualizado ejemplo de estructura de API key
- ✅ Renumerados endpoints (5 endpoints en total ahora)

**Líneas modificadas**: ~100 líneas

#### 4. `docs/SAVEDOCS_PERMISSION_IMPLEMENTATION.md` (NUEVO)

Este archivo (documentación del cambio).

---

## 📊 Resumen de Endpoints

| Endpoint | Método | Permiso | Guarda en BD | Aplica Reglas |
|----------|--------|---------|--------------|---------------|
| `/document` | POST | `parse` | ❌ No | ❌ No |
| `/apply-rules` | POST | `applyRules` | ❌ No | ✅ Sí |
| `/save` | POST | `saveDocs` | ✅ **Sí** | ⚙️ Opcional |
| `/full` | POST | `parse` + `applyRules` | ❌ No | ✅ Sí |
| `/health` | GET | Ninguno | ❌ No | ❌ No |

---

## 💡 Casos de Uso

### Caso 1: Sistema ERP que Importa Facturas

**Escenario**: Una empresa tiene un ERP que necesita importar facturas escaneadas a Parse.

**Solución**:
1. Crear API key con permiso `saveDocs`
2. ERP envía facturas vía `POST /save` con `aplicarReglas=true`
3. Facturas quedan guardadas en Parse con clasificación automática
4. Usuarios pueden ver/editar facturas en la web de Parse

**Código**:
```javascript
const result = await axios.post(
  'https://parsedemo.axiomacloud.com/api/v1/parse/save',
  formData,
  {
    headers: { 'X-API-Key': API_KEY }
  }
);

console.log('Factura guardada con ID:', result.data.documento.id);
// Ahora visible en https://parsedemo.axiomacloud.com/parse
```

---

### Caso 2: Portal de Proveedores

**Escenario**: Proveedores suben facturas vía portal web externo.

**Solución**:
1. Portal tiene API key con `saveDocs`
2. Proveedores suben PDFs en el portal
3. Portal envía a Parse API para guardar
4. Equipo de contabilidad revisa en Parse web

---

### Caso 3: Integración con Email

**Escenario**: Facturas llegan por email, se deben guardar automáticamente.

**Solución**:
1. Servicio de email parsing (Zapier, Make, etc.)
2. Detecta emails con adjuntos PDF
3. Envía PDFs a Parse API `/save`
4. Facturas quedan guardadas y clasificadas

---

## 🧪 Testing

### Test Manual

1. Crear API key con permiso `saveDocs`:
   - Ir a Parse → Configuración → API Keys
   - Crear nueva key
   - Habilitar checkbox "Save Docs (Guardar documentos)"
   - Copiar la key

2. Probar endpoint:
```bash
curl -X POST https://parsedemo.axiomacloud.com/api/v1/parse/save \
  -H "X-API-Key: tu-api-key-aqui" \
  -F "file=@factura.pdf" \
  -F "aplicarReglas=true" \
  -F 'metadata={"ordenCompra":"OC-001"}'
```

3. Verificar:
   - Response tiene status 201
   - Response incluye `documento.id`
   - Ir a Parse web → Parse
   - Verificar que el documento aparece en la lista

4. Test de permisos:
   - Crear API key SIN permiso `saveDocs`
   - Intentar llamar `/save`
   - Debe retornar 403 Forbidden

---

## ✅ Checklist de Implementación

- [x] Agregar permiso `saveDocs` a interfaz TypeScript
- [x] Agregar checkbox en formulario de creación
- [x] Agregar checkbox en formulario de edición
- [x] Agregar badge en tabla de permisos
- [x] Crear endpoint `POST /save` en backend
- [x] Validar permiso `saveDocs` en endpoint
- [x] Implementar guardado en base de datos
- [x] Soportar aplicación de reglas opcional
- [x] Soportar metadata personalizada
- [x] Actualizar documentación API
- [x] Agregar ejemplos de uso
- [x] Build exitoso del frontend
- [x] Crear documentación del cambio

---

## 🚀 Deploy

### Frontend
```bash
cd frontend
npm run build
# Build exitoso ✓
```

### Backend
No requiere rebuild. El cambio es en código JavaScript que se carga dinámicamente.

Reiniciar servicio:
```bash
pm2 restart parse-backend
```

---

## 📈 Impacto

### Beneficios

✅ **Mayor flexibilidad**: Aplicaciones pueden elegir entre parse sin guardar o guardar en plataforma
✅ **Automatización**: ERPs y sistemas externos pueden importar facturas automáticamente
✅ **Centralización**: Todos los documentos en un solo lugar (Parse)
✅ **Trazabilidad**: Cada documento guardado tiene ID único y metadata
✅ **Reglas automáticas**: Clasificación y enriquecimiento al guardar

### Riesgos

⚠️ **Almacenamiento**: Más documentos guardados = más espacio en disco
⚠️ **Seguridad**: API keys con `saveDocs` tienen acceso de escritura

**Mitigación**:
- Rate limiting (2000 req/15min)
- Validación de tamaño de archivo (max 10MB)
- Permisos granulares por API key
- Logging de todas las operaciones

---

## 🔄 Próximos Pasos (Opcionales)

1. **Webhook al guardar**: Notificar a sistemas externos cuando se guarda un documento
2. **Bulk save**: Endpoint para guardar múltiples documentos en una llamada
3. **Update endpoint**: `PUT /save/:id` para actualizar documentos existentes
4. **Query endpoint**: `GET /documents` para listar documentos guardados vía API
5. **Delete endpoint**: `DELETE /save/:id` para eliminar documentos vía API

---

## 📞 Contacto

Para dudas o issues relacionados con este cambio:
- GitHub Issues: https://github.com/tu-org/parse/issues
- Email: soporte@parsedemo.com

---

**Última actualización**: 16 de Enero 2025
**Autor**: Claude Code
**Versión**: 1.0.0
