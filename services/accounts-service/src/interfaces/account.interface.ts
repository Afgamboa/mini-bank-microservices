import { Account } from '../../generated/prisma-client';

// Pick<T, K>: solo los campos que el cliente puede fijar al crear; el resto (id, status, createdAt) lo pone la BD.
export type NewAccount = Pick<Account, 'ownerId' | 'currency' | 'balance'>;