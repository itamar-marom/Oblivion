# Oblivion Monorepo Structure

**Reference**: See [`../product/PRD.md`](../product/PRD.md) and [`../tasks/MASTER.md`](../tasks/MASTER.md)

---

## 📁 Actual Structure

```
oblivion/
├── apps/
│   ├── nexus/          # NestJS backend (WebSocket gateway, API, webhook processor)
│   └── observer/       # Next.js dashboard (mapping UI, agent roster, live feed)
├── packages/
│   └── sdk-python/     # Python agent SDK (WebSocket client, LangGraph integration)
├── infra/
│   └── helm/           # Helm charts (umbrella chart + subcharts)
├── product/            # Product specs (PRD.md)
├── tasks/              # Implementation tasks (MASTER.md)
└── .ai/                # AI instructions (rule files)
```

---

## 🔧 Development Commands

### Nexus (NestJS Backend)
```bash
cd apps/nexus
pnpm install
pnpm start:dev          # Hot reload on :3000
pnpm test              # Jest tests
pnpm prisma:migrate:dev # Run migrations
```

### Observer (Next.js Frontend)
```bash
cd apps/observer
pnpm install
pnpm dev               # Dev server on :3000
pnpm test              # Jest + React Testing Library
pnpm test:e2e          # Playwright E2E tests
```

### SDK Python (Agent SDK)
```bash
cd packages/sdk-python
uv sync --dev
uv pip install -e .    # Editable install for agent dev
uv run pytest
```

---

## 📋 Component Rules

### Nexus Module Organization
- One module per feature: `auth/`, `webhooks/`, `gateway/`, `agents/`, `mappings/`, `queue/`, `tools/`
- Each module: `*.module.ts`, `*.service.ts`, `*.controller.ts`, `*.spec.ts`
- DTOs in `dto/` subdirectory
- BullMQ processors in `processors/` subdirectory
- Use NestJS dependency injection everywhere

### Observer Component Organization
- Server Components by default (`app/` routes)
- Client Components in `components/` with `'use client'`
- Feature components: `components/features/mappings/`, `components/features/agents/`, `components/features/live-feed/`
- UI components: `components/ui/` (shadcn/ui)
- Hooks: `lib/hooks/`
- API client: `lib/api/`

### SDK Python Organization
- Public API: `oblivion_client/__init__.py`
- Core classes: `client.py` (WebSocket), `events.py` (Pydantic models)
- Decorators: `decorators.py` (`@agent.on_task`)
- MCP integration: `tools.py`
- Private implementations: `_internal/`

---

## 🚀 CI/CD Path Triggers

### Nexus Workflow
```yaml
paths:
  - 'apps/nexus/**'
  - '.github/workflows/nexus.yml'
```

### Observer Workflow
```yaml
paths:
  - 'apps/observer/**'
  - '.github/workflows/observer.yml'
```

### SDK Python Workflow
```yaml
paths:
  - 'packages/sdk-python/**'
  - '.github/workflows/sdk-python.yml'
```

---

## 🐳 Docker Build Context

### Nexus
```bash
docker build -t nexus:latest apps/nexus
```

### Observer
```bash
docker build -t observer:latest apps/observer
```

**Note**: Dockerfiles are in app directories, not root.

---

## 📦 Workspace Dependencies

### pnpm Workspace (Node.js)
```json
// package.json (root)
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### uv Workspace (Python)
```toml
# pyproject.toml (root)
[tool.uv.workspace]
members = ["packages/*"]
```

---

## 🎯 Key Conventions

- **Monorepo Tool**: pnpm for Node.js, uv for Python
- **Package Manager**: Never use npm or yarn
- **Lock Files**: Always commit `pnpm-lock.yaml` and `uv.lock`
- **Working Directory**: Always `cd` into component directory before commands
- **Imports**: Use workspace references (`@oblivion/*` for Node, local paths for Python)

---

**Last Updated**: 2026-01-02
