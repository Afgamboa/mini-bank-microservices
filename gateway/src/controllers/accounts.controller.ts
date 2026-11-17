import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Auth } from '@mini-bank/auth-shared';
import { Page } from '@mini-bank/shared-contracts';
import { ForwardedHeaders } from '../common/forwarded-headers.decorator';
import { Upstreams, unwrap, withQuery } from '../upstream/upstreams';

const RECENT_TRANSACTIONS = 5;

@Controller('accounts')
@Auth()
export class AccountsController {
  constructor(private readonly upstreams: Upstreams) {}

  @Post()
  open(@Body() body: unknown, @ForwardedHeaders() headers: Record<string, string>) {
    return unwrap(this.upstreams.accounts.post('', body, { headers }));
  }

  @Get(':accountId')
  balance(@Param('accountId') accountId: string, @ForwardedHeaders() headers: Record<string, string>) {
    return unwrap(this.upstreams.accounts.get(`/${encodeURIComponent(accountId)}`, { headers }));
  }

  @Get(':accountId/entries')
  entries(
    @Param('accountId') accountId: string,
    @Query() query: Record<string, string>,
    @ForwardedHeaders() headers: Record<string, string>,
  ) {
    const path = withQuery(`/${encodeURIComponent(accountId)}/entries`, query);
    return unwrap(this.upstreams.accounts.get(path, { headers }));
  }

  /** Agregación (BFF): una sola llamada del cliente = saldo (Accounts) + últimas transacciones (Transactions). */
  @Get(':accountId/overview')
  async overview(@Param('accountId') accountId: string, @ForwardedHeaders() headers: Record<string, string>) {
    const [account, recent] = await Promise.all([
      unwrap(
        this.upstreams.accounts.get<{ balance: number; currency: string }>(
          `/${encodeURIComponent(accountId)}`,
          { headers },
        ),
      ),
      unwrap(
        this.upstreams.transactions.get<Page<unknown>>(
          withQuery('', { accountId, limit: String(RECENT_TRANSACTIONS) }),
          { headers },
        ),
      ),
    ]);

    return { accountId, ...account, recentTransactions: recent.items };
  }
}
