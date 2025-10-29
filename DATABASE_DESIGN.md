# Diseño de Base de Datos - Sistema de Rendiciones

## Resumen
El sistema maneja dos tablas principales:
1. **`resumen_tarjeta`**: Almacena los datos crudos del archivo DKT (37 campos)
2. **`rendicion_tarjeta`**: Almacena los datos procesados para contabilidad

## Tabla: `resumen_tarjeta`

### Propósito
Almacena todos los 37 campos del archivo DKT importado sin procesamiento.

### Estructura
```sql
CREATE TABLE resumen_tarjeta (
  id SERIAL PRIMARY KEY,
  codigo_tarjeta VARCHAR(10) NOT NULL,           -- Parámetro de entrada (ej: ICBCVC)
  lote_id VARCHAR(20) UNIQUE NOT NULL,           -- codigo_tarjeta + periodo para evitar duplicados
  
  -- CAMPOS 1-37 DEL ARCHIVO DKT
  codigo_banco VARCHAR(3),                       -- Campo [1] LEFT(3)
  codigo_empresa VARCHAR(3),                     -- Campo [1] RIGHT(3)  
  codigo_planta VARCHAR(10),                     -- Campo [2]
  codigo_area VARCHAR(10),                       -- Campo [3]
  codigo_sector VARCHAR(10),                     -- Campo [4]
  periodo VARCHAR(6),                            -- Campo [5] - AAMM
  cartera VARCHAR(10),                           -- Campo [6]
  tipo_transaccion VARCHAR(1),                   -- Campo [7] - A=Adelanto, C=Compra, D=Devolución
  codigo_sucursal VARCHAR(10),                   -- Campo [8]
  grupo_afinidad VARCHAR(20),                    -- Campo [9]
  numero_cuenta VARCHAR(20),                     -- Campo [10]
  codigo_geografico_usuario VARCHAR(10),         -- Campo [11]
  numero_tarjeta VARCHAR(20),                    -- Campo [12]
  apellido_nombre_usuario VARCHAR(100),          -- Campo [13]
  fecha_transaccion VARCHAR(10),                 -- Campo [14]
  descripcion_cupon VARCHAR(50),                 -- Campo [15]
  resto_mensaje VARCHAR(50),                     -- Campo vacío
  numero_cupon VARCHAR(20),                      -- Campo [16]
  moneda VARCHAR(3),                             -- Campo [17] - ARP, USD
  importe_transaccion DECIMAL(18,2),             -- Campo [18]
  tipo_consumo VARCHAR(1),                       -- Campo [19] - I=Internacional, L=Local
  localidad VARCHAR(50),                         -- Campo [20]
  debito_automatico VARCHAR(10),                 -- Campo [21]
  movimiento_cajero VARCHAR(10),                 -- Campo [22]
  grupo_rubro VARCHAR(10),                       -- Campo [23] - Se usa para mapear productos
  descripcion_rubro VARCHAR(50),                 -- Campo [24]
  codigo_geografico_establecimiento VARCHAR(10), -- Campo [25]
  limite_compra_excepcion DECIMAL(18,2),         -- Campo [26]
  limite_cuotas_excepcion DECIMAL(18,2),         -- Campo [27]
  limite_adelanto_excepcion DECIMAL(18,2),       -- Campo [28]
  fecha_vigencia_compra VARCHAR(10),             -- Campo [29]
  fecha_vigencia_adelanto VARCHAR(10),           -- Campo [30]
  xxx1 VARCHAR(20),                              -- Campo [31]
  xxx2 VARCHAR(20),                              -- Campo [32]
  cuit VARCHAR(20),                              -- Campo [33]
  rubro_visa VARCHAR(10),                        -- Campo [34]
  moneda_origen_descripcion VARCHAR(50),         -- Campo [35]
  importe_origen DECIMAL(18,2),                  -- Campo [36]
  campo_vacio VARCHAR(10),                       -- Campo [37]
  
  -- CAMPOS DE AUDITORÍA
  fecha_importacion TIMESTAMP DEFAULT NOW(),
  usuario_importacion VARCHAR(50),
  estado VARCHAR(20) DEFAULT 'importado'
);
```

### Índices Recomendados
```sql
CREATE UNIQUE INDEX idx_resumen_lote ON resumen_tarjeta(lote_id);
CREATE INDEX idx_resumen_codigo_tarjeta ON resumen_tarjeta(codigo_tarjeta);
CREATE INDEX idx_resumen_periodo ON resumen_tarjeta(periodo);
CREATE INDEX idx_resumen_numero_tarjeta ON resumen_tarjeta(numero_tarjeta);
```

## Estructura de 4 Niveles para Rendiciones

El sistema maneja 4 niveles de detalle para cubrir todos los casos de uso:

1. **`resumen_tarjeta`**: Datos crudos del archivo DKT (nivel cupón)
2. **`rendicion_tarjeta`**: Procesamiento inicial (1 registro por cupón)  
3. **`rendicion_comprobantes`**: Detalle de comprobantes (N por rendición)
4. **`rendicion_distribuciones`**: Distribuciones contables (N por comprobante)

### Flujo de Datos
```
Archivo DKT → resumen_tarjeta (cupón) 
                ↓
            rendicion_tarjeta (procesamiento)
                ↓
            rendicion_comprobantes (facturas/comprobantes)
                ↓  
            rendicion_distribuciones (centros de costo)
```

## Tabla: `rendicion_tarjeta`

### Propósito
Almacena los datos procesados y enriquecidos para contabilidad, basados en los datos de `resumen_tarjeta`. **Un registro por cupón**.

