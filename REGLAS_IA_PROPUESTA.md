# Sistema de Reglas de Negocio con IA - Propuesta de Arquitectura

**Fecha:** 2025-11-07
**Estado:** Propuesta en discusión
**Objetivo:** Sistema genérico para aplicar IA a la clasificación/validación de datos extraídos de documentos

---

## 📋 Contexto

Necesidad de crear reglas de negocio ejecutadas con IA que puedan:
- Analizar cualquier dato extraído (cabecera, items, impuestos)
- Buscar en cualquier tabla de referencia (especialmente `parametros_maestros`)
- Aplicar clasificaciones/validaciones automáticas
- Requerir o no aprobación manual según confianza

**Ejemplo de uso:**
> "Recorrer los items de un comprobante, tomar la descripción de cada uno, buscar en una tabla de descripciones y traer la que considera más apropiada"

---

## 🎯 Conceptos Clave

### ¿Qué es un LLM?
**LLM = Large Language Model** (Modelo de Lenguaje Grande)

Ejemplos:
- **Claude** (Anthropic)
- **Gemini** (Google) - ya configurado en el proyecto
- **GPT-4** (OpenAI)
- **Llama** (Meta - puede correr local con Ollama)

### Enfoques de Implementación

#### 1️⃣ Embeddings + Búsqueda Semántica
**Cómo funciona:** Convertir descripciones a vectores y buscar similitud

**Ventajas:**
- ⚡ Muy rápido (milisegundos)
- 💰 Económico (~$0.0001 por 1000 tokens)
- 📈 Escalable (miles de descripciones)

**Mejor para:**
- Catálogos grandes (1000+ items)
- Búsquedas frecuentes
- Cuando el costo es crítico

#### 2️⃣ LLM Directo (Gemini/Claude)
**Cómo funciona:** Enviar descripción + opciones al LLM para que elija

**Ventajas:**
- 🧠 Razonamiento complejo y contextual
- 🔧 Sin setup inicial
- 📝 Explicable (justifica decisiones)

**Desventajas:**
- 💸 Más caro (~$0.003 por item)
- 🐌 Más lento (1-2 segundos)

**Mejor para:**
- Catálogos pequeños (<100 opciones)
- Cuando se necesita contexto
- Precisión crítica

#### 3️⃣ Híbrido (Recomendado a futuro)
**Flujo:**
1. Embeddings reduce 1000 opciones → Top 10
2. LLM analiza esas 10 con contexto → Elige mejor

**Balance ideal:** Velocidad + Precisión

---

## 🏗️ Arquitectura Propuesta: Sistema Genérico de Reglas IA

### Tabla Principal: `reglas_ia`

