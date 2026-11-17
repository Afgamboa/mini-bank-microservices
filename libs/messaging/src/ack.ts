import { Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';

const logger = new Logger('RabbitMQ');

/**
 * Ejecuta el trabajo del consumidor y confirma el mensaje según el resultado:
 *  - éxito                      -> ack: el broker lo borra de la cola.
 *  - fallo, primera entrega     -> nack + requeue: un reintento (cubre fallos transitorios).
 *  - fallo, ya reentregado      -> nack sin requeue: va a la DLQ para revisarlo a mano (no se pierde ni bloquea).
 *
 * Sin ack/nack explícito, Nest (noAck=false) deja el mensaje "en vuelo" hasta que se cierra el canal.
 */
export async function handleWithAck(context: RmqContext, work: () => Promise<void>): Promise<void> {
  const channel = context.getChannelRef() as Channel;
  const message = context.getMessage() as ConsumeMessage;

  try {
    await work();
    channel.ack(message);
  } catch (error) {
    const isFinalAttempt = message.fields.redelivered;
    logger.error(
      `Message processing failed (${isFinalAttempt ? 'sent to DLQ' : 'will retry'}): ${String(error)}`,
    );
    channel.nack(message, false, !isFinalAttempt);
  }
}
