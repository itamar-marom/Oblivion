#!/usr/bin/env python3
"""
Simple Oblivion Agent Example

This example demonstrates how to connect an AI agent to Nexus
and handle task assignments using the Oblivion SDK.

Usage:
    # Set environment variables
    export NEXUS_URL=http://localhost:3000
    export AGENT_CLIENT_ID=example-agent
    export AGENT_CLIENT_SECRET=your-secret

    # Run the agent
    python simple_agent.py
"""

import asyncio
import os
import sys

# Add parent directory to path for local development
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from oblivion import (
    ContextUpdatePayload,
    OblivionClient,
    TaskAssignedPayload,
    WakeUpPayload,
)


async def main() -> None:
    """Run the simple agent."""
    # Configuration from environment
    nexus_url = os.getenv("NEXUS_URL", "http://localhost:3000")
    client_id = os.getenv("AGENT_CLIENT_ID", "example-agent")
    client_secret = os.getenv("AGENT_CLIENT_SECRET", "example-secret")

    # Create the client
    client = OblivionClient(
        nexus_url=nexus_url,
        client_id=client_id,
        client_secret=client_secret,
        capabilities=["code-review", "documentation"],
        version="0.1.0",
    )

    # ==========================================================================
    # Event Handlers
    # ==========================================================================

    @client.on_task_assigned
    async def handle_task(task: TaskAssignedPayload) -> None:
        """Handle new task assignments from ClickUp."""
        print(f"\n📋 New Task Received!")
        print(f"   ID: {task.task_id}")
        print(f"   Title: {task.title}")
        print(f"   Description: {task.description or '(none)'}")
        print(f"   Slack Thread: #{task.slack_channel_id} @ {task.slack_thread_ts}")

        # Update status to working
        await client.update_status("working", task_id=task.task_id)

        # Simulate some work
        print("   ⚙️  Processing task...")
        await asyncio.sleep(2)

        # In a real agent, you would:
        # 1. Parse the task description
        # 2. Use LangGraph to plan and execute
        # 3. Post results back to Slack thread

        print("   ✅ Task processed!")

        # Update status back to idle
        await client.update_status("idle")

    @client.on_context_update
    async def handle_context(context: ContextUpdatePayload) -> None:
        """Handle new messages in task's Slack thread."""
        source = "👤 Human" if context.is_human else "🤖 Bot"
        print(f"\n💬 New Message ({source}):")
        print(f"   Task: {context.task_id}")
        print(f"   From: {context.author}")
        print(f"   Content: {context.content[:100]}...")

        # In a real agent, you would:
        # 1. Check if this message requires a response
        # 2. Use LangGraph to generate a response
        # 3. Post response via tool request

    @client.on_wake_up
    async def handle_wakeup(wakeup: WakeUpPayload) -> None:
        """Handle wake-up signals."""
        print(f"\n⏰ Wake Up!")
        print(f"   Reason: {wakeup.reason}")
        if wakeup.task_id:
            print(f"   Task: {wakeup.task_id}")

    # ==========================================================================
    # Connect and Run
    # ==========================================================================

    print(f"🚀 Starting Oblivion Agent")
    print(f"   Nexus URL: {nexus_url}")
    print(f"   Client ID: {client_id}")

    try:
        await client.connect()
        print("✅ Connected to Nexus!")
        print("   Waiting for tasks... (Ctrl+C to stop)")

        # Keep running until interrupted
        await client.wait()

    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
    finally:
        await client.disconnect()
        print("👋 Goodbye!")


if __name__ == "__main__":
    asyncio.run(main())