### Estructura
```sql
CREATE TABLE rendicion_tarjeta (
  -- CAMPOS PRIMARIOS
  id SERIAL PRIMARY KEY,
  resumen_id INTEGER REFERENCES resumen_tarjeta(id),
  
  -- GRUPO 1: Información básica de la transacción
  cuenta_corriente VARCHAR(20),
  periodo VARCHAR(6),
  numero_movimiento INTEGER,
  item INTEGER,
  fecha_movimiento DATE,
  numero_cupon VARCHAR(20),
  total_cupon DECIMAL(18,2),
  total_linea DECIMAL(18,2),
  
  -- GRUPO 2: Productos y conceptos (requieren parametrización)
  tipo_producto VARCHAR(10),             -- Tabla: productos_tipos
  codigo_producto VARCHAR(20),           -- Tabla: productos
  concepto_modulo VARCHAR(10),           -- Tabla: conceptos_modulos
  concepto_tipo VARCHAR(10),             -- Tabla: conceptos_tipos
  concepto_codigo VARCHAR(20),           -- Tabla: conceptos
  cantidad DECIMAL(18,2),
  precio DECIMAL(18,2),
  
  -- GRUPO 3: Información del comercio/proveedor
  modulo_comprobante VARCHAR(10),
  tipo_registro VARCHAR(20),
  comprobante_origen VARCHAR(10),
  codigo_origen VARCHAR(20),
  numero_cuenta_proveedor VARCHAR(20),
  nombre_comercio VARCHAR(100),
  nombre_proveedor VARCHAR(100),
  direccion VARCHAR(200),
  
  -- GRUPO 4: Información fiscal
  tipo_documento VARCHAR(3),             -- Tabla: tipos_documento
  numero_documento VARCHAR(20),
  codigo_pais VARCHAR(3),               -- Tabla: paises
  codigo_postal VARCHAR(10),
  condicion_iva VARCHAR(2),             -- Tabla: condiciones_iva
  codigo_moneda VARCHAR(3),             -- Tabla: monedas
  
  -- GRUPO 5: Contabilidad y cuentas
  cuenta_contable VARCHAR(20),           -- Tabla: plan_cuentas
  tipo_operacion VARCHAR(10),           -- Tabla: tipos_operacion
  tipo_comprobante VARCHAR(10),         -- Tabla: tipos_comprobante
  codigo_dimension VARCHAR(10),         -- Tabla: dimensiones
  subcuenta VARCHAR(20),                -- Tabla: subcuentas
  
  -- GRUPO 6: Campos adicionales
  textos TEXT,
  
  -- CAMPOS DE AUDITORÍA
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_modificacion TIMESTAMP DEFAULT NOW(),
  usuario_creacion VARCHAR(50),
  ultima_operacion VARCHAR(1),
  dado_de_baja VARCHAR(1) DEFAULT 'N',
  tabla_origen VARCHAR(20)
);
```

### Índices Recomendados
```sql
CREATE INDEX idx_rendicion_resumen ON rendicion_tarjeta(resumen_id);
CREATE INDEX idx_rendicion_periodo ON rendicion_tarjeta(periodo);
CREATE INDEX idx_rendicion_cuenta ON rendicion_tarjeta(cuenta_corriente);
CREATE INDEX idx_rendicion_fecha ON rendicion_tarjeta(fecha_movimiento);
```

## Tabla: `rendicion_comprobantes`

### Propósito
Almacena el detalle de comprobantes dentro de cada cupón. **Múltiples comprobantes por rendición**.
Permite dividir un cupón en varias facturas o documentos con datos específicos.

### Estructura
```sql
CREATE TABLE rendicion_comprobantes (
  id SERIAL PRIMARY KEY,
  rendicion_id INTEGER NOT NULL REFERENCES rendicion_tarjeta(id),
  
  -- Numeración de comprobantes dentro del cupón
  numero_comprobante_interno INTEGER NOT NULL,
  es_comprobante_principal BOOLEAN DEFAULT false,
  
  -- Información específica del comprobante (puede diferir del padre)
  tipo_comprobante VARCHAR(10),              -- Puede ser distinto al padre
  numero_comprobante_externo VARCHAR(50),    -- Número de factura/documento
  fecha_comprobante DATE,                    -- Puede ser distinta al cupón
  
  -- Importes específicos del comprobante
  subtotal DECIMAL(18,2),
  iva_base DECIMAL(18,2),
  iva_importe DECIMAL(18,2),
  otros_impuestos DECIMAL(18,2),
  total_comprobante DECIMAL(18,2) NOT NULL,
  
  -- Información del proveedor/comercio (puede ser específica)
  cuit_comprobante VARCHAR(20),
  razon_social_comprobante VARCHAR(200),
  domicilio_comprobante VARCHAR(200),
  condicion_iva_comprobante VARCHAR(2),
  
  -- Observaciones específicas
  observaciones TEXT,
  
  -- Campos de auditoría
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_modificacion TIMESTAMP DEFAULT NOW(),
  usuario_creacion VARCHAR(50),
  activo BOOLEAN DEFAULT true,
  
  -- Constraint: suma de comprobantes = total cupón
  CONSTRAINT chk_numero_interno_positivo CHECK (numero_comprobante_interno > 0)
);

-- Índices
CREATE INDEX idx_comprobantes_rendicion ON rendicion_comprobantes(rendicion_id);
CREATE INDEX idx_comprobantes_principal ON rendicion_comprobantes(es_comprobante_principal);
CREATE INDEX idx_comprobantes_activo ON rendicion_comprobantes(activo);
CREATE UNIQUE INDEX idx_comprobantes_numero ON rendicion_comprobantes(rendicion_id, numero_comprobante_interno);
```

## Tabla: `rendicion_distribuciones` (Flexible)

### Propósito
Almacena las distribuciones contables por centro de costo/dimensión.
**Puede relacionarse TANTO con `rendicion_tarjeta` como con `rendicion_comprobantes`**.

