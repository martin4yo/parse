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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-palette-dark"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-palette-dark"></div>
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