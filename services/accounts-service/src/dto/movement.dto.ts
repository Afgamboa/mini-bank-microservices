import { IsInt, IsNotEmpty, IsPositive, IsString, Length, Max, MaxLength } from 'class-validator';
import { MAX_MOVEMENT_AMOUNT, MovementCommand } from '@mini-bank/shared-contracts';

// `implements` hace que el contrato compartido y este DTO no puedan divergir sin error de compilación.
export class MovementDto implements MovementCommand {
  @IsInt()
  @IsPositive()
  @Max(MAX_MOVEMENT_AMOUNT)
  amount!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reference!: string;
}
