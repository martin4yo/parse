import React from 'react';
import { ShieldAlert, AlertOctagon, AlertTriangle } from 'lucide-react';

interface ValidationError {
  regla?: string;
  mensaje?: string;
  message?: string;
  severidad: 'BLOQUEANTE' | 'ERROR' | 'WARNING';
  contexto?: string;
  origen?: string;
  lineaId?: string;
  impuestoId?: string;
}

interface ValidationErrorIconProps {
  fieldName: string;
  origen?: string;
  entityId?: string;
  errors?: ValidationError[];
}

/**
 * Obtiene los errores de validación para un campo específico
 */
const getFieldErrors = (
  fieldName: string,
  origen?: string,
  entityId?: string,
  allErrors?: ValidationError[]
): ValidationError[] => {
  if (!allErrors || allErrors.length === 0) return [];

  return allErrors.filter((err: ValidationError) => {
    // Filtrar por ID del registro (la forma correcta y robusta)
    if (entityId !== undefined) {
      const isLineaError = err.lineaId === entityId;
      const isImpuestoError = err.impuestoId === entityId;

      if (!isLineaError && !isImpuestoError) return false;
    } else if (origen && err.origen !== origen) {
      // Si no hay entityId, usar origen string como fallback (solo para documento)
      return false;
    }

    // Si no hay fieldName (string vacío), devolver todos los errores del item
    if (!fieldName) return true;

    // Normalizar nombres de campos para matching
    const normalizedFieldName = fieldName.toLowerCase();
    const contextoLower = (err.contexto || '').toLowerCase();
    const mensajeLower = ((err.mensaje || err.message) || '').toLowerCase();

    // Mapeo de nombres de campos a sus variaciones
    const fieldVariations: { [key: string]: string[] } = {
      'tipoproducto': ['tipo producto', 'tipo_producto', 'tipoproducto', 'tipo'],
      'codigoproducto': ['codigo producto', 'codigo_producto', 'codigoproducto', 'código producto', 'código_producto', 'códigoproducto', 'producto'],
      'cuentacontable': ['cuenta contable', 'cuenta_contable', 'cuentacontable'],
      'codigodimension': ['codigo dimension', 'codigo_dimension', 'codigodimension', 'código dimensión', 'código_dimensión', 'códigodimensión', 'dimension', 'dimensión'],
      'subcuenta': ['subcuenta', 'sub cuenta', 'sub_cuenta'],
      'tipoordencompra': ['tipo orden compra', 'tipo_orden_compra', 'tipoordencompra', 'tipo oc', 'tipo_oc'],
      'ordencompra': ['orden compra', 'orden_compra', 'ordencompra', 'oc'],
      'codigoproveedor': ['codigo proveedor', 'codigo_proveedor', 'codigoproveedor', 'código proveedor', 'proveedor'],
      'alicuota': ['alicuota', 'alícuota', 'aliquota'],
      'baseimponible': ['base imponible', 'base_imponible', 'baseimponible'],
      'importe': ['importe', 'monto', 'total']
    };

    // Obtener variaciones del campo actual
    const variations = fieldVariations[normalizedFieldName] || [normalizedFieldName];

    // Verificar si alguna variación coincide
    const matchesField = variations.some(variation =>
      contextoLower.includes(variation) || mensajeLower.includes(variation)
    );

    return matchesField;
  });
};

export const ValidationErrorIcon: React.FC<ValidationErrorIconProps> = ({
  fieldName,
  origen,
  entityId,
  errors
}) => {
  const fieldErrors = getFieldErrors(fieldName, origen, entityId, errors);

  if (fieldErrors.length === 0) return null;

  // Obtener el error más severo
  const hasBloqueante = fieldErrors.some(e => e.severidad === 'BLOQUEANTE');
  const hasError = fieldErrors.some(e => e.severidad === 'ERROR');

  const Icon = hasBloqueante ? ShieldAlert : hasError ? AlertOctagon : AlertTriangle;
  const colorClass = hasBloqueante
    ? 'text-red-600'
    : hasError
    ? 'text-orange-600'
    : 'text-yellow-600';

  const bgClass = hasBloqueante
    ? 'bg-red-50 border-red-200'
    : hasError
    ? 'bg-orange-50 border-orange-200'
    : 'bg-yellow-50 border-yellow-200';

  return (
    <div className="relative group inline-block ml-2">
      <Icon className={`w-4 h-4 ${colorClass} cursor-help`} />

      {/* Tooltip */}
      <div className={`absolute left-0 top-6 z-50 hidden group-hover:block w-64 p-3 rounded-lg border-2 shadow-lg ${bgClass}`}>
        <div className="space-y-2">
          {fieldErrors.map((err, idx) => (
            <div key={idx} className="text-xs">
              <div className={`font-semibold mb-1 ${
                err.severidad === 'BLOQUEANTE' ? 'text-red-800' :
                err.severidad === 'ERROR' ? 'text-orange-800' : 'text-yellow-800'
              }`}>
                {err.severidad === 'BLOQUEANTE' ? '🚫' : err.severidad === 'ERROR' ? '⚠️' : '⚡'} {err.regla || 'Validación'}
              </div>
              <div className="text-gray-700">{err.mensaje || err.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
