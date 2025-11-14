'use client';

import { Trash2 } from 'lucide-react';

interface Subcuenta {
  id: string;
  codigoSubcuenta: string;
  subcuentaNombre: string;
  cuentaContable: string;
  porcentaje: number;
  importe: number;
  orden: number;
}

interface SubcuentaRowProps {
  subcuenta: Subcuenta;
  onUpdateCodigo: (codigo: string) => void;
  onUpdateNombre: (nombre: string) => void;
  onUpdateCuenta: (cuenta: string) => void;
  onUpdatePorcentaje: (porcentaje: number) => void;
  onUpdateImporte: (importe: number) => void;
  onDelete: () => void;
}

export function SubcuentaRow({
  subcuenta,
  onUpdateCodigo,
  onUpdateNombre,
  onUpdateCuenta,
  onUpdatePorcentaje,
  onUpdateImporte,
  onDelete
}: SubcuentaRowProps) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded hover:bg-gray-100 transition-colors">
      {/* Código Subcuenta */}
      <div className="col-span-3">
        <input
          type="text"
          value={subcuenta.codigoSubcuenta || ''}
          onChange={(e) => onUpdateCodigo(e.target.value)}
          placeholder="CC001"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Nombre Subcuenta */}
      <div className="col-span-3">
        <input
          type="text"
          value={subcuenta.subcuentaNombre || ''}
          onChange={(e) => onUpdateNombre(e.target.value)}
          placeholder="Administración"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Cuenta Contable */}
      <div className="col-span-2">
        <input
          type="text"
          value={subcuenta.cuentaContable || ''}
          onChange={(e) => onUpdateCuenta(e.target.value)}
          placeholder="3010101"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Porcentaje */}
      <div className="col-span-2">
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={subcuenta.porcentaje || ''}
            onChange={(e) => {
              const valor = parseFloat(e.target.value) || 0;
              onUpdatePorcentaje(Math.min(100, Math.max(0, valor)));
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-6"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
        </div>
      </div>

      {/* Importe */}
      <div className="col-span-2">
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min="0"
            value={subcuenta.importe || ''}
            onChange={(e) => {
              const valor = parseFloat(e.target.value) || 0;
              onUpdateImporte(Math.max(0, valor));
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-6"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
        </div>
      </div>

      {/* Botón Eliminar */}
      <div className="col-span-1 flex justify-center">
        <button
          onClick={onDelete}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Eliminar subcuenta"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
