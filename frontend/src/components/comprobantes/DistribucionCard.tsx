'use client';

import { useState } from 'react';
import { Trash2, Plus, ChevronDown, ChevronUp, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { SubcuentaRow } from './SubcuentaRow';

interface Subcuenta {
  id: string;
  codigoSubcuenta: string;
  subcuentaNombre: string;
  cuentaContable: string;
  porcentaje: number;
  importe: number;
  orden: number;
}

interface Distribucion {
  id: string;
  tipoDimension: string;
  tipoDimensionNombre: string;
  importeDimension: number;
  orden: number;
  subcuentas: Subcuenta[];
}

interface DistribucionCardProps {
  distribucion: Distribucion;
  onUpdate: (updates: Partial<Distribucion>) => void;
  onDelete: () => void;
}

export function DistribucionCard({ distribucion, onUpdate, onDelete }: DistribucionCardProps) {
  const [expanded, setExpanded] = useState(true);

  const handleAgregarSubcuenta = () => {
    const nuevaSubcuenta: Subcuenta = {
      id: `temp-sub-${Date.now()}`,
      codigoSubcuenta: '',
      subcuentaNombre: '',
      cuentaContable: '',
      porcentaje: 0,
      importe: 0,
      orden: distribucion.subcuentas.length + 1
    };

    onUpdate({
      subcuentas: [...distribucion.subcuentas, nuevaSubcuenta]
    });
  };

  const handleEliminarSubcuenta = (subcuentaId: string) => {
    onUpdate({
      subcuentas: distribucion.subcuentas.filter(s => s.id !== subcuentaId)
    });
  };

  const handleUpdateSubcuenta = (subcuentaId: string, updates: Partial<Subcuenta>) => {
    onUpdate({
      subcuentas: distribucion.subcuentas.map(s =>
        s.id === subcuentaId ? { ...s, ...updates } : s
      )
    });
  };

  const handlePorcentajeChange = (subcuentaId: string, nuevoPorcentaje: number) => {
    const nuevoImporte = (distribucion.importeDimension * nuevoPorcentaje) / 100;

    handleUpdateSubcuenta(subcuentaId, {
      porcentaje: nuevoPorcentaje,
      importe: parseFloat(nuevoImporte.toFixed(2))
    });
  };

  const handleImporteChange = (subcuentaId: string, nuevoImporte: number) => {
    const nuevoPorcentaje = distribucion.importeDimension > 0
      ? (nuevoImporte * 100) / distribucion.importeDimension
      : 0;

    handleUpdateSubcuenta(subcuentaId, {
      importe: nuevoImporte,
      porcentaje: parseFloat(nuevoPorcentaje.toFixed(2))
    });
  };

  const handleAjustarUltimaSubcuenta = () => {
    if (distribucion.subcuentas.length === 0) {
      toast.error('No hay subcuentas para ajustar');
      return;
    }

    const subcuentasOrdenadas = [...distribucion.subcuentas].sort((a, b) => b.orden - a.orden);
    const ultimaSubcuenta = subcuentasOrdenadas[0];

    // Calcular total sin la última
    const totalSinUltima = distribucion.subcuentas
      .filter(s => s.id !== ultimaSubcuenta.id)
      .reduce((sum, sub) => sum + parseFloat(String(sub.importe || 0)), 0);

    // Ajustar la última
    const importeFaltante = distribucion.importeDimension - totalSinUltima;
    const porcentajeFaltante = distribucion.importeDimension > 0
      ? (importeFaltante * 100) / distribucion.importeDimension
      : 0;

    handleUpdateSubcuenta(ultimaSubcuenta.id, {
      importe: Math.max(0, parseFloat(importeFaltante.toFixed(2))),
      porcentaje: Math.max(0, parseFloat(porcentajeFaltante.toFixed(2)))
    });

    toast.success('Última subcuenta ajustada');
  };

  // Validar subcuentas
  const totalPorcentaje = distribucion.subcuentas.reduce(
    (sum, sub) => sum + parseFloat(String(sub.porcentaje || 0)),
    0
  );
  const totalImporte = distribucion.subcuentas.reduce(
    (sum, sub) => sum + parseFloat(String(sub.importe || 0)),
    0
  );

  const porcentajeValido = Math.abs(totalPorcentaje - 100) <= 0.01;
  const importeValido = Math.abs(distribucion.importeDimension - totalImporte) <= 0.01;
  const esValido = porcentajeValido && importeValido;

  const porcentajeDimension = distribucion.importeDimension > 0
    ? ((distribucion.importeDimension / distribucion.importeDimension) * 100)
    : 0;

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <span className="text-lg">📊</span>
              <div className="flex-1">
                <input
                  type="text"
                  value={distribucion.tipoDimensionNombre || ''}
                  onChange={(e) => onUpdate({ tipoDimensionNombre: e.target.value })}
                  placeholder="Nombre de la dimensión (ej: Centro de Costo)"
                  className="text-base font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 w-full"
                />
                <input
                  type="text"
                  value={distribucion.tipoDimension || ''}
                  onChange={(e) => onUpdate({ tipoDimension: e.target.value })}
                  placeholder="Código del tipo (ej: CENTRO_COSTO)"
                  className="text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 w-full mt-1"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4 ml-8">
              <div>
                <label className="text-xs text-gray-500">Importe:</label>
                <input
                  type="number"
                  step="0.01"
                  value={distribucion.importeDimension || ''}
                  onChange={(e) => onUpdate({ importeDimension: parseFloat(e.target.value) || 0 })}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm w-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="text-sm text-gray-600">
                {distribucion.subcuentas.length} subcuenta(s)
              </div>
            </div>
          </div>

          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar dimensión"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subcuentas */}
      {expanded && (
        <div className="p-4">
          {distribucion.subcuentas.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 mb-2 px-2">
                <div className="col-span-3">Código</div>
                <div className="col-span-3">Nombre</div>
                <div className="col-span-2">Cuenta</div>
                <div className="col-span-2">Porcentaje</div>
                <div className="col-span-2">Importe</div>
              </div>

              {distribucion.subcuentas.map((subcuenta) => (
                <SubcuentaRow
                  key={subcuenta.id}
                  subcuenta={subcuenta}
                  onUpdatePorcentaje={(porcentaje) => handlePorcentajeChange(subcuenta.id, porcentaje)}
                  onUpdateImporte={(importe) => handleImporteChange(subcuenta.id, importe)}
                  onUpdateCodigo={(codigo) => handleUpdateSubcuenta(subcuenta.id, { codigoSubcuenta: codigo })}
                  onUpdateNombre={(nombre) => handleUpdateSubcuenta(subcuenta.id, { subcuentaNombre: nombre })}
                  onUpdateCuenta={(cuenta) => handleUpdateSubcuenta(subcuenta.id, { cuentaContable: cuenta })}
                  onDelete={() => handleEliminarSubcuenta(subcuenta.id)}
                />
              ))}

              {/* Totales */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Total:</span>
                    <span className={`text-sm font-semibold ${
                      esValido ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {totalPorcentaje.toFixed(2)}% = ${totalImporte.toFixed(2)}
                    </span>
                    {esValido ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>

                  {!esValido && (
                    <button
                      onClick={handleAjustarUltimaSubcuenta}
                      className="flex items-center space-x-1 px-3 py-1.5 text-xs text-yellow-700 bg-yellow-100 rounded hover:bg-yellow-200 transition-colors"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Ajustar último</span>
                    </button>
                  )}
                </div>

                {!esValido && (
                  <div className="mt-2 text-xs text-red-600 px-2">
                    {!porcentajeValido && (
                      <div>• Los porcentajes deben sumar 100% (actual: {totalPorcentaje.toFixed(2)}%)</div>
                    )}
                    {!importeValido && (
                      <div>• Los importes deben sumar ${distribucion.importeDimension.toFixed(2)} (actual: ${totalImporte.toFixed(2)})</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              No hay subcuentas. Haz clic en "Agregar Subcuenta" para comenzar.
            </div>
          )}

          <button
            onClick={handleAgregarSubcuenta}
            className="mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Subcuenta</span>
          </button>
        </div>
      )}
    </div>
  );
}
