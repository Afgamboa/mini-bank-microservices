import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthenticatedUser } from '@mini-bank/auth-shared';
import { HttpFailure } from '@mini-bank/http-client';
import { EventPublisher } from '@mini-bank/messaging';
import { Page, TransferCompletedPayload, mapPage, toPage, toSkipTake } from '@mini-bank/shared-contracts';
import { Prisma, Transaction } from '../../generated/prisma-client';
import { AccountsClient } from '../clients/accounts.client';
import { assertNever } from '../common/assert-never';
import {
  NewTransaction,
  RESUMABLE_STATUSES,
  TransactionStatus,
  TransactionType,
  TransactionView,
  toTransactionView,
} from '../domain/transaction.types';
import { TransactionListQueryDto } from '../dtos/transaction-list-query.dto';
import { TransactionDto } from '../dtos/transaction.dto';
import { TransferDto } from '../dtos/transfer.dto';
import { PrismaService } from '../prisma/prisma.service';
import { SagaOutcome } from '../saga/saga-orchestrator';
import { TransactionSagas } from '../saga/transaction-sagas';

/** Convierte el error de Accounts (o de red) en una respuesta HTTP sin perder su `code`. */
const toHttpException = (error: HttpFailure, extra: Record<string, unknown> = {}) =>
  new HttpException({ ...error.body, ...extra }, error.status);

