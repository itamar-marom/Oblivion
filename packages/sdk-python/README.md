# Oblivion SDK for Python

Connect AI agents to the Oblivion platform (Nexus).

## Installation

```bash
# Basic installation
pip install oblivion-sdk

# With LangGraph support
pip install oblivion-sdk[langgraph]

# Development
pip install oblivion-sdk[dev]
```

## Quick Start

```python
import asyncio
from oblivion import OblivionClient, TaskAssignedPayload

async def main():
    # Create client
    client = OblivionClient(
        nexus_url="http://localhost:3000",
        client_id="my-agent",
        client_secret="my-secret",
        capabilities=["code-review", "documentation"],
    )

    # Handle task assignments
    @client.on_task_assigned
    async def handle_task(task: TaskAssignedPayload):
        print(f"Got task: {task.title}")

        # Update status to working
        await client.update_status("working", task_id=task.task_id)

        # ... do work ...

        # Back to idle
        await client.update_status("idle")

    # Connect and run
    await client.connect()
    await client.wait()

asyncio.run(main())
```

## Event Handlers

The SDK provides decorators for handling different events from Nexus:

### `@client.on_task_assigned`
New task from ClickUp assigned to the agent.

```python
@client.on_task_assigned
async def handle_task(task: TaskAssignedPayload):
    print(f"Task: {task.title}")
    print(f"Description: {task.description}")
    print(f"Slack Thread: {task.slack_channel_id}/{task.slack_thread_ts}")
```

### `@client.on_context_update`
New message in the task's Slack thread.

```python
@client.on_context_update
async def handle_context(context: ContextUpdatePayload):
    if context.is_human:
        print(f"Human said: {context.content}")
```

### `@client.on_wake_up`
Wake-up signal (scheduled, manual, or retry).

```python
@client.on_wake_up
async def handle_wakeup(wakeup: WakeUpPayload):
    print(f"Wake up reason: {wakeup.reason}")
```

## Agent Actions

### Update Status

```python
# Simple status
await client.update_status("working")

# With task context
await client.update_status("working", task_id="task-123")

# With message
await client.update_status("error", message="Failed to connect to API")
```

### Request Tool Execution

```python
result = await client.request_tool(
    tool="github",
    action="create_issue",
    params={
        "repo": "myorg/myrepo",
        "title": "Bug found",
        "body": "Description...",
    },
    timeout=30.0,
)

if result.success:
    print(f"Issue created: {result.result}")
else:
    print(f"Error: {result.error}")
```

## Docker

Build and run your agent in a container:

```bash
# Build
docker build -t my-agent .

# Run
docker run \
  -e NEXUS_URL=http://host.docker.internal:3000 \
  -e AGENT_CLIENT_ID=my-agent \
  -e AGENT_CLIENT_SECRET=secret \
  -e OPENAI_API_KEY=sk-... \
  my-agent
```

## Examples

See the `examples/` directory for complete examples:

- `simple_agent.py` - Basic agent that logs tasks
- `langgraph_agent.py` - Agent with LangGraph ReAct pattern

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `NEXUS_URL` | Nexus server URL | `http://localhost:3000` |
| `AGENT_CLIENT_ID` | Agent identifier | Required |
| `AGENT_CLIENT_SECRET` | Agent secret | Required |
| `OPENAI_API_KEY` | OpenAI API key (for LangGraph) | Optional |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Your Agent                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │              LangGraph / Custom Logic             │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Oblivion SDK (this package)          │  │
│  │  • WebSocket client (Socket.IO)                  │  │
│  │  • JWT authentication                            │  │
│  │  • Event handlers                                │  │
│  │  • Status updates                                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                    WebSocket
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Nexus                              │
│  • Agent Gateway (Socket.IO)                           │
│  • Task routing                                        │
│  • Tool execution                                      │
└─────────────────────────────────────────────────────────┘
```

## License

MIT
