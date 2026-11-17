import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Auth, AuthenticatedUser, CurrentUser } from '@mini-bank/auth-shared';
import { IdempotencyKey } from '../common/idempotency-key.decorator';
import { TransactionListQueryDto } from '../dtos/transaction-list-query.dto';
import { TransactionDto } from '../dtos/transaction.dto';
import { TransferDto } from '../dtos/transfer.dto';
import { TransactionService } from '../services/transaction.service';

@Controller('transactions')
@Auth()
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('deposit')
  deposit(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransactionDto, @IdempotencyKey() key: string) {
    return this.transactionService.deposit(user, dto, key);
  }

  @Post('withdraw')
  withdraw(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransactionDto, @IdempotencyKey() key: string) {
    return this.transactionService.withdraw(user, dto, key);
  }

  @Post('transfer')
  transfer(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransferDto, @IdempotencyKey() key: string) {
    return this.transactionService.transfer(user, dto, key);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: TransactionListQueryDto) {
    return this.transactionService.list(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transactionService.findOne(user, id);
  }
}
