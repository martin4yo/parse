'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({
  children,
  requiredRoles = [],
  fallback
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, tenant } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Si no está autenticado, no mostrar nada (se redirigirá)
  if (!isAuthenticated) {
    return fallback || null;
  }

  // Verificar roles si se especificaron
  if (requiredRoles.length > 0) {
    // Los superusers tienen acceso a todo
    if (user?.superuser) {
      console.log('🔍 [ProtectedRoute] Superuser access granted');
    } else if (user?.profile) {
      const hasRequiredRole = requiredRoles.includes(user.profile.codigo);
      console.log('🔍 [ProtectedRoute] Role check:', {
        requiredRoles,
        userProfileCodigo: user.profile.codigo,
        hasRequiredRole
      });
      if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Acceso Denegado
            </h1>
            <p className="text-gray-600 mb-4">
              No tienes permisos para acceder a esta sección.
            </p>
            <p className="text-sm text-gray-500">
              Roles requeridos: {requiredRoles.join(', ')}
            </p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Volver
            </button>
          </div>
        </div>
        );
      }
    } else {
      // Usuario sin perfil definido y no es superuser
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Perfil No Definido
            </h1>
            <p className="text-gray-600 mb-4">
              Tu usuario no tiene un perfil asignado.
            </p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Volver
            </button>
          </div>
        </div>
      );
    }
  }

  // Verificar tenant activo (excepto para superusers)
  if (!user?.superuser && (!tenant || !tenant.nombre)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Tenant No Disponible
          </h1>
          <p className="text-gray-600 mb-4">
            Tu organización no está disponible o está inactiva.
          </p>
          <p className="text-sm text-gray-500">
            Contacta al administrador del sistema.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}