import { useState } from 'react';
import { api, parametrosApi, ParametroMaestro } from '@/lib/api';
import toast from 'react-hot-toast';
import { DocumentoProcessado } from '@/types/documento';

interface UseComprobanteEditOptions {
  onSaveSuccess?: (documento: DocumentoProcessado) => void;
  readOnly?: boolean;
}

export const useComprobanteEdit = (options: UseComprobanteEditOptions = {}) => {
  const { onSaveSuccess, readOnly = false } = options;

  // Estados principales
  const [selectedDocument, setSelectedDocument] = useState<DocumentoProcessado | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'encabezado' | 'items' | 'impuestos'>('encabezado');
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados para líneas e impuestos
  const [documentoLineas, setDocumentoLineas] = useState<any[]>([]);
  const [documentoImpuestos, setDocumentoImpuestos] = useState<any[]>([]);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [loadingImpuestos, setLoadingImpuestos] = useState(false);

  // Estados para modales de item e impuesto
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemFormData, setItemFormData] = useState<any>({});
  const [savingItem, setSavingItem] = useState(false);

  const [showImpuestoModal, setShowImpuestoModal] = useState(false);
  const [selectedImpuesto, setSelectedImpuesto] = useState<any>(null);
  const [impuestoFormData, setImpuestoFormData] = useState<any>({});
  const [savingImpuesto, setSavingImpuesto] = useState(false);

  // Estados para parámetros maestros
  const [proveedores, setProveedores] = useState<ParametroMaestro[]>([]);
  const [tiposProducto, setTiposProducto] = useState<ParametroMaestro[]>([]);
  const [codigosProducto, setCodigosProducto] = useState<ParametroMaestro[]>([]);
  const [codigosDimension, setCodigosDimension] = useState<ParametroMaestro[]>([]);
  const [subcuentas, setSubcuentas] = useState<ParametroMaestro[]>([]);
  const [cuentasContables, setCuentasContables] = useState<ParametroMaestro[]>([]);
  const [tiposOrdenCompra, setTiposOrdenCompra] = useState<ParametroMaestro[]>([]);

  // Estados para distribuciones (dimensiones)
  const [showDistribucionesModal, setShowDistribucionesModal] = useState(false);
  const [distribucionesEntidad, setDistribucionesEntidad] = useState<{
    tipo: 'linea' | 'impuesto' | 'documento';
    id: string;
    total: number;
    codigo: string;
    nombre: string;
  } | null>(null);
  const [distribucionesStatus, setDistribucionesStatus] = useState<{
    [key: string]: 'none' | 'valid' | 'invalid';
  }>({});

  /**
   * Abre el modal de edición con un documento
   */
  const openEditModal = async (doc: DocumentoProcessado) => {
    setSelectedDocument(doc);

    // Convertir fecha al formato YYYY-MM-DD
    let fechaFormateada = '';
    if (doc.fechaExtraida) {
      try {
        fechaFormateada = doc.fechaExtraida.split('T')[0];
      } catch (e) {
        fechaFormateada = doc.fechaExtraida;
      }
    }

    setEditFormData({
      fechaExtraida: fechaFormateada,
      importeExtraido: doc.importeExtraido ? Number(doc.importeExtraido).toFixed(2) : '',
      cuitExtraido: doc.cuitExtraido || '',
      numeroComprobanteExtraido: doc.numeroComprobanteExtraido || '',
      razonSocialExtraida: doc.razonSocialExtraida || '',
      caeExtraido: doc.caeExtraido || '',
      tipoComprobanteExtraido: doc.tipoComprobanteExtraido || '',
      netoGravadoExtraido: doc.netoGravadoExtraido ? Number(doc.netoGravadoExtraido).toFixed(2) : '',
      exentoExtraido: doc.exentoExtraido ? Number(doc.exentoExtraido).toFixed(2) : '',
      impuestosExtraido: doc.impuestosExtraido ? Number(doc.impuestosExtraido).toFixed(2) : '',
      descuentoGlobalExtraido: doc.descuentoGlobalExtraido ? Number(doc.descuentoGlobalExtraido).toFixed(2) : '',
      descuentoGlobalTipo: doc.descuentoGlobalTipo || '',
      codigoProveedor: doc.codigoProveedor || '',
      monedaExtraida: doc.monedaExtraida || 'ARS'
    });

    setActiveTab('encabezado');

    // Cargar proveedores
    try {
      const response = await parametrosApi.getPorCampo('proveedor');
      setProveedores(response.parametros);
    } catch (error) {
      console.error('Error loading proveedores:', error);
    }

    // Cargar líneas e impuestos
    await loadDocumentoLineas(doc.id);
    await loadDocumentoImpuestos(doc.id);

    // Cargar estado de distribuciones
    const lineas = await api.get(`/documentos/${doc.id}/lineas`).then(r => r.data.lineas || []);
    const impuestos = await api.get(`/documentos/${doc.id}/impuestos`).then(r => r.data.impuestos || []);
    await loadDistribucionesStatus(lineas, impuestos);
  };

  /**
   * Cierra el modal de edición
   */
  const closeEditModal = () => {
    setSelectedDocument(null);
    setEditFormData({});
    setDocumentoLineas([]);
    setDocumentoImpuestos([]);
    setActiveTab('encabezado');
  };

  /**
   * Carga las líneas del documento
   */
  const loadDocumentoLineas = async (documentoId: string) => {
    try {
      setLoadingLineas(true);
      const response = await api.get(`/documentos/${documentoId}/lineas`);

      // Enriquecer con nombres
      const lineasEnriquecidas = await enrichWithNames(
        response.data.lineas || [],
        [
          { field: 'tipoProducto', tipoCampo: 'tipo_producto', nameField: 'tipoProductoNombre' },
          { field: 'codigoProducto', tipoCampo: 'codigo_producto', nameField: 'codigoProductoNombre' },
          { field: 'cuentaContable', tipoCampo: 'cuenta_contable', nameField: 'cuentaContableNombre' },
          { field: 'codigoDimension', tipoCampo: 'codigo_dimension', nameField: 'codigoDimensionNombre' },
          { field: 'subcuenta', tipoCampo: 'subcuenta', nameField: 'subcuentaNombre' },
          { field: 'tipoOrdenCompra', tipoCampo: 'tipo_orden_compra', nameField: 'tipoOrdenCompraNombre' }
        ]
      );

      setDocumentoLineas(lineasEnriquecidas);
    } catch (error) {
      console.error('Error loading lineas:', error);
      toast.error('Error al cargar las líneas del documento');
    } finally {
      setLoadingLineas(false);
    }
  };

  /**
   * Carga los impuestos del documento
   */
  const loadDocumentoImpuestos = async (documentoId: string) => {
    try {
      setLoadingImpuestos(true);
      const response = await api.get(`/documentos/${documentoId}/impuestos`);

      // Enriquecer con nombres
      const impuestosEnriquecidos = await enrichWithNames(
        response.data.impuestos || [],
        [
          { field: 'cuentaContable', tipoCampo: 'cuenta_contable', nameField: 'cuentaContableNombre' },
          { field: 'codigoDimension', tipoCampo: 'codigo_dimension', nameField: 'codigoDimensionNombre' },
          { field: 'subcuenta', tipoCampo: 'subcuenta', nameField: 'subcuentaNombre' }
        ]
      );

      setDocumentoImpuestos(impuestosEnriquecidos);
    } catch (error) {
      console.error('Error loading impuestos:', error);
      toast.error('Error al cargar los impuestos del documento');
    } finally {
      setLoadingImpuestos(false);
    }
  };

  /**
   * Función auxiliar para enriquecer códigos con nombres
   */
  const enrichWithNames = async (
    items: any[],
    fieldMappings: { field: string; tipoCampo: string; nameField: string }[]
  ) => {
    const enrichedItems = [...items];
    const cache: Record<string, Record<string, string>> = {};

    for (const mapping of fieldMappings) {
      const { field, tipoCampo, nameField } = mapping;

      const uniqueCodes = Array.from(
        new Set(enrichedItems.map(item => item[field]).filter(code => code && code.trim() !== ''))
      );

      if (uniqueCodes.length === 0) continue;

      if (!cache[tipoCampo]) {
        cache[tipoCampo] = {};
      }

      const uncachedCodes = uniqueCodes.filter(code => !cache[tipoCampo][code]);

      if (uncachedCodes.length > 0) {
        try {
          const response = await parametrosApi.getPorCampo(tipoCampo);
          response.parametros.forEach((param: ParametroMaestro) => {
            cache[tipoCampo][param.codigo] = param.nombre;
          });
        } catch (error) {
          console.error(`Error fetching ${tipoCampo}:`, error);
        }
      }

      enrichedItems.forEach(item => {
        if (item[field] && cache[tipoCampo][item[field]]) {
          item[nameField] = cache[tipoCampo][item[field]];
        }
      });
    }

    return enrichedItems;
  };

  /**
   * Carga el estado de las distribuciones (dimensiones)
   */
  const loadDistribucionesStatus = async (lineas: any[], impuestos: any[]) => {
    const newStatus: { [key: string]: 'none' | 'valid' | 'invalid' } = {};

    // Función para validar si las distribuciones son válidas
    // Cada distribución debe tener subcuentas que sumen 100%
    const validarDistribuciones = (distribuciones: any[]): 'none' | 'valid' | 'invalid' => {
      if (distribuciones.length === 0) {
        return 'none';
      }

      // Verificar que cada distribución tenga subcuentas que sumen 100%
      for (const dist of distribuciones) {
        const subcuentas = dist.documento_subcuentas || [];
        if (subcuentas.length === 0) {
          // Distribución sin subcuentas - puede ser válida si es solo dimensión
          continue;
        }

        const totalSubcuentas = subcuentas.reduce(
          (sum: number, sub: any) => sum + parseFloat(sub.porcentaje || 0),
          0
        );

        // Si tiene subcuentas, deben sumar 100%
        if (Math.abs(totalSubcuentas - 100) > 0.01) {
          return 'invalid';
        }
      }

      return 'valid';
    };

    // Validar líneas
    for (const linea of lineas) {
      const distribuciones = await api
        .get(`/documentos/lineas/${linea.id}/distribuciones`)
        .then(r => r.data.distribuciones || [])
        .catch(() => []);

      const key = `linea-${linea.id}`;
      newStatus[key] = validarDistribuciones(distribuciones);
    }

    // Validar impuestos
    for (const impuesto of impuestos) {
      const distribuciones = await api
        .get(`/documentos/impuestos/${impuesto.id}/distribuciones`)
        .then(r => r.data.distribuciones || [])
        .catch(() => []);

      const key = `impuesto-${impuesto.id}`;
      newStatus[key] = validarDistribuciones(distribuciones);
    }

    setDistribucionesStatus(newStatus);
  };

  /**
   * Guarda los cambios del documento
   */
  const saveEdit = async () => {
    if (!selectedDocument) return false;

    try {
      setSavingEdit(true);

      // Validar suma de importes
      const netoGravado = parseFloat(editFormData.netoGravadoExtraido) || 0;
      const exento = parseFloat(editFormData.exentoExtraido) || 0;
      const impuestos = parseFloat(editFormData.impuestosExtraido) || 0;
      const importeTotal = parseFloat(editFormData.importeExtraido) || 0;

      if (importeTotal > 0) {
        const sumaComponentes = netoGravado + exento + impuestos;
        const diferencia = Math.abs(sumaComponentes - importeTotal);

        if (diferencia > 0.01) {
          toast.error(
            `La suma de Neto Gravado + Exento + Impuestos (${sumaComponentes.toFixed(2)}) debe ser igual al Importe Total (${importeTotal.toFixed(2)})`
          );
          return false;
        }
      }

      // Preparar datos para enviar
      const descuentoGlobal = editFormData.descuentoGlobalExtraido
        ? parseFloat(editFormData.descuentoGlobalExtraido)
        : null;
      const dataToSend = {
        ...editFormData,
        fechaExtraida: editFormData.fechaExtraida || null,
        importeExtraido: importeTotal || null,
        netoGravadoExtraido: netoGravado || null,
        exentoExtraido: exento || null,
        impuestosExtraido: impuestos || null,
        descuentoGlobalExtraido: descuentoGlobal,
        descuentoGlobalTipo: editFormData.descuentoGlobalTipo || null
      };

      await api.put(`/documentos/${selectedDocument.id}/datos-extraidos`, dataToSend);

      toast.success('Datos actualizados correctamente');

      // Callback de éxito
      if (onSaveSuccess) {
        const updatedDoc = {
          ...selectedDocument,
          ...dataToSend,
          datosExtraidos: {
            ...selectedDocument.datosExtraidos,
            tipoComprobante: dataToSend.tipoComprobanteExtraido,
            netoGravado: dataToSend.netoGravadoExtraido,
            exento: dataToSend.exentoExtraido,
            impuestos: dataToSend.impuestosExtraido
          }
        };
        onSaveSuccess(updatedDoc);
      }

      return true;
    } catch (error) {
      console.error('Error saving edit:', error);
      toast.error('Error al actualizar los datos');
      return false;
    } finally {
      setSavingEdit(false);
    }
  };

  /**
   * Maneja la eliminación de una línea
   */
  const handleDeleteLinea = async (lineaId: string) => {
    if (!selectedDocument) return;

    try {
      await api.delete(`/documentos/lineas/${lineaId}`);
      toast.success('Línea eliminada correctamente');
      await loadDocumentoLineas(selectedDocument.id);
    } catch (error) {
      console.error('Error deleting linea:', error);
      toast.error('Error al eliminar la línea');
    }
  };

  /**
   * Maneja la eliminación de un impuesto
   */
  const handleDeleteImpuesto = async (impuestoId: string) => {
    if (!selectedDocument) return;

    try {
      await api.delete(`/documentos/impuestos/${impuestoId}`);
      toast.success('Impuesto eliminado correctamente');
      await loadDocumentoImpuestos(selectedDocument.id);
    } catch (error) {
      console.error('Error deleting impuesto:', error);
      toast.error('Error al eliminar el impuesto');
    }
  };

  return {
    // Estado
    selectedDocument,
    editFormData,
    setEditFormData,
    activeTab,
    setActiveTab,
    savingEdit,
    documentoLineas,
    documentoImpuestos,
    loadingLineas,
    loadingImpuestos,
    showItemModal,
    setShowItemModal,
    selectedItem,
    setSelectedItem,
    itemFormData,
    setItemFormData,
    savingItem,
    setSavingItem,
    showImpuestoModal,
    setShowImpuestoModal,
    selectedImpuesto,
    setSelectedImpuesto,
    impuestoFormData,
    setImpuestoFormData,
    savingImpuesto,
    setSavingImpuesto,
    proveedores,
    setProveedores,
    tiposProducto,
    setTiposProducto,
    codigosProducto,
    setCodigosProducto,
    codigosDimension,
    setCodigosDimension,
    subcuentas,
    setSubcuentas,
    cuentasContables,
    setCuentasContables,
    tiposOrdenCompra,
    setTiposOrdenCompra,
    showDistribucionesModal,
    setShowDistribucionesModal,
    distribucionesEntidad,
    setDistribucionesEntidad,
    distribucionesStatus,
    setDistribucionesStatus,
    readOnly,

    // Métodos
    openEditModal,
    closeEditModal,
    saveEdit,
    loadDocumentoLineas,
    loadDocumentoImpuestos,
    loadDistribucionesStatus,
    handleDeleteLinea,
    handleDeleteImpuesto,
  };
};
