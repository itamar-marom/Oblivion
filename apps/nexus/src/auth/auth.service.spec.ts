import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AuthService - OAuth2 Client Credentials', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            agent: {
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            registrationToken: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('validateAndIssueToken', () => {
    it('should issue token for valid credentials', async () => {
      const hashedSecret = await bcrypt.hash('correct-secret', 10);
      const mockAgent = {
        id: 'agent-123',
        clientId: 'test-agent',
        clientSecret: hashedSecret,
        tenantId: 'tenant-456',
        isActive: true,
        approvalStatus: 'APPROVED',
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);
      jest.spyOn(prisma.agent, 'update').mockResolvedValue(mockAgent as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-jwt-token');

      const result = await service.validateAndIssueToken({
        client_id: 'test-agent',
        client_secret: 'correct-secret',
      });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBeDefined();
      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-123' },
        data: { lastSeenAt: expect.any(Date) },
      });
    });

    it('should reject invalid clientId', async () => {
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue(null);

      await expect(
        service.validateAndIssueToken({
          client_id: 'nonexistent',
          client_secret: 'any-secret',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject invalid secret', async () => {
      const hashedSecret = await bcrypt.hash('correct-secret', 10);
      const mockAgent = {
        id: 'agent-123',
        clientId: 'test-agent',
        clientSecret: hashedSecret,
        isActive: true,
        approvalStatus: 'APPROVED',
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);

      await expect(
        service.validateAndIssueToken({
          client_id: 'test-agent',
          client_secret: 'wrong-secret',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject inactive agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        clientId: 'test-agent',
        clientSecret: 'hashed',
        isActive: false, // Deactivated
        approvalStatus: 'APPROVED',
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);

      await expect(
        service.validateAndIssueToken({
          client_id: 'test-agent',
          client_secret: 'any',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(
        await service
          .validateAndIssueToken({
            client_id: 'test-agent',
            client_secret: 'any',
          })
          .catch((e) => e.message),
      ).toContain('disabled');
    });

    it('should reject PENDING agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        clientId: 'test-agent',
        clientSecret: 'hashed',
        isActive: true,
        approvalStatus: 'PENDING',
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);

      await expect(
        service.validateAndIssueToken({
          client_id: 'test-agent',
          client_secret: 'any',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(
        await service
          .validateAndIssueToken({
            client_id: 'test-agent',
            client_secret: 'any',
          })
          .catch((e) => e.message),
      ).toContain('pending');
    });

    it('should reject REJECTED agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        clientId: 'test-agent',
        clientSecret: 'hashed',
        isActive: true,
        approvalStatus: 'REJECTED',
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);

      await expect(
        service.validateAndIssueToken({
          client_id: 'test-agent',
          client_secret: 'any',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(
        await service
          .validateAndIssueToken({
            client_id: 'test-agent',
            client_secret: 'any',
          })
          .catch((e) => e.message),
      ).toContain('rejected');
    });

    it('should create JWT with correct payload structure', async () => {
      const hashedSecret = await bcrypt.hash('secret', 10);
      const mockAgent = {
        id: 'agent-123',
        clientId: 'test-agent',
        clientSecret: hashedSecret,
        tenantId: 'tenant-456',
        isActive: true,
        approvalStatus: 'APPROVED',
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);
      jest.spyOn(prisma.agent, 'update').mockResolvedValue(mockAgent as any);

      const signSpy = jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      await service.validateAndIssueToken({
        client_id: 'test-agent',
        client_secret: 'secret',
      });

      expect(signSpy).toHaveBeenCalledWith({
        sub: 'agent-123',
        clientId: 'test-agent',
        tenantId: 'tenant-456',
      });
    });

    it('should update lastSeenAt on successful auth', async () => {
      const hashedSecret = await bcrypt.hash('secret', 10);
      const mockAgent = {
        id: 'agent-123',
        clientId: 'test-agent',
        clientSecret: hashedSecret,
        tenantId: 'tenant-456',
        isActive: true,
        approvalStatus: 'APPROVED',
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);
      const updateSpy = jest
        .spyOn(prisma.agent, 'update')
        .mockResolvedValue(mockAgent as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      await service.validateAndIssueToken({
        client_id: 'test-agent',
        client_secret: 'secret',
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'agent-123' },
        data: { lastSeenAt: expect.any(Date) },
      });
    });
  });

  describe('validateJwtPayload', () => {
    it('should return agent info for valid JWT payload', async () => {
      const mockAgent = {
        id: 'agent-123',
        clientId: 'test-agent',
        tenantId: 'tenant-456',
        name: 'Test Agent',
        isActive: true,
        approvalStatus: 'APPROVED',
        tenant: { id: 'tenant-456', name: 'Test Tenant' },
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);
      jest.spyOn(prisma.agent, 'update').mockResolvedValue(mockAgent as any);

      const result = await service.validateJwtPayload({
        sub: 'agent-123',
        clientId: 'test-agent',
        tenantId: 'tenant-456',
      });

      expect(result.id).toBe('agent-123');
      expect(result.clientId).toBe('test-agent');
      expect(result.tenantId).toBe('tenant-456');
      expect(result.name).toBe('Test Agent');
    });

    it('should reject non-existent agent', async () => {
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue(null);

      await expect(
        service.validateJwtPayload({
          sub: 'nonexistent',
          clientId: 'test',
          tenantId: 'tenant',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject inactive agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        isActive: false,
        approvalStatus: 'APPROVED',
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);

      await expect(
        service.validateJwtPayload({
          sub: 'agent-123',
          clientId: 'test',
          tenantId: 'tenant',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject non-APPROVED agent (status changed after token issued)', async () => {
      const mockAgent = {
        id: 'agent-123',
        isActive: true,
        approvalStatus: 'REJECTED', // Was approved when token issued, now rejected
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);

      await expect(
        service.validateJwtPayload({
          sub: 'agent-123',
          clientId: 'test',
          tenantId: 'tenant',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update lastSeenAt on successful validation', async () => {
      const mockAgent = {
        id: 'agent-123',
        clientId: 'test-agent',
        tenantId: 'tenant-456',
        name: 'Test Agent',
        isActive: true,
        approvalStatus: 'APPROVED',
        tenant: { id: 'tenant-456', name: 'Test Tenant' },
      };

      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(mockAgent as any);
      const updateSpy = jest
        .spyOn(prisma.agent, 'update')
        .mockResolvedValue(mockAgent as any);

      await service.validateJwtPayload({
        sub: 'agent-123',
        clientId: 'test-agent',
        tenantId: 'tenant-456',
      });

      // Update is fire-and-forget, but spy should be called
      // Give it a moment to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('registerAgent', () => {
    it('should register agent with valid token', async () => {
      const mockToken = {
        id: 'token-123',
        token: 'reg_validtoken',
        groupId: 'group-456',
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        maxUses: 10,
        usedCount: 5,
        group: {
          id: 'group-456',
          name: 'Test Group',
          tenantId: 'tenant-789',
        },
      };

      const mockCreatedAgent = {
        id: 'new-agent-123',
        name: 'New Agent',
        clientId: 'new-agent-client',
        approvalStatus: 'PENDING',
      };

      jest
        .spyOn(prisma.registrationToken, 'findUnique')
        .mockResolvedValue(mockToken as any);
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue(null); // ClientId available
      jest
        .spyOn(prisma, '$transaction')
        .mockResolvedValue([mockCreatedAgent, {}] as any);

      const result = await service.registerAgent({
        registrationToken: 'reg_validtoken',
        name: 'New Agent',
        clientId: 'new-agent-client',
        clientSecret: 'new-secret',
      });

      expect(result.id).toBe('new-agent-123');
      expect(result.approvalStatus).toBe('PENDING');
    });

    it('should reject expired registration token', async () => {
      const mockToken = {
        id: 'token-123',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        group: { tenantId: 'tenant-123' },
      };

      jest
        .spyOn(prisma.registrationToken, 'findUnique')
        .mockResolvedValue(mockToken as any);

      await expect(
        service.registerAgent({
          registrationToken: 'reg_expired',
          name: 'Agent',
          clientId: 'agent',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(
        await service
          .registerAgent({
            registrationToken: 'reg_expired',
            name: 'Agent',
            clientId: 'agent',
            clientSecret: 'secret',
          })
          .catch((e) => e.message),
      ).toContain('expired');
    });

    it('should reject exhausted registration token', async () => {
      const mockToken = {
        id: 'token-123',
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
        maxUses: 10,
        usedCount: 10, // Already at max
        group: { tenantId: 'tenant-123' },
      };

      jest
        .spyOn(prisma.registrationToken, 'findUnique')
        .mockResolvedValue(mockToken as any);

      await expect(
        service.registerAgent({
          registrationToken: 'reg_exhausted',
          name: 'Agent',
          clientId: 'agent',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(
        await service
          .registerAgent({
            registrationToken: 'reg_exhausted',
            name: 'Agent',
            clientId: 'agent',
            clientSecret: 'secret',
          })
          .catch((e) => e.message),
      ).toContain('maximum uses');
    });

    it('should reject revoked registration token', async () => {
      const mockToken = {
        id: 'token-123',
        isActive: false, // Revoked
        group: { tenantId: 'tenant-123' },
      };

      jest
        .spyOn(prisma.registrationToken, 'findUnique')
        .mockResolvedValue(mockToken as any);

      await expect(
        service.registerAgent({
          registrationToken: 'reg_revoked',
          name: 'Agent',
          clientId: 'agent',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(
        await service
          .registerAgent({
            registrationToken: 'reg_revoked',
            name: 'Agent',
            clientId: 'agent',
            clientSecret: 'secret',
          })
          .catch((e) => e.message),
      ).toContain('revoked');
    });

    it('should reject duplicate clientId', async () => {
      const mockToken = {
        id: 'token-123',
        isActive: true,
        expiresAt: null,
        maxUses: null,
        usedCount: 0,
        group: { id: 'group-1', tenantId: 'tenant-123', name: 'Group' },
        groupId: 'group-1',
      };

      const existingAgent = {
        id: 'existing-123',
        clientId: 'duplicate-client',
      };

      jest
        .spyOn(prisma.registrationToken, 'findUnique')
        .mockResolvedValue(mockToken as any);
      jest
        .spyOn(prisma.agent, 'findUnique')
        .mockResolvedValue(existingAgent as any);

      await expect(
        service.registerAgent({
          registrationToken: 'reg_valid',
          name: 'New Agent',
          clientId: 'duplicate-client',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow(ConflictException);
      expect(
        await service
          .registerAgent({
            registrationToken: 'reg_valid',
            name: 'New Agent',
            clientId: 'duplicate-client',
            clientSecret: 'secret',
          })
          .catch((e) => e.message),
      ).toContain('already exists');
    });

    it('should create agent with PENDING status and increment usage', async () => {
      const mockToken = {
        id: 'token-123',
        isActive: true,
        expiresAt: null,
        maxUses: 10,
        usedCount: 5,
        group: { id: 'group-1', tenantId: 'tenant-123', name: 'Group' },
        groupId: 'group-1',
      };

      const mockCreatedAgent = {
        id: 'agent-new',
        name: 'New Agent',
        clientId: 'new-client',
        approvalStatus: 'PENDING',
        pendingGroupId: 'group-1',
        tenantId: 'tenant-123',
      };

      jest
        .spyOn(prisma.registrationToken, 'findUnique')
        .mockResolvedValue(mockToken as any);
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(prisma, '$transaction')
        .mockResolvedValue([mockCreatedAgent, mockToken] as any);

      const result = await service.registerAgent({
        registrationToken: 'reg_valid',
        name: 'New Agent',
        clientId: 'new-client',
        clientSecret: 'secret',
      });

      expect(result.approvalStatus).toBe('PENDING');
      expect(result.id).toBe('agent-new');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