### Casos de Uso
1. **Distribución Directa**: Desde `rendicion_tarjeta` (sin crear comprobantes detallados)
2. **Distribución por Comprobantes**: Desde `rendicion_comprobantes` (nivel detallado)

### Estructura
```sql
CREATE TABLE rendicion_distribuciones (
  id SERIAL PRIMARY KEY,
  
  -- DOBLE FK: Puede referenciar TANTO rendición como comprobante
  rendicion_id INTEGER REFERENCES rendicion_tarjeta(id),        -- FK a nivel rendición
  comprobante_id INTEGER REFERENCES rendicion_comprobantes(id), -- FK a nivel comprobante
  
  -- Numeración de distribuciones
  numero_distribucion INTEGER NOT NULL,
  
  -- Distribución contable (dimensión + subcuenta)
  codigo_dimension VARCHAR(10) NOT NULL,     -- Referencia a parametros_maestros
  subcuenta VARCHAR(20) NOT NULL,            -- Referencia a parametros_maestros
  
  -- Cuenta contable específica
  cuenta_contable VARCHAR(20),
  
  -- Importes de la distribución
  importe_debe DECIMAL(18,2) DEFAULT 0,
  importe_haber DECIMAL(18,2) DEFAULT 0,
  porcentaje_distribucion DECIMAL(5,2),     -- % del total
  
  -- Descripción de la distribución
  descripcion_distribucion VARCHAR(200),
  centro_costo_descripcion VARCHAR(100),
  
  -- Campos de control
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_modificacion TIMESTAMP DEFAULT NOW(),
  usuario_creacion VARCHAR(50),
  activo BOOLEAN DEFAULT true,
  
  -- CONSTRAINTS CRÍTICOS
  CONSTRAINT chk_numero_dist_positivo CHECK (numero_distribucion > 0),
  CONSTRAINT chk_debe_o_haber CHECK (
    (importe_debe > 0 AND importe_haber = 0) OR 
    (importe_debe = 0 AND importe_haber > 0) OR
    (importe_debe = 0 AND importe_haber = 0 AND porcentaje_distribucion > 0)
  ),
  CONSTRAINT chk_porcentaje_valido CHECK (porcentaje_distribucion BETWEEN 0 AND 100),
  
  -- CONSTRAINT PRINCIPAL: Solo una FK debe estar poblada
  CONSTRAINT chk_una_sola_fk CHECK (
    (rendicion_id IS NOT NULL AND comprobante_id IS NULL) OR 
    (rendicion_id IS NULL AND comprobante_id IS NOT NULL)
  )
);

-- Índices actualizados
CREATE INDEX idx_distribuciones_rendicion ON rendicion_distribuciones(rendicion_id);
CREATE INDEX idx_distribuciones_comprobante ON rendicion_distribuciones(comprobante_id);
CREATE INDEX idx_distribuciones_dimension ON rendicion_distribuciones(codigo_dimension);
CREATE INDEX idx_distribuciones_subcuenta ON rendicion_distribuciones(subcuenta);
CREATE INDEX idx_distribuciones_cuenta ON rendicion_distribuciones(cuenta_contable);
CREATE INDEX idx_distribuciones_activo ON rendicion_distribuciones(activo);

-- Índices únicos por contexto
CREATE UNIQUE INDEX idx_distribuciones_numero_rendicion 
  ON rendicion_distribuciones(rendicion_id, numero_distribucion) 
  WHERE rendicion_id IS NOT NULL;
  
CREATE UNIQUE INDEX idx_distribuciones_numero_comprobante 
  ON rendicion_distribuciones(comprobante_id, numero_distribucion) 
  WHERE comprobante_id IS NOT NULL;
```

## Validación de Integridad

