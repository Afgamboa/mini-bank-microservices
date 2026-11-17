import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '@mini-bank/shared-contracts';
import { NotifiableEvent, notificationBuilders } from './notification.builders';

/**
 * Canal de salida de la v1: log estructurado (docs/03-requerimientos.md RF-15, sin email/SMS real).
 * Cambiar de canal = reemplazar el cuerpo de `send`; el resto del flujo no se entera.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  // El genérico `N` liga el nombre del evento con su payload: el builder elegido recibe el tipo correcto.
  send<N extends NotifiableEvent>(event: DomainEvent<N>): void {
    const notification = notificationBuilders[event.eventType](event.payload);

    this.logger.log(
      JSON.stringify({
        channel: 'log',
        eventId: event.eventId,
        eventType: event.eventType,
        ...notification,
      }),
    );
  }
}
