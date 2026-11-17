import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthModule } from '@mini-bank/auth-shared';
import { MessagingModule } from '@mini-bank/messaging';
import { PrismaModule } from './prisma/prisma.module';
import { AccountController } from './controllers/account.controller';
import { InternalAccountController } from './controllers/internal.account.controller';
import { AccountService } from './services/account.service';

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
  controllers: [AccountController, InternalAccountController],
  providers: [AccountService],
})
export class AppModule {}
