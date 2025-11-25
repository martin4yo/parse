/**
 * useApiMutation - Hook para estandarizar mutaciones API (POST/PUT/DELETE)
 *
 * Características:
 * - Loading states automáticos
 * - Error handling estandarizado
 * - Toast notifications
 * - Callbacks onSuccess/onError
 * - TypeScript genérico
 *
 * Uso:
 * ```typescript
 * const createMutation = useApiMutation({
 *   onSuccess: (data) => {
 *     console.log('Éxito', data);
 *   },
 *   successMessage: 'Creado exitosamente'
 * });
 *
 * createMutation.mutate(() => api.post('/endpoint', data));
 * ```
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { useConfirmDialog } from './useConfirm';

interface UseApiMutationOptions<TData = any> {
  onSuccess?: (data: TData) => void;
  onError?: (error: any) => void;
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

interface UseApiMutationReturn<TData = any> {
  mutate: (apiFn: () => Promise<any>) => Promise<void>;
  isLoading: boolean;
  error: any;
  data: TData | null;
  reset: () => void;
}

export function useApiMutation<TData = any>(
  options: UseApiMutationOptions<TData> = {}
): UseApiMutationReturn<TData> {
  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    showSuccessToast = true,
    showErrorToast = true,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [data, setData] = useState<TData | null>(null);

  const mutate = async (apiFn: () => Promise<any>) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFn();
      const responseData = response.data?.data || response.data;

      setData(responseData);

      // Show success toast
      if (showSuccessToast) {
        toast.success(successMessage || 'Operación exitosa');
      }

      // Call onSuccess callback
      if (onSuccess) {
        onSuccess(responseData);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error en la operación';

      setError(err);

      // Show error toast
      if (showErrorToast) {
        toast.error(errorMessage || errorMsg);
      }

      // Call onError callback
      if (onError) {
        onError(err);
      }

      // Re-throw for optional additional handling
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setIsLoading(false);
    setError(null);
    setData(null);
  };

  return {
    mutate,
    isLoading,
    error,
    data,
    reset,
  };
}

/**
 * Hook especializado para operaciones DELETE
 *
 * Uso:
 * ```typescript
 * const deleteMutation = useDeleteMutation({
 *   onSuccess: () => {
 *     setItems(items.filter(i => i.id !== itemId));
 *   },
 *   confirmMessage: '¿Estás seguro de eliminar este elemento?'
 * });
 *
 * deleteMutation.mutate(() => api.delete(`/endpoint/${id}`));
 * ```
 */
interface UseDeleteMutationOptions<TData = any> extends UseApiMutationOptions<TData> {
  confirmMessage?: string;
  skipConfirm?: boolean;
}

export function useDeleteMutation<TData = any>(
  options: UseDeleteMutationOptions<TData> = {}
): UseApiMutationReturn<TData> {
  const {
    confirmMessage = '¿Estás seguro de eliminar este elemento?',
    skipConfirm = false,
    ...mutationOptions
  } = options;

  const { confirm } = useConfirmDialog();

  const mutation = useApiMutation<TData>({
    successMessage: 'Eliminado exitosamente',
    ...mutationOptions,
  });

  const mutateWithConfirm = async (apiFn: () => Promise<any>) => {
    // Show confirmation dialog with custom modal (danger style)
    if (!skipConfirm) {
      const confirmed = await confirm(
        'Esta acción no se puede deshacer.',
        confirmMessage,
        'danger'  // Use danger type for red buttons
      );
      if (!confirmed) {
        return;
      }
    }

    return mutation.mutate(apiFn);
  };

  return {
    ...mutation,
    mutate: mutateWithConfirm,
  };
}

/**
 * Hook especializado para operaciones UPDATE
 *
 * Uso:
 * ```typescript
 * const updateMutation = useUpdateMutation({
 *   onSuccess: (data) => {
 *     setItems(items.map(i => i.id === data.id ? data : i));
 *   }
 * });
 *
 * updateMutation.mutate(() => api.put(`/endpoint/${id}`, data));
 * ```
 */
export function useUpdateMutation<TData = any>(
  options: UseApiMutationOptions<TData> = {}
): UseApiMutationReturn<TData> {
  return useApiMutation<TData>({
    successMessage: 'Actualizado exitosamente',
    ...options,
  });
}

/**
 * Hook especializado para operaciones CREATE
 *
 * Uso:
 * ```typescript
 * const createMutation = useCreateMutation({
 *   onSuccess: (data) => {
 *     setItems([data, ...items]);
 *   }
 * });
 *
 * createMutation.mutate(() => api.post('/endpoint', data));
 * ```
 */
export function useCreateMutation<TData = any>(
  options: UseApiMutationOptions<TData> = {}
): UseApiMutationReturn<TData> {
  return useApiMutation<TData>({
    successMessage: 'Creado exitosamente',
    ...options,
  });
}
