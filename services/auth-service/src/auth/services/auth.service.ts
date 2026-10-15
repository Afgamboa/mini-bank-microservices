import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';
import { UsersService } from '../../users/services/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(userData: RegisterDto) {
    // verify email user
    const existingUser = await this.usersService.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // encrypt password
    const passwordHash = await bcrypt.hash(userData.password, 10);

    return await this.usersService.create({
      email: userData.email,
      name: userData.name,
      lastname: userData.lastname,
      passwordHash,
    });
  }

  async login(data: LoginDto) {
    const user = await this.usersService.findByEmail(data.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  async getMe() {
    // Implement the logic to get the currently authenticated user's information
    // This is just a placeholder implementation
    return { message: 'Get me endpoint' };
  }
}
