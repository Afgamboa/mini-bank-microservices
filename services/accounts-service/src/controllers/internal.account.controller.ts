import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MovementDto } from '../dto/movement.dto';
import { InternalApiKeyGuard } from '../guards/internal-api.guard';
import { AccountService } from '../services/account.service';

// Solo para otros servicios (x-internal-api-key). El Gateway nunca expone estas rutas.
@Controller('internal/accounts')
@UseGuards(InternalApiKeyGuard)
export class InternalAccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get(':id')
  getSummary(@Param('id') id: string) {
    return this.accountService.getSummary(id);
  }

  @Post(':id/debit')
  debit(@Param('id') id: string, @Body() dto: MovementDto) {
    return this.accountService.debit(id, dto);
  }

  @Post(':id/credit')
  credit(@Param('id') id: string, @Body() dto: MovementDto) {
    return this.accountService.credit(id, dto);
  }
}
