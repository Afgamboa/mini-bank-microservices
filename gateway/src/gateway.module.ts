import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthModule } from '@mini-bank/auth-shared';
import { AccountsController } from './controllers/accounts.controller';
import { AuthController } from './controllers/auth.controller';
import { TransactionsController } from './controllers/transactions.controller';
import { Upstreams } from './upstream/upstreams';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    JwtAuthModule,
    // Rate limiting básico (docs/03-requerimientos.md §fuera de alcance): 100 peticiones/min por IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [AuthController, AccountsController, TransactionsController],
  providers: [Upstreams, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class GatewayModule {}
