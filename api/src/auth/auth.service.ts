import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

type Auth0IdTokenPayload = jwt.JwtPayload & {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
};

type Auth0Jwk = {
  kid: string;
  x5c?: string[];
};

const auth0JwksCache = new Map<string, { keys: Auth0Jwk[]; fetchedAtMs: number }>();
const AUTH0_JWKS_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async register(payload: RegisterDto) {
    const existing = await this.usersRepository.findOne({ where: { email: payload.email.toLowerCase() } });
    if (existing) {
      throw new UnauthorizedException('Email already registered.');
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = this.usersRepository.create({
      email: payload.email.toLowerCase(),
      passwordHash,
      firstName: payload.firstName,
      lastName: payload.lastName,
    });
    await this.usersRepository.save(user);

    return {
      user: this.sanitizeUser(user),
      token: this.signToken(user.id),
    };
  }

  async login(payload: LoginDto) {
    const user = await this.usersRepository.findOne({ where: { email: payload.email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Password login is not available for this account.');
    }

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return {
      user: this.sanitizeUser(user),
      token: this.signToken(user.id),
    };
  }

  async loginWithAuth0Code(code: string, redirectUri: string) {
    const idToken = await this.exchangeAuth0CodeForIdToken(code, redirectUri);
    const claims = await this.verifyAuth0IdToken(idToken);
    const providerUserId = claims.sub;
    const email = claims.email?.toLowerCase();

    if (!providerUserId || !email) {
      throw new UnauthorizedException('Auth0 token is missing required user claims.');
    }

    const provider = this.parseProvider(providerUserId);
    let user = await this.usersRepository.findOne({
      where: [{ authProviderUserId: providerUserId }, { email }],
    });

    const firstName = claims.given_name || this.parseFirstName(claims.name) || 'User';
    const lastName = claims.family_name || this.parseLastName(claims.name) || 'Auth0';
    const authProviderMetadataJson = {
      issuer: claims.iss ?? null,
      emailVerified: claims.email_verified ?? null,
      picture: claims.picture ?? null,
    };

    if (!user) {
      user = this.usersRepository.create({
        email,
        firstName,
        lastName,
        passwordHash: null,
        authProvider: provider,
        authProviderUserId: providerUserId,
        authProviderMetadataJson,
        lastLoginAt: new Date(),
      });
      await this.usersRepository.save(user);
    } else {
      if (user.authProviderUserId && user.authProviderUserId !== providerUserId) {
        throw new UnauthorizedException('This email is already linked to another identity.');
      }

      user.firstName = user.firstName || firstName;
      user.lastName = user.lastName || lastName;
      user.authProvider = provider;
      user.authProviderUserId = providerUserId;
      user.authProviderMetadataJson = authProviderMetadataJson;
      user.lastLoginAt = new Date();
      await this.usersRepository.save(user);
    }

    return {
      user: this.sanitizeUser(user),
      token: this.signToken(user.id),
    };
  }

  async getUser(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    return this.sanitizeUser(user);
  }

  private signToken(userId: string) {
    const secret = this.configService.get<string>('JWT_SECRET') || 'dev-secret';
    return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' });
  }

  private async exchangeAuth0CodeForIdToken(code: string, redirectUri: string): Promise<string> {
    const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN');
    const auth0ClientId = this.configService.get<string>('AUTH0_CLIENT_ID');
    const auth0ClientSecret = this.configService.get<string>('AUTH0_CLIENT_SECRET');
    if (!auth0Domain || !auth0ClientId || !auth0ClientSecret) {
      throw new UnauthorizedException('Auth0 is not configured on the API.');
    }

    const issuerBase = auth0Domain.startsWith('http') ? auth0Domain : `https://${auth0Domain}`;
    const tokenUrl = `${issuerBase.replace(/\/$/, '')}/oauth/token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: auth0ClientId,
        client_secret: auth0ClientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok || !payload?.id_token) {
      throw new UnauthorizedException(payload?.error_description || 'Failed to exchange Auth0 authorization code.');
    }
    return payload.id_token;
  }

  private async verifyAuth0IdToken(idToken: string): Promise<Auth0IdTokenPayload> {
    const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN');
    const auth0ClientId = this.configService.get<string>('AUTH0_CLIENT_ID');
    if (!auth0Domain || !auth0ClientId) {
      throw new UnauthorizedException('Auth0 is not configured on the API.');
    }

    const issuerBase = auth0Domain.startsWith('http') ? auth0Domain : `https://${auth0Domain}`;
    const issuer = issuerBase.endsWith('/') ? issuerBase : `${issuerBase}/`;
    const decoded = jwt.decode(idToken, { complete: true });
    const kid = typeof decoded === 'object' ? decoded?.header?.kid : undefined;
    const algorithm = typeof decoded === 'object' ? decoded?.header?.alg : undefined;
    if (!kid || algorithm !== 'RS256') {
      throw new UnauthorizedException('Invalid Auth0 token header.');
    }

    const jwks = await this.getAuth0Jwks(issuer);
    const jwk = jwks.keys.find((key) => key.kid === kid);
    const certificate = jwk?.x5c?.[0];
    if (!certificate) {
      throw new UnauthorizedException('Unable to resolve signing key for Auth0 token.');
    }

    const pemCert = this.toPemCertificate(certificate);
    try {
      const payload = jwt.verify(idToken, pemCert, {
        algorithms: ['RS256'],
        issuer,
        audience: auth0ClientId,
      }) as Auth0IdTokenPayload;
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid Auth0 token.');
    }
  }

  private async getAuth0Jwks(issuer: string): Promise<{ keys: Auth0Jwk[] }> {
    const cached = auth0JwksCache.get(issuer);
    const now = Date.now();
    if (cached && now - cached.fetchedAtMs < AUTH0_JWKS_TTL_MS) {
      return { keys: cached.keys };
    }

    const response = await fetch(`${issuer}.well-known/jwks.json`);
    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok || !Array.isArray(payload?.keys)) {
      throw new UnauthorizedException('Unable to fetch Auth0 signing keys.');
    }

    auth0JwksCache.set(issuer, { keys: payload.keys, fetchedAtMs: now });
    return { keys: payload.keys };
  }

  private toPemCertificate(base64Certificate: string) {
    const formatted = base64Certificate.match(/.{1,64}/g)?.join('\n') || base64Certificate;
    return `-----BEGIN CERTIFICATE-----\n${formatted}\n-----END CERTIFICATE-----`;
  }

  private parseProvider(sub: string) {
    return sub.includes('|') ? sub.split('|')[0] : 'auth0';
  }

  private parseFirstName(fullName?: string) {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0] || '';
  }

  private parseLastName(fullName?: string) {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  private sanitizeUser(user: User) {
    const { passwordHash, authProviderMetadataJson, ...rest } = user;
    const avatarUrl =
      authProviderMetadataJson && typeof authProviderMetadataJson === 'object'
        ? ((authProviderMetadataJson as Record<string, unknown>).picture as string | null | undefined) || null
        : null;

    return {
      ...rest,
      authProviderMetadataJson,
      avatarUrl,
    };
  }
}
