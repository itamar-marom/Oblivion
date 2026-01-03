import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

/**
 * JWT Strategy for Passport.
 *
 * This strategy:
 * 1. Extracts JWT from Authorization header (Bearer token)
 * 2. Verifies the signature using JWT_SECRET
 * 3. Calls validate() with the decoded payload
 * 4. Attaches the result to request.user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      // Extract token from "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Reject expired tokens
      ignoreExpiration: false,

      // Secret used to verify signature
      secretOrKey: configService.get<string>('JWT_SECRET', 'fallback_secret'),
    });
  }

  /**
   * Called after JWT is verified.
   * Return value is attached to request.user
   */
  async validate(payload: JwtPayload) {
    const user = await this.authService.validateJwtPayload(payload);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
