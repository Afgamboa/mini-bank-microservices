import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventPublisher } from '@mini-bank/messaging';
import {
  AccountEntryType,
  AccountEntryView,
  AccountMutationResult,
  AccountStatus,
  AccountSummary,
  MovementCommand,
  Page,
  PageQuery,
  mapPage,
  toPage,
  toSkipTake,
} from '@mini-bank/shared-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { NewAccount } from '../interfaces/account.interface';
import { Account, AccountEntry, Prisma } from '../../generated/prisma-client';

/**
 * Cómo afecta cada tipo de movimiento al saldo. `Record<AccountEntryType, ...>` obliga a definir
 * una regla por tipo: si mañana existe un tercer tipo, el compilador lo señala aquí.
 * `guard` es la condición que debe cumplirse en la MISMA sentencia UPDATE (evita carreras:
 * dos retiros simultáneos no pueden dejar el saldo negativo).
 */
const BALANCE_RULES: Record<
  AccountEntryType,
  (amount: number) => { guard: Prisma.AccountWhereInput; change: Prisma.AccountUpdateManyMutationInput }
> = {
  DEBIT: (amount) => ({ guard: { balance: { gte: amount } }, change: { balance: { decrement: amount } } }),
  CREDIT: (amount) => ({ guard: {}, change: { balance: { increment: amount } } }),
};

const toEntryView = (entry: AccountEntry): AccountEntryView => ({
  id: entry.id,
  type: entry.type as AccountEntryType,
  amount: entry.amount,
  reference: entry.idempotencyKey,
  createdAt: entry.createdAt.toISOString(),
});

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

  async openAccount(ownerId: string, currency: string) {
    try {
      const newAccount: NewAccount = {
        ownerId,
        currency,
        balance: 0,
      };

      const createdAccount = await this.prisma.account.create({
        data: newAccount,
      });

      await this.events.publish('AccountOpened', {
        accountId: createdAccount.id,
        ownerId,
        currency,
      });

      return createdAccount;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Account with this owner already exists');
      }
      throw error;
    }
  }

  async getBalance(ownerId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: {
        ownerId,
        id: accountId,
      },
      select: {
        balance: true,
        currency: true,
      },
    });

    // findFirst returns null both when the id doesn't exist AND when it belongs to another owner;
    // using 404 in both cases avoids leaking "this account exists but isn't yours"
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  /** Historial de movimientos de la cuenta (RF-07), del más reciente al más antiguo. */
  async listEntries(ownerId: string, accountId: string, query: PageQuery): Promise<Page<AccountEntryView>> {
    await this.getBalance(ownerId, accountId); // reutiliza la verificación de propiedad (404 si no es suya)

    const [entries, total] = await this.prisma.$transaction([
      this.prisma.accountEntry.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query),
      }),
      this.prisma.accountEntry.count({ where: { accountId } }),
    ]);

    return mapPage(toPage(entries, total, query), toEntryView);
  }

  /** Para otros servicios (Transactions verifica propiedad y existencia antes de mover dinero). */
  async getSummary(accountId: string): Promise<AccountSummary> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    }
    return {
      accountId: account.id,
      ownerId: account.ownerId,
      currency: account.currency,
      status: account.status as AccountStatus,
    };
  }

  debit(accountId: string, data: MovementCommand): Promise<AccountMutationResult> {
    return this.applyMovement('DEBIT', accountId, data);
  }

  credit(accountId: string, data: MovementCommand): Promise<AccountMutationResult> {
    return this.applyMovement('CREDIT', accountId, data);
  }

  /**
   * Idempotencia: la entrada (cuenta, tipo, reference) es única. Un reintento de Transactions viola esa
   * restricción y se responde con el resultado actual en vez de mover el dinero dos veces.
   * La entrada y el cambio de saldo van en una sola transacción de BD: o ocurren ambos o ninguno.
   */
  private async applyMovement(
    type: AccountEntryType,
    accountId: string,
    data: MovementCommand,
  ): Promise<AccountMutationResult> {
    const { amount, currency, reference: idempotencyKey } = data;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await tx.account.findUnique({ where: { id: accountId } });
        if (!account) {
          throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
        }
        this.validateAccount(account, currency);

        await tx.accountEntry.create({ data: { accountId, type, amount, idempotencyKey } });

        const { guard, change } = BALANCE_RULES[type](amount);
        const result = await tx.account.updateMany({
          where: { id: accountId, currency, status: 'ACTIVE', ...guard },
          data: change,
        });

        if (result.count === 0) {
          throw new ConflictException(
            type === 'DEBIT'
              ? { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' }
              : { code: 'ACCOUNT_INACTIVE', message: 'Account is not active' },
          );
        }

        return this.toMutationResult(tx, accountId);
      });
    } catch (error) {
      return this.handleDuplicateMovement(error, accountId, type, idempotencyKey, amount);
    }
  }

  private async toMutationResult(
    tx: Prisma.TransactionClient | PrismaService,
    accountId: string,
  ): Promise<AccountMutationResult> {
    const account = await tx.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { balance: true },
    });
    return { accountId, balanceAfter: account.balance };
  }

  private async handleDuplicateMovement(
    error: unknown,
    accountId: string,
    type: AccountEntryType,
    idempotencyKey: string,
    amount: number,
  ): Promise<AccountMutationResult> {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }

    const existingEntry = await this.prisma.accountEntry.findUnique({
      where: {
        accountId_type_idempotencyKey: { accountId, type, idempotencyKey },
      },
    });

    if (!existingEntry) {
      throw error;
    }
    if (existingEntry.amount !== amount) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Idempotency key was already used with a different amount',
      });
    }

    return this.toMutationResult(this.prisma, accountId);
  }

  private validateAccount(account: Account, currency: string) {
    if (account.currency !== currency) {
      throw new BadRequestException({
        code: 'CURRENCY_MISMATCH',
        message: 'Account currency does not match the requested currency',
      });
    }
    if (account.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Account inactive',
      });
    }
  }
}