```sql
CREATE TABLE reglas_ia (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100),              -- "Clasificar items por categoría"
  descripcion TEXT,
  activa BOOLEAN DEFAULT true,

  -- ¿QUÉ DATOS ANALIZAR?
  entidad_origen VARCHAR(50),       -- 'documento', 'item', 'impuesto'
  campos_origen JSON,               -- ["descripcion", "monto", "proveedor_nombre"]

  -- ¿DÓNDE BUSCAR?
  tabla_referencia VARCHAR(100),    -- 'parametros_maestros'
  filtro_referencia JSON,           -- { "tipo": "categorias", "activo": true }
  campos_referencia JSON,           -- ["nombre", "descripcion", "keywords"]

  -- ¿QUÉ HACER CON EL RESULTADO?
  campo_destino VARCHAR(100),       -- "categoria_id"
  requiere_aprobacion BOOLEAN DEFAULT true,
  umbral_confianza DECIMAL(3,2) DEFAULT 0.85,

  -- INSTRUCCIONES PARA LA IA
  prompt_adicional TEXT,            -- instrucciones específicas del usuario

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla de Sugerencias: `sugerencias_ia`

```sql
CREATE TABLE sugerencias_ia (
  id SERIAL PRIMARY KEY,
  regla_id INTEGER REFERENCES reglas_ia(id),

  -- Referencia genérica a la entidad procesada
  entidad_tipo VARCHAR(50),         -- 'documento', 'item', 'impuesto'
  entidad_id INTEGER,

  -- Resultado de la IA
  valor_sugerido JSON,              -- flexible: puede ser ID, texto, objeto completo
  confianza DECIMAL(3,2),           -- 0.00 - 1.00
  razon TEXT,                       -- explicación de la IA

  -- Estado y aprobación
  estado VARCHAR(20),               -- 'pendiente', 'aprobada', 'rechazada', 'aplicada'
  revisado_por INTEGER REFERENCES users(id),
  revisado_at TIMESTAMP,

  -- Feedback para mejora continua
  valor_final JSON,                 -- lo que el usuario eligió (si difiere)

  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_sugerencias_estado ON sugerencias_ia(estado);
CREATE INDEX idx_sugerencias_entidad ON sugerencias_ia(entidad_tipo, entidad_id);
CREATE INDEX idx_sugerencias_regla ON sugerencias_ia(regla_id);
```

---

## 💡 Ejemplos de Reglas

### Ejemplo 1: Clasificar Items por Categoría

```json
{
  "nombre": "Clasificar items por categoría de gasto",
  "entidad_origen": "item",
  "campos_origen": ["descripcion", "monto"],
  "tabla_referencia": "parametros_maestros",
  "filtro_referencia": {
    "tipo": "categoria_gasto",
    "activo": true
  },
  "campos_referencia": ["valor", "descripcion", "metadata->keywords"],
  "campo_destino": "categoria_id",
  "umbral_confianza": 0.85,
  "requiere_aprobacion": true,
  "prompt_adicional": "Prioriza categorías de insumos de oficina si el proveedor es una papelería o comercio de artículos de oficina"
}
```

**Caso de uso:**
```
Item procesado:
  descripcion: "Toner HP LaserJet 305A"
  monto: 15000
  proveedor: "Distribuidora Office SA"

IA busca en parametros_maestros y sugiere:
  → "Insumos de impresión" (confianza: 95%)
  Razón: "Es un consumible de impresora, coincide con keywords 'toner', 'cartucho'"
```

### Ejemplo 2: Asignar Rubro a Proveedor

```json
{
  "nombre": "Detectar rubro de proveedor",
  "entidad_origen": "documento",
  "campos_origen": [
    "proveedor_nombre",
    "proveedor_cuit",
    "items[].descripcion"
  ],
  "tabla_referencia": "parametros_maestros",
  "filtro_referencia": {
    "tipo": "rubro_proveedor"
  },
  "campos_referencia": ["valor", "descripcion"],
  "campo_destino": "proveedor_rubro_id",
  "umbral_confianza": 0.75,
  "requiere_aprobacion": false,
  "prompt_adicional": "Analiza los items comprados para inferir el rubro principal del proveedor. Un proveedor que vende notebooks y monitores es 'Tecnología', no 'Varios'"
}
```

### Ejemplo 3: Clasificar Impuestos por Jurisdicción

```json
{
  "nombre": "Detectar jurisdicción de impuesto",
  "entidad_origen": "impuesto",
  "campos_origen": ["descripcion", "alicuota", "base_imponible"],
  "tabla_referencia": "parametros_maestros",
  "filtro_referencia": {
    "tipo": "jurisdiccion_impuesto"
  },
  "campos_referencia": [
    "valor",
    "descripcion",
    "metadata->alicuotas",
    "metadata->provincias"
  ],
  "campo_destino": "jurisdiccion_id",
  "umbral_confianza": 0.90,
  "requiere_aprobacion": true,
  "prompt_adicional": "IIBB (Ingresos Brutos) es provincial, IVA es nacional. Busca pistas en la descripción sobre la provincia si es IIBB. Alícuotas pueden ayudar: IVA suele ser 10.5% o 21%"
}
```

### Ejemplo 4: Validar Centro de Costos

```json
{
  "nombre": "Asignar centro de costos según item",
  "entidad_origen": "item",
  "campos_origen": [
    "descripcion",
    "documento.area_solicitante",
    "documento.proyecto_id"
  ],
  "tabla_referencia": "centros_costos",
  "filtro_referencia": {
    "activo": true
  },
  "campos_referencia": ["codigo", "nombre", "descripcion"],
  "campo_destino": "centro_costo_id",
  "umbral_confianza": 0.80,
  "requiere_aprobacion": false,
  "prompt_adicional": "Si el documento tiene proyecto_id asignado, ese proyecto define el centro de costos. Si no, usa el área solicitante. Items de tecnología van a 'IT', papelería a 'Administración'"
}
```

---

## 🔧 Motor de Ejecución - Pseudocódigo

```javascript
// backend/src/services/motorReglasIA.js

class MotorReglasIA {

  /**
   * Ejecuta una regla de IA sobre una entidad específica
   */
  async ejecutarRegla(reglaId, entidadId) {
    const regla = await prisma.reglaIA.findUnique({
      where: { id: reglaId }
    });

    if (!regla.activa) {
      throw new Error('Regla inactiva');
    }

    // 1. OBTENER DATOS DE LA ENTIDAD A ANALIZAR
    const datosOrigen = await this.obtenerDatosOrigen(
      regla.entidad_origen,   // 'item', 'documento', 'impuesto'
      entidadId,
      regla.campos_origen     // campos específicos a extraer
    );

    // 2. OBTENER OPCIONES DE REFERENCIA
    const datosReferencia = await this.obtenerDatosReferencia(
      regla.tabla_referencia,    // 'parametros_maestros'
      regla.filtro_referencia,   // filtros WHERE
      regla.campos_referencia    // columnas a incluir
    );

    // 3. CONSTRUIR PROMPT DINÁMICO
    const prompt = this.construirPrompt(
      datosOrigen,
      datosReferencia,
      regla.prompt_adicional
    );

    // 4. EJECUTAR IA (Gemini, Claude, etc)
    const resultado = await this.llamarIA(prompt);

    // 5. DECIDIR QUÉ HACER CON EL RESULTADO
    if (resultado.confianza >= regla.umbral_confianza
        && !regla.requiere_aprobacion) {
      // APLICAR AUTOMÁTICAMENTE
      await this.aplicarResultado(regla, entidadId, resultado);
      await this.guardarSugerencia(regla, entidadId, resultado, 'aplicada');
    } else {
      // GUARDAR PARA REVISIÓN MANUAL
      await this.guardarSugerencia(regla, entidadId, resultado, 'pendiente');
    }

    return resultado;
  }

  /**
   * Obtiene datos de la entidad origen según tipo
   */
  async obtenerDatosOrigen(entidad, id, campos) {
    switch(entidad) {
      case 'documento':
        return await prisma.documento.findUnique({
          where: { id },
          select: this.camposASelect(campos),
          include: {
            proveedor: true,
            items: true  // contexto completo
          }
        });

      case 'item':
        return await prisma.documentoItem.findUnique({
          where: { id },
          select: this.camposASelect(campos),
          include: {
            documento: {
              include: { proveedor: true }
            }
          }
        });

      case 'impuesto':
        return await prisma.documentoImpuesto.findUnique({
          where: { id },
          include: { documento: true }
        });

      default:
        throw new Error(`Entidad desconocida: ${entidad}`);
    }
  }

  /**
   * Obtiene datos de tabla de referencia
   */
  async obtenerDatosReferencia(tabla, filtro, campos) {
    // Opción segura: usar Prisma dinámicamente
    if (prisma[tabla]) {
      return await prisma[tabla].findMany({
        where: filtro,
        select: this.camposASelect(campos)
      });
    }

    // Opción avanzada: query raw (requiere sanitización)
    const whereClause = this.buildWhereClause(filtro);
    const query = `
      SELECT ${campos.join(', ')}
      FROM ${tabla}
      WHERE ${whereClause}
    `;

    return await prisma.$queryRawUnsafe(query);
  }

  /**
   * Construye el prompt para la IA
   */
  construirPrompt(datosOrigen, datosReferencia, instruccionesExtra) {
    return `
Eres un asistente que clasifica datos financieros.

DATOS A ANALIZAR:
${JSON.stringify(datosOrigen, null, 2)}

OPCIONES DISPONIBLES:
${datosReferencia.map((opt, i) =>
  `${i+1}. ${JSON.stringify(opt)}`
).join('\n')}

INSTRUCCIONES ADICIONALES:
${instruccionesExtra || 'Ninguna'}

IMPORTANTE:
- Analiza cuidadosamente los datos proporcionados
- Considera el contexto completo (proveedor, montos, etc)
- Elige la opción más apropiada según las instrucciones

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "opcion_elegida": <número del 1 al ${datosReferencia.length}>,
  "confianza": <número entre 0.0 y 1.0>,
  "razon": "<explicación breve de tu elección>"
}
    `.trim();
  }

  /**
   * Llama a la IA (Gemini en este caso)
   */
  async llamarIA(prompt) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Limpiar y parsear respuesta
    const jsonText = this.limpiarRespuestaJSON(responseText);
    const parsed = JSON.parse(jsonText);

    return {
      opcion_id: parsed.opcion_elegida,
      confianza: parsed.confianza,
      razon: parsed.razon,
      respuesta_completa: responseText
    };
  }

  /**
   * Aplica el resultado a la entidad
   */
  async aplicarResultado(regla, entidadId, resultado) {
    const updateData = {
      [regla.campo_destino]: resultado.opcion_id
    };

    switch(regla.entidad_origen) {
      case 'item':
        await prisma.documentoItem.update({
          where: { id: entidadId },
          data: updateData
        });
        break;

      case 'documento':
        await prisma.documento.update({
          where: { id: entidadId },
          data: updateData
        });
        break;

      case 'impuesto':
        await prisma.documentoImpuesto.update({
          where: { id: entidadId },
          data: updateData
        });
        break;
    }
  }

  /**
   * Guarda sugerencia para auditoría/revisión
   */
  async guardarSugerencia(regla, entidadId, resultado, estado) {
    return await prisma.sugerenciaIA.create({
      data: {
        reglaId: regla.id,
        entidadTipo: regla.entidad_origen,
        entidadId: entidadId,
        valorSugerido: { id: resultado.opcion_id },
        confianza: resultado.confianza,
        razon: resultado.razon,
        estado: estado
      }
    });
  }
}

