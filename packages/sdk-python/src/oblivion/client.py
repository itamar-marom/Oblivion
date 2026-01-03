"""
Oblivion Agent Client - Connect AI agents to Nexus.

Usage:
    from oblivion import OblivionClient

    client = OblivionClient(
        nexus_url="http://localhost:3000",
        client_id="my-agent",
        client_secret="secret",
    )

    @client.on_task_assigned
    async def handle_task(task: TaskAssignedPayload):
        print(f"Received task: {task.title}")
        await client.update_status("working", task_id=task.task_id)
        # ... do work ...
        await client.update_status("idle")

    await client.connect()
"""

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

import httpx
import socketio
import structlog

from .models import (
    AgentReadyPayload,
    AgentStatus,
    BaseEvent,
    ConnectedResponse,
    ContextUpdatePayload,
    EventType,
    StatusUpdatePayload,
    TaskAssignedPayload,
    ToolRequestPayload,
    ToolResultPayload,
    WakeUpPayload,
)

logger = structlog.get_logger()

T = TypeVar("T")


class OblivionClient:
    """
    Async client for connecting AI agents to Nexus.

    Features:
    - Automatic JWT authentication
    - Typed event handlers
    - Automatic reconnection
    - Heartbeat management
    """

    def __init__(
        self,
        nexus_url: str,
        client_id: str,
        client_secret: str,
        *,
        capabilities: list[str] | None = None,
        version: str = "0.1.0",
        auto_reconnect: bool = True,
        reconnect_delay: float = 5.0,
    ):
        """
        Initialize the Oblivion client.

        Args:
            nexus_url: Base URL of Nexus server (e.g., http://localhost:3000)
            client_id: Unique identifier for this agent
            client_secret: Secret for authentication
            capabilities: List of capabilities this agent supports
            version: Agent version string
            auto_reconnect: Whether to automatically reconnect on disconnect
            reconnect_delay: Seconds to wait before reconnecting
        """
        self.nexus_url = nexus_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.capabilities = capabilities or []
        self.version = version
        self.auto_reconnect = auto_reconnect
        self.reconnect_delay = reconnect_delay

        # Connection state
        self._token: str | None = None
        self._agent_id: str | None = None
        self._connected = False
        self._should_run = False

        # Socket.IO client
        self._sio = socketio.AsyncClient(
            reconnection=False,  # We handle reconnection ourselves
            logger=False,
            engineio_logger=False,
        )

        # Event handlers
        self._task_handlers: list[Callable[[TaskAssignedPayload], Awaitable[None]]] = []
        self._context_handlers: list[Callable[[ContextUpdatePayload], Awaitable[None]]] = []
        self._wakeup_handlers: list[Callable[[WakeUpPayload], Awaitable[None]]] = []
        self._tool_result_handlers: list[Callable[[ToolResultPayload], Awaitable[None]]] = []

        # Pending tool requests
        self._pending_tools: dict[str, asyncio.Future[ToolResultPayload]] = {}

        # Register internal handlers
        self._setup_handlers()

        self._log = logger.bind(client_id=client_id)

    def _setup_handlers(self) -> None:
        """Register Socket.IO event handlers."""

        @self._sio.on("connected", namespace="/agents")
        async def on_connected(data: dict[str, Any]) -> None:
            response = ConnectedResponse.model_validate(data)
            self._agent_id = response.agent_id
            self._connected = True
            self._log.info("Connected to Nexus", agent_id=self._agent_id)

            # Send agent_ready signal
            await self._send_agent_ready()

        @self._sio.on("disconnect", namespace="/agents")
        async def on_disconnect() -> None:
            self._connected = False
            self._log.warning("Disconnected from Nexus")

            if self.auto_reconnect and self._should_run:
                await self._reconnect()

        @self._sio.on(EventType.TASK_ASSIGNED.value, namespace="/agents")
        async def on_task_assigned(data: dict[str, Any]) -> None:
            event = BaseEvent.model_validate(data)
            payload = TaskAssignedPayload.model_validate(event.payload)
            self._log.info("Task assigned", task_id=payload.task_id, title=payload.title)

            for handler in self._task_handlers:
                try:
                    await handler(payload)
                except Exception as e:
                    self._log.error("Task handler error", error=str(e))

        @self._sio.on(EventType.CONTEXT_UPDATE.value, namespace="/agents")
        async def on_context_update(data: dict[str, Any]) -> None:
            event = BaseEvent.model_validate(data)
            payload = ContextUpdatePayload.model_validate(event.payload)
            self._log.debug(
                "Context update",
                task_id=payload.task_id,
                author=payload.author,
                is_human=payload.is_human,
            )

            for handler in self._context_handlers:
                try:
                    await handler(payload)
                except Exception as e:
                    self._log.error("Context handler error", error=str(e))

        @self._sio.on(EventType.WAKE_UP.value, namespace="/agents")
        async def on_wake_up(data: dict[str, Any]) -> None:
            event = BaseEvent.model_validate(data)
            payload = WakeUpPayload.model_validate(event.payload)
            self._log.info("Wake up signal", reason=payload.reason, task_id=payload.task_id)

            for handler in self._wakeup_handlers:
                try:
                    await handler(payload)
                except Exception as e:
                    self._log.error("Wake-up handler error", error=str(e))

        @self._sio.on(EventType.TOOL_RESULT.value, namespace="/agents")
        async def on_tool_result(data: dict[str, Any]) -> None:
            event = BaseEvent.model_validate(data)
            payload = ToolResultPayload.model_validate(event.payload)
            self._log.debug("Tool result", request_id=payload.request_id, success=payload.success)

            # Resolve pending future
            if payload.request_id in self._pending_tools:
                future = self._pending_tools.pop(payload.request_id)
                future.set_result(payload)

            for handler in self._tool_result_handlers:
                try:
                    await handler(payload)
                except Exception as e:
                    self._log.error("Tool result handler error", error=str(e))

        @self._sio.on(EventType.HEARTBEAT.value, namespace="/agents")
        async def on_heartbeat(data: dict[str, Any]) -> None:
            # Server sends heartbeat, we respond
            await self._sio.emit(
                EventType.HEARTBEAT.value,
                BaseEvent.create(EventType.HEARTBEAT, {"ping": True, "serverTime": ""}).model_dump(
                    by_alias=True
                ),
                namespace="/agents",
            )

    # =========================================================================
    # Event Handler Decorators
    # =========================================================================

    def on_task_assigned(
        self, handler: Callable[[TaskAssignedPayload], Awaitable[None]]
    ) -> Callable[[TaskAssignedPayload], Awaitable[None]]:
        """Decorator to register a task assignment handler."""
        self._task_handlers.append(handler)
        return handler

    def on_context_update(
        self, handler: Callable[[ContextUpdatePayload], Awaitable[None]]
    ) -> Callable[[ContextUpdatePayload], Awaitable[None]]:
        """Decorator to register a context update handler."""
        self._context_handlers.append(handler)
        return handler

    def on_wake_up(
        self, handler: Callable[[WakeUpPayload], Awaitable[None]]
    ) -> Callable[[WakeUpPayload], Awaitable[None]]:
        """Decorator to register a wake-up handler."""
        self._wakeup_handlers.append(handler)
        return handler

    def on_tool_result(
        self, handler: Callable[[ToolResultPayload], Awaitable[None]]
    ) -> Callable[[ToolResultPayload], Awaitable[None]]:
        """Decorator to register a tool result handler."""
        self._tool_result_handlers.append(handler)
        return handler

    # =========================================================================
    # Connection Management
    # =========================================================================

    async def _authenticate(self) -> str:
        """Authenticate with Nexus and get JWT token."""
        async with httpx.AsyncClient() as http:
            response = await http.post(
                f"{self.nexus_url}/auth/token",
                json={
                    "clientId": self.client_id,
                    "clientSecret": self.client_secret,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["accessToken"]

    async def _send_agent_ready(self) -> None:
        """Send agent_ready signal to Nexus."""
        payload = AgentReadyPayload(capabilities=self.capabilities, version=self.version)
        event = BaseEvent.create(EventType.AGENT_READY, payload)
        await self._sio.emit(
            EventType.AGENT_READY.value,
            event.model_dump(by_alias=True),
            namespace="/agents",
        )

    async def connect(self) -> None:
        """Connect to Nexus and start receiving events."""
        self._should_run = True
        self._log.info("Authenticating with Nexus")

        try:
            self._token = await self._authenticate()
            self._log.info("Authentication successful")
        except httpx.HTTPStatusError as e:
            self._log.error("Authentication failed", status=e.response.status_code)
            raise

        # Connect to WebSocket
        ws_url = self.nexus_url.replace("http://", "ws://").replace("https://", "wss://")
        await self._sio.connect(
            ws_url,
            namespaces=["/agents"],
            auth={"token": self._token},
            transports=["websocket"],
            socketio_path="/socket.io",
            wait_timeout=10,
        )

    async def _reconnect(self) -> None:
        """Attempt to reconnect to Nexus."""
        while self._should_run and not self._connected:
            self._log.info("Attempting reconnection", delay=self.reconnect_delay)
            await asyncio.sleep(self.reconnect_delay)

            try:
                await self.connect()
            except Exception as e:
                self._log.error("Reconnection failed", error=str(e))

    async def disconnect(self) -> None:
        """Disconnect from Nexus."""
        self._should_run = False
        if self._sio.connected:
            await self._sio.disconnect()
        self._connected = False
        self._log.info("Disconnected")

    async def wait(self) -> None:
        """Wait until disconnected (useful for keeping agent running)."""
        while self._should_run:
            await asyncio.sleep(1)

    @property
    def connected(self) -> bool:
        """Check if currently connected to Nexus."""
        return self._connected

    @property
    def agent_id(self) -> str | None:
        """Get the agent ID assigned by Nexus."""
        return self._agent_id

    # =========================================================================
    # Agent Actions
    # =========================================================================

    async def update_status(
        self,
        status: AgentStatus | str,
        *,
        task_id: str | None = None,
        message: str | None = None,
    ) -> None:
        """
        Update agent status.

        Args:
            status: New status (idle, working, error)
            task_id: Optional task ID if working on a task
            message: Optional status message
        """
        if isinstance(status, str):
            status = AgentStatus(status)

        payload = StatusUpdatePayload(status=status, task_id=task_id, message=message)
        event = BaseEvent.create(EventType.STATUS_UPDATE, payload)

        await self._sio.emit(
            EventType.STATUS_UPDATE.value,
            event.model_dump(by_alias=True),
            namespace="/agents",
        )
        self._log.debug("Status updated", status=status.value, task_id=task_id)

    async def request_tool(
        self,
        tool: str,
        action: str,
        params: dict[str, Any],
        *,
        timeout: float = 30.0,
    ) -> ToolResultPayload:
        """
        Request tool execution from Nexus.

        Args:
            tool: Tool name (e.g., "github", "slack")
            action: Action to perform (e.g., "create_issue", "post_message")
            params: Parameters for the action
            timeout: Timeout in seconds

        Returns:
            Tool execution result
        """
        request_id = str(uuid.uuid4())
        payload = ToolRequestPayload(
            request_id=request_id,
            tool=tool,
            action=action,
            params=params,
        )
        event = BaseEvent.create(EventType.TOOL_REQUEST, payload)

        # Create future for response
        future: asyncio.Future[ToolResultPayload] = asyncio.get_event_loop().create_future()
        self._pending_tools[request_id] = future

        # Send request
        await self._sio.emit(
            EventType.TOOL_REQUEST.value,
            event.model_dump(by_alias=True),
            namespace="/agents",
        )

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            self._pending_tools.pop(request_id, None)
            return ToolResultPayload(
                request_id=request_id,
                success=False,
                error="Tool request timed out",
            )

    async def send_heartbeat(self) -> None:
        """Send a heartbeat to Nexus."""
        event = BaseEvent.create(
            EventType.HEARTBEAT,
            {"ping": True, "serverTime": ""},
        )
        await self._sio.emit(
            EventType.HEARTBEAT.value,
            event.model_dump(by_alias=True),
            namespace="/agents",
        )
