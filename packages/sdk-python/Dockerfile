# Oblivion Agent Dockerfile
# Build: docker build -t oblivion-agent .
# Run:   docker run -e NEXUS_URL=http://host.docker.internal:3000 \
#                   -e AGENT_CLIENT_ID=my-agent \
#                   -e AGENT_CLIENT_SECRET=secret \
#                   oblivion-agent

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy package files
COPY pyproject.toml README.md ./
COPY src/ ./src/

# Install the package and dependencies
RUN uv pip install --system -e ".[langgraph]"

# Copy examples (optional - remove if building production image)
COPY examples/ ./examples/

# Default environment variables
ENV NEXUS_URL=http://localhost:3000 \
    AGENT_CLIENT_ID=docker-agent \
    AGENT_CLIENT_SECRET=change-me \
    PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import oblivion; print('healthy')" || exit 1

# Run the simple agent by default
# Override with: docker run ... oblivion-agent python examples/langgraph_agent.py
CMD ["python", "examples/simple_agent.py"]
