import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

const FORWARDED = ['authorization', 'idempotency-key'] as const;

/** Cabeceras del cliente que se reenvían al servicio interno (el JWT se vuelve a verificar allí). */
export const ForwardedHeaders = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Record<string, string> => {
    const { headers } = context.switchToHttp().getRequest<Request>();
    const forwarded: Record<string, string> = {};
    for (const name of FORWARDED) {
      const value = headers[name];
      if (typeof value === 'string') forwarded[name] = value;
    }
    return forwarded;
  },
);
