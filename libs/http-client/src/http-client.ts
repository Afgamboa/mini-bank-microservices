import { CircuitBreaker, CircuitBreakerOptions } from './circuit-breaker';
import { fail, ok, Result } from './result';
import { withRetry } from './retry';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Forma normalizada de cualquier error: la del servicio remoto o la generada aquí (red, timeout). */
export interface ErrorBody {
  message: string | string[];
  code?: string;
  [extra: string]: unknown;
}

export interface HttpFailure {
  status: number;
  body: ErrorBody;
}

export interface HttpClientOptions {
  /** Sin barra final, ej. "http://localhost:3002". */
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Reintentos por defecto; usar > 0 solo si las llamadas son idempotentes. */
  retries?: number;
  retryDelayMs?: number;
  breaker?: CircuitBreakerOptions;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  retries?: number;
}

const DEFAULT_TIMEOUT_MS = 3000;

const failure = (status: number, code: string, message: string): HttpFailure => ({
  status,
  body: { code, message },
});

/** Un 5xx indica un problema de infraestructura; un 4xx es una respuesta de negocio válida. */
const isServerFailure = (error: HttpFailure) => error.status >= 500 && error.body.code !== 'CIRCUIT_OPEN';

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toErrorBody(parsed: unknown, fallback: string): ErrorBody {
  if (typeof parsed === 'object' && parsed !== null && 'message' in parsed) return parsed as ErrorBody;
  return { message: typeof parsed === 'string' && parsed ? parsed : fallback };
}

/**
 * Cliente HTTP JSON con timeout explícito, reintentos acotados y circuit breaker
 * (RNF-07). Nunca lanza: devuelve `Result<T, HttpFailure>`.
 * El genérico `T` del método describe la forma esperada de la respuesta exitosa.
 */
export class HttpClient {
  private readonly breaker?: CircuitBreaker;

  constructor(private readonly options: HttpClientOptions) {
    if (options.breaker) this.breaker = new CircuitBreaker(options.breaker);
  }

  // Omit<T, K>: mismas opciones sin `body`, porque un GET no lleva cuerpo.
  get<T>(path: string, init?: Omit<RequestOptions, 'body'>) {
    return this.request<T>('GET', path, init);
  }

  post<T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'body'>) {
    return this.request<T>('POST', path, { ...init, body });
  }

  request<T>(method: HttpMethod, path: string, init: RequestOptions = {}): Promise<Result<T, HttpFailure>> {
    return withRetry(() => this.attempt<T>(method, path, init), {
      retries: init.retries ?? this.options.retries ?? 0,
      delayMs: this.options.retryDelayMs ?? 200,
      shouldRetry: (result) => !result.ok && isServerFailure(result.error),
    });
  }

  private async attempt<T>(
    method: HttpMethod,
    path: string,
    init: RequestOptions,
  ): Promise<Result<T, HttpFailure>> {
    if (this.breaker && !this.breaker.canRequest()) {
      return fail(failure(503, 'CIRCUIT_OPEN', 'Downstream service temporarily unavailable'));
    }

    const result = await this.send<T>(method, path, init);

    if (result.ok || !isServerFailure(result.error)) this.breaker?.recordSuccess();
    else this.breaker?.recordFailure();

    return result;
  }

  private async send<T>(
    method: HttpMethod,
    path: string,
    init: RequestOptions,
  ): Promise<Result<T, HttpFailure>> {
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...this.options.headers, ...init.headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      return fail(
        timedOut
          ? failure(504, 'TIMEOUT', 'Downstream service timed out')
          : failure(503, 'SERVICE_UNAVAILABLE', 'Downstream service unavailable'),
      );
    }

    const text = await response.text();
    const parsed = text ? parseBody(text) : undefined;

    if (!response.ok) {
      return fail({ status: response.status, body: toErrorBody(parsed, response.statusText) });
    }
    return ok(parsed as T);
  }
}
