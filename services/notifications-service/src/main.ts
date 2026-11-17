import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { assertDeadLetterQueue, rmqConsumerOptions } from '@mini-bank/messaging';
import { NOTIFICATIONS_QUEUE } from '@mini-bank/shared-contracts';
import { NotificationsModule } from './notifications.module';

async function bootstrap() {
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL is required');

  await assertDeadLetterQueue(url, NOTIFICATIONS_QUEUE);

  // Microservicio puro: no abre puerto HTTP, solo consume de la cola.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationsModule,
    rmqConsumerOptions(url, NOTIFICATIONS_QUEUE),
  );
  await app.listen();
}

void bootstrap();
