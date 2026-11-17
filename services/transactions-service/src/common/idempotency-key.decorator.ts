import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

const MAX_KEY_LENGTH = 100;

/** Extrae y valida el header `Idempotency-Key` (RNF-02). Decorador propio = validación reutilizable y fuera del controller. */
export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const header = context.switchToHttp().getRequest<Request>().headers['idempotency-key'];
  const key = Array.isArray(header) ? header[0] : header;

  if (!key || key.length > MAX_KEY_LENGTH) {
    throw new BadRequestException(`Idempotency-Key header is required (max ${MAX_KEY_LENGTH} chars)`);
  }
  return key;
});
