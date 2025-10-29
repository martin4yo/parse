'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApiClient } from '@/hooks/useApiClient';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface TenantOption {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  cuit: string;
  _count: {
    users: number;
  };
}

export function TenantSelector() {
  const { user, tenant, switchTenant, isSuperuser } = useAuth();
  const { get } = useApiClient();
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Solo mostrar para superusers
  if (!isSuperuser) {
    return null;
  }

  useEffect(() => {
    // Ejecutar cuando el usuario esté cargado y sea superuser
    if (isSuperuser && user && !hasInitialized) {
      console.log('🏢 [TenantSelector] Usuario superuser detectado, inicializando...', user.email);
      fetchAvailableTenants();
    }
  }, [isSuperuser, user, hasInitialized]); // Depender de estas propiedades

  const fetchAvailableTenants = async () => {
    if (hasInitialized) {
      console.log('🏢 [TenantSelector] Ya inicializado, omitiendo...');
      return;
    }

    console.log('🏢 [TenantSelector] Iniciando carga de tenants...');
    setHasInitialized(true); // Marcar inmediatamente para evitar múltiples llamadas

    try {
      console.log('🏢 [TenantSelector] Cargando tenants disponibles...');
      const response = await get('/api/auth/available-tenants');
      console.log('🏢 [TenantSelector] Respuesta:', response);

      if (response.success) {
        setAvailableTenants(response.tenants);
        console.log('🏢 [TenantSelector] Tenants cargados:', response.tenants.length);

        // Solo si el usuario NO tiene tenant, autoseleccionar el primero
        if (!tenant && response.tenants.length > 0) {
          console.log('🏢 [TenantSelector] Auto-seleccionando primer tenant:', response.tenants[0].nombre);
          await handleTenantChange(response.tenants[0].id);
        }
        // Si el usuario ya tiene un tenant, solo verificar que sea válido
        else if (tenant && response.tenants.length > 0) {
          const currentTenantExists = response.tenants.some((t: TenantOption) => t.id === tenant.id);
          if (!currentTenantExists) {
            console.log('🏢 [TenantSelector] Tenant actual no existe, seleccionando primero:', response.tenants[0].nombre);
            await handleTenantChange(response.tenants[0].id);
          } else {
            console.log('🏢 [TenantSelector] Tenant actual válido:', tenant.nombre);
            // NO forzar cambio si ya está correcto - esto causaba el loop
          }
        } else {
          console.log('🏢 [TenantSelector] No hay tenants disponibles');
        }
      }
    } catch (error) {
      console.error('Error cargando tenants:', error);
    }
  };

  const handleTenantChange = async (tenantId: string, force = false) => {
    // Solo omitir si el tenant es el mismo Y no se está forzando la actualización
    if (!force && tenantId === tenant?.id) return;

    console.log('🔄 [TenantSelector] Cambiando tenant:', tenantId, force ? '(forzado)' : '');
    setLoading(true);
    try {
      await switchTenant(tenantId);
      console.log('✅ [TenantSelector] Tenant cambiado exitosamente');
      // No recargar la página - dejar que React maneje el cambio reactivamente
      // window.location.reload();
    } catch (error) {
      console.error('❌ [TenantSelector] Error cambiando tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'Common': return 'bg-gray-800 text-white';
      case 'Uncommon': return 'bg-gray-400 text-white';
      case 'Rare': return 'bg-yellow-500 text-black';
      case 'Mythic': return 'bg-orange-500 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex items-center space-x-2 p-3 bg-blue-50 border-b border-blue-200">
      <Building2 className="h-4 w-4 text-blue-600" />
      <span className="text-sm font-medium text-blue-900">Trabajando como:</span>

      <select
        value={tenant?.id || ''}
        onChange={(e) => handleTenantChange(e.target.value)}
        disabled={loading}
        className="w-[250px] h-8 bg-white border border-blue-200 rounded px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {availableTenants.map((tenantOption) => (
          <option key={tenantOption.id} value={tenantOption.id}>
            {tenantOption.nombre} ({tenantOption.plan}) - {tenantOption._count.users} usuarios
          </option>
        ))}
      </select>

      {tenant && (
        <div className="flex items-center space-x-2">
          <Badge className={getPlanColor(tenant.plan)} variant="secondary">
            {tenant.plan}
          </Badge>
        </div>
      )}

      {!tenant && (
        <Badge variant="secondary" className="text-xs text-red-600 bg-red-100">
          Sin organización
        </Badge>
      )}
    </div>
  );
}