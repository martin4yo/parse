'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Loader2, ChevronDown, Lightbulb } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { chatService, type ChatMessage as ChatMessageType, type PendingAction } from '@/lib/chatService';
import { useAuth } from '@/contexts/AuthContext';

interface ChatWidgetProps {
  className?: string;
}

export function ChatWidget({ className }: ChatWidgetProps) {
  const { token, tenant, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasShownWelcome = useRef(false);

  // Auto-scroll al último mensaje
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Verificar disponibilidad del servicio
  useEffect(() => {
    const checkHealth = async () => {
      if (token) {
        chatService.setToken(token);
        const health = await chatService.checkHealth();
        setIsAvailable(health.available);
      }
    };
    checkHealth();
  }, [token]);

  // Cargar sugerencias
  useEffect(() => {
    const loadSuggestions = async () => {
      const sug = await chatService.getSuggestions();
      setSuggestions(sug);
    };
    loadSuggestions();
  }, []);

  // Mensaje de bienvenida al abrir por primera vez
  useEffect(() => {
    if (isOpen && !hasShownWelcome.current && messages.length === 0) {
      hasShownWelcome.current = true;
      const welcomeMessage: ChatMessageType = {
        id: 'welcome',
        role: 'assistant',
        content: `¡Hola${user?.nombre ? ` ${user.nombre}` : ''}! 👋 Soy **Axio**, tu asistente de IA para Parse.

Puedo ayudarte a:
• **Crear reglas de negocio** tradicionales o con IA
• **Optimizar prompts** de extracción de datos de documentos
• **Analizar y mejorar** la configuración existente
• **Consultar** reglas y prompts activos

¿En qué puedo ayudarte hoy?`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, user?.nombre]);

  // Focus en input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Enviar mensaje
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !tenant?.id) return;

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await chatService.sendMessage({
        message: userMessage.content,
        tenantId: tenant.id,
        context: {
          currentPage: typeof window !== 'undefined' ? window.location.pathname : undefined
        }
      });

      const assistantMessage: ChatMessageType = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        data: response.data,
        action: response.action,
        requiresConfirmation: response.requiresConfirmation,
        pendingAction: response.pendingAction
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('[ChatWidget] Error:', error);
      const errorMessage: ChatMessageType = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Confirmar acción
  const handleConfirm = async (messageId: string, confirmed: boolean) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.pendingAction?.id) return;

    setIsConfirming(true);

    try {
      // Usar el ID de la acción pendiente, no el ID del mensaje
      const response = await chatService.confirmAction(message.pendingAction.id, confirmed);

      // Actualizar el mensaje original para quitar los botones
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, requiresConfirmation: false }
          : m
      ));

      // Agregar respuesta de confirmación
      const confirmMessage: ChatMessageType = {
        id: `confirm-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        data: response.data,
        action: response.action
      };

      setMessages(prev => [...prev, confirmMessage]);
    } catch (error) {
      console.error('[ChatWidget] Error confirmando:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  // Manejar Enter para enviar
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Usar sugerencia
  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // No renderizar si no hay autenticación
  if (!token || !tenant) {
    return null;
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gray-600 hover:bg-gray-700 rotate-90'
            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
        } ${className}`}
        title={isOpen ? 'Cerrar Axio' : 'Abrir Axio'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Sparkles className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Panel del chat */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Axio</h3>
                <p className="text-purple-100 text-xs">
                  {isAvailable ? 'Asistente de Parse • Conectado' : 'No disponible'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Área de mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map(message => (
              <ChatMessage
                key={message.id}
                message={message}
                onConfirm={message.requiresConfirmation
                  ? (confirmed) => handleConfirm(message.id, confirmed)
                  : undefined
                }
                isConfirming={isConfirming}
              />
            ))}

            {/* Indicador de carga */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span className="text-sm text-gray-600">Pensando...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sugerencias */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="border-t border-gray-200 bg-white p-2 max-h-40 overflow-y-auto">
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 mb-1">
                <Lightbulb className="w-3 h-3" />
                Sugerencias
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Área de input */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(inputValue.length === 0)}
                  placeholder="Escribe tu mensaje..."
                  disabled={isLoading || !isAvailable}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                  rows={1}
                  style={{ maxHeight: '100px' }}
                />
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="absolute right-2 bottom-2 text-gray-400 hover:text-purple-600 transition-colors"
                  title="Ver sugerencias"
                >
                  <Lightbulb className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading || !isAvailable}
                className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Presiona Enter para enviar • Shift+Enter para nueva línea
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;
