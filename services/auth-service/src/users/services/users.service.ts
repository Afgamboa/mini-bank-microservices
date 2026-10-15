import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma-client';
import { PrismaService } from '../../prisma/services/prisma.service';

interface CreateUserData {
  email: string;
  name: string;
  lastname: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {
    console.log('DB URL:', process.env.DATABASE_URL);
  }

  async findByEmail(email: string) {
    return this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
  }

  async create(userData: CreateUserData) {
    try {
      const user = await this.prismaService.user.create({
        data: userData,
      });

      const userWithoutPassword = { ...user };
      delete (userWithoutPassword as { passwordHash?: unknown }).passwordHash;

      return userWithoutPassword;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }
}
