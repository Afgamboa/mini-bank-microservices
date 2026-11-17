import { withRetry } from './retry';

describe('withRetry', () => {
  const noSleep = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => noSleep.mockClear());

  it('returns the first result without retrying when it is acceptable', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    const result = await withRetry(operation, { retries: 2, delayMs: 10, shouldRetry: () => false, sleep: noSleep });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries with exponential backoff until the result is acceptable', async () => {
    const operation = jest.fn().mockResolvedValueOnce('fail').mockResolvedValueOnce('fail').mockResolvedValue('ok');

    const result = await withRetry(operation, {
      retries: 3,
      delayMs: 10,
      shouldRetry: (r) => r === 'fail',
      sleep: noSleep,
    });

    expect(result).toBe('ok');
    expect(noSleep.mock.calls).toEqual([[10], [20]]);
  });

  it('gives up after the configured retries and returns the last result', async () => {
    const operation = jest.fn().mockResolvedValue('fail');

    const result = await withRetry(operation, { retries: 2, delayMs: 1, shouldRetry: () => true, sleep: noSleep });

    expect(result).toBe('fail');
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
