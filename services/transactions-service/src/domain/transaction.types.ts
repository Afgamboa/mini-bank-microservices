import { Transaction } from '../../generated/prisma-client';

/**
 * Patrón "const object + union derivada": un único lugar define los valores, y el tipo se deduce de él
 * (`as const` conserva los literales; `keyof`/indexado extrae la unión). Mismo nombre para valor y tipo.
 */
export const TransactionType = {
  Deposit: 'DEPOSIT',
  Withdraw: 'WITHDRAW',
  Transfer: 'TRANSFER',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  Pending: 'PENDING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
  CompensationFailed: 'COMPENSATION_FAILED',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

/**
 * Estados desde los que una petición repetida (mismo Idempotency-Key) REANUDA la saga.
 * Es seguro porque cada llamada a Accounts es idempotente por `reference`.
 */
export const RESUMABLE_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.Pending,
  TransactionStatus.CompensationFailed,
];

/** Datos para registrar una operación nueva: lo que envía el cliente + quién la inicia. */
export type NewTransaction = Pick<
  Transaction,
  'accountId' | 'amount' | 'currency' | 'initiatedBy' | 'idempotencyKey'
> & { type: TransactionType; toAccountId?: string };

/**
 * Lo que se devuelve al cliente. `Omit` quita campos internos; se re-tipan `type` y `status`
 * (Prisma los guarda como string) con las uniones del dominio.
 */
export type TransactionView = Omit<Transaction, 'type' | 'status' | 'idempotencyKey' | 'initiatedBy'> & {
  type: TransactionType;
  status: TransactionStatus;
};

export const toTransactionView = ({
  idempotencyKey: _idempotencyKey,
  initiatedBy: _initiatedBy,
  ...rest
}: Transaction): TransactionView => ({
  ...rest,
  type: rest.type as TransactionType,
  status: rest.status as TransactionStatus,
});
