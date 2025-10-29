// Utility functions for API calls with rate limiting and retry logic

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

/**
 * Realiza una petición HTTP con manejo automático de rate limiting y retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000
  } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Si es rate limiting (429), esperamos y reintentamos
      if (response.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000 // Retry-After está en segundos
            : Math.min(baseDelay * Math.pow(2, attempt), maxDelay); // Exponential backoff

          console.warn(`🔄 Rate limit alcanzado. Reintentando en ${delay}ms (intento ${attempt + 1}/${maxRetries + 1})`);
          await sleep(delay);
          continue;
        }
      }

      // Para otros errores de red, reintentamos con backoff
      if (!response.ok && attempt < maxRetries) {
        // Solo reintentamos errores de servidor (5xx) y algunos 4xx específicos
        if (response.status >= 500 || response.status === 408 || response.status === 429) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          console.warn(`🔄 Error ${response.status}. Reintentando en ${delay}ms (intento ${attempt + 1}/${maxRetries + 1})`);
          await sleep(delay);
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Solo reintentamos errores de red
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.warn(`🔄 Error de red. Reintentando en ${delay}ms (intento ${attempt + 1}/${maxRetries + 1})`, error);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Maneja respuestas de rate limiting de forma elegante
 */
export async function handleRateLimitedResponse(response: Response): Promise<any> {
  if (response.status === 429) {
    const data = await response.json().catch(() => ({
      error: 'Rate limit exceeded',
      message: 'Demasiadas peticiones. Por favor, espera un momento antes de continuar.',
      retryAfter: 15 * 60
    }));

    throw new Error(data.message || 'Rate limit exceeded');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({
      error: 'Request failed',
      message: `Error ${response.status}: ${response.statusText}`
    }));

    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Helper function para esperar un tiempo determinado
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrapper para realizar peticiones autenticadas con retry logic
 */
export async function authenticatedFetch(
  url: string,
  token: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<any> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  }, retryOptions);

  return handleRateLimitedResponse(response);
}