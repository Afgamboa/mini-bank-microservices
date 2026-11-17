import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Auth } from '@mini-bank/auth-shared';
import { ForwardedHeaders } from '../common/forwarded-headers.decorator';
import { Upstreams, unwrap, withQuery } from '../upstream/upstreams';

type Headers = Record<string, string>;

@Controller('transactions')
@Auth()
export class TransactionsController {
  constructor(private readonly upstreams: Upstreams) {}

  // `Idempotency-Key` viaja en ForwardedHeaders: Transactions lo exige y valida.
  @Post('deposit')
  deposit(@Body() body: unknown, @ForwardedHeaders() headers: Headers) {
    return unwrap(this.upstreams.transactions.post('/deposit', body, { headers }));
  }

  @Post('withdraw')
  withdraw(@Body() body: unknown, @ForwardedHeaders() headers: Headers) {
    return unwrap(this.upstreams.transactions.post('/withdraw', body, { headers }));
  }

  @Post('transfer')
  transfer(@Body() body: unknown, @ForwardedHeaders() headers: Headers) {
    return unwrap(this.upstreams.transactions.post('/transfer', body, { headers }));
  }

  @Get()
  list(@Query() query: Record<string, string>, @ForwardedHeaders() headers: Headers) {
    return unwrap(this.upstreams.transactions.get(withQuery('', query), { headers }));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @ForwardedHeaders() headers: Headers) {
    return unwrap(this.upstreams.transactions.get(`/${encodeURIComponent(id)}`, { headers }));
  }
}
