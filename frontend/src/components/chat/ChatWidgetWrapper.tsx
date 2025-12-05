'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ChatWidget } from './ChatWidget';

/**
 * Wrapper del ChatWidget que verifica autenticación y tenant
 * Solo renderiza el widget si el usuario está autenticado y tiene un tenant seleccionado
 */
export function ChatWidgetWrapper() {
  const { isAuthenticated, token, tenant, isLoading } = useAuth();

  // No mostrar mientras carga
  if (isLoading) {
    return null;
  }

  // Solo mostrar si está autenticado y tiene tenant
  if (!isAuthenticated || !token || !tenant) {
    return null;
  }

  return <ChatWidget />;
}

export default ChatWidgetWrapper;
