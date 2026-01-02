# NestJS Backend Rules (Nexus)

**Purpose**: Guidelines for developing the Nexus backend in `apps/nexus/`

**Reference**: See [`../product/PRD.md`](../product/PRD.md) Section 2 (Core Architecture)

---

## 🎯 Tech Stack

- **Framework**: NestJS (Node.js)
- **Language**: TypeScript (Strict mode)
- **ORM**: Prisma (PostgreSQL)
- **Queue**: BullMQ (Redis-backed)
- **WebSocket**: Socket.io
- **Auth**: OAuth 2.0 Client Credentials (JWT)
- **Package Manager**: pnpm

---

## 📁 Nexus Structure

```
apps/nexus/
├── src/
│   ├── auth/           # OAuth2 Client Credentials flow
│   ├── webhooks/       # ClickUp/Slack webhook handlers
│   ├── gateway/        # WebSocket gateway (Socket.io)
│   ├── agents/         # Agent registry & management
│   ├── mappings/       # Project/Task mappings (ClickUp ↔ Slack)
│   ├── queue/          # BullMQ processors
│   ├── integrations/   # ClickUp/Slack API clients
│   ├── tools/          # Tool Gateway (secure proxy)
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma   # Database schema
├── test/               # E2E tests
└── Dockerfile
```

---

## 🔑 Key Patterns

### Module Structure
```typescript
// Standard module pattern
src/webhooks/
├── webhooks.module.ts       # @Module decorator
├── webhooks.controller.ts   # @Controller, HTTP endpoints
├── webhooks.service.ts      # @Injectable, business logic
├── dto/
│   ├── clickup-webhook.dto.ts   # class-validator DTOs
│   └── slack-event.dto.ts
├── processors/
│   ├── clickup.processor.ts     # @Processor, BullMQ consumer
│   └── slack.processor.ts
└── webhooks.service.spec.ts     # Jest unit tests
```

### Dependency Injection
```typescript
// Use DI everywhere
@Injectable()
export class WebhooksService {
  constructor(
    private prisma: PrismaService,
    private slack: SlackService,
    private clickup: ClickUpService,
    @InjectQueue('webhook-processing') private queue: Queue,
  ) {}
}
```

### WebSocket Gateway
```typescript
// Socket.io gateway pattern
@WebSocketGateway({ namespace: '/agents' })
export class AgentGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('MESSAGE_POST')
  async handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    // Handle agent message
  }

  afterInit(server: Server) {
    // Gateway initialized
  }

  handleConnection(client: Socket) {
    // Validate JWT from query params
    // Store socket_id → agent_id in Redis
  }

  handleDisconnect(client: Socket) {
    // Clean up Redis mapping
  }
}
```

### BullMQ Queue Pattern
```typescript
// Producer (enqueue webhook)
@Injectable()
export class WebhooksController {
  constructor(@InjectQueue('webhook-processing') private queue: Queue) {}

  @Post('/clickup')
  async handleClickUpWebhook(@Body() payload: any) {
    await this.queue.add('process-clickup', payload);
    return { status: 'queued' };  // Return 200 OK immediately
  }
}

// Consumer (process webhook)
@Processor('webhook-processing')
export class ClickUpProcessor {
  @Process('process-clickup')
  async processClickUp(job: Job) {
    const { taskId, description } = job.data;
    // Parse @mentions, create Slack thread, etc.
  }
}
```

### Prisma ORM
```typescript
// Service pattern
@Injectable()
export class MappingsService {
  constructor(private prisma: PrismaService) {}

  async createMapping(data: CreateMappingDto) {
    return this.prisma.projectMapping.create({
      data: {
        tenantId: data.tenantId,
        clickUpListId: data.clickUpListId,
        slackChannelId: data.slackChannelId,
      },
    });
  }

  async findByClickUpList(listId: string) {
    return this.prisma.projectMapping.findUnique({
      where: { clickUpListId: listId },
      include: { tenant: true },  // Include relations
    });
  }
}
```

---

## 🔐 Authentication

### OAuth2 Client Credentials
```typescript
// POST /auth/token
@Controller('auth')
export class AuthController {
  @Post('token')
  async getToken(@Body() dto: ClientCredentialsDto) {
    // Validate client_id + client_secret
    // Return JWT access_token
    return {
      access_token: jwt,
      token_type: 'bearer',
      expires_in: 3600,
    };
  }
}

// Auth Guard for WebSocket
export class WsJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const token = client.handshake.query.token;
    // Validate JWT
  }
}
```

---

## 🧪 Testing Rules

### Unit Tests (Jest)
```typescript
// webhooks.service.spec.ts
describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(WebhooksService);
  });

  it('should parse ClickUp webhook', () => {
    const result = service.parseClickUp(mockPayload);
    expect(result.taskId).toBe('123');
  });
});
```

### E2E Tests
```typescript
// test/e2e/webhooks.e2e-spec.ts
describe('Webhooks (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/webhooks/clickup (POST)', () => {
    return request(app.getHttpServer())
      .post('/webhooks/clickup')
      .send(mockWebhook)
      .expect(200);
  });
});
```

---

## ⚡ Performance Rules

- **Webhook Endpoints**: Return 200 OK immediately, queue for processing
- **Redis Caching**: Cache socket mappings, agent status
- **Database**: Use Prisma connection pooling (max 10 connections)
- **Async/Await**: All I/O operations must be async
- **No Blocking**: Never block the event loop (use queues for heavy work)

---

## 🔒 Security Rules

- **No `any` type**: Use strict TypeScript types
- **Validate All Inputs**: Use class-validator DTOs
- **JWT Validation**: Check token on every WebSocket handshake
- **Sanitize Webhooks**: Verify webhook signatures from ClickUp/Slack
- **Rate Limiting**: Use `@nestjs/throttler` for API endpoints
- **Secrets**: Load from environment, never hardcode

---

## 📊 Code Quality

### TypeScript Config
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  }
}
```

### ESLint Rules
- **No `any`**: Error on explicit `any`
- **No console.log**: Use Logger service
- **Naming**: camelCase for functions, PascalCase for classes
- **Imports**: Auto-sorted with prettier

---

## 🎯 Nexus-Specific Rules

### Webhook Processing
- **Immediate Response**: Enqueue to BullMQ, return 200 OK within 100ms
- **Idempotency**: Check for duplicate webhooks (store processed IDs in Redis)
- **Error Handling**: Never let webhook processing crash the server
- **Logging**: Log all webhook receipts with correlation IDs

### WebSocket Management
- **Connection Tracking**: Store `socket_id → agent_id` in Redis
- **Multi-Pod Support**: Use Redis adapter for Socket.io horizontal scaling
- **Heartbeat**: Ping every 25s, disconnect on 30s timeout
- **Reconnection**: Support automatic agent reconnection

### Integration Clients
- **ClickUp API**: Use official SDK, handle rate limits (100 req/min)
- **Slack API**: Use `@slack/web-api`, handle rate limits (tier-based)
- **Retry Logic**: Exponential backoff for failed API calls
- **Circuit Breaker**: Stop calling API if failures > 50% in 1 min

---

**Last Updated**: 2026-01-02
**Reference**: [`tasks/MASTER.md`](../tasks/MASTER.md) Phase 1 (Nexus Core)
