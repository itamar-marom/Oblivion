# Next.js Frontend Rules (Observer)

**Purpose**: Guidelines for developing the Observer dashboard in `apps/observer/`

**Reference**: See [`../product/PRD.md`](../product/PRD.md) Section 4 (Observer Dashboard)

---

## 🎯 Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Icons**: Lucide React
- **Animation**: Framer Motion
- **Auth**: Clerk or NextAuth
- **WebSocket**: Socket.io client
- **Package Manager**: pnpm

---

## 📁 Observer Structure

```
apps/observer/
├── app/
│   ├── (auth)/             # Auth routes (login, signup)
│   ├── dashboard/
│   │   ├── mappings/       # ClickUp ↔ Slack project mapping UI
│   │   ├── agents/         # Agent roster (connected agents)
│   │   └── logs/           # Live feed (streaming event logs)
│   ├── api/                # API routes (if needed)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── features/
│   │   ├── mappings/       # Mapping UI components
│   │   ├── agents/         # Agent roster components
│   │   └── live-feed/      # Live feed components
│   └── ui/                 # shadcn/ui base components
├── lib/
│   ├── api/                # Nexus API client
│   ├── hooks/              # Custom hooks
│   └── websocket.ts        # Socket.io client singleton
└── Dockerfile
```

---

## 🔑 Key Patterns

### Mapping UI (ClickUp ↔ Slack)
```tsx
// app/dashboard/mappings/page.tsx (Server Component)
async function MappingsPage() {
  const mappings = await fetchMappings();  // Direct API call

  return (
    <div>
      <MappingList mappings={mappings} />
      <CreateMappingButton />
    </div>
  );
}

// components/features/mappings/mapping-form.tsx (Client Component)
'use client';

export function MappingForm() {
  const [clickupLists, setClickupLists] = useState([]);
  const [slackChannels, setSlackChannels] = useState([]);

  // Fetch lists and channels from Nexus API
  // Two-column UI: ClickUp Lists (left) ↔ Slack Channels (right)
  // "Link" button writes to Postgres via Nexus API
}
```

### Agent Roster
```tsx
// components/features/agents/agent-roster.tsx
'use client';

import { useAgentStatus } from '@/lib/hooks/use-agent-status';

export function AgentRoster() {
  const { agents, onlineCount } = useAgentStatus();  // WebSocket subscription

  return (
    <div>
      <h2>Connected Agents: {onlineCount}</h2>
      {agents.map(agent => (
        <AgentCard
          key={agent.id}
          name={agent.name}
          status={agent.status}  // online, offline, busy
          lastSeen={agent.lastSeen}
        />
      ))}
    </div>
  );
}
```

### Live Feed (Streaming Logs)
```tsx
// components/features/live-feed/live-feed.tsx
'use client';

import { useSocket } from '@/lib/hooks/use-socket';
import { useState, useEffect } from 'react';

export function LiveFeed() {
  const socket = useSocket();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    socket.on('LOG_EVENT', (event) => {
      setEvents(prev => [event, ...prev].slice(0, 100));  // Keep last 100
    });

    return () => socket.off('LOG_EVENT');
  }, [socket]);

  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <LogEntry key={i} event={event} />
      ))}
    </div>
  );
}
```

### WebSocket Client
```typescript
// lib/websocket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_NEXUS_URL + '/admin', {
      auth: { token: getAuthToken() },  // JWT from Clerk/NextAuth
      transports: ['websocket'],
    });

    socket.on('connect', () => console.log('Connected to Nexus'));
    socket.on('disconnect', () => console.log('Disconnected'));
  }

  return socket;
}

// lib/hooks/use-socket.ts
export function useSocket() {
  const [socket] = useState(() => getSocket());
  return socket;
}
```

---

## 🎨 UI Rules

### Component Architecture
- **Server Components**: Use by default for data fetching
- **Client Components**: Only when needed (hooks, event handlers, WebSocket)
- **Co-location**: Keep feature components together in `components/features/`
- **shadcn/ui**: Use for base components (Button, Dialog, Form, etc.)

### Styling
```tsx
// ✅ Good: Tailwind utilities
<div className="flex items-center gap-4 rounded-lg border bg-card p-4">
  <AgentAvatar />
  <div className="flex-1">
    <h3 className="font-semibold">{agent.name}</h3>
    <p className="text-sm text-muted-foreground">{agent.status}</p>
  </div>
</div>

// Use cn() for conditional classes
className={cn(
  "rounded-lg p-4",
  agent.online ? "bg-green-500/10" : "bg-gray-500/10"
)}
```

### Dark Mode
- Design for dark mode first
- Use CSS variables from tailwind.config.ts
- Test both light and dark modes

---

## 🔐 Authentication

### Clerk/NextAuth Setup
```tsx
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

// Protect routes
import { auth } from '@clerk/nextjs';

export default async function DashboardPage() {
  const { userId } = auth();
  if (!userId) redirect('/login');

  // Render protected content
}
```

---

## 🧪 Testing Rules

### Component Tests
```tsx
// components/features/mappings/mapping-form.test.tsx
import { render, screen, userEvent } from '@testing-library/react';

describe('MappingForm', () => {
  it('should submit form', async () => {
    render(<MappingForm />);

    await userEvent.selectOptions(screen.getByLabelText('ClickUp List'), 'list-123');
    await userEvent.selectOptions(screen.getByLabelText('Slack Channel'), 'C123');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(mockCreateMapping).toHaveBeenCalledWith({
      clickUpListId: 'list-123',
      slackChannelId: 'C123',
    });
  });
});
```

### E2E Tests (Playwright)
```typescript
// tests/e2e/mappings.spec.ts
import { test, expect } from '@playwright/test';

test('user can create mapping', async ({ page }) => {
  await page.goto('/dashboard/mappings');
  await page.click('button:has-text("New Mapping")');

  await page.selectOption('[name="clickupList"]', 'list-123');
  await page.selectOption('[name="slackChannel"]', 'C123');
  await page.click('button[type="submit"]');

  await expect(page.locator('text=Mapping created')).toBeVisible();
});
```

---

## ⚡ Performance Rules

- **Image Optimization**: Use Next.js `<Image>` component
- **Code Splitting**: Dynamic imports for heavy components
- **Server Components**: Fetch data server-side when possible
- **Streaming**: Use React Suspense for loading states
- **Caching**: Use Next.js caching for static data

---

## 🎯 Observer-Specific Features

### Mapping UI Requirements
- **Left Column**: ClickUp Lists (fetched from Nexus → ClickUp API)
- **Right Column**: Slack Channels (fetched from Nexus → Slack API)
- **Link Action**: Button creates `project_mappings` entry via Nexus API
- **Visual**: Show existing mappings, ability to unlink

### Agent Roster Requirements
- **Real-time Status**: Subscribe to WebSocket for agent online/offline events
- **Agent Info**: Name, status (online/offline/busy), last seen timestamp
- **Capabilities**: Show agent-registered task types
- **Metrics**: Show tasks completed, average completion time

### Live Feed Requirements
- **Event Streaming**: WebSocket subscription to Nexus event bus
- **Event Types**: Webhook received, Agent woke up, Message posted, Tool executed
- **Filtering**: Filter by agent, event type, time range
- **Auto-scroll**: Scroll to latest (with option to pause)
- **Collapsible**: Expand event details on click

---

**Last Updated**: 2026-01-02
**Reference**: [`tasks/MASTER.md`](../tasks/MASTER.md) Phase 4 (Observer Dashboard)
