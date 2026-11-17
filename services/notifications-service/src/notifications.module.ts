import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notifications/notification.service';
import { NotificationsConsumer } from './notifications/notifications.consumer';
import { InMemoryProcessedEventsStore, PROCESSED_EVENTS_STORE } from './notifications/processed-events.store';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })],
  controllers: [NotificationsConsumer],
  providers: [
    NotificationService,
    { provide: PROCESSED_EVENTS_STORE, useFactory: () => new InMemoryProcessedEventsStore() },
  ],
})
export class NotificationsModule {}
