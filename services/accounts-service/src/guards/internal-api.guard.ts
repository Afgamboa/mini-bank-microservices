import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const configuredKey = Buffer.from(process.env.INTERNAL_API_KEY ?? '', 'utf-8');
    const header = req.headers['x-internal-api-key'];
    if (typeof header !== 'string' || configuredKey.length === 0) {
      return false;
    }

    const providedKey = Buffer.from(header, 'utf-8');
    if (providedKey.length !== configuredKey.length) {
      return false;
    }

    return timingSafeEqual(providedKey, configuredKey);
  }
}
