# CI/CD Guidelines

**Purpose**: Comprehensive CI/CD guidelines for the Oblivion monorepo with component-specific workflows for independent deployment.

---

## 🎯 CI/CD Philosophy

### Monorepo Strategy

**Core Principles:**

1. **Independent Pipelines**: Each component (service, package, agent, MCP server) has its own workflow
2. **Selective Execution**: CI/CD runs only for changed components (path-based triggers)
3. **Parallel Execution**: Multiple components can be tested/deployed simultaneously
4. **Consistent Patterns**: Shared workflow structure across all component types
5. **Fast Feedback**: Optimized for speed with caching and parallelization

**Benefits:**
- Faster builds (only affected components)
- Independent deployment cycles
- Reduced blast radius (failures isolated to specific components)
- Clear ownership and accountability
- Scalable as monorepo grows

---

## 🏗️ Workflow Organization

### Directory Structure

```
.github/
├── workflows/                          # GitHub Actions workflows
│   ├── service-api.yml                 # Python FastAPI service
│   ├── service-worker.yml              # Background worker service
│   ├── service-frontend.yml            # Next.js frontend service
│   ├── package-common.yml              # Shared Python package
│   ├── package-ui.yml                  # Shared UI components
│   ├── agent-assistant.yml             # AI agent
│   ├── mcp-tools.yml                   # MCP server
│   └── shared-security.yml             # Security scanning (all components)
├── actions/                            # Reusable composite actions
│   ├── setup-python/                   # Python environment setup
│   ├── setup-node/                     # Node.js environment setup
│   ├── security-scan/                  # Security scanning
│   └── docker-build/                   # Docker build & push
└── scripts/                            # CI/CD helper scripts
    ├── detect-changes.sh               # Detect changed components
    └── notify-deployment.sh            # Deployment notifications
```

### Naming Convention

**Workflow Files:**
- Services: `service-{service-name}.yml`
- Packages: `package-{package-name}.yml`
- Agents: `agent-{agent-name}.yml`
- MCP Servers: `mcp-{server-name}.yml`
- Shared: `shared-{purpose}.yml`

---

## 🔄 Component-Specific Workflows

### Python Service CI/CD (FastAPI)

**Workflow File**: `.github/workflows/service-api.yml`

**Pipeline Stages:**

1. **Trigger Conditions**
   - Path filters: `services/api/**`
   - Branches: `main`, `develop`, PR to `main`
   - Manual dispatch (workflow_dispatch)

2. **Build & Test**
   - Setup Python 3.12+ with uv
   - Install dependencies (`uv sync`)
   - Run linting (Ruff)
   - Run type checking (mypy)
   - Run tests (pytest with coverage)
   - Upload coverage reports

3. **Security Scanning**
   - Dependency scanning (`safety check`, `pip-audit`)
   - Static analysis (Bandit, Semgrep)
   - Secret scanning
   - SAST tools

4. **Docker Build**
   - Build Docker image
   - Scan image (Trivy)
   - Tag with commit SHA and branch
   - Push to container registry (on main branch only)

5. **Deploy** (production/staging)
   - Deploy to environment (Kubernetes, ECS, Cloud Run)
   - Run smoke tests
   - Notify team (Slack, email)

**Example Workflow Structure:**

```yaml
name: Service API CI/CD

on:
  push:
    branches: [main, develop]
    paths:
      - 'services/api/**'
      - '.github/workflows/service-api.yml'
  pull_request:
    paths:
      - 'services/api/**'
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/api

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install uv
        run: pip install uv

      - name: Install dependencies
        run: uv sync --dev

      - name: Lint with Ruff
        run: uv run ruff check .

      - name: Type check with mypy
        run: uv run mypy app/

      - name: Run tests
        run: uv run pytest --cov=app --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./services/api/coverage.xml
          flags: service-api

  security:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/api

    steps:
      - uses: actions/checkout@v4

      - name: Run safety check
        run: uv run safety check

      - name: Run Bandit
        run: uv run bandit -r app/

      - name: Secret scanning
        uses: trufflesecurity/trufflehog@v3

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ secrets.REGISTRY_URL }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./services/api
          push: true
          tags: |
            ${{ secrets.REGISTRY_URL }}/api:${{ github.sha }}
            ${{ secrets.REGISTRY_URL }}/api:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ secrets.REGISTRY_URL }}/api:${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: 1

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Deploy to production
        run: |
          # Deploy logic (kubectl, helm, etc.)
          echo "Deploying to production"
```

