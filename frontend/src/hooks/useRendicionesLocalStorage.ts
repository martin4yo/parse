import { useState, useEffect, useCallback, useRef } from 'react';
import { RendicionItem } from '@/types/rendiciones';

interface ChangeTracking {
  timestamp: string;
  changes: {
    modified: Array<{
      id: string;
      originalData: Partial<RendicionItem>;
      currentData: Partial<RendicionItem>;
    }>;
    new: Array<{
      tempId: string;
      data: Partial<RendicionItem>;
    }>;
    deleted: string[];
  };
}

interface UseRendicionesLocalStorageProps {
  numeroTarjeta: string;
  periodo: string;
  userId?: string;
  autoSaveDelay?: number;
}

export function useRendicionesLocalStorage({
  numeroTarjeta,
  periodo,
  userId,
  autoSaveDelay = 500
}: UseRendicionesLocalStorageProps) {
  const [changes, setChanges] = useState<ChangeTracking>({
    timestamp: new Date().toISOString(),
    changes: {
      modified: [],
      new: [],
      deleted: []
    }
  });
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Generar clave única para localStorage
  const getStorageKey = useCallback(() => {
    const userPart = userId || 'anonymous';
    return `rendiciones_draft_${numeroTarjeta}_${periodo}_${userPart}`;
  }, [numeroTarjeta, periodo, userId]);
  
  // Cargar cambios desde localStorage al montar
  useEffect(() => {
    const loadDraft = () => {
      try {
        setIsRecovering(true);
        const key = getStorageKey();
        const savedData = localStorage.getItem(key);
        
        if (savedData) {
          const parsed = JSON.parse(savedData) as ChangeTracking;
          
          // Verificar si los cambios son recientes (menos de 24 horas)
          const savedTime = new Date(parsed.timestamp);
          const now = new Date();
          const hoursDiff = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);
          
          if (hoursDiff < 24) {
            console.log('Recovering unsaved changes from localStorage', parsed);
            setChanges(parsed);
            setHasUnsavedChanges(
              parsed.changes.modified.length > 0 ||
              parsed.changes.new.length > 0 ||
              parsed.changes.deleted.length > 0
            );
            return true;
          } else {
            // Limpiar cambios antiguos
            localStorage.removeItem(key);
          }
        }
        return false;
      } catch (error) {
        console.error('Error loading draft from localStorage:', error);
        return false;
      } finally {
        setIsRecovering(false);
      }
    };
    
    loadDraft();
  }, [getStorageKey]);
  
  // Guardar en localStorage con debounce
  const saveToLocalStorage = useCallback(() => {
    // Limpiar timeout anterior si existe
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Configurar nuevo timeout
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const key = getStorageKey();
        
        // Si no hay cambios, eliminar del localStorage
        if (
          changes.changes.modified.length === 0 &&
          changes.changes.new.length === 0 &&
          changes.changes.deleted.length === 0
        ) {
          localStorage.removeItem(key);
          setHasUnsavedChanges(false);
        } else {
          // Actualizar timestamp y guardar
          const dataToSave: ChangeTracking = {
            ...changes,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(key, JSON.stringify(dataToSave));
          setHasUnsavedChanges(true);
        }
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
    }, autoSaveDelay);
  }, [changes, getStorageKey, autoSaveDelay]);
  
  // Auto-guardar cuando cambian los datos
  useEffect(() => {
    saveToLocalStorage();
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [saveToLocalStorage]);
  
  // Registrar modificación de un item existente
  const trackModification = useCallback((
    itemId: string,
    field: string,
    newValue: any,
    originalItem?: RendicionItem
  ) => {
    setChanges(prev => {
      const existingModIndex = prev.changes.modified.findIndex(m => m.id === itemId);
      
      if (existingModIndex >= 0) {
        // Ya existe una modificación para este item, actualizar
        const modified = [...prev.changes.modified];
        modified[existingModIndex] = {
          ...modified[existingModIndex],
          currentData: {
            ...modified[existingModIndex].currentData,
            [field]: newValue
          }
        };
        
        return {
          ...prev,
          changes: {
            ...prev.changes,
            modified
          }
        };
      } else if (originalItem) {
        // Nueva modificación
        return {
          ...prev,
          changes: {
            ...prev.changes,
            modified: [
              ...prev.changes.modified,
              {
                id: itemId,
                originalData: originalItem,
                currentData: {
                  ...originalItem,
                  [field]: newValue
                }
              }
            ]
          }
        };
      }
      
      return prev;
    });
  }, []);
  
  // Registrar nuevo item
  const trackNewItem = useCallback((tempId: string, data: Partial<RendicionItem>) => {
    setChanges(prev => ({
      ...prev,
      changes: {
        ...prev.changes,
        new: [
          ...prev.changes.new,
          { tempId, data }
        ]
      }
    }));
  }, []);
  
  // Registrar eliminación
  const trackDeletion = useCallback((itemId: string) => {
    setChanges(prev => {
      // Verificar si es un item nuevo (no guardado aún)
      const newItemIndex = prev.changes.new.findIndex(n => n.tempId === itemId);
      
      if (newItemIndex >= 0) {
        // Es un item nuevo, solo quitarlo de la lista de nuevos
        const newItems = [...prev.changes.new];
        newItems.splice(newItemIndex, 1);
        
        return {
          ...prev,
          changes: {
            ...prev.changes,
            new: newItems
          }
        };
      } else {
        // Es un item existente, agregarlo a eliminados
        // También quitar de modificados si estaba ahí
        const modified = prev.changes.modified.filter(m => m.id !== itemId);
        
        return {
          ...prev,
          changes: {
            ...prev.changes,
            modified,
            deleted: prev.changes.deleted.includes(itemId)
              ? prev.changes.deleted
              : [...prev.changes.deleted, itemId]
          }
        };
      }
    });
  }, []);
  
  // Limpiar todos los cambios (después de guardar exitosamente)
  const clearChanges = useCallback(() => {
    console.log('CLEARING CHANGES - Before:', changes);
    
    const emptyChanges = {
      timestamp: new Date().toISOString(),
      changes: {
        modified: [],
        new: [],
        deleted: []
      }
    };
    
    setChanges(emptyChanges);
    
    // Limpiar localStorage
    const key = getStorageKey();
    localStorage.removeItem(key);
    setHasUnsavedChanges(false);
    
    console.log('CLEARING CHANGES - After:', emptyChanges);
  }, [getStorageKey, changes]);
  
  // Obtener el conteo total de cambios
  const getChangesCount = useCallback(() => {
    return (
      changes.changes.modified.length +
      changes.changes.new.length +
      changes.changes.deleted.length
    );
  }, [changes]);
  
  // Verificar si un item tiene cambios
  const hasItemChanges = useCallback((itemId: string) => {
    return (
      changes.changes.modified.some(m => m.id === itemId) ||
      changes.changes.new.some(n => n.tempId === itemId) ||
      changes.changes.deleted.includes(itemId)
    );
  }, [changes]);
  
  // Obtener el tipo de cambio de un item
  const getItemChangeType = useCallback((itemId: string): 'modified' | 'new' | 'deleted' | null => {
    if (changes.changes.deleted.includes(itemId)) return 'deleted';
    if (changes.changes.modified.some(m => m.id === itemId)) return 'modified';
    if (changes.changes.new.some(n => n.tempId === itemId)) return 'new';
    return null;
  }, [changes]);
  
  // Revertir cambios de un item específico
  const revertItemChanges = useCallback((itemId: string) => {
    setChanges(prev => ({
      ...prev,
      changes: {
        modified: prev.changes.modified.filter(m => m.id !== itemId),
        new: prev.changes.new.filter(n => n.tempId !== itemId),
        deleted: prev.changes.deleted.filter(id => id !== itemId)
      }
    }));
  }, []);
  
  return {
    changes,
    hasUnsavedChanges,
    isRecovering,
    trackModification,
    trackNewItem,
    trackDeletion,
    clearChanges,
    getChangesCount,
    hasItemChanges,
    getItemChangeType,
    revertItemChanges,
    saveToLocalStorage
  };
}