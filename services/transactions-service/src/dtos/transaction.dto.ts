import { IsUUID } from 'class-validator';
import { MoneyDto } from './money.dto';

export class TransactionDto extends MoneyDto {
  @IsUUID()
  accountId!: string;
}
