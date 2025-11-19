'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { SidebarProvider } from '@/contexts/SidebarContext';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading during hydration to avoid mismatch
  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen"
        style={{
          background: `linear-gradient(135deg, #FCE5B7 0%, #FCE5B7 25%, #F1ABB5 50%, #8E6AAA 75%, #352151 100%)`,
        }}
      >
        <div className="flex flex-col items-center justify-center gap-8">
          <div className="relative w-96 h-96 animate-pulse">
            <img
              src="/axioma_logo_invertido.png"
              alt="Axioma Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="w-96">
            <div className="h-2 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-gradient-to-r from-palette-purple to-palette-pink transition-all duration-300 ease-out animate-pulse"
                style={{ width: '60%' }}
              />
            </div>
            <p className="text-white text-center mt-4 text-lg font-medium">
              Cargando...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen"
        style={{
          background: `linear-gradient(135deg, #FCE5B7 0%, #FCE5B7 25%, #F1ABB5 50%, #8E6AAA 75%, #352151 100%)`,
        }}
      >
        <div className="flex flex-col items-center justify-center gap-8">
          <div className="relative w-96 h-96 animate-pulse">
            <img
              src="/axioma_logo_invertido.png"
              alt="Axioma Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="w-96">
            <div className="h-2 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-gradient-to-r from-palette-purple to-palette-pink transition-all duration-300 ease-out animate-pulse"
                style={{ width: '60%' }}
              />
            </div>
            <p className="text-white text-center mt-4 text-lg font-medium">
              Cargando...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <ConfirmProvider>
        {/* @ts-ignore */}
        <Toaster position="top-right" />
        <Sidebar>{children}</Sidebar>
      </ConfirmProvider>
    </SidebarProvider>
  );
}