### Node.js Service CI/CD (Hono/Fastify)

**Workflow File**: `.github/workflows/service-webhooks.yml`

**Pipeline Stages:**

1. **Trigger Conditions**
   - Path filters: `services/webhooks/**`
   - Branches: `main`, `develop`, PR to `main`

2. **Build & Test**
   - Setup Node.js 22+ with pnpm
   - Install dependencies (`pnpm install`)
   - Run linting (ESLint)
   - Run type checking (tsc)
   - Run tests (Vitest with coverage)
   - Upload coverage reports

3. **Security Scanning**
   - Dependency scanning (`pnpm audit`)
   - Static analysis (ESLint security plugin)
   - Secret scanning

4. **Docker Build & Deploy**
   - Build Docker image
   - Scan image
   - Push to registry
   - Deploy to environment

**Key Differences from Python:**
- Use `pnpm` instead of `uv`
- Use `tsc --noEmit` for type checking
- Use `vitest` for testing
- Use `pnpm audit` for dependency scanning

### Frontend CI/CD (Next.js)

**Workflow File**: `.github/workflows/service-web.yml`

**Pipeline Stages:**

1. **Trigger Conditions**
   - Path filters: `services/web/**`, `packages/ui/**`
   - Note: Includes shared UI package since frontend depends on it

2. **Build & Test**
   - Setup Node.js with pnpm
   - Install dependencies
   - Run linting (ESLint + Prettier)
   - Run type checking (tsc)
   - Run tests (Vitest)
   - Build Next.js app (`pnpm build`)
   - Upload build artifacts

3. **Preview Deployments**
   - Deploy to Vercel/Netlify preview environment (on PR)
   - Comment PR with preview URL

4. **Production Deployment**
   - Deploy to Vercel/Netlify production (on main)
   - Run Lighthouse CI for performance
   - Notify team

**Special Considerations:**
- Build time optimization (caching, incremental builds)
- Environment variables (build-time vs runtime)
- Static asset optimization
- CDN cache invalidation

### Python Package CI/CD

**Workflow File**: `.github/workflows/package-common.yml`

**Pipeline Stages:**

1. **Trigger Conditions**
   - Path filters: `packages/common/**`
   - Branches: `main`, PR to `main`, version tags (`v*`)

2. **Test**
   - Setup Python with uv
   - Install dependencies
   - Run linting (Ruff)
   - Run type checking (mypy)
   - Run tests (pytest with coverage)
   - Test across multiple Python versions (3.12, 3.13)

3. **Build**
   - Build package (`uv build`)
   - Validate package metadata
   - Check distribution files

4. **Publish**
   - Publish to PyPI (on version tag)
   - Create GitHub release
   - Update changelog

**Versioning Strategy:**
- Semantic versioning (MAJOR.MINOR.PATCH)
- Version bumps via git tags
- Automated changelog generation

### JavaScript/TypeScript Package CI/CD

**Workflow File**: `.github/workflows/package-ui.yml`

**Pipeline Stages:**

1. **Trigger Conditions**
   - Path filters: `packages/ui/**`
   - Branches: `main`, PR to `main`, version tags

2. **Test**
   - Setup Node.js with pnpm
   - Install dependencies
   - Run linting and type checking
   - Run tests
   - Build package

3. **Publish**
   - Publish to npm (on version tag)
   - Create GitHub release

### AI Agent CI/CD

**Workflow File**: `.github/workflows/agent-assistant.yml`

**Pipeline Stages:**

1. **Trigger Conditions**
   - Path filters: `agents/assistant/**`

2. **Test**
   - Setup Python with uv
   - Install dependencies
   - Run linting and type checking
   - Run agent tests (including tool validation)
   - Test agent execution in sandbox

3. **Deploy**
   - Package agent code
   - Deploy to agent runtime environment
   - Run integration tests

**Special Considerations:**
- Test agent tools independently
- Validate tool schemas
- Test with mock LLM responses
- Rate limiting tests

### MCP Server CI/CD

**Workflow File**: `.github/workflows/mcp-tools.yml`

**Pipeline Stages:**

1. **Trigger Conditions**
   - Path filters: `mcp/tools/**`

