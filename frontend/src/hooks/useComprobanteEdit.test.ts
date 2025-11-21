import { renderHook, act, waitFor } from '@testing-library/react';
import { useComprobanteEdit } from './useComprobanteEdit';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

// Mock del API
jest.mock('@/lib/api');

// Mock de react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useComprobanteEdit', () => {
  const mockDocument = {
    id: 'doc-123',
    nombreArchivo: 'factura-test.pdf',
    tipoArchivo: 'application/pdf',
    fechaProcesamiento: '2025-01-20T10:00:00Z',
    fechaExtraida: '2025-01-15',
    importeExtraido: 1000,
    cuitExtraido: '20-12345678-9',
    numeroComprobanteExtraido: '00001-00000123',
    razonSocialExtraida: 'Proveedor Test SA',
    tipoComprobanteExtraido: 'FACTURA A',
    netoGravadoExtraido: 800,
    exentoExtraido: 0,
    impuestosExtraido: 200,
    caeExtraido: '12345678901234',
    exportado: false,
  };

  const mockLineas = [
    {
      id: 'linea-1',
      numero: 1,
      descripcion: 'Producto 1',
      cantidad: 2,
      precioUnitario: 100,
      subtotal: 200,
    },
    {
      id: 'linea-2',
      numero: 2,
      descripcion: 'Producto 2',
      cantidad: 1,
      precioUnitario: 300,
      subtotal: 300,
    },
  ];

  const mockImpuestos = [
    {
      id: 'impuesto-1',
      tipo: 'IVA',
      descripcion: 'IVA 21%',
      alicuota: 21,
      baseImponible: 500,
      importe: 105,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock default API responses
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/lineas')) {
        return Promise.resolve({ data: { lineas: mockLineas } });
      }
      if (url.includes('/impuestos')) {
        return Promise.resolve({ data: { impuestos: mockImpuestos } });
      }
      if (url.includes('/proveedores') || url.includes('/parametros/maestros')) {
        return Promise.resolve({ data: { parametros: [] } });
      }
      if (url.includes('/dimensiones')) {
        return Promise.resolve({ data: { dimensiones: [] } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  describe('Estado inicial', () => {
    it('debería inicializarse con valores por defecto', () => {
      const { result } = renderHook(() => useComprobanteEdit());

      expect(result.current.selectedDocument).toBeNull();
      expect(result.current.editFormData).toEqual({});
      expect(result.current.savingEdit).toBe(false);
      expect(result.current.activeTab).toBe('encabezado');
      expect(result.current.documentoLineas).toEqual([]);
      expect(result.current.documentoImpuestos).toEqual([]);
      expect(result.current.loadingLineas).toBe(false);
      expect(result.current.loadingImpuestos).toBe(false);
    });
  });

  describe('openEditModal', () => {
    it('debería cargar el documento y sus datos', async () => {
      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.openEditModal(mockDocument);
      });

      expect(result.current.selectedDocument).toEqual(mockDocument);
      expect(result.current.editFormData.fechaExtraida).toBe('2025-01-15');
      expect(result.current.editFormData.cuitExtraido).toBe('20-12345678-9');
      expect(result.current.editFormData.importeExtraido).toBe('1000.00');
    });

    it('debería cargar líneas del documento', async () => {
      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.openEditModal(mockDocument);
      });

      await waitFor(() => {
        expect(result.current.documentoLineas).toEqual(mockLineas);
        expect(result.current.loadingLineas).toBe(false);
      });
    });

    it('debería cargar impuestos del documento', async () => {
      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.openEditModal(mockDocument);
      });

      await waitFor(() => {
        expect(result.current.documentoImpuestos).toEqual(mockImpuestos);
        expect(result.current.loadingImpuestos).toBe(false);
      });
    });

    it('debería manejar error al cargar líneas', async () => {
      (api.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/lineas')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: {} });
      });

      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.openEditModal(mockDocument);
      });

      await waitFor(() => {
        expect(result.current.documentoLineas).toEqual([]);
        expect(result.current.loadingLineas).toBe(false);
      });
    });
  });

  describe('saveEdit', () => {
    it('debería guardar cambios exitosamente', async () => {
      const onSaveSuccess = jest.fn();
      const updatedDoc = { ...mockDocument, cuitExtraido: '20-99999999-9' };

      (api.put as jest.Mock).mockResolvedValue({ data: updatedDoc });

      const { result } = renderHook(() => useComprobanteEdit({ onSaveSuccess }));

      await act(async () => {
        await result.current.openEditModal(mockDocument);
      });

      act(() => {
        result.current.setEditFormData({
          ...result.current.editFormData,
          cuitExtraido: '20-99999999-9'
        });
      });

      await act(async () => {
        await result.current.saveEdit();
      });

      expect(api.put).toHaveBeenCalledWith(
        `/documentos/${mockDocument.id}/datos-extraidos`,
        expect.objectContaining({
          cuitExtraido: '20-99999999-9'
        })
      );

      expect(onSaveSuccess).toHaveBeenCalledWith(updatedDoc);
      expect(toast.success).toHaveBeenCalledWith('Datos actualizados correctamente');
    });

    it('debería validar suma de componentes vs total', async () => {
      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.openEditModal(mockDocument);
      });

      act(() => {
        result.current.setEditFormData({
          ...result.current.editFormData,
          netoGravadoExtraido: '500.00',  // Total should be 700, not 1000
          exentoExtraido: '0.00',
          impuestosExtraido: '200.00',
          importeExtraido: '1000.00'
        });
      });

      await act(async () => {
        await result.current.saveEdit();
      });

      // No debería llamar al API si la validación falla
      expect(api.put).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('debería manejar error al guardar', async () => {
      (api.put as jest.Mock).mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.openEditModal(mockDocument);
      });

      await act(async () => {
        await result.current.saveEdit();
      });

      expect(toast.error).toHaveBeenCalledWith('Error al actualizar los datos');
    });

    it('NO debería guardar si no hay documento seleccionado', async () => {
      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.saveEdit();
      });

      expect(api.put).not.toHaveBeenCalled();
    });
  });

  describe('closeEditModal', () => {
    it('debería limpiar el estado al cerrar', async () => {
      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.openEditModal(mockDocument);
      });

      act(() => {
        result.current.closeEditModal();
      });

      expect(result.current.selectedDocument).toBeNull();
      expect(result.current.editFormData).toEqual({});
      expect(result.current.documentoLineas).toEqual([]);
      expect(result.current.documentoImpuestos).toEqual([]);
      expect(result.current.activeTab).toBe('encabezado');
    });
  });

  describe('loadDocumentoLineas', () => {
    it('debería cargar líneas correctamente', async () => {
      const { result } = renderHook(() => useComprobanteEdit());

      expect(result.current.loadingLineas).toBe(false);

      await act(async () => {
        await result.current.loadDocumentoLineas('doc-123');
      });

      expect(api.get).toHaveBeenCalledWith('/documentos/doc-123/lineas');
      expect(result.current.documentoLineas).toEqual(mockLineas);
      expect(result.current.loadingLineas).toBe(false);
    });

    it('debería establecer array vacío si falla la carga', async () => {
      (api.get as jest.Mock).mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.loadDocumentoLineas('doc-123');
      });

      expect(result.current.documentoLineas).toEqual([]);
      expect(result.current.loadingLineas).toBe(false);
    });
  });

  describe('loadDocumentoImpuestos', () => {
    it('debería cargar impuestos correctamente', async () => {
      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.loadDocumentoImpuestos('doc-123');
      });

      expect(api.get).toHaveBeenCalledWith('/documentos/doc-123/impuestos');
      expect(result.current.documentoImpuestos).toEqual(mockImpuestos);
      expect(result.current.loadingImpuestos).toBe(false);
    });

    it('debería establecer array vacío si falla la carga', async () => {
      (api.get as jest.Mock).mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useComprobanteEdit());

      await act(async () => {
        await result.current.loadDocumentoImpuestos('doc-123');
      });

      expect(result.current.documentoImpuestos).toEqual([]);
      expect(result.current.loadingImpuestos).toBe(false);
    });
  });

  describe('Gestión de tabs', () => {
    it('debería cambiar el tab activo', () => {
      const { result } = renderHook(() => useComprobanteEdit());

      expect(result.current.activeTab).toBe('encabezado');

      act(() => {
        result.current.setActiveTab('items');
      });

      expect(result.current.activeTab).toBe('items');

      act(() => {
        result.current.setActiveTab('impuestos');
      });

      expect(result.current.activeTab).toBe('impuestos');
    });
  });
});
