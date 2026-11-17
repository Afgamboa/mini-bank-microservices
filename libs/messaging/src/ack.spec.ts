import { Logger } from '@nestjs/common';
import type { RmqContext } from '@nestjs/microservices';
import { handleWithAck } from './ack';

function makeContext(redelivered: boolean) {
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { fields: { redelivered } };
  const context = { getChannelRef: () => channel, getMessage: () => message } as unknown as RmqContext;
  return { context, channel, message };
}

describe('handleWithAck', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('acks when the work succeeds', async () => {
    const { context, channel, message } = makeContext(false);

    await handleWithAck(context, async () => undefined);

    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('requeues on the first failure', async () => {
    const { context, channel, message } = makeContext(false);

    await handleWithAck(context, async () => {
      throw new Error('boom');
    });

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('rejects without requeue (dead-letter) when the message was already redelivered', async () => {
    const { context, channel, message } = makeContext(true);

    await handleWithAck(context, async () => {
      throw new Error('boom');
    });

    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
