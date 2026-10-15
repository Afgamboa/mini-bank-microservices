import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

/// No DB lookup here: the signature already proves the token is legit,
/// auth-service is the source of truth for identity (docs/01-analisis-dominio.md).
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; email: string }): Promise<AuthenticatedUser> {
    return { userId: payload.sub, email: payload.email }; 
  }
}