2. **Test**
   - Setup Python with uv
   - Install dependencies
   - Run linting and type checking
   - Test MCP protocol compliance
   - Test tool implementations
   - Validate resource schemas

3. **Package**
   - Create MCP server package
   - Test installation
   - Validate server startup

4. **Deploy**
   - Deploy to MCP server registry (if applicable)
   - Update documentation

---

## 🔒 Security in CI/CD

### Security Scanning Workflow

**Shared Workflow**: `.github/workflows/shared-security.yml`

**Runs on:**
- All PRs (fast checks)
- Scheduled daily (comprehensive scans)
- Manual dispatch

**Scans:**

1. **Dependency Scanning**
   - Python: `safety check`, `pip-audit`
   - JavaScript: `pnpm audit`, `npm audit`
   - Multi-language: Snyk, Dependabot

2. **Secret Scanning**
   - TruffleHog
   - GitHub Secret Scanning
   - Gitleaks

3. **Static Analysis (SAST)**
   - Python: Bandit, Semgrep
   - JavaScript: ESLint security plugin, Semgrep
   - Multi-language: CodeQL

4. **Container Scanning**
   - Trivy (vulnerabilities + misconfigurations)
   - Grype
   - Docker Scout

5. **SBOM Generation**
   - Generate Software Bill of Materials
   - Store for compliance and tracking

**Failure Handling:**
- HIGH/CRITICAL vulnerabilities: Fail build
- MEDIUM: Warning (review required)
- LOW: Informational

### Secrets Management in CI/CD

**GitHub Secrets:**
- Store sensitive credentials (API keys, tokens, passwords)
- Use environment-specific secrets
- Rotate regularly

**Secret Categories:**
- `REGISTRY_*`: Container registry credentials
- `DEPLOY_*`: Deployment credentials (Kubernetes, Cloud providers)
- `API_*`: Third-party API keys
- `NOTIFY_*`: Notification service tokens (Slack, email)

**Best Practices:**
- Use least privilege principle
- Separate secrets per environment (dev, staging, prod)
- Never log secrets
- Use GitHub Environments for deployment protection

---

## ⚡ Performance Optimization

### Caching Strategy

**Python (uv):**
```yaml
- name: Cache Python dependencies
  uses: actions/cache@v4
  with:
    path: ~/.cache/uv
    key: ${{ runner.os }}-uv-${{ hashFiles('**/uv.lock') }}
```

**Node.js (pnpm):**
```yaml
- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
```

**Docker:**
```yaml
- name: Cache Docker layers
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Path Filtering

**Selective Execution:**
```yaml
on:
  push:
    paths:
      - 'services/api/**'              # Service code
      - 'packages/common/**'           # Shared dependencies
      - '.github/workflows/service-api.yml'  # Workflow itself
```

**Ignore Patterns:**
```yaml
paths-ignore:
  - '**.md'                            # Documentation
  - 'docs/**'                          # Docs directory
  - '.github/workflows/other-*.yml'   # Other workflows
```

### Parallel Job Execution

**Matrix Strategy:**
```yaml
jobs:
  test:
    strategy:
      matrix:
        python-version: ['3.12', '3.13']
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}
```

**Concurrent Jobs:**
- Run test, lint, and security scans in parallel
- Use `needs` for dependencies between jobs
- Fail fast: Cancel other jobs if one fails

---

## 🚀 Deployment Strategies

### Environment Strategy

**Environments:**
1. **Development**: Automatic deployment on `develop` branch
2. **Staging**: Automatic deployment on `main` branch
3. **Production**: Manual approval + automatic deployment

**Environment Configuration:**
```yaml
deploy-production:
  environment:
    name: production
    url: https://api.oblivion.com
  needs: [test, security, build]
  if: github.ref == 'refs/heads/main'
```

**Protection Rules:**
- Production: Requires approval from designated reviewers
- Staging: No approval required
- Development: No approval required

### Deployment Methods

**1. Container-Based (Kubernetes, ECS, Cloud Run)**

```yaml
- name: Deploy to Kubernetes
  run: |
    kubectl set image deployment/api \
      api=${{ secrets.REGISTRY_URL }}/api:${{ github.sha }} \
      -n production
    kubectl rollout status deployment/api -n production
```

**2. Serverless (AWS Lambda, Cloud Functions)**

```yaml
- name: Deploy to Lambda
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE }}

