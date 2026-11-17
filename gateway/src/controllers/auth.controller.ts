import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Auth } from '@mini-bank/auth-shared';
import { ForwardedHeaders } from '../common/forwarded-headers.decorator';
import { Upstreams, unwrap } from '../upstream/upstreams';

// Más estricto que el límite global: frena la fuerza bruta de credenciales.
const CREDENTIALS_LIMIT = { default: { limit: 10, ttl: 60_000 } };

// Los cuerpos se reenvían tal cual (`unknown`): cada servicio valida su propio DTO y su 400 pasa sin cambios.
@Controller('auth')
export class AuthController {
  constructor(private readonly upstreams: Upstreams) {}

  @Post('register')
  @Throttle(CREDENTIALS_LIMIT)
  register(@Body() body: unknown) {
    return unwrap(this.upstreams.auth.post('/register', body));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(CREDENTIALS_LIMIT)
  login(@Body() body: unknown) {
    return unwrap(this.upstreams.auth.post<{ accessToken: string }>('/login', body));
  }

  @Get('me')
  @Auth()
  me(@ForwardedHeaders() headers: Record<string, string>) {
    return unwrap(this.upstreams.auth.get('/getme', { headers }));
  }
}