const failureCode = (error: HttpFailure) => (typeof error.body.code === 'string' ? error.body.code : 'UNKNOWN');

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsClient,
    private readonly sagas: TransactionSagas,
    private readonly events: EventPublisher,
  ) {}

  deposit(user: AuthenticatedUser, dto: TransactionDto, idempotencyKey: string) {
    return this.process(
      this.newTransaction(TransactionType.Deposit, user, dto.accountId, dto, idempotencyKey),
      () => this.requireOwnedAccount(user, dto.accountId, dto.currency),
      (tx) =>
        this.sagas.deposit.run({
          transactionId: tx.id,
          accountId: tx.accountId,
          amount: tx.amount,
          currency: tx.currency,
        }),
    );
  }

  withdraw(user: AuthenticatedUser, dto: TransactionDto, idempotencyKey: string) {
    return this.process(
      this.newTransaction(TransactionType.Withdraw, user, dto.accountId, dto, idempotencyKey),
      () => this.requireOwnedAccount(user, dto.accountId, dto.currency),
      (tx) =>
        this.sagas.withdraw.run({
          transactionId: tx.id,
          accountId: tx.accountId,
          amount: tx.amount,
          currency: tx.currency,
        }),
    );
  }

  transfer(user: AuthenticatedUser, dto: TransferDto, idempotencyKey: string) {
    return this.process(
      this.newTransaction(TransactionType.Transfer, user, dto.fromAccountId, dto, idempotencyKey, dto.toAccountId),
      async () => {
        if (dto.fromAccountId === dto.toAccountId) {
          throw new BadRequestException({ code: 'SAME_ACCOUNT', message: 'Source and destination must differ' });
        }
        await this.requireOwnedAccount(user, dto.fromAccountId, dto.currency);
        await this.requireAccount(dto.toAccountId, dto.currency);
      },
      (tx) =>
        this.sagas.transfer.run({
          transactionId: tx.id,
          accountId: tx.accountId,
          toAccountId: dto.toAccountId,
          amount: tx.amount,
          currency: tx.currency,
        }),
    );
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<TransactionView> {
    // El filtro por initiatedBy hace que una transacción ajena sea indistinguible de una inexistente (404).
    const record = await this.prisma.transaction.findFirst({ where: { id, initiatedBy: user.userId } });
    if (!record) throw new NotFoundException('Transaction not found');
    return toTransactionView(record);
  }

  async list(user: AuthenticatedUser, query: TransactionListQueryDto): Promise<Page<TransactionView>> {
    const where: Prisma.TransactionWhereInput = {
      initiatedBy: user.userId,
      ...(query.accountId && { OR: [{ accountId: query.accountId }, { toAccountId: query.accountId }] }),
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(query) }),
      this.prisma.transaction.count({ where }),
    ]);

    return mapPage(toPage(records, total, query), toTransactionView);
  }

  /**
   * Flujo común a las tres operaciones:
   *  1. Idempotencia: si ya existe el registro (mismo Idempotency-Key) se reutiliza en vez de crear otro.
   *  2. Un registro terminado (COMPLETED/FAILED) se devuelve tal cual: el reintento no repite el dinero.
   *  3. Uno pendiente se REANUDA: la saga se vuelve a ejecutar y, al ser idempotentes los pasos en Accounts,
   *     los ya aplicados no se duplican.
   */
  private async process(
    command: NewTransaction,
    validate: () => Promise<unknown>,
    run: (record: Transaction) => Promise<SagaOutcome<HttpFailure>>,
  ): Promise<TransactionView> {
    const existing = await this.find(command);
    let record: Transaction;
    if (existing) {
      this.assertSameRequest(existing, command);
      record = existing;
    } else {
      await validate();
      record = await this.createPending(command);
    }

    if (!RESUMABLE_STATUSES.includes(record.status as TransactionStatus)) return toTransactionView(record);

    return this.settle(record, await run(record));
  }

  /** Traduce el resultado de la saga a estado persistido, evento y respuesta HTTP. */
  private async settle(record: Transaction, outcome: SagaOutcome<HttpFailure>): Promise<TransactionView> {
    switch (outcome.status) {
      case 'COMPLETED': {
        const updated = await this.update(record.id, { status: TransactionStatus.Completed, failureReason: null });
        await this.publishTransferCompleted(updated);
        return toTransactionView(updated);
      }

      case 'FAILED': {
        const reason = failureCode(outcome.error);
        const updated = await this.update(record.id, { status: TransactionStatus.Failed, failureReason: reason });
        await this.publishTransferFailed(updated, reason);
        throw toHttpException(outcome.error, { transactionId: record.id });
      }

      case 'UNCERTAIN':
        // Sigue PENDING a propósito: no sabemos si Accounts aplicó el paso. Reintentar con la misma key lo resuelve.
        await this.update(record.id, { failureReason: failureCode(outcome.error) });
        throw toHttpException(outcome.error, { transactionId: record.id });

      case 'COMPENSATION_FAILED':
        await this.update(record.id, {
          status: TransactionStatus.CompensationFailed,
          failureReason: failureCode(outcome.compensationError),
        });
        throw new ServiceUnavailableException({
          code: 'COMPENSATION_FAILED',
          message: 'Transaction could not be rolled back yet; retry with the same Idempotency-Key',
          transactionId: record.id,
        });

      default:
        return assertNever(outcome);
    }
  }

  private newTransaction(
    type: TransactionType,
    user: AuthenticatedUser,
    accountId: string,
    money: { amount: number; currency: string },
    idempotencyKey: string,
    toAccountId?: string,
  ): NewTransaction {
    return {
      type,
      accountId,
      toAccountId,
      amount: money.amount,
      currency: money.currency,
      initiatedBy: user.userId,
      idempotencyKey,
    };
  }

  private find(command: NewTransaction) {
    return this.prisma.transaction.findUnique({
      where: {
        accountId_type_idempotencyKey: {
          accountId: command.accountId,
          type: command.type,
          idempotencyKey: command.idempotencyKey,
        },
      },
    });
  }

  private async createPending(command: NewTransaction): Promise<Transaction> {
    try {
      return await this.prisma.transaction.create({ data: { ...command, status: TransactionStatus.Pending } });
    } catch (error) {
      // Dos peticiones simultáneas con la misma key: gana una, la otra reutiliza el registro creado.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.find(command);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private assertSameRequest(existing: Transaction, command: NewTransaction): void {
    const same =
      existing.initiatedBy === command.initiatedBy &&
      existing.amount === command.amount &&
      existing.currency === command.currency &&
      existing.toAccountId === (command.toAccountId ?? null);

    if (!same) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Idempotency-Key was already used with a different request',
      });
    }
  }

  private update(id: string, data: { status?: TransactionStatus; failureReason?: string | null }) {
    return this.prisma.transaction.update({ where: { id }, data });
  }

  private async requireAccount(accountId: string, currency: string) {
    const result = await this.accounts.getSummary(accountId);
    if (!result.ok) throw toHttpException(result.error);

    if (result.value.currency !== currency) {
      throw new BadRequestException({ code: 'CURRENCY_MISMATCH', message: 'Currency does not match the account' });
    }
    return result.value;
  }

  private async requireOwnedAccount(user: AuthenticatedUser, accountId: string, currency: string) {
    const account = await this.requireAccount(accountId, currency);
    // Misma respuesta que una cuenta inexistente para no revelar que existe.
    if (account.ownerId !== user.userId) {
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    }
  }

  // --- Eventos: solo las transferencias notifican (docs/01-analisis-dominio.md §4) ---

  private transferPayload(tx: Transaction): TransferCompletedPayload | null {
    if (tx.type !== TransactionType.Transfer || !tx.toAccountId) return null;
    return {
      transactionId: tx.id,
      fromAccountId: tx.accountId,
      toAccountId: tx.toAccountId,
      amount: tx.amount,
      currency: tx.currency,
      initiatedBy: tx.initiatedBy,
    };
  }

  private async publishTransferCompleted(tx: Transaction) {
    const payload = this.transferPayload(tx);
    if (payload) await this.events.publish('TransferCompleted', payload);
  }

  private async publishTransferFailed(tx: Transaction, reason: string) {
    const payload = this.transferPayload(tx);
    if (payload) await this.events.publish('TransferFailed', { ...payload, reason });
  }
}
