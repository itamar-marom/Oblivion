import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Observer API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let testAgentId: string;
  let testTenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Get the test tenant and agent (seeded)
    const tenant = await prisma.tenant.findFirst();
    const agent = await prisma.agent.findFirst({
      where: { clientId: 'observer-dashboard' },
    });

    if (!tenant || !agent) {
      throw new Error('Test data not seeded. Run: pnpm db:seed');
    }

    testTenantId = tenant.id;
    testAgentId = agent.id;

    // Authenticate to get JWT token
    // Note: Use the plain text secret, not the hashed one from DB
    const authResponse = await request(app.getHttpServer())
      .post('/auth/token')
      .send({
        client_id: 'observer-dashboard',
        client_secret: 'observer_secret',
      });

    expect(authResponse.status).toBe(200);
    accessToken = authResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /observer/stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/observer/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('connectedAgents');
      expect(response.body).toHaveProperty('totalAgents');
      expect(response.body).toHaveProperty('activeTasks');
      expect(response.body).toHaveProperty('pendingTasks');
      expect(response.body).toHaveProperty('totalGroups');
      expect(response.body).toHaveProperty('totalProjects');
      expect(typeof response.body.connectedAgents).toBe('number');
      expect(typeof response.body.totalAgents).toBe('number');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/observer/stats')
        .expect(401);
    });
  });

  describe('GET /observer/agents', () => {
    it('should return all agents with connection status', async () => {
      const response = await request(app.getHttpServer())
        .get('/observer/agents')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const agent = response.body[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('clientId');
      expect(agent).toHaveProperty('capabilities');
      expect(agent).toHaveProperty('isActive');
      expect(agent).toHaveProperty('isConnected');
      expect(agent).toHaveProperty('connectionStatus');
    });
  });

  describe('GET /observer/agents/:id', () => {
    it('should return a single agent by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/observer/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testAgentId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('clientId');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('avatarUrl');
      expect(response.body).toHaveProperty('slackUserId');
      expect(response.body).toHaveProperty('capabilities');
      expect(response.body).toHaveProperty('isConnected');
      expect(response.body).toHaveProperty('connectionStatus');
    });

    it('should return 404 for non-existent agent', async () => {
      await request(app.getHttpServer())
        .get('/observer/agents/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /observer/agents/:id', () => {
    it('should update agent profile', async () => {
      const updateData = {
        name: 'Updated Observer',
        description: 'Updated description',
        email: 'observer@test.com',
      };

      const response = await request(app.getHttpServer())
        .patch(`/observer/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
      expect(response.body.email).toBe(updateData.email);
    });

    it('should update agent capabilities', async () => {
      const updateData = {
        capabilities: ['observe', 'admin', 'test-capability'],
      };

      const response = await request(app.getHttpServer())
        .patch(`/observer/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.capabilities).toEqual(updateData.capabilities);
    });

    it('should reject invalid email', async () => {
      const updateData = {
        email: 'not-an-email',
      };

      await request(app.getHttpServer())
        .patch(`/observer/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(400);
    });

    it('should return 404 for non-existent agent', async () => {
      await request(app.getHttpServer())
        .patch('/observer/agents/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test' })
        .expect(404);
    });
  });

  describe('GET /observer/activity', () => {
    it('should return activity events', async () => {
      const response = await request(app.getHttpServer())
        .get('/observer/activity')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/observer/activity?limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /observer/tasks', () => {
    it('should return task queue grouped by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/observer/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('todo');
      expect(response.body).toHaveProperty('claimed');
      expect(response.body).toHaveProperty('inProgress');
      expect(response.body).toHaveProperty('done');
      expect(Array.isArray(response.body.todo)).toBe(true);
      expect(Array.isArray(response.body.claimed)).toBe(true);
      expect(Array.isArray(response.body.inProgress)).toBe(true);
      expect(Array.isArray(response.body.done)).toBe(true);
    });
  });
});