module.exports = new MotorReglasIA();
```

---

## 🎨 UI Propuesta

### Panel de Gestión de Reglas

```typescript
// frontend/src/app/(protected)/reglas-ia/page.tsx

interface ReglaIA {
  id: number;
  nombre: string;
  entidadOrigen: 'documento' | 'item' | 'impuesto';
  activa: boolean;
  sugerenciasPendientes: number;
}

function ReglasIAPage() {
  return (
    <div>
      <h1>Reglas de IA</h1>

      <Button onClick={crearNuevaRegla}>
        + Nueva Regla
      </Button>

      <Table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Aplica a</th>
            <th>Estado</th>
            <th>Pendientes</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reglas.map(regla => (
            <tr key={regla.id}>
              <td>{regla.nombre}</td>
              <td>{regla.entidadOrigen}</td>
              <td>
                <Switch
                  checked={regla.activa}
                  onChange={() => toggleRegla(regla.id)}
                />
              </td>
              <td>
                <Badge>{regla.sugerenciasPendientes}</Badge>
              </td>
              <td>
                <Button onClick={() => editarRegla(regla)}>
                  Editar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
```

### Formulario de Creación de Regla

```typescript
function FormularioReglaIA() {
  return (
    <Form>
      <Input
        label="Nombre de la regla"
        placeholder="Ej: Clasificar items por categoría"
      />

      <Select label="¿Qué quieres clasificar?">
        <option value="item">Items de documentos</option>
        <option value="documento">Documentos completos</option>
        <option value="impuesto">Impuestos</option>
      </Select>

      <MultiSelect label="Campos a analizar">
        {/* Opciones dinámicas según entidad elegida */}
        <option value="descripcion">Descripción</option>
        <option value="monto">Monto</option>
        <option value="proveedor_nombre">Proveedor</option>
      </MultiSelect>

      <Select label="Buscar en tabla">
        <option value="parametros_maestros">Parámetros Maestros</option>
        <option value="categorias">Categorías</option>
        <option value="centros_costos">Centros de Costos</option>
      </Select>

      <JsonEditor
        label="Filtro de registros"
        placeholder='{ "tipo": "categoria_gasto", "activo": true }'
      />

      <TextArea
        label="Instrucciones adicionales para la IA"
        placeholder="Ej: Considera el contexto del proveedor..."
        rows={4}
      />

      <RangeSlider
        label="Umbral de confianza"
        min={0}
        max={100}
        defaultValue={85}
        suffix="%"
      />

      <Checkbox
        label="Requiere aprobación manual"
        defaultChecked
      />

      <Button type="submit">Crear Regla</Button>
    </Form>
  );
}
```

### Panel de Sugerencias Pendientes

```typescript
function SugerenciasPendientesPage() {
  return (
    <div>
      <h1>Sugerencias de IA Pendientes</h1>

      <Filters>
        <Select label="Regla">
          <option value="all">Todas</option>
          {reglas.map(r => <option value={r.id}>{r.nombre}</option>)}
        </Select>

        <Select label="Confianza">
          <option value="all">Todas</option>
          <option value="high">Alta (&gt;90%)</option>
          <option value="medium">Media (70-90%)</option>
          <option value="low">Baja (&lt;70%)</option>
        </Select>
      </Filters>

      <Button onClick={aprobarTodas}>
        ✓ Aprobar Todas (Confianza &gt; 90%)
      </Button>

      {sugerencias.map(sug => (
        <Card key={sug.id}>
          <div className="flex justify-between">
            <div>
              <h3>{sug.regla.nombre}</h3>
              <p>Item: {sug.entidad.descripcion}</p>

              <div className="mt-2">
                <strong>Sugerencia IA:</strong> {sug.valorSugerido.nombre}
                <Progress value={sug.confianza * 100} />
                <small>{sug.razon}</small>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="success"
                onClick={() => aprobar(sug.id)}
              >
                ✓ Aprobar
              </Button>

              <Button
                variant="danger"
                onClick={() => rechazar(sug.id)}
              >
                ✗ Rechazar
              </Button>

              <Select
                placeholder="Elegir otra..."
                onChange={(opt) => aplicarOtra(sug.id, opt)}
              >
                {sug.opcionesDisponibles.map(opt => (
                  <option value={opt.id}>{opt.nombre}</option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

---

## 🚀 Plan de Implementación

### Fase 1: Motor Genérico (3-4 días)

**Tareas:**
- [ ] Crear migración Prisma para `reglas_ia`
- [ ] Crear migración Prisma para `sugerencias_ia`
- [ ] Implementar clase `MotorReglasIA`
  - [ ] Método `obtenerDatosOrigen()`
  - [ ] Método `obtenerDatosReferencia()`
  - [ ] Método `construirPrompt()`
  - [ ] Método `llamarIA()` (usar Gemini existente)
  - [ ] Método `aplicarResultado()`
  - [ ] Método `guardarSugerencia()`
- [ ] Endpoints API:
  - [ ] `POST /api/reglas-ia` - crear regla
  - [ ] `GET /api/reglas-ia` - listar reglas
  - [ ] `PUT /api/reglas-ia/:id` - editar regla
  - [ ] `POST /api/reglas-ia/:id/ejecutar` - ejecutar regla
  - [ ] `GET /api/sugerencias-ia` - listar sugerencias
  - [ ] `POST /api/sugerencias-ia/:id/aprobar` - aprobar
  - [ ] `POST /api/sugerencias-ia/:id/rechazar` - rechazar

**Entregable:** Motor funcional con API completa

---

### Fase 2: Primera Regla de Prueba (1-2 días)

**Tareas:**
- [ ] Insertar manualmente regla de prueba en BD
- [ ] Ejemplo: "Clasificar items por categoría"
- [ ] Crear 10-20 categorías en `parametros_maestros`
- [ ] Ejecutar regla sobre 20 documentos reales
- [ ] Analizar resultados:
  - [ ] % de precisión
  - [ ] Confianza promedio
  - [ ] Errores comunes
- [ ] Ajustar prompts según resultados
- [ ] Documentar mejores prácticas

**Entregable:** Validación de concepto exitosa

---

### Fase 3: UI de Gestión (2-3 días)

**Tareas:**
- [ ] Página `/reglas-ia`
  - [ ] Listar reglas existentes
  - [ ] Activar/desactivar reglas
  - [ ] Ver estadísticas por regla
- [ ] Formulario crear/editar regla
  - [ ] Selección de entidad
  - [ ] Multi-select de campos
  - [ ] Editor JSON para filtros
  - [ ] TextArea para prompts
  - [ ] Validaciones
- [ ] Página `/sugerencias-ia`
  - [ ] Listar pendientes
  - [ ] Filtros (regla, confianza, fecha)
  - [ ] Aprobar/rechazar individual
  - [ ] Aprobar en batch (alta confianza)
  - [ ] Seleccionar opción alternativa
- [ ] Dashboard de métricas
  - [ ] Precisión por regla
  - [ ] Tiempo de revisión promedio
  - [ ] Feedback positivo/negativo

**Entregable:** Interface completa para usuarios

---

### Fase 4: Integración en Flujo de Procesamiento (1-2 días)

**Tareas:**
- [ ] Hook en `documentProcessor.js` post-extracción
- [ ] Ejecutar reglas activas automáticamente
- [ ] Para cada regla:
  - [ ] Si `entidad_origen = 'item'` → recorrer items
  - [ ] Si `entidad_origen = 'documento'` → ejecutar una vez
  - [ ] Si `entidad_origen = 'impuesto'` → recorrer impuestos
- [ ] Aplicar sugerencias con alta confianza
- [ ] Notificar usuario de sugerencias pendientes
- [ ] Logging detallado para debugging

**Entregable:** Clasificación automática al procesar documentos

---

### Fase 5: Mejora Continua (continuo)

**Tareas:**
- [ ] Sistema de feedback
  - [ ] Registrar aceptaciones/rechazos
  - [ ] Identificar patrones de error
- [ ] Mejora de prompts
  - [ ] A/B testing de prompts
  - [ ] Agregar ejemplos exitosos al prompt
- [ ] Análisis de performance
  - [ ] Medir latencia por regla
  - [ ] Optimizar queries pesadas
- [ ] Migración a embeddings (si es necesario)
  - [ ] Solo para reglas con muchas opciones
  - [ ] Mantener LLM como fallback

**Entregable:** Sistema auto-mejorado

---

## 💰 Estimación de Costos

### Escenario: 1000 documentos/mes, 5 items promedio

| Concepto | Cantidad | Costo Unitario | Total Mensual |
|----------|----------|----------------|---------------|
| Items procesados | 5,000 | $0.001 | $5 |
| Documentos procesados | 1,000 | $0.003 | $3 |
| Impuestos procesados | 3,000 | $0.001 | $3 |
| **TOTAL** | - | - | **~$11/mes** |

**Nota:** Usando Gemini Flash. Con embeddings sería ~$2/mes pero requiere más setup.

---

## ✅ Ventajas del Sistema

1. **Genérico y Reutilizable**
   - Una vez implementado, solo se configuran reglas
   - No requiere código nuevo por cada caso de uso

2. **Flexible**
   - Funciona con cualquier entidad (documento, item, impuesto)
   - Busca en cualquier tabla de referencia
   - Prompts personalizables por regla

3. **Escalable**
   - Agregar reglas no afecta performance
   - Se puede migrar a embeddings si crece mucho

4. **Auditable**
   - Toda sugerencia queda registrada
   - Trazabilidad completa de decisiones
   - Feedback para mejorar

5. **Progresivo**
   - Empieza con aprobación manual
   - Confianza alta → automático
   - Bajo riesgo de errores

6. **Integrado con Parametros**
   - Usa tabla `parametros_maestros` existente
   - No duplica configuración
   - Centralizado

---

## 🎯 Casos de Uso Adicionales

Una vez implementado el sistema, se pueden crear reglas para:

### Validaciones
- ✅ "Validar que items de tecnología >$50K tengan 3 presupuestos"
- ✅ "Alertar si precio unitario es 200% mayor al histórico"
- ✅ "Verificar que facturas A tengan CUIT válido"

### Enriquecimiento
- ✅ "Completar código contable según categoría + centro de costo"
- ✅ "Sugerir proyecto según descripción de item"
- ✅ "Asignar aprobador según monto y tipo de gasto"

### Detección
- ✅ "Detectar facturas duplicadas (mismo proveedor + monto + fecha cercana)"
- ✅ "Identificar gastos recurrentes (misma descripción mensual)"
- ✅ "Marcar items sospechosos (descripción genérica + monto alto)"

### Clasificación Avanzada
- ✅ "Categorizar por naturaleza del gasto (inversión vs gasto corriente)"
- ✅ "Determinar si es activo fijo según descripción + monto"
- ✅ "Clasificar urgencia de pago según términos en la factura"

---

## 🔐 Consideraciones de Seguridad

### 1. Sanitización de Queries
```javascript
// ❌ NUNCA HACER (inyección SQL)
const query = `SELECT * FROM ${tabla} WHERE ${filtro}`;

// ✅ CORRECTO (usar Prisma o parámetros)
const data = await prisma[tabla].findMany({
  where: JSON.parse(filtro)  // validar primero
});
```

### 2. Validación de Configuración
```javascript
// Validar que campos existen en el schema
function validarCampos(entidad, campos) {
  const camposValidos = {
    'item': ['id', 'descripcion', 'monto', 'cantidad'],
    'documento': ['id', 'numeroFactura', 'proveedor', 'fecha'],
    'impuesto': ['id', 'descripcion', 'alicuota', 'base']
  };

  const invalidos = campos.filter(c =>
    !camposValidos[entidad].includes(c)
  );

  if (invalidos.length > 0) {
    throw new Error(`Campos inválidos: ${invalidos.join(', ')}`);
  }
}
```

### 3. Límites de Ejecución
```javascript
// Prevenir abuse de la API de IA
const LIMITE_EJECUCIONES_DIA = 10000;
const LIMITE_POR_REGLA_HORA = 1000;

async function verificarLimites(reglaId) {
  const ejecucionesHoy = await contarEjecuciones(reglaId, '1 day');
  const ejecucionesHora = await contarEjecuciones(reglaId, '1 hour');

  if (ejecucionesHoy > LIMITE_EJECUCIONES_DIA) {
    throw new Error('Límite diario excedido');
  }

  if (ejecucionesHora > LIMITE_POR_REGLA_HORA) {
    throw new Error('Límite horario excedido, intenta más tarde');
  }
}
```

### 4. Permisos de Usuario
```javascript
// Solo admins pueden crear/editar reglas
// Usuarios pueden ver sugerencias de su tenant
async function verificarPermisos(userId, accion) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });

  if (accion === 'crear_regla' && user.profile.role !== 'ADMIN') {
    throw new Error('Permisos insuficientes');
  }
}
```

---

## 📚 Referencias Técnicas

### APIs de IA
- **Gemini API:** https://ai.google.dev/docs
- **Claude API:** https://docs.anthropic.com/
- **OpenAI API:** https://platform.openai.com/docs

### Embeddings
- **Google Vertex AI Embeddings:** https://cloud.google.com/vertex-ai/docs/generative-ai/embeddings
- **OpenAI Embeddings:** https://platform.openai.com/docs/guides/embeddings
- **Ollama (local):** https://ollama.com/

### Búsqueda Vectorial
- **pgvector (PostgreSQL):** https://github.com/pgvector/pgvector
- **Pinecone:** https://www.pinecone.io/
- **Weaviate:** https://weaviate.io/

---

## 🤔 Preguntas Pendientes

1. ¿Estructura actual de `parametros_maestros`?
   - ¿Tiene campo `tipo` para categorizar?
   - ¿Cómo se almacenan keywords/metadatos?

2. ¿Nivel de automatización deseado?
   - ¿Todo requiere aprobación inicial?
   - ¿Automatizar progresivamente según precisión?

3. ¿Roles y permisos?
   - ¿Quién puede crear reglas?
   - ¿Quién aprueba sugerencias?

4. ¿Prioridad de casos de uso?
   - Empezar con clasificación de items?
   - O con validación de proveedores?

5. ¿Budget de API?
   - ¿Cuántos documentos/mes se procesan actualmente?
   - ¿Límite de costo mensual aceptable?

---

## 📝 Notas Finales

Este documento describe una arquitectura **genérica y extensible** para aplicar IA a cualquier tipo de clasificación/validación en el sistema de rendiciones.

**Principio de diseño:** "Configurar, no programar"
- Los usuarios crean reglas desde la UI
- El motor ejecuta cualquier regla de manera uniforme
- No se necesita código nuevo por cada caso de uso

**Siguiente paso recomendado:**
Validar el diseño con un stakeholder técnico y luego implementar Fase 1 (motor genérico) para tener una base sólida.

---

**Autor:** Claude (Anthropic)
**Contacto proyecto:** Parse Demo - Rendiciones App
**Actualizado:** 2025-11-07
