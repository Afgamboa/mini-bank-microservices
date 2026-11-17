import { Logger } from '@nestjs/common';
import type { RmqContext } from '@nestjs/microservices';
import { createDomainEvent } from '@mini-bank/shared-contracts';
import { NotificationService } from './notification.service';
import { NotificationsConsumer } from './notifications.consumer';
import { InMemoryProcessedEventsStore } from './processed-events.store';

function makeContext() {
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => ({ fields: { redelivered: false } }),
  } as unknown as RmqContext;
  return { context, channel };
}

describe('NotificationsConsumer', () => {
  const send = jest.fn();
  let consumer: NotificationsConsumer;

  const event = createDomainEvent('AccountOpened', { accountId: 'a1', ownerId: 'user-1', currency: 'USD' });

  beforeEach(() => {
    send.mockReset();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    consumer = new NotificationsConsumer(
      { send } as unknown as NotificationService,
      new InMemoryProcessedEventsStore(),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('notifies once and acks', async () => {
    const { context, channel } = makeContext();

    await consumer.onAccountOpened(event, context);

    expect(send).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalled();
  });

  it('acks a duplicate delivery without notifying twice', async () => {
    const first = makeContext();
    const second = makeContext();

    await consumer.onAccountOpened(event, first.context);
    await consumer.onAccountOpened(event, second.context);

    expect(send).toHaveBeenCalledTimes(1);
    expect(second.channel.ack).toHaveBeenCalled();
  });

  it('does not mark the event as processed when sending fails, so a retry can notify', async () => {
    send.mockImplementationOnce(() => {
      throw new Error('channel down');
    });
    const failing = makeContext();
    const retry = makeContext();

    await consumer.onAccountOpened(event, failing.context);
    await consumer.onAccountOpened(event, retry.context);

    expect(failing.channel.nack).toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(2);
    expect(retry.channel.ack).toHaveBeenCalled();
  });
});
