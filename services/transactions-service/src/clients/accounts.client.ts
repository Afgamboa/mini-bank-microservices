import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpClient } from '@mini-bank/http-client';
import {
  AccountMutationResult,
  AccountSummary,
  CreditCommand,
  DebitCommand,
} from '@mini-bank/shared-contracts';

/**
 * Único punto de contacto con Accounts. Todo lo que cruza la red (timeout, reintentos, breaker)
 * está configurado aquí; el resto del servicio solo ve `Result<T, HttpFailure>`.
 * Los reintentos son seguros porque Accounts es idempotente por `reference`.
 */
@Injectable()
export class AccountsClient {
  private readonly http: HttpClient;

  constructor(config: ConfigService) {
    this.http = new HttpClient({
      baseUrl: `${config.getOrThrow<string>('ACCOUNTS_SERVICE_URL')}/api/internal/accounts`,
      headers: { 'x-internal-api-key': config.getOrThrow<string>('INTERNAL_API_KEY') },
      timeoutMs: 3000,
      retries: 2,
      retryDelayMs: 200,
      breaker: { failureThreshold: 5, resetTimeoutMs: 10_000 },
    });
  }

  getSummary(accountId: string) {
    return this.http.get<AccountSummary>(`/${encodeURIComponent(accountId)}`);
  }

  debit(accountId: string, command: DebitCommand) {
    return this.http.post<AccountMutationResult>(`/${encodeURIComponent(accountId)}/debit`, command);
  }

  credit(accountId: string, command: CreditCommand) {
    return this.http.post<AccountMutationResult>(`/${encodeURIComponent(accountId)}/credit`, command);
  }
}
