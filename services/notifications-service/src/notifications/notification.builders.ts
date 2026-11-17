import { EventName, EventPayloadMap } from '@mini-bank/shared-contracts';

/** Subconjunto de eventos que generan notificación. `Extract` falla si escribes un nombre que no es un evento. */
export type NotifiableEvent = Extract<EventName, 'AccountOpened' | 'TransferCompleted' | 'TransferFailed'>;

export interface Notification {
  userId: string;
  level: 'info' | 'warning';
  subject: string;
  message: string;
}

/**
 * Mapped type: exige UN constructor por evento notificable, tipado con el payload de ESE evento.
 * Si agregas un evento a `NotifiableEvent` y olvidas su builder, no compila.
 */
export type NotificationBuilders = {
  [N in NotifiableEvent]: (payload: EventPayloadMap[N]) => Notification;
};

// Los montos viajan en unidad mínima (docs/02-arquitectura.md §3.1); Intl conoce los decimales de cada moneda.
function formatMoney(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  const decimals = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** decimals);
}

export const notificationBuilders: NotificationBuilders = {
  AccountOpened: ({ ownerId, accountId, currency }) => ({
    userId: ownerId,
    level: 'info',
    subject: 'Account opened',
    message: `Your ${currency} account ${accountId} is ready to use.`,
  }),

  TransferCompleted: ({ initiatedBy, amount, currency, fromAccountId, toAccountId }) => ({
    userId: initiatedBy,
    level: 'info',
    subject: 'Transfer completed',
    message: `${formatMoney(amount, currency)} moved from ${fromAccountId} to ${toAccountId}.`,
  }),

  TransferFailed: ({ initiatedBy, amount, currency, reason }) => ({
    userId: initiatedBy,
    level: 'warning',
    subject: 'Transfer failed',
    message: `Your transfer of ${formatMoney(amount, currency)} could not be completed (${reason}). No money was lost.`,
  }),
};
