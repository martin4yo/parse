'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, parametrosApi } from '@/lib/api';
import { SmartSelector } from '@/components/rendiciones/SmartSelector';

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

interface DistribucionesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: 'linea' | 'impuesto' | 'documento';
  entidadId: string;
  totalEntidad: number;
  codigo: string;
  nombre: string;
  onSave: () => void;
}

export function DistribucionesModal({
  isOpen,
  onClose,
  tipo,
  entidadId,
  totalEntidad,
  codigo,
  nombre,
  onSave
}: DistribucionesModalProps) {
  const [distribuciones, setDistribuciones] = useState<Distribucion[]>([]);
  const [selectedDistribucionId, setSelectedDistribucionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // SmartSelector states
  const [showDimensionSelector, setShowDimensionSelector] = useState(false);
  const [showSubcuentaSelector, setShowSubcuentaSelector] = useState(false);
  const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });

  // Track si hubo edición manual por dimensión
  const [edicionManualPorDimension, setEdicionManualPorDimension] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && entidadId) {
      loadDistribuciones();
    }
  }, [isOpen, entidadId]);

  const loadDistribuciones = async () => {
    try {
      setLoading(true);
      const endpoint = tipo === 'documento'
        ? `/documentos/${entidadId}/distribuciones`
        : tipo === 'linea'
        ? `/documentos/lineas/${entidadId}/distribuciones`
        : `/documentos/impuestos/${entidadId}/distribuciones`;

      const response = await api.get(endpoint);
      const data = response.data;

      const distribucionesMapeadas = data.distribuciones.map((dist: any) => ({
        id: dist.id,
        tipoDimension: dist.tipoDimension,
        tipoDimensionNombre: dist.tipoDimensionNombre,
        importeDimension: totalEntidad, // Siempre usar el total de la entidad
        orden: dist.orden,
        subcuentas: dist.documento_subcuentas.map((sub: any) => ({
          id: sub.id,
          codigoSubcuenta: sub.codigoSubcuenta,
          subcuentaNombre: sub.subcuentaNombre || '',
          cuentaContable: sub.cuentaContable || '',
          porcentaje: parseFloat(sub.porcentaje),
          importe: parseFloat(sub.importe),
          orden: sub.orden
        }))
      }));

      setDistribuciones(distribucionesMapeadas);
      if (distribucionesMapeadas.length > 0 && !selectedDistribucionId) {
        setSelectedDistribucionId(distribucionesMapeadas[0].id);
      }

      // Marcar dimensiones con subcuentas como "editadas manualmente"
      // para evitar auto-redistribución de datos guardados
      const flagsEdicion: Record<string, boolean> = {};
      distribucionesMapeadas.forEach((dist: Distribucion) => {
        if (dist.subcuentas.length > 0) {
          flagsEdicion[dist.id] = true;
        }
      });
      setEdicionManualPorDimension(flagsEdicion);
    } catch (error) {
      console.error('Error cargando distribuciones:', error);
      toast.error('Error al cargar las distribuciones');
    } finally {
      setLoading(false);
    }
  };

  const handleDimensionSelectorClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSelectorPosition({ x: rect.left, y: rect.bottom });
    setShowDimensionSelector(true);
  };

  const handleDimensionSelect = (codigo: string, nombre: string) => {
    const nuevaDimension: Distribucion = {
      id: `temp-${Date.now()}`,
      tipoDimension: codigo,
      tipoDimensionNombre: nombre,
      importeDimension: totalEntidad, // Cada dimensión distribuye el total completo
      orden: distribuciones.length + 1,
      subcuentas: []
    };

    setDistribuciones([...distribuciones, nuevaDimension]);
    setSelectedDistribucionId(nuevaDimension.id);
    setShowDimensionSelector(false);
  };

  const handleSubcuentaSelectorClick = (e: React.MouseEvent) => {
    if (!selectedDistribucionId) {
      toast.error('Primero selecciona una dimensión');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setSelectorPosition({ x: rect.left, y: rect.bottom });
    setShowSubcuentaSelector(true);
  };

  const handleSubcuentaSelect = (codigo: string, nombre: string) => {
    if (!selectedDistribucionId) return;

    const distribucionSeleccionada = distribuciones.find(d => d.id === selectedDistribucionId);
    if (!distribucionSeleccionada) return;

    const nuevaSubcuenta: Subcuenta = {
      id: `temp-sub-${Date.now()}`,
      codigoSubcuenta: codigo,
      subcuentaNombre: nombre,
      cuentaContable: '',
      porcentaje: 0,
      importe: 0,
      orden: distribucionSeleccionada.subcuentas.length + 1
    };

    const nuevasSubcuentas = [...distribucionSeleccionada.subcuentas, nuevaSubcuenta];

    // Si no hubo edición manual, redistribuir automáticamente
    if (!edicionManualPorDimension[selectedDistribucionId]) {
      const cantidadSubcuentas = nuevasSubcuentas.length;
      const porcentajeBase = Math.floor((100 / cantidadSubcuentas) * 100) / 100; // Redondear hacia abajo
      const importeBase = Math.floor((totalEntidad / cantidadSubcuentas) * 100) / 100;

      // Asignar porcentaje base a todas
      nuevasSubcuentas.forEach((sub, index) => {
        sub.porcentaje = porcentajeBase;
        sub.importe = importeBase;
      });

      // Calcular residuo y ajustar última subcuenta para que sume exactamente 100%
      const totalAsignado = porcentajeBase * cantidadSubcuentas;
      const residuoPorcentaje = parseFloat((100 - totalAsignado).toFixed(2));
      const importeResiduo = parseFloat((totalEntidad - (importeBase * cantidadSubcuentas)).toFixed(2));

      const ultimaSubcuenta = nuevasSubcuentas[cantidadSubcuentas - 1];
      ultimaSubcuenta.porcentaje = parseFloat((porcentajeBase + residuoPorcentaje).toFixed(2));
      ultimaSubcuenta.importe = parseFloat((importeBase + importeResiduo).toFixed(2));

      console.log(`✨ Auto-distribución: ${cantidadSubcuentas} subcuentas (${porcentajeBase}% base, última ajustada a ${ultimaSubcuenta.porcentaje}%)`);
    }

    setDistribuciones(distribuciones.map(d =>
      d.id === selectedDistribucionId
        ? { ...d, subcuentas: nuevasSubcuentas }
        : d
    ));

    setShowSubcuentaSelector(false);
  };

  const handleEliminarDimension = (dimensionId: string) => {
    setDistribuciones(distribuciones.filter(d => d.id !== dimensionId));
    if (selectedDistribucionId === dimensionId) {
      setSelectedDistribucionId(distribuciones[0]?.id || null);
    }
  };

  const handleEliminarSubcuenta = (subcuentaId: string) => {
    if (!selectedDistribucionId) return;

    const distribucion = distribuciones.find(d => d.id === selectedDistribucionId);
    if (!distribucion) return;

    const nuevasSubcuentas = distribucion.subcuentas.filter(s => s.id !== subcuentaId);

    // Si se eliminan todas las subcuentas, resetear el flag de edición manual
    if (nuevasSubcuentas.length === 0) {
      setEdicionManualPorDimension(prev => ({
        ...prev,
        [selectedDistribucionId]: false
      }));
      console.log('🔄 Se eliminaron todas las subcuentas, auto-distribución reactivada');
    }
    // Si todavía quedan subcuentas y NO hubo edición manual, redistribuir automáticamente
    else if (!edicionManualPorDimension[selectedDistribucionId]) {
      const cantidadSubcuentas = nuevasSubcuentas.length;
      const porcentajeBase = Math.floor((100 / cantidadSubcuentas) * 100) / 100;
      const importeBase = Math.floor((totalEntidad / cantidadSubcuentas) * 100) / 100;

      // Asignar porcentaje base a todas
      nuevasSubcuentas.forEach(sub => {
        sub.porcentaje = porcentajeBase;
        sub.importe = importeBase;
      });

      // Calcular residuo y ajustar última subcuenta para que sume exactamente 100%
      const totalAsignado = porcentajeBase * cantidadSubcuentas;
      const residuoPorcentaje = parseFloat((100 - totalAsignado).toFixed(2));
      const importeResiduo = parseFloat((totalEntidad - (importeBase * cantidadSubcuentas)).toFixed(2));

      const ultimaSubcuenta = nuevasSubcuentas[cantidadSubcuentas - 1];
      ultimaSubcuenta.porcentaje = parseFloat((porcentajeBase + residuoPorcentaje).toFixed(2));
      ultimaSubcuenta.importe = parseFloat((importeBase + importeResiduo).toFixed(2));

      console.log(`✨ Auto-distribución después de eliminar: ${cantidadSubcuentas} subcuentas (${porcentajeBase}% base, última ajustada a ${ultimaSubcuenta.porcentaje}%)`);
    }

    setDistribuciones(distribuciones.map(d =>
      d.id === selectedDistribucionId
        ? { ...d, subcuentas: nuevasSubcuentas }
        : d
    ));
  };

  const handleSubcuentaPorcentajeChange = (subcuentaId: string, nuevoPorcentaje: number) => {
    if (!selectedDistribucionId) return;

    const distribucion = distribuciones.find(d => d.id === selectedDistribucionId);
    if (!distribucion) return;

    // Marcar que hubo edición manual en esta dimensión
    if (!edicionManualPorDimension[selectedDistribucionId]) {
      setEdicionManualPorDimension(prev => ({
        ...prev,
        [selectedDistribucionId]: true
      }));
      console.log('🖊️ Edición manual detectada, auto-distribución desactivada para esta dimensión');
    }

    // Siempre usar totalEntidad para el cálculo
    const nuevoImporte = (totalEntidad * nuevoPorcentaje) / 100;

    console.log('🔢 Cambio de porcentaje:', {
      porcentaje: nuevoPorcentaje,
      totalEntidad,
      importeCalculado: nuevoImporte.toFixed(2)
    });

    setDistribuciones(distribuciones.map(d =>
      d.id === selectedDistribucionId
        ? {
            ...d,
            subcuentas: d.subcuentas.map(s =>
              s.id === subcuentaId
                ? { ...s, porcentaje: nuevoPorcentaje, importe: parseFloat(nuevoImporte.toFixed(2)) }
                : s
            )
          }
        : d
    ));
  };

  const handleSubcuentaImporteChange = (subcuentaId: string, nuevoImporte: number) => {
    if (!selectedDistribucionId) return;

    const distribucion = distribuciones.find(d => d.id === selectedDistribucionId);
    if (!distribucion) return;

    // Marcar que hubo edición manual en esta dimensión
    if (!edicionManualPorDimension[selectedDistribucionId]) {
      setEdicionManualPorDimension(prev => ({
        ...prev,
        [selectedDistribucionId]: true
      }));
      console.log('🖊️ Edición manual detectada, auto-distribución desactivada para esta dimensión');
    }

    // Siempre usar totalEntidad para el cálculo
    const nuevoPorcentaje = totalEntidad > 0
      ? (nuevoImporte * 100) / totalEntidad
      : 0;

    console.log('💰 Cambio de importe:', {
      importe: nuevoImporte,
      totalEntidad,
      porcentajeCalculado: nuevoPorcentaje.toFixed(2)
    });

    setDistribuciones(distribuciones.map(d =>
      d.id === selectedDistribucionId
        ? {
            ...d,
            subcuentas: d.subcuentas.map(s =>
              s.id === subcuentaId
                ? { ...s, importe: nuevoImporte, porcentaje: parseFloat(nuevoPorcentaje.toFixed(2)) }
                : s
            )
          }
        : d
    ));
  };

  const validarDistribuciones = () => {
    // Cada dimensión distribuye el total completo,
    // solo validamos que todas las dimensiones tengan subcuentas válidas (100%)
    let todasValidas = true;

    for (const dist of distribuciones) {
      if (dist.subcuentas.length === 0) {
        todasValidas = false;
        break;
      }

      const totalPorcentaje = dist.subcuentas.reduce(
        (sum, sub) => sum + parseFloat(String(sub.porcentaje || 0)),
        0
      );

      if (Math.abs(totalPorcentaje - 100) > 0.01) {
        todasValidas = false;
        break;
      }
    }

    return {
      valido: todasValidas,
      totalDistribuido: totalEntidad, // Siempre es el total
      diferencia: 0
    };
  };

  const handleGuardar = async () => {
    // Validar que todas las dimensiones tengan subcuentas válidas
    for (const dist of distribuciones) {
      if (!dist.tipoDimension || !dist.tipoDimensionNombre) {
        toast.error('Todas las dimensiones deben tener tipo y nombre');
        return;
      }

      if (dist.subcuentas.length === 0) {
        toast.error(`La dimensión "${dist.tipoDimensionNombre}" debe tener al menos una subcuenta`);
        return;
      }

      const totalPorcentaje = dist.subcuentas.reduce(
        (sum, sub) => sum + parseFloat(String(sub.porcentaje || 0)),
        0
      );

      if (Math.abs(totalPorcentaje - 100) > 0.01) {
        toast.error(
          `Las subcuentas de "${dist.tipoDimensionNombre}" deben sumar 100% (actualmente: ${totalPorcentaje.toFixed(2)}%)`
        );
        return;
      }
    }

    try {
      setSaving(true);

      const endpoint = tipo === 'documento'
        ? `/documentos/${entidadId}/distribuciones`
        : tipo === 'linea'
        ? `/documentos/lineas/${entidadId}/distribuciones`
        : `/documentos/impuestos/${entidadId}/distribuciones`;

      console.log('📤 Guardando distribuciones:', {
        endpoint,
        distribuciones: JSON.stringify(distribuciones, null, 2)
      });

      await api.post(endpoint, { distribuciones });

      toast.success('Distribuciones guardadas correctamente');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('❌ Error guardando distribuciones:', error);
      console.error('Response data:', error.response?.data);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Error al guardar las distribuciones';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const validacion = validarDistribuciones();
  const selectedDistribucion = distribuciones.find(d => d.id === selectedDistribucionId);

  // Validar subcuentas de la dimensión seleccionada
  const validarSubcuentas = () => {
    if (!selectedDistribucion) return { valido: true, totalPorcentaje: 0, totalImporte: 0 };

    const totalPorcentaje = selectedDistribucion.subcuentas.reduce(
      (sum, sub) => sum + parseFloat(String(sub.porcentaje || 0)),
      0
    );
    const totalImporte = selectedDistribucion.subcuentas.reduce(
      (sum, sub) => sum + parseFloat(String(sub.importe || 0)),
      0
    );

    const porcentajeValido = Math.abs(totalPorcentaje - 100) <= 0.01;
    const importeValido = Math.abs(selectedDistribucion.importeDimension - totalImporte) <= 0.01;

    return {
      valido: porcentajeValido && importeValido,
      totalPorcentaje,
      totalImporte
    };
  };

  const validacionSubcuentas = validarSubcuentas();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[70]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 bg-white rounded-lg shadow-2xl z-[70] flex flex-col max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">
              Dimensiones y Subcuentas
            </h2>
            <div className="mt-1 space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">
                  {tipo === 'documento' ? 'Documento:' : tipo === 'linea' ? 'Producto:' : 'Impuesto:'}
                </span>{' '}
                {codigo && <span className="text-blue-600 font-mono">{codigo}</span>}
                {codigo && nombre && <span className="text-gray-400 mx-1">-</span>}
                {nombre && <span className="text-gray-900">{nombre}</span>}
              </p>
              <p className="text-sm text-gray-500">
                Total {tipo === 'documento' ? 'del documento' : tipo === 'linea' ? 'de la línea' : 'del impuesto'}: <span className="font-semibold text-gray-900">${totalEntidad.toFixed(2)}</span>
                <span className="text-gray-400 ml-2">(Cada dimensión distribuye este total completo)</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content - 2 Grillas */}
        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          {/* Grilla Izquierda - Dimensiones */}
          <div className="w-1/3 flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Dimensiones</h3>
              <div
                onClick={handleDimensionSelectorClick}
                className="w-full px-3 py-2 text-left text-sm bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-50"
              >
                Seleccionar Dimensión...
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Tipo</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Nombre</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {distribuciones.map((dist) => (
                    <tr
                      key={dist.id}
                      onClick={() => setSelectedDistribucionId(dist.id)}
                      className={`cursor-pointer border-b border-gray-200 hover:bg-blue-50 ${
                        selectedDistribucionId === dist.id ? 'bg-blue-100' : ''
                      }`}
                    >
                      <td className="px-3 py-2">{dist.tipoDimension}</td>
                      <td className="px-3 py-2">{dist.tipoDimensionNombre}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEliminarDimension(dist.id);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {distribuciones.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No hay dimensiones. Selecciona una dimensión arriba para comenzar.
                </div>
              )}
            </div>
          </div>

          {/* Grilla Derecha - Subcuentas */}
          <div className="w-2/3 flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Subcuentas</h3>
                {selectedDistribucion && (
                  <div className="text-xs">
                    <span className="text-gray-600">Total a distribuir: </span>
                    <span className="font-semibold text-gray-900">${totalEntidad.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div
                onClick={handleSubcuentaSelectorClick}
                className={`w-full px-3 py-2 text-left text-sm bg-white border border-gray-300 rounded ${
                  selectedDistribucionId ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-50'
                }`}
              >
                {selectedDistribucion
                  ? `Seleccionar Subcuenta para ${selectedDistribucion.tipoDimensionNombre}...`
                  : 'Selecciona una dimensión primero...'}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedDistribucion ? (
                <>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Código</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Nombre</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">%</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">Importe</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-700 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDistribucion.subcuentas.map((sub) => (
                        <tr key={sub.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-2">{sub.codigoSubcuenta}</td>
                          <td className="px-3 py-2">{sub.subcuentaNombre}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={sub.porcentaje}
                              onChange={(e) => handleSubcuentaPorcentajeChange(sub.id, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={sub.importe}
                              onChange={(e) => handleSubcuentaImporteChange(sub.id, parseFloat(e.target.value) || 0)}
                              className="w-32 px-2 py-1 text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleEliminarSubcuenta(sub.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 sticky bottom-0">
                      <tr className="font-semibold border-t-2 border-gray-300">
                        <td colSpan={2} className="px-3 py-2 text-right">Total:</td>
                        <td className={`px-3 py-2 text-right ${
                          validacionSubcuentas.valido ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {validacionSubcuentas.totalPorcentaje.toFixed(2)}%
                        </td>
                        <td className={`px-3 py-2 text-right ${
                          validacionSubcuentas.valido ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${validacionSubcuentas.totalImporte.toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Indicador de diferencia */}
                  {selectedDistribucion.subcuentas.length > 0 && !validacionSubcuentas.valido && (
                    <div className="p-3 bg-yellow-50 border-t border-yellow-200">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-yellow-700">
                            {Math.abs(100 - validacionSubcuentas.totalPorcentaje) > 0.01 && (
                              validacionSubcuentas.totalPorcentaje < 100
                                ? `Falta distribuir: ${(100 - validacionSubcuentas.totalPorcentaje).toFixed(2)}%`
                                : `Sobra: ${(validacionSubcuentas.totalPorcentaje - 100).toFixed(2)}%`
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-yellow-700">
                            {Math.abs(totalEntidad - validacionSubcuentas.totalImporte) > 0.01 && (
                              validacionSubcuentas.totalImporte < totalEntidad
                                ? `Falta: $${(totalEntidad - validacionSubcuentas.totalImporte).toFixed(2)}`
                                : `Sobra: $${(validacionSubcuentas.totalImporte - totalEntidad).toFixed(2)}`
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedDistribucion.subcuentas.length === 0 && (
                    <div className="text-center py-12 text-gray-500 text-sm">
                      No hay subcuentas. Selecciona una subcuenta arriba para comenzar.
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-500 text-sm">
                  Selecciona una dimensión de la grilla izquierda
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          {!validacion.valido && (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                Todas las dimensiones deben tener al menos una subcuenta, y las subcuentas de cada dimensión deben sumar 100%.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              onClick={handleGuardar}
              disabled={saving || !validacion.valido}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SmartSelector para Dimensiones */}
      {showDimensionSelector && (
        <SmartSelector
          value=""
          fieldType="codigo_dimension"
          onSelect={handleDimensionSelect}
          onClose={() => setShowDimensionSelector(false)}
          position={selectorPosition}
        />
      )}

      {/* SmartSelector para Subcuentas */}
      {showSubcuentaSelector && selectedDistribucion && (
        <SmartSelector
          value=""
          fieldType="subcuenta"
          parentValue={selectedDistribucion.tipoDimension}
          onSelect={handleSubcuentaSelect}
          onClose={() => setShowSubcuentaSelector(false)}
          position={selectorPosition}
        />
      )}
    </>
  );
}
