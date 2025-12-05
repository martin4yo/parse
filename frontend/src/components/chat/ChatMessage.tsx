'use client';

import React from 'react';
import { Bot, User, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/lib/chatService';

interface ChatMessageProps {
  message: ChatMessageType;
  onConfirm?: (confirmed: boolean) => void;
  isConfirming?: boolean;
}

export function ChatMessage({ message, onConfirm, isConfirming }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Formatear contenido con markdown básico
  const formatContent = (content: string) => {
    // Negritas **texto**
    let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Código inline `código`
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');

    // Listas con •
    formatted = formatted.replace(/^• (.+)$/gm, '<li class="ml-4">$1</li>');

    // Listas numeradas
    formatted = formatted.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4"><span class="font-medium">$1.</span> $2</li>');

    // Saltos de línea
    formatted = formatted.replace(/\n/g, '<br />');

    return formatted;
  };

  // Formatear timestamp
  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser
          ? 'bg-blue-100 text-blue-600'
          : 'bg-purple-100 text-purple-600'
      }`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Contenido del mensaje */}
      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-800'
        }`}>
          <div
            className="text-sm whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
          />
        </div>

        {/* Botones de confirmación si la acción lo requiere */}
        {isAssistant && message.requiresConfirmation && message.pendingAction && onConfirm && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onConfirm(true)}
              disabled={isConfirming}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isConfirming ? (
                <Clock size={14} className="animate-spin" />
              ) : (
                <CheckCircle size={14} />
              )}
              Confirmar
            </button>
            <button
              onClick={() => onConfirm(false)}
              disabled={isConfirming}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle size={14} />
              Cancelar
            </button>
          </div>
        )}

        {/* Timestamp */}
        <span className={`text-xs mt-1 ${isUser ? 'text-gray-400' : 'text-gray-400'}`}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

export default ChatMessage;
