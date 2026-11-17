// Contratos HTTP internos Transactions -> Accounts (docs/02-arquitectura.md §3.1).

/**
 * Tope por movimiento, en unidad mínima (1_000_000_000 = 10 millones de COP con 2 decimales).
 * Un único valor para todos los DTOs. Ojo: el saldo es `Int` de Postgres (máx. ~2.147e9),
 * así que un tope mayor exigiría migrar el saldo a BigInt.
 */
export const MAX_MOVEMENT_AMOUNT = 1_000_000_000;

/** Débito y crédito llevan exactamente los mismos datos: un solo tipo, dos alias. */
export interface MovementCommand {
  /** Entero en la unidad mínima de la moneda, nunca float. */
  amount: number;
  /** ISO 4217, ej. "USD". */
  currency: string;
  /** Clave de idempotencia: id de la transacción que origina el movimiento. */
  reference: string;
}

export type DebitCommand = MovementCommand;
export type CreditCommand = MovementCommand;

export interface AccountMutationResult {
  accountId: string;
  balanceAfter: number;
}

export const ACCOUNT_STATUSES = ['ACTIVE', 'BLOCKED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface AccountSummary {
  accountId: string;
  ownerId: string;
  currency: string;
  status: AccountStatus;
}

// `as const` + indexed access: la lista es la única fuente de verdad del tipo.
export const ACCOUNT_ERROR_CODES = [
  'INSUFFICIENT_FUNDS',
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_INACTIVE',
  'CURRENCY_MISMATCH',
  'IDEMPOTENCY_KEY_REUSED',
] as const;

export type AccountMutationErrorCode = (typeof ACCOUNT_ERROR_CODES)[number];

export interface AccountMutationError {
  code: AccountMutationErrorCode;
  message: string;
}

export const ACCOUNT_ENTRY_TYPES = ['DEBIT', 'CREDIT'] as const;
export type AccountEntryType = (typeof ACCOUNT_ENTRY_TYPES)[number];

/** Movimiento del historial de una cuenta (RF-07). */
export interface AccountEntryView {
  id: string;
  type: AccountEntryType;
  amount: number;
  reference: string;
  createdAt: string;
}
