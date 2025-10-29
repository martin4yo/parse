import { createContext, useContext, useState, ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

interface ConfirmProviderProps {
  children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    resolve: (value: boolean) => void;
    options: ConfirmOptions;
  } | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        resolve,
        options
      });
    });
  };

  const handleConfirm = () => {
    if (dialogState) {
      dialogState.resolve(true);
      setDialogState(null);
    }
  };

  const handleCancel = () => {
    if (dialogState) {
      dialogState.resolve(false);
      setDialogState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialogState && (
        <ConfirmDialog
          isOpen={dialogState.isOpen}
          onConfirm={handleConfirm}
          onClose={handleCancel}
          title={dialogState.options.title}
          message={dialogState.options.message}
          confirmText={dialogState.options.confirmText}
          cancelText={dialogState.options.cancelText}
          type={dialogState.options.type}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

// Hook de conveniencia para reemplazar window.confirm
export function useConfirmDialog() {
  const { confirm } = useConfirm();
  
  const confirmDialog = async (
    message: string,
    title: string = 'Confirmar acción',
    type: 'warning' | 'danger' | 'info' = 'warning'
  ): Promise<boolean> => {
    return confirm({
      title,
      message,
      type,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar'
    });
  };

  const confirmDelete = async (
    itemName?: string
  ): Promise<boolean> => {
    const message = itemName 
      ? `¿Estás seguro de que quieres eliminar "${itemName}"?`
      : '¿Estás seguro de que quieres eliminar este elemento?';
    
    return confirm({
      title: 'Confirmar eliminación',
      message: `${message} Esta acción no se puede deshacer.`,
      type: 'danger',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar'
    });
  };

  return {
    confirm: confirmDialog,
    confirmDelete
  };
}