- run: |
    aws lambda update-function-code \
      --function-name api-function \
      --image-uri ${{ secrets.REGISTRY_URL }}/api:${{ github.sha }}
```

**3. Platform-as-a-Service (Vercel, Netlify, Render)**

```yaml
- name: Deploy to Vercel
  uses: amondnet/vercel-action@v25
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
    vercel-args: '--prod'
```

### Rollback Strategy

**Automatic Rollback:**
- Health check failures after deployment
- Error rate threshold exceeded
- Response time degradation

**Manual Rollback:**
```yaml
rollback:
  runs-on: ubuntu-latest
  if: failure()
  steps:
    - name: Rollback deployment
      run: |
        kubectl rollout undo deployment/api -n production
```

---

## 📊 Monitoring & Notifications

### Status Checks

**Required Checks:**
- All tests passing
- Linting passing
- Type checking passing
- Security scans passing (HIGH/CRITICAL)
- Code coverage threshold met (80%)

**Branch Protection:**
- Require status checks before merge
- Require review approval
- Require up-to-date branch

### Notifications

**Slack Integration:**
```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "❌ Build failed: ${{ github.workflow }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Workflow:* ${{ github.workflow }}\n*Status:* Failed\n*Branch:* ${{ github.ref_name }}\n*Commit:* ${{ github.sha }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

**Email Notifications:**
- Configure in GitHub repository settings
- Notify on workflow failures
- Notify on deployment completions

---

## 🧪 Testing Strategy in CI/CD

### Test Types

**1. Unit Tests**
- Run on every commit
- Fast feedback (< 5 minutes)
- High coverage requirement (80%+)

**2. Integration Tests**
- Run on every PR
- Test component interactions
- Database, API, external service tests

**3. E2E Tests**
- Run on main branch only (slower)
- Test critical user flows
- Frontend + backend integration

**4. Performance Tests**
- Run on main branch only
- API response time benchmarks
- Load testing for high-traffic services

**5. Security Tests**
- Run on every PR (fast scans)
- Comprehensive scans daily (scheduled)
- Container scanning on image builds

### Test Matrix

**Python Services:**
```yaml
strategy:
  matrix:
    python-version: ['3.12', '3.13']
    test-suite: ['unit', 'integration']
```

**Node.js Services:**
```yaml
strategy:
  matrix:
    node-version: ['22', '23']
    os: [ubuntu-latest, macos-latest]
```

---

## 📈 Metrics & Analytics

### CI/CD Metrics to Track

**Build Metrics:**
- Build duration (target: < 10 minutes)
- Build success rate (target: > 95%)
- Time to merge (target: < 24 hours)

**Deployment Metrics:**
- Deployment frequency (target: multiple per day)
- Lead time for changes (target: < 1 hour)
- Mean time to recovery (MTTR) (target: < 30 minutes)
- Change failure rate (target: < 5%)

**Quality Metrics:**
- Test coverage (target: > 80%)
- Code review turnaround (target: < 4 hours)
- Security vulnerabilities (target: 0 HIGH/CRITICAL)

### Dashboards

**GitHub Actions Insights:**
- Workflow run history
- Success/failure rates
- Duration trends
- Cost analysis (Actions minutes)

**External Monitoring:**
- Integration with Datadog, New Relic, or Grafana
- Custom dashboards for CI/CD metrics
- Alerting on metric thresholds

---

## 🔧 Reusable Workflows & Actions

### Composite Actions

**Create reusable actions for common tasks:**

**Example: Setup Python Action**

`.github/actions/setup-python/action.yml`:

```yaml
name: Setup Python with uv
description: Sets up Python and installs dependencies with uv

inputs:
  python-version:
    description: Python version to use
    required: false
    default: '3.12'
  working-directory:
    description: Working directory
    required: true

runs:
  using: composite
  steps:
    - name: Setup Python
      uses: actions/setup-python@v5
      with:
        python-version: ${{ inputs.python-version }}

    - name: Install uv
      shell: bash
      run: pip install uv

    - name: Cache dependencies
      uses: actions/cache@v4
      with:
        path: ~/.cache/uv
        key: ${{ runner.os }}-uv-${{ hashFiles(format('{0}/**/uv.lock', inputs.working-directory)) }}

    - name: Install dependencies
      shell: bash
      working-directory: ${{ inputs.working-directory }}
      run: uv sync --dev
```

