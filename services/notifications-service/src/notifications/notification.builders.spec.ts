import { notificationBuilders } from './notification.builders';

describe('notificationBuilders', () => {
  const transfer = {
    transactionId: 't1',
    fromAccountId: 'a1',
    toAccountId: 'a2',
    amount: 10_050,
    currency: 'USD',
    initiatedBy: 'user-1',
  };

  it('notifies the account owner when an account is opened', () => {
    const notification = notificationBuilders.AccountOpened({ accountId: 'a1', ownerId: 'user-1', currency: 'USD' });

    expect(notification).toMatchObject({ userId: 'user-1', level: 'info' });
  });

  it('formats minor units as money on completed transfers', () => {
    const notification = notificationBuilders.TransferCompleted(transfer);

    expect(notification.userId).toBe('user-1');
    expect(notification.message).toContain('$100.50');
  });

  it('warns the initiator with the reason when a transfer fails', () => {
    const notification = notificationBuilders.TransferFailed({ ...transfer, reason: 'INSUFFICIENT_FUNDS' });

    expect(notification.level).toBe('warning');
    expect(notification.message).toContain('INSUFFICIENT_FUNDS');
  });
});
