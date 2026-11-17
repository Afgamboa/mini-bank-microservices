import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NOTIFICATIONS_QUEUE } from '@mini-bank/shared-contracts';
import { EVENT_BUS_CLIENT, EventPublisher } from './event-publisher';
import { eventQueueOptions } from './rabbitmq.config';

/** Para servicios que PUBLICAN eventos (Accounts, Transactions). Requiere RABBITMQ_URL. */
@Module({})
export class MessagingModule {
  static register(): DynamicModule {
    return {
      module: MessagingModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: EVENT_BUS_CLIENT,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              transport: Transport.RMQ,
              options: {
                urls: [config.getOrThrow<string>('RABBITMQ_URL')],
                queue: NOTIFICATIONS_QUEUE,
                queueOptions: eventQueueOptions(NOTIFICATIONS_QUEUE),
                persistent: true,
              },
            }),
          },
        ]),
      ],
      providers: [EventPublisher],
      exports: [EventPublisher],
    };
  }
}
