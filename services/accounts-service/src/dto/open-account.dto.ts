import { IsNotEmpty, IsString, Length } from 'class-validator';

export class OpenAccountDto {
  // ISO 4217 currency codes are always 3 letters, e.g. "USD"
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  currency!: string;
}
