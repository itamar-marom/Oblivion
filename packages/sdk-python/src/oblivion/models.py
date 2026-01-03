"""
Typed models for Nexus WebSocket events.

These mirror the TypeScript DTOs in nexus/src/gateway/dto/events.dto.ts
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Event types for agent communication."""

    # Server → Agent (downstream)
    TASK_ASSIGNED = "task_assigned"
    CONTEXT_UPDATE = "context_update"
    WAKE_UP = "wake_up"
    TOOL_RESULT = "tool_result"

    # Bidirectional
    HEARTBEAT = "heartbeat"

    # Agent → Server (upstream)
    AGENT_READY = "agent_ready"
    TOOL_REQUEST = "tool_request"
    STATUS_UPDATE = "status_update"


class AgentStatus(str, Enum):
    """Agent status states."""

    IDLE = "idle"
    WORKING = "working"
    ERROR = "error"


class WakeUpReason(str, Enum):
    """Reasons for wake-up events."""

    SCHEDULED = "scheduled"
    MANUAL = "manual"
    RETRY = "retry"


# =============================================================================
# Event Payloads
# =============================================================================


class TaskAssignedPayload(BaseModel):
    """TASK_ASSIGNED: New task from ClickUp assigned to agent."""

    task_id: str = Field(alias="taskId")
    project_mapping_id: str = Field(alias="projectMappingId")
    clickup_task_id: str = Field(alias="clickupTaskId")
    slack_channel_id: str = Field(alias="slackChannelId")
    slack_thread_ts: str = Field(alias="slackThreadTs")
    title: str
    description: str | None = None
    assigned_at: str = Field(alias="assignedAt")

    model_config = {"populate_by_name": True}


class ContextUpdatePayload(BaseModel):
    """CONTEXT_UPDATE: New message in Slack thread."""

    task_id: str = Field(alias="taskId")
    slack_channel_id: str = Field(alias="slackChannelId")
    slack_thread_ts: str = Field(alias="slackThreadTs")
    message_ts: str = Field(alias="messageTs")
    author: str
    content: str
    is_human: bool = Field(alias="isHuman")

    model_config = {"populate_by_name": True}


class WakeUpPayload(BaseModel):
    """WAKE_UP: Generic agent wake signal."""

    reason: WakeUpReason
    task_id: str | None = Field(default=None, alias="taskId")
    metadata: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class ToolRequestPayload(BaseModel):
    """TOOL_REQUEST: Agent requests tool execution."""

    request_id: str = Field(alias="requestId")
    tool: str
    action: str
    params: dict[str, Any]

    model_config = {"populate_by_name": True}


class ToolResultPayload(BaseModel):
    """TOOL_RESULT: Response from tool execution."""

    request_id: str = Field(alias="requestId")
    success: bool
    result: Any | None = None
    error: str | None = None

    model_config = {"populate_by_name": True}


class HeartbeatPayload(BaseModel):
    """HEARTBEAT: Keep-alive ping/pong."""

    ping: bool | None = None
    pong: bool | None = None
    server_time: str = Field(alias="serverTime")

    model_config = {"populate_by_name": True}


class AgentReadyPayload(BaseModel):
    """AGENT_READY: Agent signals it's ready to receive events."""

    capabilities: list[str] | None = None
    version: str | None = None


class StatusUpdatePayload(BaseModel):
    """STATUS_UPDATE: Agent updates its status."""

    status: AgentStatus
    task_id: str | None = Field(default=None, alias="taskId")
    message: str | None = None

    model_config = {"populate_by_name": True}


# =============================================================================
# Base Event Wrapper
# =============================================================================


class BaseEvent(BaseModel):
    """Base event wrapper - all events follow this structure."""

    type: EventType
    payload: dict[str, Any]
    timestamp: str

    @classmethod
    def create(cls, event_type: EventType, payload: BaseModel | dict[str, Any]) -> "BaseEvent":
        """Create a new event with the current timestamp."""
        payload_dict = payload.model_dump(by_alias=True) if isinstance(payload, BaseModel) else payload
        return cls(
            type=event_type,
            payload=payload_dict,
            timestamp=datetime.utcnow().isoformat() + "Z",
        )


# =============================================================================
# Connection Response
# =============================================================================


class ConnectedResponse(BaseModel):
    """Response when successfully connected to Nexus."""

    message: str
    agent_id: str = Field(alias="agentId")
    server_time: str = Field(alias="serverTime")

    model_config = {"populate_by_name": True}
