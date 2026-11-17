import { IsInt, IsPositive, IsString, Length, Max } from 'class-validator';
import { MAX_MOVEMENT_AMOUNT } from '@mini-bank/shared-contracts';

/** Campos comunes a toda operación de dinero; los DTOs concretos solo agregan las cuentas involucradas. */
export abstract class MoneyDto {
  @IsInt()
  @IsPositive()
  @Max(MAX_MOVEMENT_AMOUNT)
  amount!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;
}
