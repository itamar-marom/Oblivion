# Security Guidelines

**Purpose**: Comprehensive security guidelines for the Oblivion monorepo covering OWASP Top 10, API security, secrets management, container security, and AI agent/MCP server security.

---

## 🛡️ Security Principles

All components in the Oblivion monorepo should follow these core security principles:

1. **Defense in Depth**: Multiple layers of security controls
2. **Principle of Least Privilege**: Minimal access rights for users, services, and processes
3. **Secure by Default**: Security enabled out of the box, not opt-in
4. **Zero Trust Architecture**: Never trust, always verify
5. **Security as Code**: Security practices integrated into development workflow

---

## 🎯 OWASP Top 10 Protection

### A01: Broken Access Control

**Prevention Strategies:**
- Implement Role-Based Access Control (RBAC) for all protected resources
- Validate JWT tokens on every protected endpoint
- Enforce authorization checks at the resource level, not just route level
- Deny by default - explicitly allow access, don't block exceptions
- Log access control failures for security monitoring

### A02: Cryptographic Failures

**Prevention Strategies:**
- **Always use HTTPS** - No exceptions for production
- Hash passwords with bcrypt (12+ rounds) or Argon2id
- Encrypt sensitive data at rest (database encryption, encrypted volumes)
- Use TLS 1.2+ for all data in transit
- Store session tokens securely with HttpOnly, Secure, and SameSite flags
- Never log, transmit, or display sensitive data in plain text

### A03: Injection

**Prevention Strategies:**
- **SQL Injection**: Use ORM parameterized queries (SQLModel, Drizzle)
- **NoSQL Injection**: Validate and sanitize all database queries
- **Command Injection**: Never pass user input to shell commands; use libraries instead
- **LDAP Injection**: Escape special characters in LDAP queries
- Validate all inputs with Pydantic (Python) or Zod (TypeScript)
- Use allowlists for acceptable input patterns

### A04: Insecure Design

**Prevention Strategies:**
- Perform threat modeling during design phase
- Document security requirements before implementation
- Implement rate limiting on all public endpoints
- Use secure design patterns (e.g., circuit breakers, bulkheads)
- Design for failure - graceful degradation over complete failure
- Separate sensitive operations from general functionality

### A05: Security Misconfiguration

**Prevention Strategies:**
- Use secure defaults in all configurations
- Remove unnecessary features, frameworks, and dependencies
- Review and harden framework security settings
- Keep all dependencies updated (automated with Dependabot/Renovate)
- Use security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Disable directory listings and debug modes in production

### A06: Vulnerable and Outdated Components

**Prevention Strategies:**
- Run `npm audit` / `yarn audit` (Node.js) and `safety check` (Python) regularly
- Enable automated dependency scanning in CI/CD (Snyk, Trivy)
- Keep lock files (`uv.lock`, `pnpm-lock.yaml`) in version control
- Monitor vulnerability databases and security advisories
- Test updates in staging before production deployment
- Remove unused dependencies

### A07: Identification and Authentication Failures