### Triggers para Control de Sumas
```sql
-- Trigger: Suma de comprobantes = Total cupón
CREATE OR REPLACE FUNCTION validar_suma_comprobantes()
RETURNS TRIGGER AS $$
DECLARE
  total_cupón DECIMAL(18,2);
  suma_comprobantes DECIMAL(18,2);
BEGIN
  SELECT total_cupon INTO total_cupón
  FROM rendicion_tarjeta rt
  WHERE rt.id = COALESCE(NEW.rendicion_id, OLD.rendicion_id);
  
  SELECT COALESCE(SUM(total_comprobante), 0) INTO suma_comprobantes
  FROM rendicion_comprobantes 
  WHERE rendicion_id = COALESCE(NEW.rendicion_id, OLD.rendicion_id)
    AND activo = true;
    
  IF suma_comprobantes != total_cupón THEN
    RAISE EXCEPTION 'Suma comprobantes (%) ≠ Total cupón (%)', 
      suma_comprobantes, total_cupón;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_suma_comprobantes
  AFTER INSERT OR UPDATE OR DELETE ON rendicion_comprobantes
  FOR EACH ROW EXECUTE FUNCTION validar_suma_comprobantes();

-- Trigger actualizado: Validar distribuciones contra rendición O comprobante
CREATE OR REPLACE FUNCTION validar_suma_distribuciones()
RETURNS TRIGGER AS $$
DECLARE
  total_objetivo DECIMAL(18,2);
  suma_distribuciones DECIMAL(18,2);
  contexto_validacion VARCHAR(50);
BEGIN
  -- Determinar contexto y obtener total objetivo
  IF COALESCE(NEW.rendicion_id, OLD.rendicion_id) IS NOT NULL THEN
    -- Validar contra total de rendición
    SELECT total_cupon INTO total_objetivo
    FROM rendicion_tarjeta rt
    WHERE rt.id = COALESCE(NEW.rendicion_id, OLD.rendicion_id);
    
    SELECT COALESCE(SUM(GREATEST(importe_debe, importe_haber)), 0) INTO suma_distribuciones
    FROM rendicion_distribuciones 
    WHERE rendicion_id = COALESCE(NEW.rendicion_id, OLD.rendicion_id)
      AND activo = true;
      
    contexto_validacion := 'rendición';
    
  ELSIF COALESCE(NEW.comprobante_id, OLD.comprobante_id) IS NOT NULL THEN
    -- Validar contra total de comprobante
    SELECT total_comprobante INTO total_objetivo
    FROM rendicion_comprobantes rc
    WHERE rc.id = COALESCE(NEW.comprobante_id, OLD.comprobante_id);
    
    SELECT COALESCE(SUM(GREATEST(importe_debe, importe_haber)), 0) INTO suma_distribuciones
    FROM rendicion_distribuciones 
    WHERE comprobante_id = COALESCE(NEW.comprobante_id, OLD.comprobante_id)
      AND activo = true;
      
    contexto_validacion := 'comprobante';
    
  ELSE
    RAISE EXCEPTION 'Distribución debe referenciar rendición o comprobante';
  END IF;
    
  -- Validar coincidencia (permitir diferencias menores por redondeo)
  IF ABS(suma_distribuciones - total_objetivo) > 0.01 THEN
    RAISE EXCEPTION 'Suma distribuciones (%) ≠ Total % (%). Contexto: %', 
      suma_distribuciones, total_objetivo, contexto_validacion;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_suma_distribuciones
  AFTER INSERT OR UPDATE OR DELETE ON rendicion_distribuciones
  FOR EACH ROW EXECUTE FUNCTION validar_suma_distribuciones();

-- Trigger adicional: Evitar mezclar enfoques (directo vs detallado)
CREATE OR REPLACE FUNCTION validar_consistencia_distribuciones()
RETURNS TRIGGER AS $$
DECLARE
  tiene_comprobantes BOOLEAN;
  tiene_distribuciones_directas BOOLEAN;
  rendicion_id_validar INTEGER;
BEGIN
  -- Obtener rendición a validar
  IF NEW.rendicion_id IS NOT NULL THEN
    rendicion_id_validar := NEW.rendicion_id;
  ELSIF NEW.comprobante_id IS NOT NULL THEN
    SELECT rendicion_id INTO rendicion_id_validar 
    FROM rendicion_comprobantes 
    WHERE id = NEW.comprobante_id;
  END IF;
  
  IF rendicion_id_validar IS NOT NULL THEN
    -- Verificar si existen comprobantes
    SELECT EXISTS(
      SELECT 1 FROM rendicion_comprobantes 
      WHERE rendicion_id = rendicion_id_validar AND activo = true
    ) INTO tiene_comprobantes;
    
    -- Verificar si existen distribuciones directas
    SELECT EXISTS(
      SELECT 1 FROM rendicion_distribuciones 
      WHERE rendicion_id = rendicion_id_validar AND activo = true
    ) INTO tiene_distribuciones_directas;
    
    -- No permitir ambos enfoques simultáneamente
    IF tiene_comprobantes AND tiene_distribuciones_directas THEN
      RAISE EXCEPTION 'No se pueden tener comprobantes detallados Y distribuciones directas en la misma rendición';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_consistencia_distribuciones
  BEFORE INSERT OR UPDATE ON rendicion_distribuciones
  FOR EACH ROW EXECUTE FUNCTION validar_consistencia_distribuciones();
```

## Casos de Uso - Ejemplos Completos

### Escenario A: Distribución Directa (Simple)
```sql
-- Cupón $1000 se distribuye directamente sin comprobantes detallados
INSERT INTO rendicion_tarjeta (resumen_id, total_cupon, ...) VALUES (1, 1000.00, ...);

-- Distribución directa desde rendición
INSERT INTO rendicion_distribuciones (rendicion_id, numero_distribucion, codigo_dimension, subcuenta, importe_debe, descripcion_distribucion) VALUES
(1, 1, 'CENTRO_COSTO', 'CC001', 400.00, 'Administración - Gastos generales'),
(1, 2, 'CENTRO_COSTO', 'CC002', 350.00, 'Comercial - Marketing'),
(1, 3, 'SUCURSAL', 'SUC001', 250.00, 'Sucursal Centro - Operaciones');
-- Total: $1000 ✓
```

### Escenario B: Distribución por Comprobantes (Detallado)
```sql
-- Cupón $1000 con comprobantes detallados
INSERT INTO rendicion_tarjeta (resumen_id, total_cupon, ...) VALUES (2, 1000.00, ...);

-- Crear comprobantes detallados
INSERT INTO rendicion_comprobantes (rendicion_id, numero_comprobante_interno, es_comprobante_principal, numero_comprobante_externo, total_comprobante, razon_social_comprobante) VALUES
(2, 1, true, 'FA-A-001-12345', 600.00, 'Proveedor Principal S.A.'),
(2, 2, false, 'FB-B-002-67890', 400.00, 'Servicios Auxiliares S.R.L.');

-- Distribuir Comprobante 1 ($600)
INSERT INTO rendicion_distribuciones (comprobante_id, numero_distribucion, codigo_dimension, subcuenta, importe_debe, porcentaje_distribucion) VALUES
(1, 1, 'CENTRO_COSTO', 'CC001', 360.00, 60.00),  -- Administración 60%
(1, 2, 'CENTRO_COSTO', 'CC002', 240.00, 40.00);  -- Comercial 40%

-- Distribuir Comprobante 2 ($400)
INSERT INTO rendicion_distribuciones (comprobante_id, numero_distribucion, codigo_dimension, subcuenta, importe_debe) VALUES
(2, 1, 'SUCURSAL', 'SUC001', 400.00);  -- Todo a una sucursal
```

