import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';

/**
 * JWT payload structure.
 * This is what gets encoded into the token.
 */
export interface JwtPayload {
  sub: string; // Agent ID
  clientId: string; // Client ID for reference
  tenantId: string; // Tenant ID for authorization
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validate agent credentials and issue JWT.
   *
   * OAuth2 Client Credentials Flow:
   * 1. Agent sends client_id + client_secret
   * 2. We look up agent by client_id
   * 3. We verify the secret using bcrypt
   * 4. We issue a JWT token
   */
  async validateAndIssueToken(dto: TokenRequestDto): Promise<TokenResponseDto> {
    // Find agent by client_id
    const agent = await this.prisma.agent.findUnique({
      where: { clientId: dto.client_id },
    });

    if (!agent) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    // Check if agent is active
    if (!agent.isActive) {
      throw new UnauthorizedException('Agent is disabled');
    }

    // Verify the secret (bcrypt comparison)
    const isSecretValid = await bcrypt.compare(
      dto.client_secret,
      agent.clientSecret,
    );

    if (!isSecretValid) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    // Update last seen timestamp
    await this.prisma.agent.update({
      where: { id: agent.id },
      data: { lastSeenAt: new Date() },
    });

    // Create JWT payload
    const payload: JwtPayload = {
      sub: agent.id,
      clientId: agent.clientId,
      tenantId: agent.tenantId,
    };

    // Sign and return token
    const accessToken = this.jwtService.sign(payload);

    // Parse expiration from env (e.g., "1h" -> 3600 seconds)
    const expiresIn = this.parseExpirationToSeconds(
      process.env.JWT_EXPIRES_IN || '1h',
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
    };
  }

  /**
   * Validate JWT payload and return agent info.
   * Used by JwtStrategy to attach user to request.
   */
  async validateJwtPayload(payload: JwtPayload) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!agent || !agent.isActive) {
      throw new UnauthorizedException('Agent not found or disabled');
    }

    return {
      id: agent.id,
      clientId: agent.clientId,
      tenantId: agent.tenantId,
      name: agent.name,
      tenant: agent.tenant,
    };
  }

  /**
   * Convert duration string to seconds.
   * Examples: "1h" -> 3600, "30m" -> 1800, "7d" -> 604800
   */
  private parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }
}
