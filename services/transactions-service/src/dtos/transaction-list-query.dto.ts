import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@mini-bank/shared-contracts';

export class TransactionListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
