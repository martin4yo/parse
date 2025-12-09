'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApiClient } from '@/hooks/useApiClient';
import { useRouter } from 'next/navigation';
import { Building2, Lock, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/hooks/useConfirm';

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
  const { user, tenant, switchTenant, isSuperuser, logout, token } = useAuth();
  const { get } = useApiClient();
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100';

  useEffect(() => {
    if (user && !hasInitialized) {
      console.log('[TenantSelector] Usuario detectado, inicializando...', user.email);
      fetchAvailableTenants();
    }
  }, [user, hasInitialized]);

  const fetchAvailableTenants = async () => {
    if (hasInitialized) {
      console.log('[TenantSelector] Ya inicializado, omitiendo...');
      return;
    }

    console.log('[TenantSelector] Iniciando carga de tenants...');
    setHasInitialized(true);

    try {
      console.log('[TenantSelector] Cargando tenants disponibles...');
      const endpoint = isSuperuser ? '/api/auth/available-tenants' : '/api/auth/my-tenants';
      const response = await get(endpoint);
      console.log('[TenantSelector] Respuesta:', response);

      if (response.success && response.tenants) {
        setAvailableTenants(response.tenants);
        console.log('[TenantSelector] Tenants cargados:', response.tenants.length);

        if (!tenant && response.tenants.length > 0) {
          console.log('[TenantSelector] Auto-seleccionando primer tenant:', response.tenants[0].nombre);
          await handleTenantChange(response.tenants[0].id);
        } else if (tenant && response.tenants.length > 0) {
          const currentTenantExists = response.tenants.some((t: TenantOption) => t.id === tenant.id);
          if (!currentTenantExists) {
            console.log('[TenantSelector] Tenant actual no existe, seleccionando primero:', response.tenants[0].nombre);
            await handleTenantChange(response.tenants[0].id);
          } else {
            console.log('[TenantSelector] Tenant actual valido:', tenant.nombre);
          }
        } else {
          console.log('[TenantSelector] No hay tenants disponibles');
        }
      }
    } catch (error) {
      console.error('Error cargando tenants:', error);
    }
  };

  const handleTenantChange = async (tenantId: string, force = false) => {
    if (!force && tenantId === tenant?.id) return;

    console.log('[TenantSelector] Cambiando tenant:', tenantId, force ? '(forzado)' : '');
    setLoading(true);
    try {
      await switchTenant(tenantId);
      console.log('[TenantSelector] Tenant cambiado exitosamente');
      router.refresh();
    } catch (error) {
      console.error('[TenantSelector] Error cambiando tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirm(
      'Estas seguro de que quieres cerrar sesion?',
      'Confirmar cierre de sesion',
      'warning'
    );

    if (confirmed) {
      logout();
      window.location.href = '/auth/login';
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('La nueva contrasena debe tener al menos 6 caracteres');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch(`${API_URL}/api/users/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cambiar la contrasena');
      }

      toast.success('Contrasena actualizada correctamente');
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Error al cambiar la contrasena');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-palette-purple to-palette-purple/90 border-b border-palette-purple/20 shadow-sm">
        <div className="flex items-center space-x-3">
          {availableTenants.length > 0 && (
            <>
              <Building2 className="h-5 w-5 text-white" />
              <span className="text-sm font-semibold text-white">Organizacion:</span>

              <select
                value={tenant?.id || ''}
                onChange={(e) => {
                  console.log('[TenantSelector] Select onChange triggered:', e.target.value);
                  handleTenantChange(e.target.value);
                }}
                disabled={loading}
                className="min-w-[280px] h-9 bg-white/95 border border-white/30 rounded-md px-3 text-sm font-medium text-palette-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {availableTenants.map((tenantOption) => (
                  <option key={tenantOption.id} value={tenantOption.id}>
                    {tenantOption.nombre} - {tenantOption.cuit}
                  </option>
                ))}
              </select>

              {loading && (
                <span className="text-xs text-white/80 bg-white/20 px-2 py-1 rounded animate-pulse">
                  Cargando...
                </span>
              )}
            </>
          )}

          {!tenant && availableTenants.length > 0 && (
            <span className="text-xs text-white bg-red-500 px-3 py-1 rounded-full font-medium">
              Sin organizacion seleccionada
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <div className="text-right mr-2">
            <div className="text-sm text-white font-medium">{user?.nombre} {user?.apellido}</div>
            <div className="text-xs text-white/60">{user?.email}</div>
          </div>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Cambiar Contrasena"
          >
            <Lock className="w-5 h-5" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Cerrar Sesion"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => {
              setShowPasswordModal(false);
              setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cambiar Contrasena</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contrasena Actual
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-purple focus:border-transparent"
                  placeholder="Ingresa tu contrasena actual"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva Contrasena
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-purple focus:border-transparent"
                  placeholder="Minimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Nueva Contrasena
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palette-purple focus:border-transparent"
                  placeholder="Repite la nueva contrasena"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-palette-dark rounded-lg hover:bg-palette-purple transition-colors disabled:opacity-50"
              >
                {changingPassword ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
