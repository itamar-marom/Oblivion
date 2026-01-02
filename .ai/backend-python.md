# Python Agent SDK Rules

**Purpose**: Guidelines for building AI agents using the Oblivion Python SDK (`packages/sdk-python`)

**Reference**: See [`../product/PRD.md`](../product/PRD.md) Section 5 (Agent Interface Standard)

---

## 🎯 Tech Stack

- **Language**: Python 3.12+
- **Framework**: LangGraph (agent orchestration)
- **WebSocket**: AsyncSocketIO (Socket.io client)
- **Tools**: MCP (Model Context Protocol)
- **Validation**: Pydantic V2
- **Testing**: pytest + pytest-asyncio
- **Package Manager**: uv

---

## 📁 Agent Project Structure

```
my-agent/
├── agent/
│   ├── __init__.py
│   ├── main.py         # Agent entry point
│   ├── graph.py        # LangGraph state machine
│   ├── tools/          # MCP tool implementations
│   │   ├── github.py
│   │   └── search.py
│   └── prompts/        # System prompts
├── tests/
│   ├── test_agent.py
│   └── test_tools.py
├── pyproject.toml
├── .env.example
└── README.md
```

---

## 🔑 Key Patterns

### Agent Initialization
```python
# agent/main.py
from oblivion_client import OblivionAgent
from agent.graph import build_graph

agent = OblivionAgent(
    client_id=os.getenv("AGENT_CLIENT_ID"),
    client_secret=os.getenv("AGENT_CLIENT_SECRET"),
    nexus_url=os.getenv("NEXUS_URL"),  # wss://nexus.oblivion.local
)

@agent.on_task("fix_bug")
async def handle_bug_fix(event):
    """Handle bug fix tasks."""
    # 1. Fetch context from Memory Bank (Qdrant RAG)
    context = await agent.search_history(
        project_id=event.project_id,
        query="similar bugs and fixes",
        limit=10
    )

    # 2. Build state and run LangGraph
    graph = build_graph()
    result = await graph.ainvoke({
        "task": event.task_description,
        "context": context,
        "slack_thread": event.thread_ts,
    })

    # 3. Post update to Slack via Nexus
    await agent.post_message(event.thread_ts, result["final_output"])

if __name__ == "__main__":
    agent.run()  # Connect and listen for events
```

### LangGraph State Machine
```python
# agent/graph.py
from langgraph.graph import StateGraph, END
from pydantic import BaseModel

class AgentState(BaseModel):
    task: str
    context: list[dict]
    current_step: str
    thoughts: list[str]
    final_output: str

def build_graph():
    graph = StateGraph(AgentState)

    # Define nodes
    graph.add_node("read", read_task_node)
    graph.add_node("plan", plan_approach_node)
    graph.add_node("execute", execute_plan_node)
    graph.add_node("verify", verify_result_node)

    # Define edges
    graph.set_entry_point("read")
    graph.add_edge("read", "plan")
    graph.add_edge("plan", "execute")
    graph.add_edge("execute", "verify")
    graph.add_conditional_edges("verify", should_retry, {
        "retry": "plan",
        "done": END
    })

    return graph.compile()
```

### Tool Integration (MCP)
```python
# agent/tools/github.py
from mcp import Tool

@Tool(
    name="push_to_github",
    description="Push code changes to GitHub repository",
    parameters={
        "repo": "string",
        "branch": "string",
        "message": "string",
        "files": "array"
    }
)
async def push_to_github(repo: str, branch: str, message: str, files: list):
    """Request tool execution via Nexus Tool Gateway."""
    # Agent doesn't have GitHub token - requests via Nexus
    result = await agent.request_tool({
        "tool": "github",
        "action": "push",
        "params": {
            "repo": repo,
            "branch": branch,
            "message": message,
            "files": files
        }
    })
    return result
```

---

## 🔐 Security Rules

### Stateless Agents
- **Never store local state**: Rebuild state from Slack thread + ClickUp description on each wake
- **No credential storage**: Request tool execution via Nexus, never store API keys
- **Event-driven only**: No polling, wait for WebSocket events
- **Context isolation**: Only search history for assigned project_id

### Tool Security
- **Intent-based**: Send tool intent to Nexus, not direct API calls
- **Audit trail**: All tool requests logged by Nexus
- **Scoped access**: Tools scoped to workgroup (tenant)
- **Validation**: Validate all tool parameters with Pydantic