### Escenario C: Validación (Caso que Falla)
```sql
-- Ejemplo de lo que NO se puede hacer
INSERT INTO rendicion_tarjeta (resumen_id, total_cupon, ...) VALUES (3, 1500.00, ...);

-- 1. Crear un comprobante
INSERT INTO rendicion_comprobantes (rendicion_id, numero_comprobante_interno, total_comprobante) 
VALUES (3, 1, 800.00);

-- 2. Intentar TAMBIÉN crear distribución directa (FALLA)
INSERT INTO rendicion_distribuciones (rendicion_id, numero_distribucion, codigo_dimension, subcuenta, importe_debe) 
VALUES (3, 1, 'CENTRO_COSTO', 'CC001', 700.00);
-- ERROR: "No se pueden tener comprobantes detallados Y distribuciones directas en la misma rendición"
```

### Consultas Útiles para la Aplicación

```sql
-- Determinar tipo de distribución de una rendición
SELECT 
  r.id,
  r.total_cupon,
  CASE 
    WHEN EXISTS(SELECT 1 FROM rendicion_comprobantes WHERE rendicion_id = r.id AND activo = true) 
    THEN 'DETALLADO'
    WHEN EXISTS(SELECT 1 FROM rendicion_distribuciones WHERE rendicion_id = r.id AND activo = true)
    THEN 'DIRECTO'
    ELSE 'SIN_DISTRIBUIR'
  END as tipo_distribucion
FROM rendicion_tarjeta r;

-- Obtener todas las distribuciones de una rendición (ambos enfoques)
SELECT 
  rd.id,
  rd.numero_distribucion,
  rd.codigo_dimension,
  rd.subcuenta,
  rd.importe_debe,
  rd.descripcion_distribucion,
  CASE 
    WHEN rd.rendicion_id IS NOT NULL THEN 'DIRECTO'
    WHEN rd.comprobante_id IS NOT NULL THEN 'COMPROBANTE'
  END as origen_distribucion,
  rc.numero_comprobante_externo,
  rc.razon_social_comprobante
FROM rendicion_distribuciones rd
LEFT JOIN rendicion_comprobantes rc ON rd.comprobante_id = rc.id
WHERE (rd.rendicion_id = 1 OR rd.comprobante_id IN (
  SELECT id FROM rendicion_comprobantes WHERE rendicion_id = 1
))
AND rd.activo = true
ORDER BY 
  CASE WHEN rd.rendicion_id IS NOT NULL THEN 0 ELSE rc.numero_comprobante_interno END,
  rd.numero_distribucion;
```

### Índices Recomendados Adicionales
```sql

## Control de Duplicados

### Estrategia
- **Campo `lote_id`**: Combinación de `codigo_tarjeta` + `periodo`
- **Ejemplo**: `ICBCVC2306` (tarjeta ICBCVC, período junio 2023)
- **Validación**: Antes de importar, verificar que no exista el `lote_id`

### Implementación
```sql
-- Generar lote_id antes del INSERT
INSERT INTO resumen_tarjeta (codigo_tarjeta, lote_id, periodo, ...)
VALUES ('ICBCVC', 'ICBCVC2306', '2306', ...);
```

## Mapeo de Datos

### De DKT a resumen_tarjeta
- **Directo**: Todos los 37 campos se importan tal como vienen
- **Transformaciones mínimas**:
  - Campo [1] → `codigo_banco` (LEFT 3) + `codigo_empresa` (RIGHT 3)
  - Campo [18] → `importe_transaccion` (dividir por 100)
  - Campo [14] → Formatear fecha

### De resumen_tarjeta a rendicion_tarjeta
- **Campos calculados**: Basados en lógica de negocio
- **Enriquecimiento**: Usando tablas de parametrización
- **Mapeo clave**: `grupo_rubro` → productos y conceptos

## Estados del Proceso

### resumen_tarjeta.estado
- `importado`: Datos importados del DKT
- `procesado`: Ya se generaron registros en rendicion_tarjeta
- `error`: Error en el procesamiento

### Flujo
1. **Importar** DKT → `resumen_tarjeta` (estado: 'importado')
2. **Procesar** → `rendicion_tarjeta` + actualizar estado a 'procesado'
3. **Visualizar** datos desde ambas tablas

## Sistema de Parametrización - Tabla Maestra

### Estrategia
En lugar de crear múltiples tablas auxiliares, utilizamos **una sola tabla maestra** que maneja:
- Todos los valores de dominio para campos parametrizables
- Relaciones jerárquicas para combos en cascada
- Estructura flexible y escalable

### Tabla Maestra de Parámetros + Relaciones

```sql
-- Tabla principal de parámetros
CREATE TABLE parametros_maestros (
  id SERIAL PRIMARY KEY,
  campo VARCHAR(50) NOT NULL,              -- Campo de rendicion_tarjeta que controla
  codigo VARCHAR(20) NOT NULL,             -- Código del valor
  descripcion VARCHAR(200) NOT NULL,       -- Descripción del valor
  padre_id INTEGER REFERENCES parametros_maestros(id), -- FK para jerarquías
  orden INTEGER DEFAULT 1,                 -- Orden de presentación
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_modificacion TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(campo, codigo)                     -- Un código único por campo
);

-- Tabla de relaciones padre-hijo (para administración)
CREATE TABLE parametros_relaciones (
  id SERIAL PRIMARY KEY,
  campo_padre VARCHAR(50) NOT NULL,
  campo_hijo VARCHAR(50) NOT NULL,
  descripcion VARCHAR(200),                -- Ej: "Productos filtrados por Tipo"
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(campo_padre, campo_hijo)
);

-- Índices
CREATE INDEX idx_parametros_campo ON parametros_maestros(campo);
CREATE INDEX idx_parametros_padre ON parametros_maestros(padre_id);
CREATE INDEX idx_parametros_activo ON parametros_maestros(activo);
CREATE INDEX idx_parametros_campo_activo ON parametros_maestros(campo, activo);

