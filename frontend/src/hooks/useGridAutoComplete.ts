import { useState, useCallback } from 'react';
import { rendicionesApi, AutoCompleteRequest, AutoCompleteResponse } from '@/lib/api';
import { toast } from 'react-hot-toast';

export interface UseGridAutoCompleteOptions {
  onFieldChange?: (campo: string, value: any) => void;
  onMultipleFieldsChange?: (fields: Record<string, any>) => void;
  enableLogging?: boolean;
}

export interface GridAutoCompleteState {
  isLoading: boolean;
  lastTrigger: string | null;
  error: string | null;
}

export const useGridAutoComplete = (options: UseGridAutoCompleteOptions = {}) => {
  const { onFieldChange, onMultipleFieldsChange, enableLogging = false } = options;
  
  const [state, setState] = useState<GridAutoCompleteState>({
    isLoading: false,
    lastTrigger: null,
    error: null
  });

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[GridAutoComplete] ${message}`, data || '');
    }
  }, [enableLogging]);

  const executeAutoComplete = useCallback(async (
    campo: string,
    valor: any,
    itemData: Record<string, any>
  ): Promise<AutoCompleteResponse | null> => {
    // Validaciones básicas
    if (!campo || valor === null || valor === undefined || valor === '') {
      log(`Skipping auto-complete for ${campo}: empty value`);
      return null;
    }

    // Evitar loops infinitos si el valor no cambió
    const triggerKey = `${campo}:${valor}`;
    if (state.lastTrigger === triggerKey) {
      log(`Skipping auto-complete for ${campo}: same trigger as last time`);
      return null;
    }

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      lastTrigger: triggerKey, 
      error: null 
    }));

    try {
      log(`Executing auto-complete for field: ${campo} with value: ${valor}`);

      const request: AutoCompleteRequest = {
        campo,
        valor,
        itemData
      };

      const response = await rendicionesApi.autoComplete(request);
      
      if (response.found && response.values) {
        log(`Auto-complete successful for ${campo}`, response.values);
        
        // Aplicar cambios usando las callbacks proporcionadas
        const fieldsToUpdate = Object.keys(response.values);
        
        if (fieldsToUpdate.length === 1 && onFieldChange) {
          // Un solo campo: usar callback individual
          const fieldName = fieldsToUpdate[0];
          const fieldValue = response.values[fieldName];
          onFieldChange(fieldName, fieldValue);
        } else if (fieldsToUpdate.length > 1 && onMultipleFieldsChange) {
          // Múltiples campos: usar callback de múltiples campos
          onMultipleFieldsChange(response.values);
        } else if (fieldsToUpdate.length > 0 && onFieldChange) {
          // Fallback: aplicar uno por uno usando callback individual
          fieldsToUpdate.forEach(fieldName => {
            onFieldChange(fieldName, response.values[fieldName]);
          });
        }

        if (response.message && enableLogging) {
          toast.success(`Auto-complete: ${response.message}`);
        }
      } else {
        log(`No auto-complete rules found for ${campo} with value ${valor}`);
      }

      setState(prev => ({ ...prev, isLoading: false, error: null }));
      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido en auto-complete';
      
      log(`Auto-complete error for ${campo}:`, errorMessage);
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));

      if (enableLogging) {
        toast.error(`Error en auto-complete: ${errorMessage}`);
      }

      return null;
    }
  }, [state.lastTrigger, onFieldChange, onMultipleFieldsChange, enableLogging, log]);

  const clearState = useCallback(() => {
    setState({
      isLoading: false,
      lastTrigger: null,
      error: null
    });
  }, []);

  return {
    state,
    executeAutoComplete,
    clearState,
    isLoading: state.isLoading,
    error: state.error
  };
};

export default useGridAutoComplete;