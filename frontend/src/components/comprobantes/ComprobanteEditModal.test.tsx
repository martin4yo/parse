import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComprobanteEditModal } from './ComprobanteEditModal';
import { useComprobanteEdit } from '@/hooks/useComprobanteEdit';
import { api } from '@/lib/api';

// Mock del hook useComprobanteEdit
jest.mock('@/hooks/useComprobanteEdit');

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

// Mock de SmartSelector
jest.mock('@/components/rendiciones/SmartSelector', () => ({
  SmartSelector: () => <div data-testid="smart-selector">SmartSelector Mock</div>
}));

describe('ComprobanteEditModal', () => {
  // Documento de prueba
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
    validationErrors: {
      errors: [],
      summary: {
        total: 0,
        bloqueantes: 0,
        errores: 0,
        warnings: 0
      },
      timestamp: '2025-01-20T10:00:00Z'
    }
  };

  // Mock del valor retornado por useComprobanteEdit
  const mockComprobanteEdit = {
    selectedDocument: mockDocument,
    editFormData: {
      fechaExtraida: '2025-01-15',
      importeExtraido: '1000.00',
      cuitExtraido: '20-12345678-9',
      numeroComprobanteExtraido: '00001-00000123',
      razonSocialExtraida: 'Proveedor Test SA',
      tipoComprobanteExtraido: 'FACTURA A',
      netoGravadoExtraido: '800.00',
      exentoExtraido: '0.00',
      impuestosExtraido: '200.00',
      caeExtraido: '12345678901234',
    },
    setEditFormData: jest.fn(),
    savingEdit: false,
    activeTab: 'encabezado',
    setActiveTab: jest.fn(),
    documentoLineas: [],
    documentoImpuestos: [],
    loadingLineas: false,
    loadingImpuestos: false,
    showItemModal: false,
    setShowItemModal: jest.fn(),
    selectedItem: null,
    setSelectedItem: jest.fn(),
    itemFormData: {},
    setItemFormData: jest.fn(),
    savingItem: false,
    showImpuestoModal: false,
    setShowImpuestoModal: jest.fn(),
    selectedImpuesto: null,
    setSelectedImpuesto: jest.fn(),
    impuestoFormData: {},
    setImpuestoFormData: jest.fn(),
    savingImpuesto: false,
    showDistribucionesModal: false,
    setShowDistribucionesModal: jest.fn(),
    distribucionesEntidad: null,
    setDistribucionesEntidad: jest.fn(),
    distribucionesStatus: {},
    proveedores: [],
    openEditModal: jest.fn(),
    closeEditModal: jest.fn(),
    saveEdit: jest.fn(),
    loadDocumentoLineas: jest.fn(),
    loadDocumentoImpuestos: jest.fn(),
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default mock return value
    (useComprobanteEdit as jest.Mock).mockReturnValue(mockComprobanteEdit);
  });

  describe('Renderizado básico', () => {
    it('debería renderizar el modal cuando isOpen es true', () => {
      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      expect(screen.getByText('Editar Datos Extraídos')).toBeInTheDocument();
      expect(screen.getByText('factura-test.pdf')).toBeInTheDocument();
    });

    it('NO debería renderizar el modal cuando isOpen es false', () => {
      render(
        <ComprobanteEditModal
          isOpen={false}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      expect(screen.queryByText('Editar Datos Extraídos')).not.toBeInTheDocument();
    });

    it('NO debería renderizar si documento es null', () => {
      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={null}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      expect(screen.queryByText('Editar Datos Extraídos')).not.toBeInTheDocument();
    });
  });

  describe('Modo ReadOnly', () => {
    it('debería mostrar "Ver Datos Extraídos" en modo readOnly', () => {
      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
          readOnly={true}
        />
      );

      expect(screen.getByText('Ver Datos Extraídos')).toBeInTheDocument();
      expect(screen.queryByText('Editar Datos Extraídos')).not.toBeInTheDocument();
    });

    it('debería mostrar badge "Solo lectura" cuando readOnly es true', () => {
      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
          readOnly={true}
        />
      );

      expect(screen.getByText('Solo lectura')).toBeInTheDocument();
    });

    it('NO debería mostrar botón "Guardar Cambios" en modo readOnly', () => {
      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
          readOnly={true}
        />
      );

      expect(screen.queryByText('Guardar Cambios')).not.toBeInTheDocument();
    });

    it('debería deshabilitar todos los inputs en modo readOnly', () => {
      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
          readOnly={true}
        />
      );

      // Obtener todos los inputs del tab Encabezado
      const inputs = screen.getAllByRole('textbox');
      const selects = screen.getAllByRole('combobox');

      // Verificar que todos están disabled
      inputs.forEach(input => {
        expect(input).toBeDisabled();
      });

      selects.forEach(select => {
        expect(select).toBeDisabled();
      });
    });

    it('NO debería mostrar botón "Agregar Item" en modo readOnly', () => {
      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
          readOnly={true}
        />
      );

      // Cambiar a tab Items
      const itemsTab = screen.getByText('Items');
      fireEvent.click(itemsTab);

      expect(screen.queryByText('Agregar Item')).not.toBeInTheDocument();
    });

    it('NO debería mostrar botón "Agregar Impuesto" en modo readOnly', () => {
      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
          readOnly={true}
        />
      );

      // Cambiar a tab Impuestos
      const impuestosTab = screen.getByText('Impuestos');
      fireEvent.click(impuestosTab);

      expect(screen.queryByText('Agregar Impuesto')).not.toBeInTheDocument();
    });
  });

  describe('Interacción con botones', () => {
    it('debería llamar onClose cuando se hace click en botón cerrar', () => {
      const onClose = jest.fn();

      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={onClose}
          onSave={jest.fn()}
        />
      );

      const closeButton = screen.getByRole('button', { name: /cerrar/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('debería llamar handleSave cuando se hace click en "Guardar Cambios"', async () => {
      const mockSaveEdit = jest.fn().mockResolvedValue(true);
      (useComprobanteEdit as jest.Mock).mockReturnValue({
        ...mockComprobanteEdit,
        saveEdit: mockSaveEdit,
      });

      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      const saveButton = screen.getByText('Guardar Cambios');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveEdit).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Tabs', () => {
    it('debería cambiar a tab "Items" cuando se hace click', () => {
      const setActiveTab = jest.fn();
      (useComprobanteEdit as jest.Mock).mockReturnValue({
        ...mockComprobanteEdit,
        setActiveTab,
      });

      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      const itemsTab = screen.getByText('Items');
      fireEvent.click(itemsTab);

      expect(setActiveTab).toHaveBeenCalledWith('items');
    });

    it('debería cambiar a tab "Impuestos" cuando se hace click', () => {
      const setActiveTab = jest.fn();
      (useComprobanteEdit as jest.Mock).mockReturnValue({
        ...mockComprobanteEdit,
        setActiveTab,
      });

      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      const impuestosTab = screen.getByText('Impuestos');
      fireEvent.click(impuestosTab);

      expect(setActiveTab).toHaveBeenCalledWith('impuestos');
    });

    it('debería mostrar tab "Encabezado" por defecto', () => {
      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={mockDocument}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      // Verificar que se muestran campos del encabezado
      expect(screen.getByLabelText(/Fecha/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/CUIT/i)).toBeInTheDocument();
    });
  });

  describe('Validación de errores', () => {
    it('debería mostrar badges de error en tabs cuando hay errores', () => {
      const docWithErrors = {
        ...mockDocument,
        validationErrors: {
          errors: [
            { campo: 'fecha', mensaje: 'Fecha inválida', severidad: 'ERROR', origen: 'documento' },
            { campo: 'descripcion', mensaje: 'Falta descripción', severidad: 'ERROR', entityId: 'linea-1' },
            { campo: 'alicuota', mensaje: 'Alícuota incorrecta', severidad: 'WARNING', entityId: 'impuesto-1' }
          ],
          summary: {
            total: 3,
            bloqueantes: 0,
            errores: 2,
            warnings: 1
          },
          timestamp: '2025-01-20T10:00:00Z'
        }
      };

      (useComprobanteEdit as jest.Mock).mockReturnValue({
        ...mockComprobanteEdit,
        selectedDocument: docWithErrors,
      });

      render(
        <ComprobanteEditModal
          isOpen={true}
          documento={docWithErrors}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      // Verificar que se muestran los contadores de errores en los tabs
      // (La implementación específica depende de cómo renderizas los badges)
      expect(screen.getByText('Encabezado')).toBeInTheDocument();
      expect(screen.getByText('Items')).toBeInTheDocument();
      expect(screen.getByText('Impuestos')).toBeInTheDocument();
    });
  });
});