CREATE INDEX idx_relaciones_padre ON parametros_relaciones(campo_padre);
CREATE INDEX idx_relaciones_hijo ON parametros_relaciones(campo_hijo);
CREATE INDEX idx_relaciones_activo ON parametros_relaciones(activo);
```

### Campos que Usan la Tabla Maestra

#### Jerarquías (Combos en Cascada)
- `tipo_producto` → `codigo_producto`
- `concepto_modulo` → `concepto_tipo` → `concepto_codigo`
- `codigo_dimension` → `subcuenta`

#### Campos Simples
- `tipo_documento`, `codigo_pais`, `condicion_iva`, `codigo_moneda`
- `tipo_operacion`, `tipo_comprobante`
- Campos de validación: `tipo_transaccion`, `moneda`, `tipo_consumo`

### Ejemplo Práctico: Configuración Completa

```sql
-- 1. Definir relaciones padre-hijo
INSERT INTO parametros_relaciones (campo_padre, campo_hijo, descripcion) VALUES
('tipo_producto', 'codigo_producto', 'Productos filtrados por Tipo de Producto'),
('concepto_modulo', 'concepto_tipo', 'Tipos de Concepto por Módulo'),
('concepto_tipo', 'concepto_codigo', 'Conceptos por Tipo'),
('codigo_dimension', 'subcuenta', 'Subcuentas por Dimensión');

-- 2. Insertar tipos de producto (nivel padre)
INSERT INTO parametros_maestros (campo, codigo, descripcion, orden) VALUES
('tipo_producto', 'TARJETA', 'Productos de Tarjeta', 1),
('tipo_producto', 'CREDITO', 'Productos de Crédito', 2),
('tipo_producto', 'SERVICIO', 'Servicios Bancarios', 3);

-- 3. Insertar productos específicos (nivel hijo)
INSERT INTO parametros_maestros (campo, codigo, descripcion, padre_id, orden) VALUES
-- Productos de TARJETA (padre_id hace referencia al registro "TARJETA")
('codigo_producto', 'VISA_GOLD', 'Visa Gold', 1, 1),
('codigo_producto', 'MASTER_PLAT', 'Mastercard Platinum', 1, 2),
-- Productos de CREDITO
('codigo_producto', 'PERS_24', 'Préstamo Personal 24 meses', 2, 1),
('codigo_producto', 'HIPO_UVA', 'Hipotecario UVA', 2, 2);
```

### Consultas Optimizadas con Tabla de Relaciones

### Para la Aplicación (Runtime)

```sql
-- 1. Cargar combo padre (ej: tipos de producto)
SELECT id, codigo, descripcion 
FROM parametros_maestros 
WHERE campo = 'tipo_producto' AND activo = true
ORDER BY orden, descripcion;

-- 2. Usuario selecciona 'TARJETA' - Obtener ID del registro
SELECT id FROM parametros_maestros 
WHERE campo = 'tipo_producto' AND codigo = 'TARJETA';
-- Resultado: id = 1

-- 3. Descubrir qué campos filtrar (usando tabla de relaciones)
SELECT campo_hijo, descripcion
FROM parametros_relaciones 
WHERE campo_padre = 'tipo_producto' AND activo = true;
-- Resultado: [{'campo_hijo': 'codigo_producto', 'descripcion': 'Productos filtrados por Tipo'}]

-- 4. Filtrar cada campo hijo (con validación de relación)
SELECT pm.codigo, pm.descripcion 
FROM parametros_maestros pm
JOIN parametros_relaciones rel ON pm.campo = rel.campo_hijo
WHERE rel.campo_padre = 'tipo_producto'
  AND rel.campo_hijo = 'codigo_producto'
  AND pm.padre_id = 1  -- ID del tipo seleccionado
  AND pm.activo = true
  AND rel.activo = true
ORDER BY pm.orden, pm.descripcion;

-- 5. Para campos sin jerarquía (campos simples)
SELECT codigo, descripcion 
FROM parametros_maestros 
WHERE campo = 'tipo_documento' AND activo = true
ORDER BY orden, descripcion;
```

### Para Administración

```sql
-- Al crear un registro hijo, mostrar solo padres válidos
SELECT DISTINCT pm.id, pm.codigo, pm.descripcion
FROM parametros_maestros pm
JOIN parametros_relaciones rel ON pm.campo = rel.campo_padre
WHERE rel.campo_hijo = 'codigo_producto'  -- Campo que estoy creando
  AND pm.activo = true
  AND rel.activo = true
ORDER BY pm.descripcion;

-- Validar consistencia: verificar que todos los hijos tengan padre válido
SELECT pm.campo, pm.codigo, pm.descripcion, 'PADRE INVÁLIDO' as problema
FROM parametros_maestros pm
WHERE pm.padre_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM parametros_maestros padre
  JOIN parametros_relaciones rel ON padre.campo = rel.campo_padre
  WHERE padre.id = pm.padre_id 
    AND rel.campo_hijo = pm.campo
    AND rel.activo = true
    AND padre.activo = true
);

-- Listar todas las relaciones configuradas
SELECT 
  rel.campo_padre,
  rel.campo_hijo,
  rel.descripcion,
  COUNT(DISTINCT padre.id) as cant_padres,
  COUNT(DISTINCT hijo.id) as cant_hijos
FROM parametros_relaciones rel
LEFT JOIN parametros_maestros padre ON padre.campo = rel.campo_padre AND padre.activo = true
LEFT JOIN parametros_maestros hijo ON hijo.campo = rel.campo_hijo AND hijo.activo = true
WHERE rel.activo = true
GROUP BY rel.campo_padre, rel.campo_hijo, rel.descripcion
ORDER BY rel.campo_padre, rel.campo_hijo;
```

### Flujo Completo de la Aplicación

```javascript
// 1. Cargar combo padre
const tiposProducto = await query(`
  SELECT id, codigo, descripcion 
  FROM parametros_maestros 
  WHERE campo = 'tipo_producto' AND activo = true
  ORDER BY orden, descripcion
`);

