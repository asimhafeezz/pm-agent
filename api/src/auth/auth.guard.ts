import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || '';
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing token.');
    }

    const secret = this.configService.get<string>('JWT_SECRET') || 'dev-secret';
    try {
      const decoded = jwt.verify(token, secret) as { sub: string };
      request.user = { id: decoded.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token.');
    }
  }
}
