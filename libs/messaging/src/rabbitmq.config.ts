import { Transport, RmqOptions } from '@nestjs/microservices';
import { connect } from 'amqplib';

/**
 * Cómo funciona RabbitMQ aquí (resumen):
 *
 *   publicador ──emit──> [ cola  notifications.events ] ──> consumidor
 *                                   │ nack sin requeue
 *                                   ▼
 *                        [ cola  notifications.events.dlq ]   (dead-letter queue)
 *
 * - El broker guarda el mensaje en la cola (durable) aunque el consumidor esté caído: desacopla
 *   en el tiempo a quien publica de quien consume.
 * - El consumidor confirma (ack) solo cuando terminó de procesar; si muere a mitad, el mensaje vuelve a la cola.
 * - Un mensaje que no se puede procesar va a la DLQ en vez de bloquear la cola para siempre.
 *
 * Limitación consciente: el transporte RMQ de @nestjs/microservices publica directo a una cola (sin
 * exchanges). Si más consumidores necesitaran los mismos eventos, el siguiente paso es un exchange
 * `topic` con una cola por consumidor.
 */

export const deadLetterQueueName = (queue: string) => `${queue}.dlq`;

/**
 * Publicador y consumidor DEBEN declarar la cola con los mismos argumentos; si difieren,
 * RabbitMQ rechaza la declaración (PRECONDITION_FAILED). Por eso viven en un único lugar.
 */
export const eventQueueOptions = (queue: string) => ({
  durable: true,
  arguments: {
    // El exchange '' es el "default": enruta por nombre de cola, así la DLQ no necesita binding.
    'x-dead-letter-exchange': '',
    'x-dead-letter-routing-key': deadLetterQueueName(queue),
  },
});

export const rmqConsumerOptions = (url: string, queue: string): RmqOptions => ({
  transport: Transport.RMQ,
  options: {
    urls: [url],
    queue,
    queueOptions: eventQueueOptions(queue),
    // noAck=false: el broker espera confirmación manual (ver handleWithAck).
    noAck: false,
    // Máximo de mensajes sin confirmar a la vez por consumidor.
    prefetchCount: 10,
    persistent: true,
  },
});

/**
 * Nadie crea la DLQ automáticamente: si no existe cuando se dead-lettera un mensaje, el broker lo descarta.
 * Se declara al arrancar el consumidor (la declaración es idempotente).
 */
export async function assertDeadLetterQueue(url: string, queue: string): Promise<void> {
  const connection = await connect(url);
  try {
    const channel = await connection.createChannel();
    await channel.assertQueue(deadLetterQueueName(queue), { durable: true });
    await channel.close();
  } finally {
    await connection.close();
  }
}
