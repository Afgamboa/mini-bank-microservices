// Contratos definidos en docs/02-arquitectura.md §3. Fuente de verdad compartida entre servicios.

export interface DebitCommand {
  amount: number;
  currency: string;
  reference: string;
}

export interface CreditCommand {
  amount: number;
  currency: string;
  reference: string;
}

export interface AccountMutationResult {
  accountId: string;
  balanceAfter: number;
}

export type AccountMutationErrorCode =
  'INSUFFICIENT_FUNDS' | 'ACCOUNT_NOT_FOUND' | 'ACCOUNT_BLOCKED';

export interface AccountMutationError {
  code: AccountMutationErrorCode;
  message: string;
}

export interface DomainEvent<T> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload: T;
}

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
}

export interface TransferFailedPayload extends TransferCompletedPayload {
  reason: string;
}
