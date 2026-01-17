import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentGateway } from '../gateway/agent.gateway';
import { SlackService } from '../integrations/slack/slack.service';

describe('TasksService - E2E Task Workflow', () => {
  let service: TasksService;
  let prisma: PrismaService;
  let gateway: AgentGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: PrismaService,
          useValue: {
            task: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            project: {
              findUnique: jest.fn(),
            },
            agent: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: AgentGateway,
          useValue: {
            setClaimTaskHandler: jest.fn(),
            broadcastToGroup: jest.fn().mockResolvedValue(undefined),
            sendToAgent: jest.fn().mockResolvedValue(undefined),
            emitToAgents: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SlackService,
          useValue: {
            postToThread: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prisma = module.get<PrismaService>(PrismaService);
    gateway = module.get<AgentGateway>(AgentGateway);
  });

  describe('claimTask', () => {
    it('should successfully claim a TODO task', async () => {
      const mockTask = {
        id: 'task-123',
        title: 'Test Task',
        status: 'TODO',
        claimedByAgentId: null,
        projectId: 'project-456',
        project: {
          id: 'project-456',
          name: 'Test Project',
          group: {
            id: 'group-789',
            members: [
              { agentId: 'agent-123', agent: { id: 'agent-123', name: 'Test Agent', capabilities: ['test'] } },
            ],
          },
        },
      };

      const mockAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        capabilities: ['test'],
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      jest.spyOn(prisma.task, 'updateMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue(mockAgent as any);

      const result = await service.claimTask('agent-123', 'task-123');

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-123');
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'task-123',
          claimedByAgentId: null,
          status: 'TODO',
        },
        data: {
          claimedByAgentId: 'agent-123',
          claimedAt: expect.any(Date),
          status: 'CLAIMED',
        },
      });
    });

    it('should reject claim if task already claimed', async () => {
      const mockTask = {
        id: 'task-123',
        claimedByAgentId: 'other-agent',
        project: {
          group: {
            members: [{ agent: { id: 'agent-123' } }],
          },
        },
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);

      const result = await service.claimTask('agent-123', 'task-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already claimed');
    });

    it('should reject claim if task not found', async () => {
      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(null);

      const result = await service.claimTask('agent-123', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject claim if agent not in group', async () => {
      const mockTask = {
        id: 'task-123',
        claimedByAgentId: null,
        status: 'TODO',
        project: {
          group: {
            members: [
              { agent: { id: 'other-agent' } }, // Different agent
            ],
          },
        },
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);

      const result = await service.claimTask('agent-123', 'task-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not in project group');
    });

    it('should handle race condition when multiple agents claim simultaneously', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'TODO',
        claimedByAgentId: null,
        project: {
          group: {
            members: [
              { agent: { id: 'agent-1' } },
              { agent: { id: 'agent-2' } },
            ],
          },
        },
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue({ name: 'Agent' } as any);

      // First agent succeeds
      jest.spyOn(prisma.task, 'updateMany')
        .mockResolvedValueOnce({ count: 1 } as any)
        // Second agent fails (count: 0 = already claimed)
        .mockResolvedValueOnce({ count: 0 } as any);

      const [result1, result2] = await Promise.all([
        service.claimTask('agent-1', 'task-123'),
        service.claimTask('agent-2', 'task-123'),
      ]);

      // One should succeed, one should fail
      const successCount = [result1, result2].filter(r => r.success).length;
      expect(successCount).toBe(1);
    });

    it('should set claimedAt timestamp on successful claim', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'TODO',
        claimedByAgentId: null,
        project: {
          group: {
            members: [{ agent: { id: 'agent-123' } }],
          },
        },
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      const updateSpy = jest.spyOn(prisma.task, 'updateMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue({ name: 'Agent' } as any);

      await service.claimTask('agent-123', 'task-123');

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            claimedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should transition status from TODO to CLAIMED', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'TODO',
        claimedByAgentId: null,
        project: {
          group: {
            members: [{ agent: { id: 'agent-123' } }],
          },
        },
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      const updateSpy = jest.spyOn(prisma.task, 'updateMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue({ name: 'Agent' } as any);

      await service.claimTask('agent-123', 'task-123');

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CLAIMED',
          }),
        })
      );
    });
  });

  describe('updateTaskStatus', () => {
    it('should update status from CLAIMED to IN_PROGRESS', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'CLAIMED',
        claimedByAgentId: 'agent-123',
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      const updateSpy = jest.spyOn(prisma.task, 'update').mockResolvedValue({
        ...mockTask,
        status: 'IN_PROGRESS',
      } as any);

      const result = await service.updateTaskStatus('agent-123', 'task-123', 'IN_PROGRESS');

      expect(result.status).toBe('IN_PROGRESS');
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: { status: 'IN_PROGRESS' },
      });
    });

    it('should update status from IN_PROGRESS to DONE', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'IN_PROGRESS',
        claimedByAgentId: 'agent-123',
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      jest.spyOn(prisma.task, 'update').mockResolvedValue({
        ...mockTask,
        status: 'DONE',
      } as any);

      const result = await service.updateTaskStatus('agent-123', 'task-123', 'DONE');

      expect(result.status).toBe('DONE');
    });

    it('should update status from IN_PROGRESS to BLOCKED_ON_HUMAN', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'IN_PROGRESS',
        claimedByAgentId: 'agent-123',
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      jest.spyOn(prisma.task, 'update').mockResolvedValue({
        ...mockTask,
        status: 'BLOCKED_ON_HUMAN',
      } as any);

      const result = await service.updateTaskStatus('agent-123', 'task-123', 'BLOCKED_ON_HUMAN');

      expect(result.status).toBe('BLOCKED_ON_HUMAN');
    });

    it('should reject status update if task not found', async () => {
      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(null);

      await expect(
        service.updateTaskStatus('agent-123', 'nonexistent', 'IN_PROGRESS')
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject status update from wrong agent', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'CLAIMED',
        claimedByAgentId: 'other-agent', // Different agent owns it
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);

      await expect(
        service.updateTaskStatus('agent-123', 'task-123', 'IN_PROGRESS')
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateTaskStatus('agent-123', 'task-123', 'IN_PROGRESS')
      ).rejects.toThrow('not claimed by this agent');
    });

    it('should allow same agent to update status multiple times', async () => {
      const mockTask = {
        id: 'task-123',
        claimedByAgentId: 'agent-123',
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      jest.spyOn(prisma.task, 'update')
        .mockResolvedValueOnce({ ...mockTask, status: 'IN_PROGRESS' } as any)
        .mockResolvedValueOnce({ ...mockTask, status: 'BLOCKED_ON_HUMAN' } as any)
        .mockResolvedValueOnce({ ...mockTask, status: 'IN_PROGRESS' } as any)
        .mockResolvedValueOnce({ ...mockTask, status: 'DONE' } as any);

      // Multiple status updates
      await service.updateTaskStatus('agent-123', 'task-123', 'IN_PROGRESS');
      await service.updateTaskStatus('agent-123', 'task-123', 'BLOCKED_ON_HUMAN');
      await service.updateTaskStatus('agent-123', 'task-123', 'IN_PROGRESS');
      const final = await service.updateTaskStatus('agent-123', 'task-123', 'DONE');

      expect(final.status).toBe('DONE');
    });

    it('should enforce ownership for status updates', async () => {
      const mockTask = {
        id: 'task-123',
        claimedByAgentId: 'agent-1',
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);

      // Agent 1 can update
      jest.spyOn(prisma.task, 'update').mockResolvedValue({ ...mockTask, status: 'IN_PROGRESS' } as any);
      const result1 = await service.updateTaskStatus('agent-1', 'task-123', 'IN_PROGRESS');
      expect(result1.status).toBe('IN_PROGRESS');

      // Agent 2 cannot update
      await expect(
        service.updateTaskStatus('agent-2', 'task-123', 'DONE')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow completion from any in-progress state', async () => {
      const mockTask = {
        id: 'task-123',
        claimedByAgentId: 'agent-123',
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);

      // From IN_PROGRESS → DONE
      jest.spyOn(prisma.task, 'update').mockResolvedValueOnce({ status: 'DONE' } as any);
      let result = await service.updateTaskStatus('agent-123', 'task-123', 'DONE');
      expect(result.status).toBe('DONE');

      // From BLOCKED_ON_HUMAN → DONE (should also work)
      jest.spyOn(prisma.task, 'update').mockResolvedValueOnce({ status: 'DONE' } as any);
      result = await service.updateTaskStatus('agent-123', 'task-123', 'DONE');
      expect(result.status).toBe('DONE');
    });
  });

  describe('createTask', () => {
    it('should create task with TODO status', async () => {
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        isActive: true,
        group: {
          id: 'group-456',
          members: [
            { agent: { id: 'agent-1', name: 'Agent 1' } },
          ],
        },
      };

      jest.spyOn(prisma.project, 'findUnique').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(null); // No existing task
      const createSpy = jest.spyOn(prisma.task, 'create').mockResolvedValue({
        id: 'task-new',
        status: 'TODO',
        projectId: 'project-123',
        title: 'New Task',
        priority: 2,
        createdAt: new Date(),
      } as any);

      await service.createTask({
        projectId: 'project-123',
        clickupTaskId: 'CLICK-123',
        title: 'New Task',
        priority: 2,
      });

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project-123',
          clickupTaskId: 'CLICK-123',
          title: 'New Task',
          priority: 2,
          status: 'TODO',
        }),
      });
    });

    it('should reject duplicate clickupTaskId', async () => {
      const mockProject = {
        id: 'project-123',
        isActive: true,
        group: { members: [] },
      };

      const existingTask = {
        id: 'existing-task',
        clickupTaskId: 'CLICK-123',
      };

      jest.spyOn(prisma.project, 'findUnique').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(existingTask as any);

      await expect(
        service.createTask({
          projectId: 'project-123',
          clickupTaskId: 'CLICK-123',
          title: 'Duplicate',
        })
      ).rejects.toThrow(ConflictException);
    });

  });

  describe('Concurrency - Race Conditions', () => {
    it('should use optimistic locking to prevent double-claims', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'TODO',
        claimedByAgentId: null,
        project: {
          group: {
            members: [
              { agent: { id: 'agent-1' } },
              { agent: { id: 'agent-2' } },
              { agent: { id: 'agent-3' } },
            ],
          },
        },
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue({ name: 'Agent' } as any);

      // Simulate 3 agents trying to claim simultaneously
      // Only the first updateMany should succeed (count: 1)
      jest.spyOn(prisma.task, 'updateMany')
        .mockResolvedValueOnce({ count: 1 } as any) // agent-1 succeeds
        .mockResolvedValueOnce({ count: 0 } as any) // agent-2 fails
        .mockResolvedValueOnce({ count: 0 } as any); // agent-3 fails

      const results = await Promise.all([
        service.claimTask('agent-1', 'task-123'),
        service.claimTask('agent-2', 'task-123'),
        service.claimTask('agent-3', 'task-123'),
      ]);

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(2);
    });

    it('should use WHERE clause for optimistic locking', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'TODO',
        claimedByAgentId: null,
        project: {
          group: {
            members: [{ agent: { id: 'agent-123' } }],
          },
        },
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      const updateSpy = jest.spyOn(prisma.task, 'updateMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.agent, 'findUnique').mockResolvedValue({ name: 'Agent' } as any);

      await service.claimTask('agent-123', 'task-123');

      // Verify optimistic lock: WHERE claimedByAgentId IS NULL
      expect(updateSpy).toHaveBeenCalledWith({
        where: {
          id: 'task-123',
          claimedByAgentId: null, // Optimistic lock
          status: 'TODO',
        },
        data: expect.anything(),
      });
    });

    it('should return failure when updateMany count is 0 (race condition)', async () => {
      const mockTask = {
        id: 'task-123',
        status: 'TODO',
        claimedByAgentId: null,
        project: {
          group: {
            members: [{ agent: { id: 'agent-123' } }],
          },
        },
      };

      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(mockTask as any);
      // updateMany returns count: 0 (someone else claimed it between findUnique and updateMany)
      jest.spyOn(prisma.task, 'updateMany').mockResolvedValue({ count: 0 } as any);

      const result = await service.claimTask('agent-123', 'task-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('claimed by another agent');
    });
  });
});
