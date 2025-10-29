/**
 * Catálogo compartido de atributos/campos de rendición
 * 
 * Este archivo centraliza la definición de atributos que se utilizan
 * tanto en la página de usuarios como en la página de parámetros.
 * 
 * Esto asegura consistencia y facilita el mantenimiento futuro.
 */

export interface AtributoDefinition {
  id: string;
  codigo: string;
  descripcion: string;
  grupo: string;
  orden: number;
  activo: boolean;
}

export const ATRIBUTOS_CATALOGO: AtributoDefinition[] = [
  // Atributos de Usuario
  {
    id: 'delegacion',
    codigo: 'DELEGACION',
    descripcion: 'Delegación',
    grupo: 'Usuario',
    orden: 1,
    activo: true
  },
  {
    id: 'centro_costo',
    codigo: 'CENTRO_COSTO',
    descripcion: 'Centro de Costo',
    grupo: 'Usuario',
    orden: 2,
    activo: true
  },
  {
    id: 'area',
    codigo: 'AREA',
    descripcion: 'Área',
    grupo: 'Usuario',
    orden: 3,
    activo: true
  },
  {
    id: 'categoria',
    codigo: 'CATEGORIA',
    descripcion: 'Categoría',
    grupo: 'Usuario',
    orden: 4,
    activo: true
  },
  
  // Campos de Rendición - Tarjetas
  {
    id: 'marca_tarjeta',
    codigo: 'marca_tarjeta',
    descripcion: 'Marca de Tarjeta',
    grupo: 'Tarjeta',
    orden: 10,
    activo: true
  },
  {
    id: 'tipo_tarjeta',
    codigo: 'tipo_tarjeta',
    descripcion: 'Tipo de Tarjeta',
    grupo: 'Tarjeta',
    orden: 11,
    activo: true
  },
  {
    id: 'banco',
    codigo: 'banco',
    descripcion: 'Banco',
    grupo: 'Tarjeta',
    orden: 12,
    activo: true
  },

  // Campos de Rendición - Comprobantes
  {
    id: 'tipo_comprobante',
    codigo: 'tipo_comprobante',
    descripcion: 'Tipo de Comprobante',
    grupo: 'Comprobante',
    orden: 20,
    activo: true
  },
  {
    id: 'categoria_gasto',
    codigo: 'categoria_gasto',
    descripcion: 'Categoría de Gasto',
    grupo: 'Comprobante',
    orden: 21,
    activo: true
  },
  {
    id: 'concepto',
    codigo: 'concepto',
    descripcion: 'Concepto',
    grupo: 'Comprobante',
    orden: 22,
    activo: true
  },
  {
    id: 'proveedor',
    codigo: 'proveedor',
    descripcion: 'Proveedor',
    grupo: 'Comprobante',
    orden: 23,
    activo: true
  },

  // Campos de Rendición - Geográficos
  {
    id: 'provincia',
    codigo: 'provincia',
    descripcion: 'Provincia',
    grupo: 'Geográfico',
    orden: 30,
    activo: true
  },
  {
    id: 'localidad',
    codigo: 'localidad',
    descripcion: 'Localidad',
    grupo: 'Geográfico',
    orden: 31,
    activo: true
  },

  // Campos de Rendición - Otros
  {
    id: 'moneda',
    codigo: 'moneda',
    descripcion: 'Moneda',
    grupo: 'Otros',
    orden: 40,
    activo: true
  },
  {
    id: 'forma_pago',
    codigo: 'forma_pago',
    descripcion: 'Forma de Pago',
    grupo: 'Otros',
    orden: 41,
    activo: true
  }
];

/**
 * Obtiene los atributos filtrados por grupo
 */
export const getAtributosByGrupo = (grupo: string): AtributoDefinition[] => {
  return ATRIBUTOS_CATALOGO.filter(attr => attr.grupo === grupo && attr.activo);
};

/**
 * Obtiene todos los grupos disponibles
 */
export const getGruposAtributos = (): string[] => {
  const grupos = Array.from(new Set(ATRIBUTOS_CATALOGO.map(attr => attr.grupo)));
  return grupos.sort();
};

/**
 * Obtiene un atributo por su código
 */
export const getAtributoByCodigo = (codigo: string): AtributoDefinition | undefined => {
  return ATRIBUTOS_CATALOGO.find(attr => attr.codigo === codigo);
};

/**
 * Obtiene atributos para usuarios (grupos específicos)
 */
export const getAtributosUsuario = (): AtributoDefinition[] => {
  return ATRIBUTOS_CATALOGO.filter(attr => 
    ['Usuario'].includes(attr.grupo) && attr.activo
  );
};

/**
 * Obtiene campos de rendición (grupos específicos)
 */
export const getCamposRendicion = (): AtributoDefinition[] => {
  return ATRIBUTOS_CATALOGO.filter(attr => 
    ['Tarjeta', 'Comprobante', 'Geográfico', 'Otros'].includes(attr.grupo) && attr.activo
  );
};