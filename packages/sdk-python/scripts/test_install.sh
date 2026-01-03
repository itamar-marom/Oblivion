#!/bin/bash
# Test script to verify SDK installation
# Run from the sdk-python directory

set -e

echo "🔧 Creating virtual environment..."
python3 -m venv .venv
source .venv/bin/activate

echo "📦 Installing SDK..."
pip install -e ".[dev]" --quiet

echo "🧪 Testing imports..."
python3 -c "
from oblivion import (
    OblivionClient,
    TaskAssignedPayload,
    ContextUpdatePayload,
    EventType,
    AgentStatus,
)

print('✅ All imports successful!')
print(f'   EventType values: {[e.value for e in EventType]}')
print(f'   AgentStatus values: {[s.value for s in AgentStatus]}')
"

echo "✅ SDK test complete!"
echo ""
echo "To use the SDK:"
echo "  source .venv/bin/activate"
echo "  python examples/simple_agent.py"
