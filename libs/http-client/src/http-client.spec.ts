import { HttpClient } from './http-client';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('HttpClient', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => jest.restoreAllMocks());

  const client = (overrides = {}) =>
    new HttpClient({ baseUrl: 'http://svc', retryDelayMs: 0, ...overrides });

  it('returns the parsed body on success and sends JSON + headers', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { balanceAfter: 10 }));

    const result = await client({ headers: { 'x-key': 'k' } }).post('/debit', { amount: 5 });

    expect(result).toEqual({ ok: true, value: { balanceAfter: 10 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://svc/debit');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'x-key': 'k' });
    expect(init.body).toBe(JSON.stringify({ amount: 5 }));
  });

  it('keeps the remote error body and status for 4xx and does not retry', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { code: 'INSUFFICIENT_FUNDS', message: 'no' }));

    const result = await client({ retries: 2 }).post('/debit', {});

    expect(result).toEqual({
      ok: false,
      error: { status: 409, body: { code: 'INSUFFICIENT_FUNDS', message: 'no' } },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on network failure and then succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue(jsonResponse(200, { ok: 1 }));

    const result = await client({ retries: 1 }).get('/x');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports 503 SERVICE_UNAVAILABLE when the service is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await client().get('/x');

    expect(result).toMatchObject({ ok: false, error: { status: 503, body: { code: 'SERVICE_UNAVAILABLE' } } });
  });

  it('opens the circuit after repeated infrastructure failures', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const c = client({ breaker: { failureThreshold: 2, resetTimeoutMs: 60_000 } });

    await c.get('/x');
    await c.get('/x');
    const result = await c.get('/x');

    expect(result).toMatchObject({ ok: false, error: { body: { code: 'CIRCUIT_OPEN' } } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
