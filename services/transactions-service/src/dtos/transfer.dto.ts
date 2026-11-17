import { IsUUID } from 'class-validator';
import { MoneyDto } from './money.dto';

export class TransferDto extends MoneyDto {
  @IsUUID()
  fromAccountId!: string;

  @IsUUID()
  toAccountId!: string;
}
