import { ConfigService } from '@nestjs/config';
import { HttpException, Injectable } from '@nestjs/common';
import { HttpClient, HttpFailure, Result } from '@mini-bank/http-client';

/** Un `HttpClient` por servicio interno. Es el único lugar del gateway que conoce sus URLs. */
@Injectable()
export class Upstreams {
  readonly auth: HttpClient;
  readonly accounts: HttpClient;
  readonly transactions: HttpClient;

  constructor(config: ConfigService) {
    const client = (urlVar: string, resource: string, timeoutMs: number) =>
      new HttpClient({
        baseUrl: `${config.getOrThrow<string>(urlVar)}/api/${resource}`,
        timeoutMs,
        breaker: { failureThreshold: 5, resetTimeoutMs: 10_000 },
      });

    this.auth = client('AUTH_SERVICE_URL', 'auth', 5000);
    this.accounts = client('ACCOUNTS_SERVICE_URL', 'accounts', 5000);
    // Una transferencia encadena varias llamadas a Accounts con sus propios timeouts y reintentos.
    this.transactions = client('TRANSACTIONS_SERVICE_URL', 'transactions', 20_000);
  }
}

/** Devuelve el valor o lanza el error del servicio interno tal cual, conservando status y `code`. */
export async function unwrap<T>(pending: Promise<Result<T, HttpFailure>>): Promise<T> {
  const result = await pending;
  if (!result.ok) throw new HttpException(result.error.body, result.error.status);
  return result.value;
}

export function withQuery(path: string, query: Record<string, string>): string {
  const search = new URLSearchParams(query).toString();
  return search ? `${path}?${search}` : path;
}
