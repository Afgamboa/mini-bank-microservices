type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Fallos consecutivos que abren el circuito. */
  failureThreshold: number;
  /** Tiempo con el circuito abierto antes de dejar pasar una llamada de prueba. */
  resetTimeoutMs: number;
  now?: () => number;
}

/**
 * Evita martillar un servicio caído (fallo en cascada, docs/02-arquitectura.md §1):
 * CLOSED --(N fallos)--> OPEN --(pasa el timeout)--> HALF_OPEN --(éxito)--> CLOSED
 *                                                       |--(fallo)--> OPEN
 */
export class CircuitBreaker {
  private state: BreakerState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;
  private readonly now: () => number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.now = options.now ?? Date.now;
  }

  get currentState(): BreakerState {
    return this.state;
  }

  canRequest(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN' && this.now() - this.openedAt >= this.options.resetTimeoutMs) {
      this.state = 'HALF_OPEN';
      return true; // una única llamada de prueba
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failures++;
    if (this.state === 'HALF_OPEN' || this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = this.now();
    }
  }
}
