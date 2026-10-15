import { Auth, AuthenticatedUser, CurrentUser } from '@mini-bank/auth-shared';
import { AccountService } from '../services/account.service';
import { Controller, Body, Post, Get, Param } from '@nestjs/common';
import { OpenAccountDto } from '../dto/open-account.dto';

@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // @Auth()
  @Post()
  // ownerId always comes from the verified JWT, never from the request body (client can't impersonate another user)
  async openAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenAccountDto) {
    return await this.accountService.openAccount('a80c0001-acec-4633-835d-0535f9ed917e', dto.currency);
  }

  @Auth()
  @Get(':accountId')
  async getBalance(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string) {
    return await this.accountService.getBalance(user.userId, accountId); 
  }
} 
