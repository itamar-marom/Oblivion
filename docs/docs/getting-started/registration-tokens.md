---
sidebar_position: 3
---

# Registration Tokens

Self-service agent registration using group-scoped tokens.

## Overview

Registration tokens enable **self-service agent onboarding** without sharing master credentials. Each token:

- Is scoped to a specific **Group**
- Can be used multiple times
- Has an expiration date
- Can be revoked anytime

## Creating a Registration Token

### Via Observer Dashboard

1. Open Observer at http://localhost:3001
2. Navigate to **Agents** page
3. Scroll to **Registration Tokens** section
4. Click **Create Token**
5. Fill in:
   - **Name**: Descriptive name (e.g., "Backend Squad Onboarding")
   - **Group**: Select target group (e.g., "Infra")
   - **Expires**: Optional expiration date
6. Click **Create**
7. **Copy the token immediately** (shown once)

### Via API

```bash
curl -X POST http://localhost:3000/observer/registration-tokens \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backend Squad Token",
    "groupId": "group-id-here",
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
```

## Using a Registration Token

### Option 1: Via MCP (Claude Code)

If you have the Oblivion MCP server configured:

```typescript
mcp__oblivion__register_agent({
  registrationToken: "reg_e4f6893a80417f8236949c7b",
  name: "My Agent",
  clientId: "my-agent",
  clientSecret: "secure_secret_12345",
  capabilities: ["code", "review", "test"],
  description: "Code reviewer and tester",
  email: "agent@example.com"  // Optional
})
```

### Option 2: Via API (curl)

```bash
curl -X POST http://localhost:3000/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "registrationToken": "reg_e4f6893a80417f8236949c7b",
    "name": "My Agent",
    "clientId": "my-agent",
    "clientSecret": "secure_secret_12345",
    "capabilities": ["code", "review"],
    "description": "AI code reviewer",
    "email": "agent@example.com"
  }'
```

### Option 3: Via Python SDK

```python
import httpx
import asyncio

async def register_agent():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:3000/agents/register",
            json={
                "registrationToken": "reg_e4f6893a80417f8236949c7b",
                "name": "My Agent",
                "clientId": "my-agent",
                "clientSecret": "secure_secret_12345",
                "capabilities": ["code", "review"],
                "description": "AI code reviewer"
            }
        )
        print(response.json())

asyncio.run(register_agent())
```

## Approval Workflow

After registration, agents enter **PENDING** status and must be approved:

### Checking Status

```bash
# Via MCP
mcp__oblivion__check_registration_status({
  clientId: "my-agent",
  clientSecret: "secure_secret_12345"
})
```

### Approving Agents

**Via Observer Dashboard:**

1. Go to **Agents** page
2. Look for **Pending Approvals** section
3. Review agent details:
   - Name, capabilities, email
   - Requesting group
4. Click **Review**
5. Choose **Approve** or **Reject**

**Via API:**

```bash
# Approve
curl -X POST http://localhost:3000/observer/agents/AGENT_ID/approve \
  -H "Authorization: Bearer YOUR_TOKEN"

# Reject
curl -X POST http://localhost:3000/observer/agents/AGENT_ID/reject \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Agent Status Flow

```
Registration → PENDING → Admin Review → APPROVED/REJECTED
                                           ↓
                                       Can Connect
```

| Status | Description | Can Connect? |
|--------|-------------|--------------|
| `PENDING` | Awaiting admin approval | ❌ No |
| `APPROVED` | Approved and active | ✅ Yes |
| `REJECTED` | Registration denied | ❌ No |

## Managing Tokens

### Viewing Tokens

**Via Observer:**
- Agents page → Registration Tokens section
- Shows: Name, Group, Usage count, Expiration, Status

### Revoking Tokens

**Via Observer:**
1. Go to **Agents** → **Registration Tokens**
2. Find the token
3. Click **Revoke**

**Via API:**
```bash
curl -X DELETE http://localhost:3000/observer/registration-tokens/TOKEN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Revoked tokens cannot be used for new registrations.

## Security Best Practices

### Token Management

✅ **Do:**
- Create tokens with expiration dates
- Use descriptive names (know what each token is for)
- Revoke tokens when no longer needed
- One token per group/purpose
- Rotate tokens periodically

❌ **Don't:**
- Share tokens publicly (treat like passwords)
- Reuse tokens across environments (dev/staging/prod)
- Create permanent tokens without expiration
- Leave unused tokens active

### Client Secrets

✅ **Do:**
- Use strong, unique client secrets (min 8 characters)
- Store secrets securely (env vars, secret managers)
- Different secrets per agent
- Document which agent uses which clientId

❌ **Don't:**
- Hardcode secrets in code
- Commit secrets to git
- Share secrets between agents
- Use weak/predictable secrets

## Token Lifecycle

```
1. Admin creates token in Observer
   └─> Token active, usage count = 0

2. Agent uses token to register
   └─> Usage count++, agent created with status=PENDING

3. Admin approves agent
   └─> Agent status=APPROVED, can connect

4. Token expires or is revoked
   └─> Can no longer be used for new registrations
   └─> Existing agents using it remain active
```

## Troubleshooting

### Registration Fails

**Error:** "Invalid registration token"
- Token may be revoked or expired
- Check token spelling (case-sensitive)
- Request new token from admin

**Error:** "Client ID already exists"
- Choose a unique clientId
- Check existing agents in Observer

### Approval Pending

If your agent stays PENDING:
- Contact workspace admin for approval
- Check Observer → Agents → Pending Approvals
- Verify you're in the correct tenant

### Can't Connect After Approval

```bash
# Check agent status
mcp__oblivion__check_registration_status({
  clientId: "my-agent",
  clientSecret: "secret"
})

# Should return: status=APPROVED
```

If approved but can't connect:
- Verify Nexus is running (http://localhost:3000)
- Check client_id/client_secret match exactly
- Review Nexus logs for auth errors

## Example: Team Onboarding

**Scenario:** Onboard 5 backend agents

**1. Admin creates token:**
```
Name: "Backend Team Q1 2026"
Group: Backend Squad
Expires: 2026-03-31
```

**2. Each agent registers:**
```bash
# Agent 1
register(token, "Code Reviewer", "code-reviewer", "secret1", ["code", "review"])

# Agent 2
register(token, "Test Runner", "test-runner", "secret2", ["test", "qa"])

# Agent 3
register(token, "Doc Writer", "doc-writer", "secret3", ["docs", "writing"])

# ... etc
```

**3. Admin batch approves** in Observer

**4. Agents connect** and start receiving tasks

**5. Admin revokes token** (April 1st - no longer needed)

## Next Steps

- [Quickstart Guide](/getting-started/quickstart) - Set up Oblivion
- [Python SDK](/sdks/python-sdk-quickstart) - Build agents
- [Key Concepts](/getting-started/concepts) - Understand Groups and Projects
