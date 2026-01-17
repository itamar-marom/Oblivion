---
sidebar_position: 2
---

# Python SDK Quickstart

Build Oblivion agents in Python using the production-ready Python SDK.

## Installation

```bash
cd packages/sdk-python
uv sync
```

Or install as a dependency:

```bash
uv add git+https://github.com/itamarmarom/Oblivion.git#subdirectory=packages/sdk-python
```

## Quick Start

```python
import asyncio
from oblivion import OblivionClient

async def main():
    # Create client
    client = OblivionClient(
        nexus_url="http://localhost:3000",
        client_id="my-agent",
        client_secret="your_secret_here"
    )

    # Handle task assignments
    @client.on_task_assigned
    async def handle_task(payload):
        print(f"📋 New task: {payload.title}")
        await client.update_status("working", payload.task_id, "Starting work...")

        # Your task logic here

        await client.update_status("idle")

    # Handle context updates (Slack thread messages)
    @client.on_context_update
    async def handle_context(payload):
        print(f"💬 {payload.author}: {payload.content}")

    # Connect and run
    await client.connect()
    print("✅ Agent connected and ready!")
    await client.wait()

if __name__ == "__main__":
    asyncio.run(main())
```

## Configuration

```python
client = OblivionClient(
    nexus_url="http://localhost:3000",     # Required: Nexus API URL
    client_id="my-agent",                   # Required: OAuth2 client ID
    client_secret="secret",                 # Required: OAuth2 client secret
    auto_reconnect=True,                    # Optional: Auto-reconnect (default: True)
    reconnect_delay=5.0,                    # Optional: Reconnect delay in seconds
)
```

## Event Handlers

### Task Events

```python
@client.on_task_assigned
async def handle_new_task(payload):
    """Called when a task is assigned to this agent."""
    print(f"Task ID: {payload.task_id}")
    print(f"Title: {payload.title}")
    print(f"Priority: {payload.priority}")
    print(f"Project: {payload.project_name}")

@client.on_context_update
async def handle_thread_update(payload):
    """Called when someone posts in the task's Slack thread."""
    print(f"Author: {payload.author}")
    print(f"Message: {payload.content}")
    if payload.is_human:
        print("👤 Human responded")
```

### Connection Events

```python
@client.on_wake_up
async def handle_wake(payload):
    """Called when agent is woken up (e.g., @mention)."""
    print(f"Woken up for task: {payload.task_id}")
    print(f"Reason: {payload.reason}")
```

## Agent Operations

### Status Updates

```python
# Update agent status
await client.update_status(
    status="working",           # idle, working, error
    task_id="task-123",        # Optional: associate with task
    message="Processing data"  # Optional: status message
)

# Return to idle
await client.update_status("idle")

# Report error
await client.update_status("error", message="Database connection failed")
```

### Tool Requests

```python
# Request tool execution (if Tool Gateway implemented)
result = await client.request_tool(
    tool="github",
    action="create_pr",
    params={
        "repo": "my-org/my-repo",
        "title": "Fix bug",
        "branch": "feature-branch"
    },
    timeout=30
)

if result.success:
    print(f"PR created: {result.data}")
else:
    print(f"Error: {result.error}")
```

### Heartbeat

```python
# Manual heartbeat (automatic by default)
await client.send_heartbeat()
```

## Error Handling

```python
import asyncio
from oblivion import OblivionClient

async def main():
    client = OblivionClient(
        nexus_url="http://localhost:3000",
        client_id="my-agent",
        client_secret="secret"
    )

    try:
        await client.connect()
        await client.wait()
    except Exception as error:
        print(f"Connection failed: {error}")
        # Implement retry logic or alert

if __name__ == "__main__":
    asyncio.run(main())
```

## Complete Example

```python
import asyncio
from oblivion import OblivionClient, AgentStatus

async def main():
    client = OblivionClient(
        nexus_url="http://localhost:3000",
        client_id="code-reviewer",
        client_secret="my_secret"
    )

    @client.on_task_assigned
    async def review_code(payload):
        """Handle code review tasks."""
        print(f"📋 Reviewing: {payload.title}")

        await client.update_status(
            AgentStatus.WORKING,
            payload.task_id,
            "Starting code review..."
        )

        # Simulate code review
        await asyncio.sleep(5)
        review_result = "✅ Code looks good! No issues found."

        print(f"Review complete: {review_result}")
        await client.update_status(AgentStatus.IDLE)

    @client.on_context_update
    async def handle_feedback(payload):
        """Handle human responses in Slack."""
        if "question" in payload.content.lower():
            print(f"❓ Question from {payload.author}")
            # Process question and respond

    @client.on_wake_up
    async def handle_wake(payload):
        """Handle wake-up signals (e.g., @mentions)."""
        print(f"👋 Woken up for task: {payload.task_id}")
        print(f"Reason: {payload.reason}")

    # Connection lifecycle
    print("🔌 Connecting to Nexus...")
    await client.connect()
    print(f"✅ Connected! Agent ID: {client.agent_id}")

    # Keep running
    await client.wait()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Agent shutting down...")
```

## Available Event Types

```python
from oblivion import EventType

# Server -> Agent events
EventType.TASK_ASSIGNED      # New task for claiming
EventType.CONTEXT_UPDATE     # Thread message update
EventType.WAKE_UP           # Wake-up signal
EventType.TOOL_RESULT       # Tool execution result
EventType.HEARTBEAT         # Keep-alive ping

# Agent -> Server events
EventType.AGENT_READY       # Agent capabilities announcement
EventType.STATUS_UPDATE     # Agent status change
```

## Typed Payloads

All event payloads are Pydantic models with full type hints:

```python
from oblivion import (
    TaskAssignedPayload,
    ContextUpdatePayload,
    WakeUpPayload,
    ToolResultPayload,
    HeartbeatPayload
)

@client.on_task_assigned
async def handler(payload: TaskAssignedPayload):
    # Full IDE autocomplete and type checking
    task_id: str = payload.task_id
    title: str = payload.title
    priority: int = payload.priority
```

## Logging

The SDK uses `structlog` for structured logging:

```python
import logging

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)

# Client logs include context
# Output: event=task_assigned task_id=abc123 title="Fix bug"
```

## Auto-Reconnection

The client automatically reconnects on connection loss:

```python
client = OblivionClient(
    # ...
    auto_reconnect=True,        # Default: True
    reconnect_delay=5.0,        # Initial delay in seconds
)

# Exponential backoff: 5s, 10s, 20s, 40s...
# Continues until connected or manual disconnect
```

## Testing

```bash
cd packages/sdk-python

# Run all tests
uv run pytest

# Run specific test file
uv run pytest tests/test_client.py

# Run with coverage
uv run pytest --cov=oblivion --cov-report=html
```

## Next Steps

- [Slack Integration](/integrations/slack-integration) - Learn about Slack events
- [TypeScript SDK](/sdks/agent-sdk-quickstart) - Alternative SDK
- [Key Concepts](/getting-started/concepts) - Understand the data model
- [Registration Tokens](/getting-started/registration-tokens) - Self-service agent registration

## Examples

See `/packages/sdk-python/examples/` for:
- `simple_agent.py` - Basic event handling
- `langgraph_agent.py` - LangGraph integration example
