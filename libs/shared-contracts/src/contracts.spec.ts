import { createDomainEvent, AnyDomainEvent } from './events';
import { mapPage, toPage, toSkipTake } from './pagination';

describe('createDomainEvent', () => {
  it('wraps the payload in the common envelope', () => {
    const event = createDomainEvent('AccountOpened', { accountId: 'a', ownerId: 'o', currency: 'COP' });

    expect(event.eventType).toBe('AccountOpened');
    expect(event.payload.accountId).toBe('a');
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
  });

  it('narrows the payload by eventType in the discriminated union', () => {
    const event: AnyDomainEvent = createDomainEvent('TransferFailed', {
      transactionId: 't',
      fromAccountId: 'a',
      toAccountId: 'b',
      amount: 1,
      currency: 'COP',
      initiatedBy: 'u',
      reason: 'INSUFFICIENT_FUNDS',
    });

    const reason = event.eventType === 'TransferFailed' ? event.payload.reason : undefined;

    expect(reason).toBe('INSUFFICIENT_FUNDS');
  });
});

describe('pagination helpers', () => {
  it('computes skip/take from page and limit', () => {
    expect(toSkipTake({ page: 3, limit: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it('builds a page and maps its items keeping metadata', () => {
    const page = toPage([1, 2], 10, { page: 2, limit: 2 });

    expect(mapPage(page, (n) => String(n * 2))).toEqual({ items: ['2', '4'], page: 2, limit: 2, total: 10 });
  });
});
