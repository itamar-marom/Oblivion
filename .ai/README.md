# AI Instructions Directory

This directory contains comprehensive instructions for AI agents working on the Oblivion project.

## Project Overview

**Oblivion** is the "Connective Tissue" for the Autonomous Workforce. It is an orchestration platform that enables AI Agents to work alongside humans within existing toolchains—specifically **Slack** (Communication) and **ClickUp** (Task Management)—without requiring humans to adopt new interfaces.

### The Vision

Transform AI Agents from "chatbots in a browser" into **First-Class Team Members** with:
- Persistent identity across tools
- Access to team context and history
- Ability to autonomously drive tasks to completion
- Secure tool execution via standardized protocols

### The "Mirror" Philosophy

Oblivion doesn't replace your tools; it mirrors state between them:
- **Action Source**: ClickUp (Tasks)
- **Discussion Source**: Slack (Context)
- **Execution Layer**: Oblivion (Agents)

When a task updates in ClickUp, Oblivion wakes the relevant Agent. When the Agent speaks in Slack, Oblivion syncs the summary back to ClickUp.

### Key Technologies

**Backend (The Nexus):**
- Node.js / NestJS (WebSocket gateway + API)
- Prisma ORM (PostgreSQL)
- BullMQ (Redis-based queue)
- Socket.io (WebSocket communication)

**Frontend (The Observer):**
- Next.js 15+ (App Router)
- TypeScript (Strict mode)
- Tailwind CSS + shadcn/ui
- Clerk/NextAuth (Authentication)

**Agent SDK:**
- Python 3.12+
- LangGraph (Agent orchestration)
- AsyncSocketIO (WebSocket client)
- MCP (Model Context Protocol)

**Infrastructure:**
- Kubernetes (Deployment platform)
- Helm (Package manager)
- PostgreSQL (Relational data)
- Redis (Cache + Queue)
- Qdrant (Vector store for RAG)
- Langfuse (LLM tracing)
- External Secrets Operator (Secrets management)

### Project Purpose

Enable AI agents to:
1. Receive task assignments from ClickUp
2. Collaborate in Slack channels with context awareness
3. Execute secure tool operations (GitHub, APIs, etc.)
4. Maintain persistent memory through RAG (Qdrant)
5. Provide transparent thought processes ("Subvocal" protocol)

## Directory Structure

This directory is organized into focused instruction files:

### Core Instructions

- **README.md** (this file) - Project overview and directory guide
- **repository-structure.md** - Monorepo structure, component organization, and development patterns
- **architecture.md** - System architecture, design patterns, and key decisions
- **backend-python.md** - Python backend guidelines (FastAPI, SQLModel, Pydantic)
- **backend-node.md** - Node.js/TypeScript backend guidelines (Hono, Drizzle, Zod)
- **frontend.md** - Frontend development guidelines (Next.js, React, TypeScript)
- **setup.md** - Build, installation, and development workflow

### Specialized Guides

- **security.md** - Security guidelines and considerations
- **testing.md** - Testing standards and requirements
- **cicd.md** - CI/CD guidelines with component-specific workflows
- **self-improvement.md** - How to continuously improve these AI instructions

## How to Use These Instructions

1. **Start here** - Read this overview to understand the project
2. **Review repository-structure.md** - Understand the monorepo organization
3. **Review architecture.md** - Understand the system design
4. **Choose your stack**:
   - **Python backend**: Check backend-python.md (FastAPI, SQLModel, Pydantic)
   - **Node.js backend**: Check backend-node.md (Hono, Drizzle, Zod)
   - **Frontend**: Check frontend.md (Next.js, React, TypeScript)
5. **Reference setup.md** - Get the development environment running
6. **Consult specialized guides** as needed for specific tasks

## Quick Reference

### Project Structure

```
oblivion/
├── apps/
│   ├── nexus/              # NestJS backend (WebSocket gateway, API)
│   └── observer/           # Next.js dashboard
├── packages/
│   └── sdk-python/         # Python agent SDK
├── infra/
│   └── helm/               # Helm charts for K8s deployment
├── product/                # Product specifications
│   └── PRD.md              # Master PRD
├── tasks/                  # Implementation tasks
│   └── MASTER.md           # Master task list
└── .ai/                    # AI agent instructions (this directory)
```

### Key Conventions

- **Monorepo**: Use workspace dependencies for shared packages
- **Container Hierarchy**: Workgroup (Tenant) → Project (Context) → Task (Unit of work)
- **Mirror Philosophy**: Slack ↔ ClickUp bidirectional sync
- **Agent Protocol**: WebSocket-based communication, stateless agents
- **Tool Security**: Agents request tools via MCP, Gateway executes with stored credentials
- **Memory**: RAG-powered context via Qdrant vector store

## Product Documentation

For detailed product specifications and feature requirements:

📋 **Start with**: [`../product/PRD.md`](../product/PRD.md) - Master Product Requirements Document

This contains:
- Executive summary and vision
- Core architecture overview
- Data model (Container system)
- Functional requirements
- Agent interface standards
- Non-functional requirements

## Implementation Tasks

For current development tasks and roadmap:

✅ **Reference**: [`../tasks/MASTER.md`](../tasks/MASTER.md) - Master Task List

This contains:
- Phase-by-phase implementation plan
- Kubernetes foundation setup
- Backend (Nexus) implementation
- Integration engine development
- Agent ecosystem buildout
- Frontend (Observer) development
- Production hardening steps

---

*These AI instruction files should evolve alongside the product and tasks. See [self-improvement.md](./self-improvement.md) for guidelines.*
