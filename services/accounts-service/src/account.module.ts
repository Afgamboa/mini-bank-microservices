import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthModule } from '@mini-bank/auth-shared';
import { PrismaModule } from './prisma/prisma.module';
import { AccountController } from './controllers/account.controller';
import { AccountService } from './services/account.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
   JwtAuthModule,
   PrismaModule,
  ],
  controllers: [
    AccountController,
  ],
  providers: [
    AccountService,
  ],
})
export class AppModule {}
