import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EventPublisher } from '@mini-bank/messaging';
import { Prisma } from '../../generated/prisma-client';
import type { PrismaService } from '../prisma/prisma.service';
import { AccountService } from './account.service';

const account = (overrides: Record<string, unknown> = {}) => ({
  id: 'acc-1',
  ownerId: 'user-1',
  balance: 100,
  currency: 'USD',
  status: 'ACTIVE',
  ...overrides,
});

const duplicateKeyError = () =>
  new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });

describe('AccountService', () => {
  const tx = {
    account: { findUnique: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    accountEntry: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    account: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    accountEntry: { findUnique: jest.fn() },
  };
  const events = { publish: jest.fn() };
  let service: AccountService;

  const movement = { amount: 40, currency: 'USD', reference: 'ref-1' };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((work) => work(tx));
    tx.account.findUnique.mockResolvedValue(account());
    tx.account.updateMany.mockResolvedValue({ count: 1 });
    tx.account.findUniqueOrThrow.mockResolvedValue({ balance: 60 });
    service = new AccountService(prisma as unknown as PrismaService, events as unknown as EventPublisher);
  });

  it('debits with a balance guard in the same update', async () => {
    const result = await service.debit('acc-1', movement);

    expect(result).toEqual({ accountId: 'acc-1', balanceAfter: 60 });
    expect(tx.account.updateMany).toHaveBeenCalledWith({
      where: { id: 'acc-1', currency: 'USD', status: 'ACTIVE', balance: { gte: 40 } },
      data: { balance: { decrement: 40 } },
    });
  });

  it('credits without a balance guard', async () => {
    await service.credit('acc-1', movement);

    expect(tx.account.updateMany).toHaveBeenCalledWith({
      where: { id: 'acc-1', currency: 'USD', status: 'ACTIVE' },
      data: { balance: { increment: 40 } },
    });
  });

  it('reports INSUFFICIENT_FUNDS when the guarded update matches nothing', async () => {
    tx.account.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.debit('acc-1', movement)).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_FUNDS' },
    });
  });

  it('rejects a currency mismatch before touching the balance', async () => {
    await expect(service.debit('acc-1', { ...movement, currency: 'EUR' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.account.updateMany).not.toHaveBeenCalled();
  });

  it('answers a repeated reference with the current balance instead of moving money twice', async () => {
    prisma.$transaction.mockRejectedValue(duplicateKeyError());
    prisma.accountEntry.findUnique.mockResolvedValue({ amount: 40 });
    prisma.account.findUniqueOrThrow.mockResolvedValue({ balance: 60 });

    await expect(service.debit('acc-1', movement)).resolves.toEqual({ accountId: 'acc-1', balanceAfter: 60 });
  });

  it('rejects a repeated reference with a different amount', async () => {
    prisma.$transaction.mockRejectedValue(duplicateKeyError());
    prisma.accountEntry.findUnique.mockResolvedValue({ amount: 999 });

    await expect(service.debit('acc-1', movement)).rejects.toBeInstanceOf(ConflictException);
  });

  it('publishes AccountOpened after creating the account', async () => {
    prisma.account.create.mockResolvedValue(account());

    await service.openAccount('user-1', 'USD');

    expect(events.publish).toHaveBeenCalledWith('AccountOpened', {
      accountId: 'acc-1',
      ownerId: 'user-1',
      currency: 'USD',
    });
  });
});