// 2. Usuario selecciona un tipo de producto
const tipoSeleccionado = { id: 1, codigo: 'TARJETA' };

// 3. Descubrir campos a filtrar automáticamente
const camposHijos = await query(`
  SELECT DISTINCT campo as campo_hijo
  FROM parametros_maestros 
  WHERE padre_id = ${tipoSeleccionado.id} AND activo = true
`);

// 4. Filtrar cada campo hijo
for (const { campo_hijo } of camposHijos) {
  const opciones = await query(`
    SELECT codigo, descripcion 
    FROM parametros_maestros 
    WHERE campo = '${campo_hijo}' 
      AND padre_id = ${tipoSeleccionado.id} 
      AND activo = true
    ORDER BY orden, descripcion
  `);
  
  // Actualizar combo correspondiente en el UI
  updateCombo(campo_hijo, opciones);
}
```

### Consulta Universal para Jerarquías

```sql
-- Obtener jerarquía completa de cualquier campo padre
WITH RECURSIVE jerarquia AS (
  -- Nivel 1: Padres
  SELECT id, campo, codigo, descripcion, padre_id, 1 as nivel
  FROM parametros_maestros 
  WHERE campo = 'concepto_modulo' AND activo = true
  
  UNION ALL
  
  -- Niveles siguientes: Hijos
  SELECT p.id, p.campo, p.codigo, p.descripcion, p.padre_id, j.nivel + 1
  FROM parametros_maestros p
  INNER JOIN jerarquia j ON p.padre_id = j.id
  WHERE p.activo = true
)
SELECT * FROM jerarquia 
ORDER BY nivel, orden;
```

### Ventajas del Diseño con Tabla de Relaciones

#### Para Administración
1. **Validación en tiempo real**: Al crear un campo hijo, solo muestra padres válidos configurados
2. **Consistencia garantizada**: Queries de validación detectan relaciones inválidas
3. **Documentación automática**: Campo descripción explica cada relación
4. **Auditoría completa**: Reporte de todas las relaciones y sus cantidades
5. **Flexibilidad controlada**: Solo se permiten relaciones pre-configuradas

#### Para la Aplicación
1. **Performance optimizada**: Consulta directa a tabla de relaciones (no búsqueda)
2. **Menos consultas**: Una query obtiene todos los campos hijo de una vez
3. **Validación robusta**: JOIN con tabla de relaciones garantiza consistencia
4. **Cache inteligente**: Relaciones se pueden pre-cargar al inicio
5. **Escalabilidad**: Agregar nuevas relaciones no afecta código existente

### Lógica del Frontend Actualizada

```javascript
class ParametrosManager {
  constructor() {
    this.combos = new Map();
    this.relaciones = new Map(); // Cache de relaciones pre-cargadas
  }

  // Pre-cargar todas las relaciones al inicio
  async inicializar() {
    const relaciones = await this.query(`
      SELECT campo_padre, campo_hijo, descripcion
      FROM parametros_relaciones 
      WHERE activo = true
    `);
    
    relaciones.forEach(rel => {
      if (!this.relaciones.has(rel.campo_padre)) {
        this.relaciones.set(rel.campo_padre, []);
      }
      this.relaciones.get(rel.campo_padre).push({
        campo: rel.campo_hijo,
        descripcion: rel.descripcion
      });
    });
  }

  // Cargar combo con validación de relaciones
  async cargarCombo(nombreCampo, padreId = null) {
    const cacheKey = `${nombreCampo}_${padreId || 'root'}`;
    
    if (this.combos.has(cacheKey)) {
      return this.combos.get(cacheKey);
    }

    const sql = padreId 
      ? `SELECT pm.id, pm.codigo, pm.descripcion 
         FROM parametros_maestros pm
         JOIN parametros_relaciones rel ON pm.campo = rel.campo_hijo
         WHERE pm.campo = '${nombreCampo}' 
           AND pm.padre_id = ${padreId} 
           AND pm.activo = true 
           AND rel.activo = true
         ORDER BY pm.orden, pm.descripcion`
      : `SELECT id, codigo, descripcion FROM parametros_maestros 
         WHERE campo = '${nombreCampo}' AND padre_id IS NULL AND activo = true
         ORDER BY orden, descripcion`;

    const opciones = await this.query(sql);
    this.combos.set(cacheKey, opciones);
    return opciones;
  }

  // Descubrir campos hijos usando relaciones pre-cargadas
  async onSeleccionPadre(campoSeleccionado, valorSeleccionado, formFields) {
    // 1. Obtener campos hijo desde cache de relaciones
    const camposHijos = this.relaciones.get(campoSeleccionado) || [];

    // 2. Limpiar combos que ya no aplican
    this.limpiarCombosHijos(formFields, camposHijos);

    // 3. Cargar cada combo hijo
    for (const campoHijo of camposHijos) {
      const opciones = await this.cargarCombo(campoHijo.campo, valorSeleccionado.id);
      this.actualizarComboEnForm(campoHijo.campo, opciones, formFields);
    }
  }

  // Obtener padres válidos para administración
  async obtenerPadresValidos(campoHijo) {
    return await this.query(`
      SELECT DISTINCT pm.id, pm.codigo, pm.descripcion
      FROM parametros_maestros pm
      JOIN parametros_relaciones rel ON pm.campo = rel.campo_padre
      WHERE rel.campo_hijo = '${campoHijo}'
        AND pm.activo = true
        AND rel.activo = true
      ORDER BY pm.descripcion
    `);
  }
}

// Uso en administración
const adminManager = new ParametrosManager();
await adminManager.inicializar();

