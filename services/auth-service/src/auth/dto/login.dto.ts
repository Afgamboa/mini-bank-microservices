import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsNotEmpty } from "class-validator";

export class LoginDto {

   @IsEmail()
   @IsNotEmpty()
   @ApiProperty({
    description: 'Correo del usuario',
    nullable: false,
    example: 'juan123@gmail.com',
  })
  email!: string;

  @IsString({ message: 'El campo contraseña es requerido.' })
  @IsNotEmpty()
  @ApiProperty({
    description: 'Contraseña del usuario',
    nullable: false,
    example: 'password123',
  })
  password!: string;

}