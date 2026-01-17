import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ObserverService } from './observer.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../gateway/redis.service';
import { SlackService } from '../integrations/slack/slack.service';

describe('ObserverService - Approval Workflow', () => {
  let service: ObserverService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObserverService,
        {
          provide: PrismaService,
          useValue: {
            agent: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            group: {
              findUnique: jest.fn(),
            },
            agentGroupMembership: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getConnectedAgents: jest.fn().mockResolvedValue([]),
            getSocketIdForAgent: jest.fn().mockResolvedValue(null),
            getConnectionBySocket: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: SlackService,
          useValue: {
            postMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ObserverService>(ObserverService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('approveAgent', () => {
    it('should approve PENDING agent and add to group', async () => {
      const mockPendingAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        tenantId: 'tenant-456',
        approvalStatus: 'PENDING',
        pendingGroupId: 'group-789',
      };

      const mockApprovedAgent = {
        ...mockPendingAgent,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
      };

      const mockGroup = {
        id: 'group-789',
        name: 'Test Group',
      };

      // First call to findFirst (in approveAgent check)
      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValueOnce(mockPendingAgent as any);
      // Second call to findFirst (in getAgent after approval)
      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValueOnce(mockApprovedAgent as any);

      jest.spyOn(prisma.group, 'findUnique').mockResolvedValue(mockGroup as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async () => {
        // Just return success - actual implementation happens in the transaction
        return undefined;
      });

      const result = await service.approveAgent('tenant-456', 'agent-123', 'approver-id');

      expect(result.approvalStatus).toBe('APPROVED');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should reject non-existent agent', async () => {
      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValue(null);

      await expect(
        service.approveAgent('tenant-456', 'nonexistent', 'approver-id')
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject approval of non-PENDING agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        approvalStatus: 'APPROVED', // Already approved
        tenantId: 'tenant-456',
      };

      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValue(mockAgent as any);

      await expect(
        service.approveAgent('tenant-456', 'agent-123', 'approver-id')
      ).rejects.toThrow(BadRequestException);
      expect(await service.approveAgent('tenant-456', 'agent-123', 'approver-id')
        .catch(e => e.message)).toContain('not pending');
    });

    it('should enforce tenant isolation (cannot approve other tenant agent)', async () => {
      const mockAgent = {
        id: 'agent-123',
        approvalStatus: 'PENDING',
        tenantId: 'other-tenant', // Different tenant
      };

      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValue(null); // No match for tenant-456

      await expect(
        service.approveAgent('tenant-456', 'agent-123', 'approver-id')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectAgent', () => {
    it('should reject PENDING agent and deactivate', async () => {
      const mockPendingAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        tenantId: 'tenant-456',
        approvalStatus: 'PENDING',
      };

      const mockRejectedAgent = {
        ...mockPendingAgent,
        approvalStatus: 'REJECTED',
        isActive: false,
        rejectedAt: new Date(),
      };

      // First call (in rejectAgent check)
      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValueOnce(mockPendingAgent as any);
      // Second call (in getAgent after rejection)
      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValueOnce(mockRejectedAgent as any);

      const updateSpy = jest.spyOn(prisma.agent, 'update').mockResolvedValue(mockRejectedAgent as any);

      const result = await service.rejectAgent(
        'tenant-456',
        'agent-123',
        'rejecter-id',
        { reason: 'Insufficient credentials' }
      );

      expect(result.approvalStatus).toBe('REJECTED');
      expect(result.isActive).toBe(false);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'agent-123' },
        data: expect.objectContaining({
          approvalStatus: 'REJECTED',
          isActive: false,
          rejectedAt: expect.any(Date),
          rejectedById: 'rejecter-id',
          rejectionReason: 'Insufficient credentials',
          pendingGroupId: null,
        }),
      });
    });

    it('should reject non-existent agent', async () => {
      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValue(null);

      await expect(
        service.rejectAgent('tenant-456', 'nonexistent', 'rejecter-id')
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject rejection of non-PENDING agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        approvalStatus: 'REJECTED', // Already rejected
        tenantId: 'tenant-456',
      };

      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValue(mockAgent as any);

      await expect(
        service.rejectAgent('tenant-456', 'agent-123', 'rejecter-id')
      ).rejects.toThrow(BadRequestException);
      expect(await service.rejectAgent('tenant-456', 'agent-123', 'rejecter-id')
        .catch(e => e.message)).toContain('not pending');
    });

    it('should enforce tenant isolation (cannot reject other tenant agent)', async () => {
      jest.spyOn(prisma.agent, 'findFirst').mockResolvedValue(null); // No match

      await expect(
        service.rejectAgent('tenant-456', 'agent-from-other-tenant', 'rejecter-id')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
