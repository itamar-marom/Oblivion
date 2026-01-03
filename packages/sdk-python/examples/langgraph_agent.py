#!/usr/bin/env python3
"""
LangGraph-based Oblivion Agent

This example demonstrates a more sophisticated agent that uses LangGraph
for reasoning and task execution.

Requirements:
    pip install oblivion-sdk[langgraph]

Usage:
    export NEXUS_URL=http://localhost:3000
    export AGENT_CLIENT_ID=langgraph-agent
    export AGENT_CLIENT_SECRET=your-secret
    export OPENAI_API_KEY=your-openai-key

    python langgraph_agent.py
"""

import asyncio
import os
import sys
from typing import Annotated, Any

# Add parent directory to path for local development
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from oblivion import (
    ContextUpdatePayload,
    OblivionClient,
    TaskAssignedPayload,
)

# LangGraph imports (optional dependency)
try:
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_openai import ChatOpenAI
    from langgraph.prebuilt import create_react_agent

    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    print("⚠️  LangGraph not installed. Install with: pip install oblivion-sdk[langgraph]")


class LangGraphAgent:
    """
    An agent powered by LangGraph's ReAct pattern.

    This agent:
    1. Receives tasks from Nexus
    2. Uses LangGraph to reason about the task
    3. Reports results back
    """

    def __init__(self, client: OblivionClient) -> None:
        self.client = client
        self.current_task: TaskAssignedPayload | None = None
        self.task_context: list[str] = []

        # Initialize LangGraph agent
        if LANGGRAPH_AVAILABLE:
            self._setup_langgraph()

    def _setup_langgraph(self) -> None:
        """Set up the LangGraph ReAct agent."""
        # Define tools the agent can use
        def analyze_code(code: str) -> str:
            """Analyze code for issues and improvements."""
            # In production, this would use actual code analysis
            return f"Code analysis complete. Found 0 critical issues."

        def search_docs(query: str) -> str:
            """Search documentation for relevant information."""
            # In production, this would search actual docs
            return f"Found 3 relevant documentation pages for: {query}"

        def create_summary(content: str) -> str:
            """Create a summary of the given content."""
            return f"Summary: {content[:100]}..."

        self.tools = [analyze_code, search_docs, create_summary]

        # Create the LLM
        self.llm = ChatOpenAI(
            model="gpt-4-turbo-preview",
            temperature=0.1,
        )

        # Create ReAct agent
        self.agent = create_react_agent(
            self.llm,
            self.tools,
            prompt=(
                "You are an AI assistant helping with software development tasks. "
                "You receive tasks from ClickUp and should analyze them, "
                "use available tools to gather information, and provide helpful responses. "
                "Be concise and actionable in your responses."
            ),
        )

    async def process_task(self, task: TaskAssignedPayload) -> str:
        """Process a task using LangGraph."""
        if not LANGGRAPH_AVAILABLE:
            return "LangGraph not available - task logged for manual review"

        self.current_task = task
        self.task_context = []

        # Build the initial message
        task_message = f"""
New Task Assigned:
- Title: {task.title}
- Description: {task.description or "No description provided"}

Please analyze this task and provide:
1. A brief summary of what needs to be done
2. Any clarifying questions you have
3. Initial thoughts on how to approach this
"""

        # Run the agent
        messages = [HumanMessage(content=task_message)]
        result = await asyncio.to_thread(
            self.agent.invoke,
            {"messages": messages},
        )

        # Extract the response
        response_messages = result.get("messages", [])
        if response_messages:
            last_message = response_messages[-1]
            return str(last_message.content)

        return "Task analysis complete"

    async def handle_context(self, context: ContextUpdatePayload) -> str | None:
        """Handle new context (messages) for the current task."""
        if not self.current_task or context.task_id != self.current_task.task_id:
            return None

        if not LANGGRAPH_AVAILABLE:
            return None

        # Only respond to human messages
        if not context.is_human:
            return None

        # Add context to history
        self.task_context.append(f"{context.author}: {context.content}")

        # Build context message
        context_message = f"""
New message from {context.author}:
{context.content}

Previous context:
{chr(10).join(self.task_context[-5:])}

Please respond helpfully to this message.
"""

        # Run agent with context
        messages = [HumanMessage(content=context_message)]
        result = await asyncio.to_thread(
            self.agent.invoke,
            {"messages": messages},
        )

        response_messages = result.get("messages", [])
        if response_messages:
            last_message = response_messages[-1]
            return str(last_message.content)

        return None


async def main() -> None:
    """Run the LangGraph agent."""
    # Configuration
    nexus_url = os.getenv("NEXUS_URL", "http://localhost:3000")
    client_id = os.getenv("AGENT_CLIENT_ID", "langgraph-agent")
    client_secret = os.getenv("AGENT_CLIENT_SECRET", "langgraph-secret")

    # Create Oblivion client
    client = OblivionClient(
        nexus_url=nexus_url,
        client_id=client_id,
        client_secret=client_secret,
        capabilities=["code-analysis", "documentation", "task-planning"],
        version="0.1.0",
    )

    # Create LangGraph agent wrapper
    agent = LangGraphAgent(client)

    # ==========================================================================
    # Event Handlers
    # ==========================================================================

    @client.on_task_assigned
    async def handle_task(task: TaskAssignedPayload) -> None:
        """Handle new task assignments."""
        print(f"\n📋 Task Received: {task.title}")

        await client.update_status("working", task_id=task.task_id)

        try:
            # Process with LangGraph
            response = await agent.process_task(task)
            print(f"\n🤖 Agent Response:\n{response}")

            # In production: post response to Slack thread via tool request
            # await client.request_tool("slack", "post_message", {
            #     "channel": task.slack_channel_id,
            #     "thread_ts": task.slack_thread_ts,
            #     "text": response,
            # })

        except Exception as e:
            print(f"❌ Error processing task: {e}")
            await client.update_status("error", task_id=task.task_id, message=str(e))
            return

        await client.update_status("idle")

    @client.on_context_update
    async def handle_context(context: ContextUpdatePayload) -> None:
        """Handle new messages in task thread."""
        if not context.is_human:
            return  # Skip bot messages

        print(f"\n💬 Message from {context.author}: {context.content[:50]}...")

        await client.update_status("working", task_id=context.task_id)

        try:
            response = await agent.handle_context(context)
            if response:
                print(f"\n🤖 Agent Response:\n{response}")

        except Exception as e:
            print(f"❌ Error handling context: {e}")

        await client.update_status("idle")

    # ==========================================================================
    # Run
    # ==========================================================================

    print("🚀 Starting LangGraph Agent")
    print(f"   Nexus: {nexus_url}")
    print(f"   Client: {client_id}")
    print(f"   LangGraph: {'✅ Available' if LANGGRAPH_AVAILABLE else '❌ Not installed'}")

    try:
        await client.connect()
        print("✅ Connected!")
        await client.wait()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