---

## 🧪 Testing Rules

### Unit Tests
```python
# tests/test_graph.py
@pytest.mark.asyncio
async def test_agent_graph():
    graph = build_graph()
    result = await graph.ainvoke({
        "task": "fix authentication bug",
        "context": [],
    })
    assert result["final_output"] is not None
```

### Integration Tests
```python
# tests/integration/test_agent_flow.py
@pytest.mark.asyncio
async def test_agent_receives_task(mock_nexus):
    """Test agent can receive and process task."""
    agent = OblivionAgent(...)

    # Mock Nexus sends TASK_ASSIGNED event
    await mock_nexus.send_event({
        "type": "TASK_ASSIGNED",
        "task_id": "123",
        "description": "Fix bug in auth module",
    })

    # Verify agent processes task
    assert agent.last_processed_task == "123"
```

---

## ⚡ Performance Rules

- **Memory**: Agents should use < 1GB RAM
- **Context Window**: Limit RAG results to 10-20 messages (avoid token overflow)
- **Tool Calls**: Minimize tool calls (< 10 per task)
- **Streaming**: Use streaming for long outputs to Slack

---

## 📊 Code Quality

### Type Hints (Required)
```python
# ✅ Good
async def search_history(project_id: str, query: str, limit: int = 10) -> list[dict]:
    ...

# ❌ Bad
async def search_history(project_id, query, limit=10):
    ...
```

### Pydantic Models
```python
# Use Pydantic for all event data
from pydantic import BaseModel

class TaskAssignedEvent(BaseModel):
    type: str = "TASK_ASSIGNED"
    task_id: str
    project_id: str
    thread_ts: str
    task_description: str
    clickup_url: str
```

### Async/Await
- **Always async** for I/O: WebSocket, HTTP, Qdrant search
- **Use `await`** for all agent SDK methods
- **Error handling**: Wrap in try/except, never let agent crash

---

## 🎯 Agent-Specific Rules

### Event Handling
- **Decorator-based**: Use `@agent.on_task(task_type)` for routing
- **Rebuild state**: Fetch full Slack thread + ClickUp description on wake
- **Context search**: Always search Memory Bank (Qdrant) for relevant history
- **Status updates**: Post incremental updates to Slack, not just final result

### The "Subvocal" Protocol
```python
# Two output streams: public (user-facing) and private (internal logs)
await agent.post_message(
    thread_ts=event.thread_ts,
    message="Working on authentication fix...",
    metadata={"type": "STATUS_UPDATE", "visibility": "public"}
)

await agent.post_message(
    thread_ts=event.thread_ts,
    message=json.dumps({"thought": "Analyzing error logs...", "step": 1}),
    metadata={"type": "INTERNAL_LOG", "visibility": "private"}
)
```

### Tool Requests
- **Never direct API calls**: Use agent.request_tool() → Nexus executes
- **MCP standard**: Follow Model Context Protocol for tool definitions
- **Validation**: Pydantic models for all tool parameters
- **Audit**: All tool requests logged by Nexus

---

## 🔍 SDK API Reference

### OblivionAgent Methods
```python
# Connection
await agent.connect()                    # Authenticate and connect to Nexus
await agent.disconnect()

# Messaging
await agent.post_message(thread_ts, message, metadata)
await agent.post_ephemeral(user_id, message)

# Context & Memory
await agent.search_history(project_id, query, limit)  # RAG search via Qdrant
await agent.get_thread(thread_ts)                     # Fetch full Slack thread

# Tools
await agent.request_tool(intent)         # Request tool execution via Gateway
await agent.list_available_tools()       # Get tools for workgroup

# Status
await agent.update_status(status)        # Update agent status in Registry
```

---

## 📦 SDK Development

### Installing SDK for Agent Development
```bash
# Clone SDK
git clone <oblivion-repo>
cd packages/sdk-python

# Install in editable mode
uv pip install -e .

# Now build your agent
cd ../../my-agent
uv init
uv add oblivion-client --editable ../../packages/sdk-python
```

---

**Last Updated**: 2026-01-02
**Reference**: [`tasks/MASTER.md`](../tasks/MASTER.md) Phase 3 (Agent Ecosystem)
