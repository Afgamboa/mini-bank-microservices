import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { createDomainEvent, EventName, EventPayloadMap } from '@mini-bank/shared-contracts';
import { lastValueFrom, timeout } from 'rxjs';

export const EVENT_BUS_CLIENT = Symbol('EVENT_BUS_CLIENT');

const PUBLISH_TIMEOUT_MS = 3000;

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);

  constructor(@Inject(EVENT_BUS_CLIENT) private readonly client: ClientProxy) {}

  /**
   * Genérico en `N`: el payload se valida contra `EventPayloadMap[N]` en compilación.
   * `publish('TransferFailed', { ... })` exige `reason`; `publish('AccountOpened', { reason })` no compila.
   *
   * Nunca lanza: cuando llegamos aquí el dinero ya se movió, y un RabbitMQ caído no debe
   * convertir una operación exitosa en un error para el cliente.
   * Riesgo conocido (dual write): si el proceso muere entre el commit en BD y el publish, el evento se pierde.
   * La solución de producción es el patrón Transactional Outbox: guardar el evento en la misma
   * transacción de BD y publicarlo desde un worker.
   */
  async publish<N extends EventName>(eventType: N, payload: EventPayloadMap[N]): Promise<void> {
    const event = createDomainEvent(eventType, payload);
    try {
      // emit() es "cold": no envía nada hasta que alguien se suscribe, de ahí lastValueFrom.
      await lastValueFrom(this.client.emit(eventType, event).pipe(timeout({ first: PUBLISH_TIMEOUT_MS })), {
        defaultValue: undefined,
      });
    } catch (error) {
      this.logger.error(`Could not publish ${eventType} (${event.eventId}): ${String(error)}`);
    }
  }
}
