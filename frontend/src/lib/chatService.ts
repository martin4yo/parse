/**
 * Chat Service - Cliente para comunicación con el agente Axio
 * Proporciona métodos para enviar mensajes y recibir respuestas del asistente de IA
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;
  action?: string;
  requiresConfirmation?: boolean;
  pendingAction?: PendingAction;
}

export interface PendingAction {
  type: string;
  payload: any;
  description: string;
}

export interface ChatRequest {
  message: string;
  tenantId: string;
  context?: {
    currentPage?: string;
    selectedItems?: string[];
  };
}

export interface ChatResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  action?: string;
  requiresConfirmation?: boolean;
  pendingAction?: PendingAction;
}

export interface HealthResponse {
  available: boolean;
  service: string;
  model: string;
}

class ChatService {
  private token: string | null = null;

  /**
   * Establece el token JWT para autenticación
   */
  setToken(token: string) {
    this.token = token;
  }

  /**
   * Obtiene el token desde localStorage si no está establecido
   */
  private getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  /**
   * Envía un mensaje al agente Axio
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const token = this.getToken();
    if (!token) {
      return {
        success: false,
        message: 'No hay sesión activa',
        error: 'NOT_AUTHENTICATED'
      };
    }

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            message: 'Sesión expirada. Por favor, vuelve a iniciar sesión.',
            error: 'UNAUTHORIZED'
          };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ChatService] Error enviando mensaje:', error);
      return {
        success: false,
        message: 'Error de conexión con el servidor',
        error: 'CONNECTION_ERROR'
      };
    }
  }

  /**
   * Confirma una acción pendiente (crear regla, modificar prompt, etc.)
   */
  async confirmAction(actionId: string, confirmed: boolean): Promise<ChatResponse> {
    const token = this.getToken();
    if (!token) {
      return {
        success: false,
        message: 'No hay sesión activa',
        error: 'NOT_AUTHENTICATED'
      };
    }

    try {
      const response = await fetch(`${API_URL}/api/chat/confirm-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ actionId, confirmed })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ChatService] Error confirmando acción:', error);
      return {
        success: false,
        message: 'Error al confirmar la acción',
        error: 'CONNECTION_ERROR'
      };
    }
  }

  /**
   * Verifica la disponibilidad del servicio de chat
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      const token = this.getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/chat/health`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          available: false,
          service: 'axio',
          model: 'unknown'
        };
      }

      return await response.json();
    } catch (error) {
      console.error('[ChatService] Error verificando salud:', error);
      return {
        available: false,
        service: 'axio',
        model: 'unknown'
      };
    }
  }

  /**
   * Obtiene sugerencias de comandos basadas en el contexto actual
   */
  async getSuggestions(context?: string): Promise<string[]> {
    const suggestions = [
      'Crea una regla para clasificar gastos de combustible',
      'Muéstrame las reglas activas',
      'Analiza el prompt de extracción de facturas A',
      'Crea una regla con IA para asignar cuentas contables',
      'Mejora el prompt para que extraiga mejor el CAE',
      '¿Qué puedes hacer?'
    ];

    // En el futuro, esto podría hacer una llamada al backend
    // para obtener sugerencias contextuales
    return suggestions;
  }
}

// Exportar instancia singleton
export const chatService = new ChatService();
export default chatService;
