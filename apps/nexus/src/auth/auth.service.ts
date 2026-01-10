import { Injectable, UnauthorizedException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';

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
  private readonly logger = new Logger(AuthService.name);

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

    // Check approval status
    if (agent.approvalStatus === 'PENDING') {
      throw new UnauthorizedException('Registration pending admin approval');
    }

    if (agent.approvalStatus === 'REJECTED') {
      throw new UnauthorizedException('Registration was rejected');
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
   * Also updates lastSeenAt to track agent activity.
   */
  async validateJwtPayload(payload: JwtPayload) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!agent || !agent.isActive) {
      throw new UnauthorizedException('Agent not found or disabled');
    }

    // Check approval status (in case status changed after token was issued)
    if (agent.approvalStatus !== 'APPROVED') {
      throw new UnauthorizedException('Agent is not approved');
    }

    // Update lastSeenAt on every authenticated request (fire and forget)
    this.prisma.agent.update({
      where: { id: agent.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => {
      // Ignore errors - this is best-effort tracking
    });

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

  /**
   * Register a new agent using a registration token.
   *
   * This endpoint does NOT require authentication - the registration token
   * serves as the authorization mechanism.
   *
   * Flow:
   * 1. Validate registration token (exists, active, not expired, not exhausted)
   * 2. Get group and tenant from token
   * 3. Validate clientId uniqueness
   * 4. Create agent with PENDING approval status
   * 5. Set pendingGroupId (group agent will join on approval)
   * 6. Increment token's usedCount
   */
  async registerAgent(dto: RegisterAgentDto) {
    // 1. Find and validate the registration token
    const token = await this.prisma.registrationToken.findUnique({
      where: { token: dto.registrationToken },
      include: {
        group: { select: { id: true, name: true, tenantId: true } },
      },
    });

    if (!token) {
      throw new BadRequestException('Invalid registration token');
    }

    if (!token.isActive) {
      throw new BadRequestException('Registration token has been revoked');
    }

    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new BadRequestException('Registration token has expired');
    }

    if (token.maxUses && token.usedCount >= token.maxUses) {
      throw new BadRequestException('Registration token has reached maximum uses');
    }

    // 2. Get tenant from the token's group
    const tenantId = token.group.tenantId;
    const groupId = token.groupId;
    const groupName = token.group.name;

    // 3. Check if clientId already exists (globally unique)
    const existingAgent = await this.prisma.agent.findUnique({
      where: { clientId: dto.clientId },
    });

    if (existingAgent) {
      throw new ConflictException(`Agent with clientId "${dto.clientId}" already exists`);
    }

    // 4. Hash the client secret
    const hashedSecret = await bcrypt.hash(dto.clientSecret, 10);

    // 5. Create the agent with PENDING status using a transaction
    const [agent] = await this.prisma.$transaction([
      // Create the agent
      this.prisma.agent.create({
        data: {
          tenantId,
          name: dto.name,
          clientId: dto.clientId,
          clientSecret: hashedSecret,
          description: dto.description || null,
          email: dto.email || null,
          capabilities: dto.capabilities || [],
          approvalStatus: 'PENDING',
          pendingGroupId: groupId,
          registrationTokenId: token.id,
          isActive: true,
        },
      }),
      // Increment token's usedCount
      this.prisma.registrationToken.update({
        where: { id: token.id },
        data: { usedCount: { increment: 1 } },
      }),
    ]);

    this.logger.log(
      `Agent "${agent.name}" (${agent.clientId}) registered with token for group "${groupName}". Pending approval.`,
    );

    return {
      id: agent.id,
      clientId: agent.clientId,
      name: agent.name,
      approvalStatus: agent.approvalStatus,
      pendingGroup: {
        id: groupId,
        name: groupName,
      },
      message: 'Registration submitted. Awaiting admin approval.',
    };
  }
}
