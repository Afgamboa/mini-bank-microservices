export const PROCESSED_EVENTS_STORE = Symbol('PROCESSED_EVENTS_STORE');

/**
 * Idempotencia del consumidor (RNF-02): RabbitMQ garantiza entrega "al menos una vez", así que el mismo
 * evento puede llegar repetido (reintento tras un nack, reconexión, etc.). Registrar los `eventId`
 * ya procesados evita notificar dos veces.
 */
export interface ProcessedEventsStore {
  wasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
}

/**
 * Implementación en memoria: se pierde al reiniciar. Para producción se reemplaza por una tabla
 * con `eventId` único (Notifications tendría su propio Postgres, ver docs/02-arquitectura.md §2) sin tocar al consumidor.
 */
export class InMemoryProcessedEventsStore implements ProcessedEventsStore {
  private readonly processed = new Set<string>();

  constructor(private readonly maxSize = 10_000) {}

  async wasProcessed(eventId: string): Promise<boolean> {
    return this.processed.has(eventId);
  }

  async markProcessed(eventId: string): Promise<void> {
    this.processed.add(eventId);
    if (this.processed.size > this.maxSize) {
      // Set conserva el orden de inserción: el primero es el más antiguo.
      this.processed.delete(this.processed.values().next().value as string);
    }
  }
}
