import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from './Button';
import { dktApi } from '@/lib/api';

interface LoteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  loteId: string | null;
}

interface Transaccion {
  id: string;
  numeroTarjeta: string;
  apellidoNombreUsuario: string;
  fechaTransaccion: string;
  descripcionCupon: string;
  numeroCupon: string;
  importeTransaccion: number;
  tipoTransaccion: string;
  moneda: string;
  tipoConsumo: string;
  localidad: string;
  grupoRubro: string;
  descripcionRubro: string;
}

interface LoteInfo {
  loteId: string;
  codigoTarjeta: string;
  periodo: string;
  fechaImportacion: string;
  usuarioImportacion: string;
  estado: string;
  tarjetas: {
    codigo: string;
    descripcion: string;
  };
}

interface Estadistica {
  tipo: string;
  cantidad: number;
  total: number;
}

export function LoteDetailModal({ isOpen, onClose, loteId }: LoteDetailModalProps) {
  const [loteInfo, setLoteInfo] = useState<LoteInfo | null>(null);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [estadisticas, setEstadisticas] = useState<Estadistica[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && loteId) {
      loadLoteDetail();
    }
  }, [isOpen, loteId, currentPage]);

  const loadLoteDetail = async () => {
    if (!loteId) return;
    
    setLoading(true);
    try {
      const response = await dktApi.getLoteDetail(loteId, currentPage, 20);
      setLoteInfo(response.lote);
      setTransacciones(response.transacciones);
      setEstadisticas(response.estadisticas);
      setTotalPages(response.pagination.pages);
      setTotalRecords(response.pagination.total);
    } catch (error) {
      console.error('Error loading lote detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const getTipoTransaccionLabel = (tipo: string) => {
    switch (tipo) {
      case 'A': return 'Adelanto';
      case 'C': return 'Compra';
      case 'D': return 'Devolución';
      default: return tipo || 'N/A';
    }
  };

  // Función para filtrar transacciones basado en el término de búsqueda
  const filteredTransacciones = transacciones.filter((transaccion) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    return (
      transaccion.numeroTarjeta?.toLowerCase().includes(searchLower) ||
      transaccion.apellidoNombreUsuario?.toLowerCase().includes(searchLower) ||
      transaccion.fechaTransaccion?.toLowerCase().includes(searchLower) ||
      transaccion.descripcionCupon?.toLowerCase().includes(searchLower) ||
      transaccion.numeroCupon?.toLowerCase().includes(searchLower) ||
      transaccion.importeTransaccion?.toString().includes(searchLower) ||
      getTipoTransaccionLabel(transaccion.tipoTransaccion).toLowerCase().includes(searchLower) ||
      formatCurrency(transaccion.importeTransaccion || 0).toLowerCase().includes(searchLower)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden animate-in fade-in-0 zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">
              Detalle del Lote
            </h2>
            {loteInfo && loteInfo.tarjetas && (
              <p className="text-sm text-text-secondary mt-1">
                {loteInfo.tarjetas.codigo} - {loteInfo.tarjetas.descripcion}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors -mb-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : loteInfo ? (
            <div className="space-y-6">
              {/* Información del Lote y Estadísticas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Información del Lote */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-text-secondary mb-2">Información del Lote</h3>
                  <p className="text-lg font-semibold text-text-primary">{loteInfo.loteId}</p>
                  <p className="text-sm text-text-secondary">Período: {loteInfo.periodo}</p>
                  <p className="text-sm text-text-secondary">
                    Importado: {new Date(loteInfo.fechaImportacion).toLocaleDateString('es-AR')}
                  </p>
                  <p className="text-sm text-text-secondary">Por: {loteInfo.usuarioImportacion}</p>
                  <p className="text-sm text-text-secondary mt-2">
                    <span className="font-medium">Total de registros:</span> {totalRecords} transacciones
                  </p>
                </div>

                {/* Estadísticas por Tipo */}
                {estadisticas.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-text-secondary mb-2">Estadísticas por Tipo de Transacción</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {estadisticas.map((stat, index) => (
                        <div key={index} className="bg-blue-50 p-3 rounded-lg">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium text-blue-700">
                              {getTipoTransaccionLabel(stat.tipo)}
                            </h4>
                            <div className="text-right">
                              <p className="text-lg font-bold text-blue-900">{stat.cantidad}</p>
                              <p className="text-xs text-blue-600">
                                {formatCurrency(stat.total)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Lista de Transacciones */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Transacciones</h3>
                  
                  {/* Campo de búsqueda */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar en todas las columnas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 w-80 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Tarjeta
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Usuario
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Descripción
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Importe
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Cupón
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-border">
                      {filteredTransacciones.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                            {searchTerm 
                              ? `No se encontraron transacciones que coincidan con "${searchTerm}"`
                              : 'No hay transacciones para mostrar'
                            }
                          </td>
                        </tr>
                      ) : filteredTransacciones.map((transaccion) => (
                        <tr key={transaccion.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-text-primary">
                            {transaccion.numeroTarjeta}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-text-primary">
                            {transaccion.apellidoNombreUsuario}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-text-secondary">
                            {transaccion.fechaTransaccion}
                          </td>
                          <td className="px-4 py-4 text-sm text-text-primary max-w-xs truncate">
                            {transaccion.descripcionCupon}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              transaccion.tipoTransaccion === 'C' 
                                ? 'bg-green-100 text-green-800'
                                : transaccion.tipoTransaccion === 'A'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {getTipoTransaccionLabel(transaccion.tipoTransaccion)}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-text-primary font-medium text-right">
                            {formatCurrency(transaccion.importeTransaccion || 0)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-text-secondary">
                            {transaccion.numeroCupon}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Indicador de resultados filtrados */}
                {searchTerm && (
                  <div className="mt-2 text-sm text-text-secondary">
                    Mostrando {filteredTransacciones.length} de {transacciones.length} transacciones
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-text-secondary">
                      Página {currentPage} de {totalPages}
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-text-secondary">No se pudo cargar la información del lote</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-border bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}