import { Injectable } from '@nestjs/common';
import { HttpFailure } from '@mini-bank/http-client';
import { MovementCommand } from '@mini-bank/shared-contracts';
import { AccountsClient } from '../clients/accounts.client';
import { SagaOrchestrator, SagaStep } from './saga-orchestrator';

export interface MovementContext {
  transactionId: string;
  accountId: string;
  amount: number;
  currency: string;
}

export interface TransferContext extends MovementContext {
  toAccountId: string;
}

type Step<C> = SagaStep<C, HttpFailure>;

/** 4xx = Accounts respondió "no" (saldo, cuenta inactiva...). 5xx / timeout = no sabemos qué pasó. */
const isDefinitive = (error: HttpFailure) => error.status < 500;

/**
 * `reference` es la llave de idempotencia en Accounts: el mismo id de transacción siempre produce
 * el mismo movimiento, y el reembolso lleva sufijo propio para no chocar con el débito original.
 */
const command = (ctx: MovementContext, reference: string = ctx.transactionId): MovementCommand => ({
  amount: ctx.amount,
  currency: ctx.currency,
  reference,
});

@Injectable()
export class TransactionSagas {
  readonly deposit: SagaOrchestrator<MovementContext, HttpFailure>;
  readonly withdraw: SagaOrchestrator<MovementContext, HttpFailure>;
  readonly transfer: SagaOrchestrator<TransferContext, HttpFailure>;

  constructor(accounts: AccountsClient) {
    const creditAccount: Step<MovementContext> = {
      name: 'credit-account',
      execute: (ctx) => accounts.credit(ctx.accountId, command(ctx)),
    };

    const debitAccount: Step<MovementContext> = {
      name: 'debit-account',
      execute: (ctx) => accounts.debit(ctx.accountId, command(ctx)),
    };

    // En una transferencia el débito SÍ necesita compensación: si el crédito falla, se reembolsa.
    const debitSource: Step<TransferContext> = {
      ...debitAccount,
      name: 'debit-source',
      compensate: (ctx) => accounts.credit(ctx.accountId, command(ctx, `${ctx.transactionId}:refund`)),
    };

    const creditDestination: Step<TransferContext> = {
      name: 'credit-destination',
      execute: (ctx) => accounts.credit(ctx.toAccountId, command(ctx)),
    };

    const options = { isDefinitive };
    this.deposit = new SagaOrchestrator([creditAccount], options);
    this.withdraw = new SagaOrchestrator([debitAccount], options);
    this.transfer = new SagaOrchestrator([debitSource, creditDestination], options);
  }
}