// Al crear un nuevo producto, mostrar solo tipos válidos
const tiposValidos = await adminManager.obtenerPadresValidos('codigo_producto');
```

### Resumen Final: Sistema de Parametrización Robusto

#### ✅ Lo que conseguimos:
1. **Una tabla principal** (`parametros_maestros`) para todos los valores
2. **Una tabla de relaciones** (`parametros_relaciones`) para control administrativo
3. **Combos en cascada automáticos** sin código adicional por campo
4. **Validación robusta** en administración y aplicación
5. **Performance optimizada** con cache y consultas eficientes
6. **Escalabilidad total** - agregar campos es configuración, no desarrollo

#### ✅ Beneficios clave:
- **Administración**: Solo muestra padres válidos al crear registros hijos
- **Consistencia**: Validación automática de relaciones padre-hijo
- **Flexibilidad**: Relaciones configurables sin cambios de código
- **Performance**: Pre-carga de relaciones + cache inteligente
- **Mantenimiento**: Reducción drástica de tablas (18 → 2)

## Tablas de Parametrización - Diseño Legacy (DEPRECIADO)

### TABLAS PADRE (Sin Foreign Keys)

#### Productos y Conceptos
```sql
-- Tipos de producto
CREATE TABLE productos_tipos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Módulos del sistema
CREATE TABLE modulos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Módulos de conceptos
CREATE TABLE conceptos_modulos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Tipos de conceptos
CREATE TABLE conceptos_tipos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);
```

#### Fiscales y Geográficas
```sql
-- Tipos de documento
CREATE TABLE tipos_documento (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(3) UNIQUE NOT NULL,
  descripcion VARCHAR(50) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Países
CREATE TABLE paises (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(3) UNIQUE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Condiciones IVA
CREATE TABLE condiciones_iva (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(2) UNIQUE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Monedas
CREATE TABLE monedas (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(3) UNIQUE NOT NULL,
  descripcion VARCHAR(50) NOT NULL,
  simbolo VARCHAR(5),
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);
```

#### Contables
```sql
-- Plan de cuentas contable
CREATE TABLE plan_cuentas (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  nivel INTEGER NOT NULL,
  cuenta_padre_id INTEGER REFERENCES plan_cuentas(id),
  es_imputable BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Tipos de operación
CREATE TABLE tipos_operacion (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Tipos de comprobante
CREATE TABLE tipos_comprobante (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Dimensiones contables
CREATE TABLE dimensiones (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);
```

### TABLAS HIJAS (Con Foreign Keys)

```sql
-- Catálogo de productos (FK a productos_tipos)
CREATE TABLE productos (
  id SERIAL PRIMARY KEY,
  tipo_producto_id INTEGER NOT NULL REFERENCES productos_tipos(id),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  precio_base DECIMAL(18,2),
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_modificacion TIMESTAMP DEFAULT NOW()
);

-- Catálogo de conceptos (FK a conceptos_modulos y conceptos_tipos)
CREATE TABLE conceptos (
  id SERIAL PRIMARY KEY,
  modulo_id INTEGER NOT NULL REFERENCES conceptos_modulos(id),
  tipo_id INTEGER NOT NULL REFERENCES conceptos_tipos(id),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  formula TEXT,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_modificacion TIMESTAMP DEFAULT NOW()
);

-- Subcuentas contables (FK a dimensiones)
CREATE TABLE subcuentas (
  id SERIAL PRIMARY KEY,
  dimension_id INTEGER NOT NULL REFERENCES dimensiones(id),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Mapeo grupo_rubro → productos/conceptos
CREATE TABLE rubros_mapping (
  id SERIAL PRIMARY KEY,
  grupo_rubro VARCHAR(10) NOT NULL,
  producto_id INTEGER REFERENCES productos(id),
  concepto_id INTEGER REFERENCES conceptos(id),
  tipo_transaccion VARCHAR(1), -- A=Adelanto, C=Compra, D=Devolución
  prioridad INTEGER DEFAULT 1,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT chk_producto_o_concepto 
    CHECK ((producto_id IS NOT NULL AND concepto_id IS NULL) OR 
           (producto_id IS NULL AND concepto_id IS NOT NULL))
);
```

### Índices Recomendados
```sql
-- Productos y Conceptos
CREATE INDEX idx_productos_tipo ON productos(tipo_producto_id);
CREATE INDEX idx_productos_activo ON productos(activo);
CREATE INDEX idx_conceptos_modulo ON conceptos(modulo_id);
CREATE INDEX idx_conceptos_tipo ON conceptos(tipo_id);
CREATE INDEX idx_conceptos_activo ON conceptos(activo);
CREATE INDEX idx_subcuentas_dimension ON subcuentas(dimension_id);
CREATE INDEX idx_subcuentas_activo ON subcuentas(activo);
CREATE INDEX idx_rubros_grupo ON rubros_mapping(grupo_rubro);
CREATE INDEX idx_rubros_producto ON rubros_mapping(producto_id);
CREATE INDEX idx_rubros_concepto ON rubros_mapping(concepto_id);
CREATE INDEX idx_rubros_tipo_trans ON rubros_mapping(tipo_transaccion);

-- Fiscales y Geográficas
CREATE INDEX idx_tipos_doc_activo ON tipos_documento(activo);
CREATE INDEX idx_paises_activo ON paises(activo);
CREATE INDEX idx_condiciones_iva_activo ON condiciones_iva(activo);
CREATE INDEX idx_monedas_activo ON monedas(activo);

-- Contables
CREATE INDEX idx_plan_cuentas_padre ON plan_cuentas(cuenta_padre_id);
CREATE INDEX idx_plan_cuentas_nivel ON plan_cuentas(nivel);
CREATE INDEX idx_plan_cuentas_imputable ON plan_cuentas(es_imputable);
CREATE INDEX idx_tipos_operacion_activo ON tipos_operacion(activo);
CREATE INDEX idx_tipos_comprobante_activo ON tipos_comprobante(activo);
CREATE INDEX idx_dimensiones_activo ON dimensiones(activo);
```