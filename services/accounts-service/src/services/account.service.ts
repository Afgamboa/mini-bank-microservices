import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NewAccount } from '../interfaces/account.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async openAccount(ownerId: string, currency: string) {
    try {
      const newAccount: NewAccount = {
        ownerId,
        currency,
        balance: 0,
      };
      
      const createdAccount = await this.prisma.account.create({
        data: newAccount,
      });

      return createdAccount;
    } catch (error) {
      
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Account with this owner already exists'); 
      }
      throw new Error('error');
    }
  }

  async getBalance(ownerId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: {
        ownerId,
        id: accountId,
      },
      select: {
        balance: true,
      },
    });

    // findFirst returns null both when the id doesn't exist AND when it belongs to another owner;
    // using 404 in both cases avoids leaking "this account exists but isn't yours"
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }
}