**Prevention Strategies:**
- Require strong passwords (min 12 chars, complexity requirements)
- Implement Multi-Factor Authentication (MFA) for privileged accounts
- Use secure session management with proper timeouts
- Prevent account enumeration (same error messages for invalid user/password)
- Rate limit authentication attempts
- Implement account lockout after failed attempts
- Use established authentication libraries (don't roll your own)

### A08: Software and Data Integrity Failures

**Prevention Strategies:**
- Sign commits and releases (GPG signing)
- Verify dependency integrity (lock files, checksums)
- Implement CI/CD pipeline security (signed artifacts, SBOM generation)
- Use Subresource Integrity (SRI) for CDN resources
- Perform code reviews for all changes
- Automate security testing in CI/CD

### A09: Security Logging and Monitoring Failures

**Prevention Strategies:**
- Log all authentication attempts (success and failure)
- Log authorization failures and access control violations
- Use structured logging (JSON format) for easy parsing
- **Never log sensitive data** (passwords, tokens, PII)
- Set up alerts for suspicious patterns (rapid failures, privilege escalation)
- Retain logs for minimum 90 days (compliance-dependent)
- Implement log integrity protection

### A10: Server-Side Request Forgery (SSRF)

**Prevention Strategies:**
- Validate and sanitize all URLs from user input
- Use allowlists for permitted domains/IPs
- Disable redirects or validate redirect destinations
- Implement network segmentation (block internal network access)
- Validate response types and content
- Use separate networks for external vs internal requests

---

## 🔐 API Security

### Authentication & Authorization

**Python (FastAPI):**
- Use JWT tokens with short expiration (15-60 minutes)
- Implement refresh tokens for extended sessions
- Validate tokens on every protected endpoint using dependencies
- Store API keys securely (environment variables, secret managers)
- Support OAuth 2.0 / OIDC for third-party integrations

**Node.js (Hono/Fastify):**
- Implement JWT middleware for protected routes
- Use TypeScript types for token payloads
- Validate token signatures and expiration
- Support multiple authentication methods (Bearer, API Key)

**Authorization Best Practices:**
- Check permissions at the resource level, not just endpoint level
- Implement RBAC or ABAC (Attribute-Based Access Control)
- Use scopes/permissions in JWT tokens
- Validate ownership for user-specific resources

### Rate Limiting & Throttling

**Implementation Strategies:**
- **Per-user limits**: Track authenticated user request counts
- **Per-IP limits**: Protect against anonymous abuse
- **Distributed rate limiting**: Use Redis for multi-instance coordination
- **Graceful degradation**: Return 429 Too Many Requests with Retry-After header

**Recommended Limits:**
- Authentication endpoints: 5 attempts per 15 minutes
- Public endpoints: 100 requests per minute per IP
- Authenticated endpoints: 1000 requests per hour per user
- Write operations: Lower limits than read operations

### CORS Configuration

**Secure CORS Setup:**
- Use restrictive origin allowlists (no `*` in production)
- Configure origins per environment (.env files)
- Enable credentials only when necessary
- Validate preflight requests
- Set appropriate cache durations

**Python (FastAPI):**
```python
# Example pattern - actual values from environment
allow_origins=["https://app.example.com"]
allow_credentials=True
allow_methods=["GET", "POST", "PUT", "DELETE"]
allow_headers=["Authorization", "Content-Type"]
```

**Node.js (Hono):**
```typescript
// Example pattern - actual values from environment
cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
})
```

### Input Validation

**Python (Pydantic):**
- Define strict schemas for all request bodies
- Use Pydantic validators for custom logic
- Set `max_length` on string fields
- Validate email, URL, and other formats
- Reject unknown fields (`extra="forbid"`)

**TypeScript (Zod):**
- Create Zod schemas for all inputs
- Use `.strict()` to reject unknown keys
- Validate with `.parse()` (throws) or `.safeParse()` (returns result)
- Set limits on string lengths and array sizes
- Combine with Hono/Fastify validators

**General Validation Rules:**
- Validate content-type headers
- Limit request body size (1-10MB typical)
- Sanitize file uploads (type, size, content validation)
- Reject malformed JSON/XML gracefully

### API Versioning

**Versioning Strategy:**
- Use URL path versioning: `/api/v1/`, `/api/v2/`
- Maintain backward compatibility within major versions
- Document deprecation timeline (minimum 6 months notice)
- Apply version-specific security policies
- Monitor usage of deprecated endpoints

---

## 🌐 Frontend Security (Next.js)

### XSS Prevention

**Built-in Protection:**
- React automatically escapes content (use this by default)
- **Avoid `dangerouslySetInnerHTML`** unless absolutely necessary
- If using `dangerouslySetInnerHTML`, sanitize with DOMPurify first

**Content Security Policy (CSP):**
- Implement strict CSP headers in Next.js configuration
- Disallow `unsafe-inline` and `unsafe-eval`
- Use nonces or hashes for inline scripts
- Restrict script sources to trusted domains

**Additional Measures:**
- Validate and sanitize user-generated content
- Use `.textContent` over `.innerHTML` in vanilla JS
- Escape data in URL parameters

### CSRF Protection

**Protection Mechanisms:**
- Use SameSite cookies (Strict or Lax)
- Implement CSRF tokens for state-changing operations
- Validate Origin and Referer headers
- Use double-submit cookie pattern
- Next.js API routes: verify request origin

**Cookie Security Attributes:**
```typescript
// Secure cookie configuration
Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600
```

### Client-Side Storage

**Storage Guidelines:**
- **Never store sensitive data in localStorage** (tokens, passwords, PII)
- Use secure HttpOnly cookies for session tokens
- sessionStorage is slightly better than localStorage (cleared on tab close)
- Encrypt data before storing if absolutely necessary
- Clear storage on logout

**Token Storage Best Practices:**
- JWTs: Store in HttpOnly cookies (backend sets/reads)
- Refresh tokens: Backend-only, never sent to client
- API keys: Backend environment variables only

### Third-Party Scripts

**Security Measures:**
- Use Subresource Integrity (SRI) for CDN resources
- Only load scripts from trusted CDNs
- Minimize third-party dependencies
- Review privacy policies of analytics/tracking tools
- Use `async` or `defer` for non-critical scripts
- Implement CSP to restrict script sources

---

## 🔑 Secrets Management

### Never Commit Secrets

**Prevention Measures:**
- Configure `.gitignore` to exclude `.env`, `.env.*` (except `.env.example`)
- Use pre-commit hooks to detect secrets (`detect-secrets`, `git-secrets`)
- Enable secret scanning in CI/CD (GitHub Secret Scanning, GitGuardian)
- If secrets are committed, rotate immediately and force-push (if safe)

**Detection Tools:**
- `detect-secrets` (pre-commit hook)
- `gitleaks` (CI/CD scanning)
- `trufflehog` (repository history scanning)

### Environment Variables

**Environment Setup:**
- Use `.env` files for local development (never committed)
- Create `.env.example` with dummy values as documentation
- Use cloud secret managers for production (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault)
- Load secrets at runtime, not build time

**Python (pydantic-settings):**
```python
# Pattern for environment-based configuration
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    api_key: str

    class Config:
        env_file = ".env"
```

**TypeScript:**
```typescript
// Pattern for environment validation
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  API_KEY: z.string(),
})

export const env = envSchema.parse(process.env)
```

### Development vs Production

**Environment Separation:**
- Maintain separate credentials for each environment
- Never use production credentials in development/staging
- Implement secret rotation policies (90 days recommended)
- Audit access to production secrets regularly
- Use different AWS/GCP accounts per environment

### Secret Rotation

**Rotation Strategy:**
- Automate rotation schedules (quarterly minimum)
- Support zero-downtime rotation (accept old and new keys during transition)
- Document rollback procedures
- Notify team before rotations
- Test rotation process in staging first

---

## 🐳 Container Security (Docker)

### Minimal Base Images

**Image Selection:**
- Use Alpine Linux or distroless images for minimal attack surface
- Implement multi-stage builds to exclude build tools from final image
- Remove unnecessary packages and tools (`apt-get remove`, `apk del`)
- Keep base images updated regularly

**Multi-Stage Build Example:**
```dockerfile
# Build stage
FROM python:3.12-alpine AS builder
# ... build steps ...

# Runtime stage
FROM python:3.12-alpine
COPY --from=builder /app /app
# Minimal runtime dependencies only
```

### Non-Root Users

**User Configuration:**
- Create dedicated non-root user in Dockerfile
- Drop privileges with `USER` directive
- Use read-only root filesystem where possible (`--read-only`)
- Set `--cap-drop=ALL` unless specific capabilities needed

**Dockerfile Pattern:**
```dockerfile
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser
USER appuser
```

### Image Scanning

**Scanning Tools:**
- Trivy (comprehensive, open-source)
- Grype (fast, accurate)
- Snyk Container
- Docker Scout

**CI/CD Integration:**
- Scan images in CI/CD pipeline before deployment
- Set vulnerability thresholds (fail on HIGH/CRITICAL)
- Scan regularly, not just on build (new vulnerabilities emerge)
- Generate SBOMs (Software Bill of Materials)

### Network Security

**Container Networking:**
- Use Docker networks for isolation between containers
- Expose minimal ports to host
- Use internal networks for service-to-service communication
- Implement network policies in Kubernetes

**Port Exposure:**
- Only expose necessary ports (`EXPOSE` directive)
- Use reverse proxies (nginx, Traefik) for external access
- Never expose database ports to public internet

### Secrets in Containers

**Secret Management:**
- **Never bake secrets into images** (they persist in layers)
- Use Docker secrets or Kubernetes secrets
- Mount secrets at runtime as files or environment variables
- Rotate secrets regularly
- Use secret management systems (Vault, AWS Secrets Manager)

---

## 🗄️ Database Security

### Connection Security

**Secure Connections:**
- Always use SSL/TLS for database connections
- Verify server certificates (don't disable verification)
- Use connection pooling for performance and resource management
- Implement automatic credential rotation

**Python (SQLModel/SQLAlchemy):**
```python
# SSL connection example pattern
database_url = f"postgresql+asyncpg://{user}:{password}@{host}/{db}?ssl=require"
```

**TypeScript (Drizzle):**
```typescript
// SSL connection example pattern
const db = drizzle(postgres(process.env.DATABASE_URL, { ssl: 'require' }))
```

### Query Safety

**Parameterized Queries:**
- Always use ORM parameterized queries (never string concatenation)
- Validate input before queries even with ORM
- Use stored procedures for complex operations
- Limit query complexity (max joins, subqueries)

**Safe ORM Usage:**
- Trust the ORM's query builders (SQLModel, Drizzle, Prisma)
- Don't use raw queries unless absolutely necessary
- If raw queries needed, use parameter binding

### Access Control

**Database Permissions:**
- Create separate database users per service
- Grant minimum necessary privileges (no `SELECT *` on all tables)
- Use read-only users for reporting/analytics
- Implement row-level security where appropriate
- Enable audit logging for sensitive tables

### Backup Security

**Backup Strategy:**
- Encrypt backups at rest
- Store backups in separate secure location (different region/account)
- Test restore procedures regularly (quarterly minimum)
- Implement retention policies (30-90 days typical)
- Restrict access to backups (separate permissions)

---

## 🤖 AI Agent & MCP Server Security

### Prompt Injection Prevention

**Input Sanitization:**
- Validate all user inputs before passing to LLM
- Filter special characters and control sequences
- Limit input length (token limits)
- Use separate system and user message contexts

**System Prompt Protection:**
- Don't echo system prompts in responses
- Use isolation techniques (XML tags, role separation)
- Validate outputs don't leak system instructions
- Monitor for prompt leakage attempts

**Output Validation:**
- Sanitize LLM outputs before execution
- Validate tool calls match expected schemas
- Implement content filtering (profanity, harmful content)
- Log suspicious outputs for review

### Tool Access Control

**Tool Security:**
- Maintain allowlist of approved tools
- Validate all tool parameters with strict schemas (Zod/Pydantic)
- Audit and log all tool executions
- Implement rate limiting on tool calls (prevent resource exhaustion)
- Require approval for dangerous operations (delete, modify critical data)

**Parameter Validation:**
- Define strict types for all tool parameters
- Validate file paths (prevent directory traversal)
- Sanitize system commands (or better, avoid them)
- Check permissions before tool execution

### MCP Server Security

**Server Configuration:**
- Validate all inputs from MCP clients
- Sandbox tool execution (containers, VMs, restricted permissions)
- Limit resource access (filesystem, network, CPU/memory)
- Implement authentication for MCP connections (if exposed)

**Tool Implementation:**
- Follow principle of least privilege
- Return minimal necessary data
- Log all tool invocations
- Implement timeouts to prevent hanging

### AI Model Security

**API Key Protection:**
- Store API keys in secret management systems
- Use separate keys per environment
- Implement key rotation policies
- Monitor key usage (detect compromise)

**Cost & Rate Management:**
- Set budget limits on API usage
- Implement rate limiting per user/session
- Monitor costs in real-time (alerts for anomalies)
- Use cheaper models for non-critical tasks

**PII Protection:**
- Filter PII from prompts before sending to API
- Don't log full prompts/responses (contain sensitive data)
- Implement data retention policies
- Use models with strong privacy guarantees when possible

### Agent Autonomy Limits

**Safety Guardrails:**
- Require human approval for dangerous operations
- Implement resource consumption limits (API calls, storage, compute)
- Set timeout policies (prevent infinite loops)
- Provide rollback capabilities for agent actions
- Monitor agent behavior for anomalies

---

## 💻 Secure Coding Practices

### Python (FastAPI)

**Best Practices:**
- Use type hints for all function signatures
- Validate inputs with Pydantic models
- Implement proper async/await error handling (try/except blocks)
- Use dependency injection for testability
- Follow FastAPI security best practices (OAuth2, JWT)

**Code Quality:**
- Use Ruff for linting and formatting (replaces Black, isort, flake8)
- Enable mypy strict mode for type checking
- Write comprehensive tests (pytest)
- Use `ruff check --select S` for security checks

### TypeScript (Hono/Fastify)

**Best Practices:**
- Enable TypeScript strict mode (`"strict": true`)
- Validate inputs with Zod schemas
- **Avoid `any` type** - use `unknown` or specific types
- Use exhaustive type checking (switch statements)
- Implement error handling middleware

**Code Quality:**
- Use ESLint with TypeScript rules
- Enable security plugins (`eslint-plugin-security`)
- Format with Prettier
- Write tests with Vitest

### Code Review Checklist

When reviewing code, ensure:
- [ ] **Authentication checks** present on protected endpoints
- [ ] **Authorization logic** validates user permissions correctly
- [ ] **Input validation** comprehensive (Pydantic/Zod)
- [ ] **No hardcoded secrets** (credentials, API keys)
- [ ] **SQL queries parameterized** (ORM used correctly)
- [ ] **Error handling** appropriate (no sensitive data leaks)
- [ ] **Sensitive data encrypted** (at rest and in transit)
- [ ] **Logging doesn't expose PII** (passwords, tokens, personal data)
- [ ] **Third-party dependencies vetted** (licenses, vulnerabilities)
- [ ] **CSRF protection** in place for state-changing operations

---

## 🧪 Security Testing

### Static Analysis

**Python Tools:**
- **Ruff**: Linting with security checks (`ruff check --select S`)
- **Bandit**: Security-focused static analyzer
- **Semgrep**: Custom security rules

**TypeScript Tools:**
- **ESLint**: With security plugins (`eslint-plugin-security`)
- **TypeScript**: Strict mode catches many issues
- **Semgrep**: JavaScript/TypeScript security rules

**CI/CD Integration:**
- Run static analysis on every commit
- Fail builds on security issues (HIGH/CRITICAL)
- Generate reports for review

### Dependency Scanning

**Automated Scanning:**
- `npm audit` / `yarn audit` / `pnpm audit` (JavaScript)
- `safety check` or `pip-audit` (Python)
- Enable Dependabot or Renovate for automated updates
- Use Snyk or Trivy for comprehensive scanning

**CI/CD Integration:**
- Scan dependencies on every build
- Fail on critical vulnerabilities
- Monitor new vulnerabilities daily
- Auto-generate PRs for updates (with testing)

### Dynamic Testing

**Testing Tools:**
- **OWASP ZAP**: Automated security scanning
- **Burp Suite**: Manual penetration testing
- **API Security Testing**: Automated API fuzzing
- **Penetration Testing**: Professional third-party testing (annually)

**Testing Scope:**
- Authentication and authorization flows
- Input validation and injection attacks
- Session management
- API security (rate limiting, CORS, headers)

### Security in CI/CD

**Pipeline Security:**
- Run security scans automatically (SAST, dependency scanning)
- Fail builds on critical vulnerabilities
- Scan container images before deployment
- Use secret scanning (prevent accidental commits)
- Generate and store SBOMs
- Implement code signing

---

## 🚨 Incident Response

### Detection

**Monitoring & Alerts:**
- Implement security monitoring (failed auth, privilege escalation)
- Use anomaly detection for unusual patterns
- Set alert thresholds (e.g., 10 failed logins in 5 minutes)
- Aggregate logs centrally (ELK stack, CloudWatch)
- Monitor third-party security advisories

### Response Plan

**Incident Handling:**
1. **Detect**: Identify security incident (automated or manual)
2. **Classify**: Determine severity (Critical, High, Medium, Low)
3. **Contain**: Isolate affected systems, revoke compromised credentials
4. **Investigate**: Determine root cause and scope
5. **Remediate**: Apply fixes, deploy patches
6. **Recover**: Restore services, validate security

**Communication:**
- Notify stakeholders (engineering, management, customers if needed)
- Document timeline and actions taken
- Follow escalation procedures for critical incidents

### Post-Incident

**Follow-up Actions:**
- Conduct root cause analysis (5 whys, fishbone diagram)
- Apply security patches and configuration changes
- Update documentation and runbooks
- Share learnings with team (blameless retrospective)
- Improve detection and prevention mechanisms

---

## ✅ Security Checklists

### Pre-Deployment Checklist

Before deploying any service or component:

- [ ] All secrets stored in environment variables (no hardcoded credentials)
- [ ] HTTPS enforced for all external endpoints
- [ ] Authentication implemented on all protected endpoints
- [ ] Rate limiting configured (per-user and per-IP)
- [ ] Input validation comprehensive (Pydantic/Zod)
- [ ] Error messages don't leak sensitive information
- [ ] Dependency vulnerabilities resolved (HIGH/CRITICAL)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- [ ] CORS properly configured (no wildcard origins in production)
- [ ] Logging in place (no sensitive data logged)
- [ ] Database connections use SSL/TLS
- [ ] Container images scanned (no HIGH/CRITICAL vulnerabilities)
- [ ] Backups tested (restore procedure validated)
- [ ] Monitoring and alerts configured

### Code Review Security Checklist

When reviewing code changes:

- [ ] **Authentication checks** present where required
- [ ] **Authorization logic** correct (proper permission validation)
- [ ] **Input validation** comprehensive (all user inputs validated)
- [ ] **No hardcoded secrets** (check for API keys, passwords)
- [ ] **SQL queries parameterized** (no string concatenation)
- [ ] **Error handling** appropriate (no stack traces in production)
- [ ] **Sensitive data encrypted** (passwords, tokens, PII)
- [ ] **Logging doesn't expose PII** (passwords, tokens, personal data)
- [ ] **Third-party dependencies vetted** (check licenses, vulnerabilities)
- [ ] **CSRF protection** in place (for state-changing operations)

### AI Agent Security Checklist

For AI agents and MCP servers:

- [ ] **Tool inputs validated** (Zod/Pydantic schemas)
- [ ] **Prompt injection safeguards** (input sanitization, output validation)
- [ ] **Tool execution sandboxed** (limited permissions, isolated environment)
- [ ] **Resource limits enforced** (API rate limits, cost limits)
- [ ] **Audit logging enabled** (log all tool executions)
- [ ] **API keys secured** (stored in secret manager, rotated regularly)
- [ ] **Cost limits configured** (budget alerts, usage monitoring)
- [ ] **Output validation present** (sanitize before execution)

---

## 🔍 Reporting Security Issues

### Internal Reporting

If you discover a security vulnerability:

1. **Do not disclose publicly** until fixed
2. **Report immediately** via designated security channel
3. **Include details**: Description, reproduction steps, impact assessment
4. **Classify priority**: Critical, High, Medium, Low

**Security Issue Template:**
```
**Vulnerability Type**: [e.g., SQL Injection, XSS, Authentication Bypass]
**Affected Component**: [Service/Package name and version]
**Severity**: [Critical/High/Medium/Low]
**Description**: [Detailed description of the vulnerability]
**Reproduction Steps**: [Step-by-step guide to reproduce]
**Impact**: [Potential security impact]
**Suggested Fix**: [If known]
```

**Escalation Path:**
- Low/Medium: Report to team lead, fix in next sprint
- High: Report to security team, fix within 7 days
- Critical: Immediate notification, emergency fix deployment

### External Reporting

For external security researchers:

**Contact**: security@oblivion.dev (replace with actual email)

**Responsible Disclosure:**
- Report vulnerabilities via email with detailed description
- Allow reasonable time for fix (90 days standard)
- Coordinate disclosure timeline
- Credit given to researchers (if desired)

**Bug Bounty Program** (if applicable):
- Rewards for valid security vulnerabilities
- Scope: In-scope vs out-of-scope systems
- Payout structure based on severity
- Hall of fame for contributors

---

## 📚 Additional Resources

### Security Tools

**Python:**
- [Bandit](https://github.com/PyCQA/bandit) - Security linter
- [Safety](https://github.com/pyupio/safety) - Dependency checker
- [pip-audit](https://github.com/pypa/pip-audit) - Audit Python packages

**JavaScript/TypeScript:**
- [npm audit](https://docs.npmjs.com/cli/v10/commands/npm-audit) - Dependency scanner
- [ESLint Security Plugin](https://github.com/eslint-community/eslint-plugin-security) - Security rules
- [Snyk](https://snyk.io/) - Comprehensive security platform

**Containers:**
- [Trivy](https://github.com/aquasecurity/trivy) - Container scanner
- [Grype](https://github.com/anchore/grype) - Vulnerability scanner
- [Docker Scout](https://docs.docker.com/scout/) - Docker's security tool

**Multi-Language:**
- [Semgrep](https://semgrep.dev/) - Static analysis with custom rules
- [Gitleaks](https://github.com/gitleaks/gitleaks) - Secret scanner
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) - Secret scanner

### Security Standards

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Top web application risks
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/) - API-specific risks
- [CWE Top 25](https://cwe.mitre.org/top25/) - Most dangerous software weaknesses
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework) - Security framework

### Training & Learning

- [OWASP WebGoat](https://owasp.org/www-project-webgoat/) - Security training application
- [PortSwigger Web Security Academy](https://portswigger.net/web-security) - Free security training
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) - Security quick references

---

**Last Updated**: 2026-01-02
**Maintained By**: Oblivion Security Team
**Review Frequency**: Quarterly
