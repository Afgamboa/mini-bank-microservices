import { randomUUID } from 'node:crypto';

// Contratos de eventos de dominio (docs/02-arquitectura.md §3.2). Un evento es un hecho ya ocurrido.

export interface UserRegisteredPayload {
  userId: string;
  email: string;
}

export interface AccountOpenedPayload {
  accountId: string;
  ownerId: string;
  currency: string;
}

export interface MoneyMovedPayload {
  accountId: string;
  amount: number;
  balanceAfter: number;
}

export interface TransferCompletedPayload {
  transactionId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  /** Usuario que inició la transferencia: a quién notificar. */
  initiatedBy: string;
}

// `extends` evita repetir campos: un fallo es una transferencia + su motivo.
export interface TransferFailedPayload extends TransferCompletedPayload {
  reason: string;
}

/**
 * Fuente única de verdad: nombre del evento -> forma de su payload.
 * Todo lo demás (EventName, DomainEvent, publicadores, consumidores) se DERIVA de aquí,
 * así que agregar un evento nuevo es una línea y el compilador señala lo que falta.
 */
export interface EventPayloadMap {
  UserRegistered: UserRegisteredPayload;
  AccountOpened: AccountOpenedPayload;
  MoneyDeposited: MoneyMovedPayload;
  MoneyWithdrawn: MoneyMovedPayload;
  TransferCompleted: TransferCompletedPayload;
  TransferFailed: TransferFailedPayload;
}

export type EventName = keyof EventPayloadMap;

/**
 * Sobre común de todo evento. El genérico `N` liga `eventType` con su `payload`:
 * `DomainEvent<'TransferFailed'>` tiene `reason`, `DomainEvent<'AccountOpened'>` no.
 */
export interface DomainEvent<N extends EventName = EventName> {
  eventId: string;
  eventType: N;
  occurredAt: string;
  payload: EventPayloadMap[N];
}

/**
 * Mapped type + indexed access: genera la unión discriminada por `eventType`.
 * Un `switch (event.eventType)` sobre este tipo estrecha el payload automáticamente.
 */
export type AnyDomainEvent = { [N in EventName]: DomainEvent<N> }[EventName];

export function createDomainEvent<N extends EventName>(
  eventType: N,
  payload: EventPayloadMap[N],
): DomainEvent<N> {
  return { eventId: randomUUID(), eventType, occurredAt: new Date().toISOString(), payload };
}

/** Cola del consumidor de notificaciones; publicadores y consumidor deben coincidir. */
export const NOTIFICATIONS_QUEUE = 'notifications.events';
