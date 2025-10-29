import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook personalizado para refrescar datos cuando cambia el tenant
 *
 * @param refreshCallback - Función que se ejecutará cuando cambie el tenant
 * @param dependencies - Dependencias adicionales para el useEffect (opcional)
 */
export function useTenantRefresh(
  refreshCallback: () => void | Promise<void>,
  dependencies: any[] = []
) {
  const { tenant } = useAuth();

  const memoizedRefresh = useCallback(refreshCallback, [refreshCallback, ...dependencies]);

  useEffect(() => {
    // Solo ejecutar si hay un tenant (para evitar llamadas innecesarias)
    console.log('🎯 [useTenantRefresh] Tenant changed:', tenant?.id, tenant?.nombre);
    if (tenant?.id) {
      console.log('🔄 [useTenantRefresh] Executing refresh callback...');
      memoizedRefresh();
    }
  }, [tenant?.id, memoizedRefresh]);

  // Retornar la función de refresh para uso manual si es necesario
  return memoizedRefresh;
}

/**
 * Hook simplificado para casos donde solo necesitas recargar datos al cambiar tenant
 *
 * @param loadDataFn - Función para cargar los datos
 */
export function useLoadOnTenantChange(loadDataFn: () => void | Promise<void>) {
  return useTenantRefresh(loadDataFn);
}