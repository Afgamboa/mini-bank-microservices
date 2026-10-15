import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './jwt.strategy';

/// Reads req.user (populated by JwtStrategy.validate) instead of trusting client-supplied body fields.
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest();
  console.log(request.user);
  return request.user;
});
