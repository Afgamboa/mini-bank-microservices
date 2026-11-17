import { Auth, AuthenticatedUser, CurrentUser } from '@mini-bank/auth-shared';
import { PaginationQueryDto } from '@mini-bank/shared-contracts';
import { AccountService } from '../services/account.service';
import { Controller, Body, Post, Get, Param, Query } from '@nestjs/common';
import { OpenAccountDto } from '../dto/open-account.dto';

@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Auth()
  @Post()
  // ownerId always comes from the verified JWT, never from the request body (client can't impersonate another user)
  async openAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenAccountDto) {
    return await this.accountService.openAccount(user.userId, dto.currency);
  }

  @Auth()
  @Get(':accountId')
  async getBalance(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string) {
    return await this.accountService.getBalance(user.userId, accountId);
  }

  @Auth()
  @Get(':accountId/entries')
  async listEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return await this.accountService.listEntries(user.userId, accountId, query);
  }
}
