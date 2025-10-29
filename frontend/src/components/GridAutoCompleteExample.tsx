import React from 'react';
import { useGridAutoComplete } from '@/hooks/useGridAutoComplete';

interface GridAutoCompleteExampleProps {
  rowId: string;
  field: string;
  codigo: string;
  nombre: string;
  currentRowData: Record<string, any>;
  onFieldChange: (field: string, value: any) => void;
  onMultipleFieldsChange?: (fields: Record<string, any>) => void;
}

/**
 * Ejemplo de integración del sistema de auto-complete en grillas
 * 
 * Este componente muestra cómo integrar el hook useGridAutoComplete
 * con el sistema SmartSelector existente para auto-completar campos
 * relacionados basados en reglas de negocio.
 */
export const GridAutoCompleteExample: React.FC<GridAutoCompleteExampleProps> = ({
  rowId,
  field,
  codigo,
  nombre,
  currentRowData,
  onFieldChange,
  onMultipleFieldsChange
}) => {
  
  const { executeAutoComplete, isLoading } = useGridAutoComplete({
    onFieldChange,
    onMultipleFieldsChange,
    enableLogging: true // Habilitar logging para debug
  });

  React.useEffect(() => {
    // Ejecutar auto-complete cuando se selecciona un valor del SmartSelector
    if (codigo) {
      executeAutoComplete(field, codigo, {
        ...currentRowData,
        [field]: codigo, // Incluir el campo recién cambiado
        rowId // Incluir ID de fila para contexto adicional
      });
    }
  }, [codigo, field, currentRowData, executeAutoComplete, rowId]);

  return (
    <div className="auto-complete-indicator">
      {isLoading && (
        <div className="text-xs text-blue-500 animate-pulse">
          Auto-completando...
        </div>
      )}
    </div>
  );
};

/**
 * Hook personalizado para integrar auto-complete en el handleSelectorSelect existente
 */
export const useGridAutoCompleteIntegration = () => {
  const { executeAutoComplete } = useGridAutoComplete({
    enableLogging: true
  });

  const handleSelectorSelectWithAutoComplete = React.useCallback(
    async (
      originalHandleSelectorSelect: (codigo: string, nombre: string) => void,
      selectorField: { rowId: string; field: string } | null,
      currentRowData: Record<string, any>,
      onFieldUpdate: (field: string, value: any) => void
    ) => {
      return async (codigo: string, nombre: string) => {
        // Ejecutar la lógica original del selector
        originalHandleSelectorSelect(codigo, nombre);
        
        // Ejecutar auto-complete si hay un campo seleccionado
        if (selectorField) {
          try {
            const response = await executeAutoComplete(
              selectorField.field,
              codigo,
              {
                ...currentRowData,
                [selectorField.field]: codigo,
                rowId: selectorField.rowId
              }
            );
            
            // Si encontró valores, aplicarlos
            if (response?.found && response.values) {
              Object.entries(response.values).forEach(([field, value]) => {
                onFieldUpdate(field, value);
              });
            }
          } catch (error) {
            console.error('Error en auto-complete:', error);
          }
        }
      };
    },
    [executeAutoComplete]
  );

  return { handleSelectorSelectWithAutoComplete };
};

export default GridAutoCompleteExample;