-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'CLAIMED';

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "slackChannelId" TEXT,
    "slackChannelName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_group_memberships" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "oblivionTag" TEXT,
    "slackChannelId" TEXT,
    "slackChannelName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clickupTaskId" TEXT NOT NULL,
    "title" TEXT,
    "slackChannelId" TEXT,
    "slackThreadTs" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "claimedByAgentId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groups_tenantId_idx" ON "groups"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "groups_tenantId_slug_key" ON "groups"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "agent_group_memberships_agentId_idx" ON "agent_group_memberships"("agentId");

-- CreateIndex
CREATE INDEX "agent_group_memberships_groupId_idx" ON "agent_group_memberships"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_group_memberships_agentId_groupId_key" ON "agent_group_memberships"("agentId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_oblivionTag_key" ON "projects"("oblivionTag");

-- CreateIndex
CREATE INDEX "projects_tenantId_idx" ON "projects"("tenantId");

-- CreateIndex
CREATE INDEX "projects_groupId_idx" ON "projects"("groupId");

-- CreateIndex
CREATE INDEX "projects_oblivionTag_idx" ON "projects"("oblivionTag");

-- CreateIndex
CREATE UNIQUE INDEX "projects_groupId_slug_key" ON "projects"("groupId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_clickupTaskId_key" ON "tasks"("clickupTaskId");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex
CREATE INDEX "tasks_claimedByAgentId_idx" ON "tasks"("claimedByAgentId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_slackChannelId_slackThreadTs_idx" ON "tasks"("slackChannelId", "slackThreadTs");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_group_memberships" ADD CONSTRAINT "agent_group_memberships_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_group_memberships" ADD CONSTRAINT "agent_group_memberships_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_claimedByAgentId_fkey" FOREIGN KEY ("claimedByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
