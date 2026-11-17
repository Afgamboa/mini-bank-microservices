import { BadRequestException, ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { ok } from '@mini-bank/http-client';
import type { EventPublisher } from '@mini-bank/messaging';
import type { AccountsClient } from '../clients/accounts.client';
import type { PrismaService } from '../prisma/prisma.service';
import type { TransactionSagas } from '../saga/transaction-sagas';
import { TransactionService } from './transaction.service';

const user = { userId: 'user-1', email: 'u@test.com' };
const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '22222222-2222-4222-8222-222222222222';

const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'tx-1',
  accountId: A1,
  toAccountId: null,
  type: 'DEPOSIT',
  amount: 500,
  currency: 'USD',
  status: 'PENDING',
  initiatedBy: 'user-1',
  idempotencyKey: 'key-1',
  failureReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('TransactionService', () => {
  const prisma = { transaction: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
  const accounts = { getSummary: jest.fn() };
  const sagas = { deposit: { run: jest.fn() }, withdraw: { run: jest.fn() }, transfer: { run: jest.fn() } };
  const events = { publish: jest.fn() };
  let service: TransactionService;

  const depositDto = { accountId: A1, amount: 500, currency: 'USD' };
  const transferDto = { fromAccountId: A1, toAccountId: A2, amount: 500, currency: 'USD' };

  beforeEach(() => {
    jest.resetAllMocks();
    accounts.getSummary.mockResolvedValue(ok({ accountId: A1, ownerId: 'user-1', currency: 'USD', status: 'ACTIVE' }));
    prisma.transaction.findUnique.mockResolvedValue(null);
    prisma.transaction.create.mockImplementation(async ({ data }) => record(data));
    prisma.transaction.update.mockImplementation(async ({ data }) => record(data));
    service = new TransactionService(
      prisma as unknown as PrismaService,
      accounts as unknown as AccountsClient,
      sagas as unknown as TransactionSagas,
      events as unknown as EventPublisher,
    );
  });

  it('completes a deposit and hides internal fields', async () => {
    sagas.deposit.run.mockResolvedValue({ status: 'COMPLETED' });

    const result = await service.deposit(user, depositDto, 'key-1');

    expect(result).toMatchObject({ id: 'tx-1', status: 'COMPLETED' });
    expect(result).not.toHaveProperty('idempotencyKey');
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('returns the stored result on replay without running the saga again', async () => {
    prisma.transaction.findUnique.mockResolvedValue(record({ status: 'COMPLETED' }));

    const result = await service.deposit(user, depositDto, 'key-1');

    expect(result.status).toBe('COMPLETED');
    expect(sagas.deposit.run).not.toHaveBeenCalled();
    expect(accounts.getSummary).not.toHaveBeenCalled();
  });

  it('resumes a pending transaction on replay', async () => {
    prisma.transaction.findUnique.mockResolvedValue(record({ status: 'PENDING' }));
    sagas.deposit.run.mockResolvedValue({ status: 'COMPLETED' });

    await service.deposit(user, depositDto, 'key-1');

    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(sagas.deposit.run).toHaveBeenCalledTimes(1);
  });

  it('rejects an Idempotency-Key reused with a different amount', async () => {
    prisma.transaction.findUnique.mockResolvedValue(record({ amount: 999 }));

    await expect(service.deposit(user, depositDto, 'key-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('answers 404 when the account belongs to someone else', async () => {
    accounts.getSummary.mockResolvedValue(ok({ accountId: A1, ownerId: 'other', currency: 'USD', status: 'ACTIVE' }));

    await expect(service.deposit(user, depositDto, 'key-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects a transfer to the same account', async () => {
    await expect(
      service.transfer(user, { ...transferDto, toAccountId: A1 }, 'key-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks a rejected transfer as FAILED, publishes TransferFailed and returns the upstream error', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);
    prisma.transaction.create.mockImplementation(async ({ data }) =>
      record({ ...data, type: 'TRANSFER', toAccountId: A2 }),
    );
    prisma.transaction.update.mockImplementation(async ({ data }) =>
      record({ type: 'TRANSFER', toAccountId: A2, ...data }),
    );
    sagas.transfer.run.mockResolvedValue({
      status: 'FAILED',
      failedStep: 'debit-source',
      error: { status: 409, body: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' } },
    });

    await expect(service.transfer(user, transferDto, 'key-1')).rejects.toMatchObject({ status: 409 });

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: { status: 'FAILED', failureReason: 'INSUFFICIENT_FUNDS' },
    });
    expect(events.publish).toHaveBeenCalledWith(
      'TransferFailed',
      expect.objectContaining({ transactionId: 'tx-1', reason: 'INSUFFICIENT_FUNDS', initiatedBy: 'user-1' }),
    );
  });

  it('publishes TransferCompleted when a transfer succeeds', async () => {
    prisma.transaction.create.mockImplementation(async ({ data }) =>
      record({ ...data, type: 'TRANSFER', toAccountId: A2 }),
    );
    prisma.transaction.update.mockImplementation(async ({ data }) =>
      record({ type: 'TRANSFER', toAccountId: A2, ...data }),
    );
    sagas.transfer.run.mockResolvedValue({ status: 'COMPLETED' });

    await service.transfer(user, transferDto, 'key-1');

    expect(events.publish).toHaveBeenCalledWith(
      'TransferCompleted',
      expect.objectContaining({ fromAccountId: A1, toAccountId: A2, amount: 500 }),
    );
  });

  it('keeps the transaction PENDING when the outcome is unknown', async () => {
    sagas.deposit.run.mockResolvedValue({
      status: 'UNCERTAIN',
      failedStep: 'credit-account',
      error: { status: 504, body: { code: 'TIMEOUT', message: 'timeout' } },
    });

    const attempt = service.deposit(user, depositDto, 'key-1');

    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await expect(attempt).rejects.toMatchObject({ status: 504 });
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: { failureReason: 'TIMEOUT' },
    });
    expect(events.publish).not.toHaveBeenCalled();
  });
});
