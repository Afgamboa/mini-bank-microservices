import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthModule } from '@mini-bank/auth-shared';
import { MessagingModule } from '@mini-bank/messaging';
import { PrismaModule } from './prisma/prisma.module';
import { AccountsClient } from './clients/accounts.client';
import { TransactionSagas } from './saga/transaction-sagas';
import { TransactionService } from './services/transaction.service';
import { TransactionController } from './controllers/transaction.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtAuthModule,
    PrismaModule,
    MessagingModule.register(),
  ],
  controllers: [TransactionController],
  providers: [TransactionService, AccountsClient, TransactionSagas],
})
export class AppModule {}
