import { Controller, Inject } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { handleWithAck } from '@mini-bank/messaging';
import { DomainEvent } from '@mini-bank/shared-contracts';
import { NotifiableEvent } from './notification.builders';
import { NotificationService } from './notification.service';
import { PROCESSED_EVENTS_STORE, ProcessedEventsStore } from './processed-events.store';

/**
 * Consumidor puro (fire-and-forget, docs/01-analisis-dominio.md §4): no responde a nadie, solo reacciona.
 * `@EventPattern` enruta por el nombre del evento que el publicador pasó a `emit`.
 * `satisfies` comprueba que cada patrón sea un `NotifiableEvent` válido sin ensanchar el literal.
 */
@Controller()
export class NotificationsConsumer {
  constructor(
    private readonly notifications: NotificationService,
    @Inject(PROCESSED_EVENTS_STORE) private readonly processedEvents: ProcessedEventsStore,
  ) {}

  @EventPattern('AccountOpened' satisfies NotifiableEvent)
  onAccountOpened(@Payload() event: DomainEvent<'AccountOpened'>, @Ctx() context: RmqContext) {
    return this.consume(event, context);
  }

  @EventPattern('TransferCompleted' satisfies NotifiableEvent)
  onTransferCompleted(@Payload() event: DomainEvent<'TransferCompleted'>, @Ctx() context: RmqContext) {
    return this.consume(event, context);
  }

  @EventPattern('TransferFailed' satisfies NotifiableEvent)
  onTransferFailed(@Payload() event: DomainEvent<'TransferFailed'>, @Ctx() context: RmqContext) {
    return this.consume(event, context);
  }

  private consume<N extends NotifiableEvent>(event: DomainEvent<N>, context: RmqContext) {
    return handleWithAck(context, async () => {
      // Duplicado: ya se notificó. Se confirma (ack) igual para que el broker deje de reenviarlo.
      if (await this.processedEvents.wasProcessed(event.eventId)) return;

      this.notifications.send(event);
      // Se marca DESPUÉS de procesar: si falla, el reintento no lo ve como duplicado.
      await this.processedEvents.markProcessed(event.eventId);
    });
  }
}