**Usage in workflows:**
```yaml
- uses: ./.github/actions/setup-python
  with:
    working-directory: services/api
```

### Reusable Workflows

**Shared workflow templates:**

`.github/workflows/reusable-python-test.yml`:

```yaml
name: Reusable Python Test

on:
  workflow_call:
    inputs:
      working-directory:
        required: true
        type: string
      python-version:
        required: false
        type: string
        default: '3.12'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/setup-python
        with:
          python-version: ${{ inputs.python-version }}
          working-directory: ${{ inputs.working-directory }}

      - name: Run tests
        working-directory: ${{ inputs.working-directory }}
        run: uv run pytest --cov --cov-report=xml
```

**Call from service workflow:**
```yaml
jobs:
  test:
    uses: ./.github/workflows/reusable-python-test.yml
    with:
      working-directory: services/api
```

---

## 📝 Best Practices

### Workflow Design

1. **Keep workflows DRY**: Use reusable workflows and composite actions
2. **Fail fast**: Run fastest checks first (linting before tests)
3. **Parallel execution**: Run independent jobs concurrently
4. **Minimal scope**: Only run workflows for changed components
5. **Clear naming**: Descriptive job and step names
6. **Timeout limits**: Set reasonable timeouts to prevent hanging
7. **Resource limits**: Use appropriate runner sizes

### Security Best Practices

1. **Least privilege**: Use minimal permissions for workflows
2. **Secrets rotation**: Rotate secrets regularly
3. **Dependency pinning**: Pin action versions (not `@main`)
4. **Code scanning**: Enable CodeQL and Dependabot
5. **Audit logs**: Review workflow run logs regularly
6. **Environment protection**: Require approvals for production

### Performance Best Practices

1. **Caching**: Cache dependencies and build artifacts
2. **Incremental builds**: Use Docker layer caching
3. **Matrix optimization**: Limit matrix dimensions
4. **Artifact management**: Clean up old artifacts
5. **Self-hosted runners**: Consider for high-volume builds

### Maintenance Best Practices

1. **Regular updates**: Update actions and dependencies monthly
2. **Workflow reviews**: Review and optimize workflows quarterly
3. **Documentation**: Keep workflow documentation up-to-date
4. **Monitoring**: Track CI/CD metrics and trends
5. **Incident response**: Document and learn from CI/CD failures

---

## 🗂️ Workflow Templates

### Quick Start Templates

**Python Service Minimal Template:**

```yaml
name: Python Service

on:
  push:
    branches: [main]
    paths: ['services/my-service/**']
  pull_request:
    paths: ['services/my-service/**']

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/my-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install uv
      - run: uv sync --dev
      - run: uv run ruff check .
      - run: uv run pytest
```

**Node.js Service Minimal Template:**

```yaml
name: Node.js Service

on:
  push:
    branches: [main]
    paths: ['services/my-service/**']
  pull_request:
    paths: ['services/my-service/**']

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/my-service
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test
```

---

## 🔄 Migration Guide

### Moving from Centralized to Component-Specific CI/CD

**Steps:**

1. **Audit existing workflows**: Identify all current CI/CD processes
2. **Map to components**: Assign each process to specific component
3. **Create component workflows**: Generate workflow files per component
4. **Add path filters**: Configure selective execution
5. **Test in parallel**: Run old and new workflows side-by-side
6. **Migrate gradually**: Move one component at a time
7. **Remove old workflows**: Delete centralized workflows once migration complete

**Validation Checklist:**
- [ ] All components have dedicated workflows
- [ ] Path filters correctly configured
- [ ] No duplicate workflow executions
- [ ] All secrets properly configured
- [ ] Deployment pipelines tested
- [ ] Rollback procedures documented
- [ ] Team trained on new workflows

---

## 📚 Additional Resources

### GitHub Actions Documentation
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Workflow syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Composite actions](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action)
- [Reusable workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)

### Security Resources
- [GitHub Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [OWASP CI/CD Security](https://owasp.org/www-project-devsecops-guideline/)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)

### Monitoring & Metrics
- [DORA Metrics](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
- [CI/CD Metrics](https://www.atlassian.com/devops/frameworks/devops-metrics)

---

**Last Updated**: 2026-01-02
**Maintained By**: Oblivion DevOps Team
**Review Frequency**: Quarterly
