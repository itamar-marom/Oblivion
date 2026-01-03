"""
Oblivion SDK - Connect AI agents to the Oblivion platform.

Usage:
    from oblivion import OblivionClient, TaskAssignedPayload

    client = OblivionClient(
        nexus_url="http://localhost:3000",
        client_id="my-agent",
        client_secret="secret",
    )

    @client.on_task_assigned
    async def handle_task(task: TaskAssignedPayload):
        print(f"Got task: {task.title}")
        await client.update_status("working", task_id=task.task_id)

    await client.connect()
    await client.wait()
"""

from .client import OblivionClient
from .models import (
    AgentReadyPayload,
    AgentStatus,
    BaseEvent,
    ConnectedResponse,
    ContextUpdatePayload,
    EventType,
    HeartbeatPayload,
    StatusUpdatePayload,
    TaskAssignedPayload,
    ToolRequestPayload,
    ToolResultPayload,
    WakeUpPayload,
    WakeUpReason,
)

__version__ = "0.1.0"

__all__ = [
    # Client
    "OblivionClient",
    # Event types
    "EventType",
    "AgentStatus",
    "WakeUpReason",
    # Payloads
    "TaskAssignedPayload",
    "ContextUpdatePayload",
    "WakeUpPayload",
    "ToolRequestPayload",
    "ToolResultPayload",
    "HeartbeatPayload",
    "AgentReadyPayload",
    "StatusUpdatePayload",
    # Other
    "BaseEvent",
    "ConnectedResponse",
]
