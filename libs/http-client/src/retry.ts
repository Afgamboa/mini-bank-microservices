export interface RetryOptions<T> {
  /** Reintentos adicionales al primer intento. */
  retries: number;
  /** Espera base; se duplica en cada reintento (backoff exponencial). */
  delayMs: number;
  /** Decide, mirando el resultado, si vale la pena reintentar. */
  shouldRetry: (result: T) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reintenta una operación cuyo resultado es un valor (p. ej. un `Result`), no una excepción.
 * Es genérica en `T`: sirve para cualquier operación asíncrona.
 * Solo es seguro reintentar operaciones idempotentes (aquí lo son por `reference`).
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  { retries, delayMs, shouldRetry, sleep = defaultSleep }: RetryOptions<T>,
): Promise<T> {
  let result = await operation(0);
  for (let attempt = 1; attempt <= retries && shouldRetry(result); attempt++) {
    await sleep(delayMs * 2 ** (attempt - 1));
    result = await operation(attempt);
  }
  return result;
}
