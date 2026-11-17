import { HttpException } from '@nestjs/common';
import { fail, ok } from '@mini-bank/http-client';
import { unwrap, withQuery } from './upstreams';

describe('unwrap', () => {
  it('returns the value of a successful call', async () => {
    await expect(unwrap(Promise.resolve(ok({ id: 1 })))).resolves.toEqual({ id: 1 });
  });

  it('rethrows the upstream error keeping status and code', async () => {
    const failure = { status: 409, body: { code: 'INSUFFICIENT_FUNDS', message: 'no money' } };

    const attempt = unwrap(Promise.resolve(fail(failure)));

    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await expect(attempt).rejects.toMatchObject({ status: 409, response: failure.body });
  });
});

describe('withQuery', () => {
  it('appends the query string', () => {
    expect(withQuery('/x', { page: '2', limit: '5' })).toBe('/x?page=2&limit=5');
  });

  it('leaves the path untouched when there is no query', () => {
    expect(withQuery('/x', {})).toBe('/x');
  });
});
