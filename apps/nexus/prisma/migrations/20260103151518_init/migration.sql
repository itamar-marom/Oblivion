-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED_ON_HUMAN', 'DONE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clickupListId" TEXT NOT NULL,
    "clickupSpaceId" TEXT,
    "slackChannelId" TEXT NOT NULL,
    "slackTeamId" TEXT NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_mappings" (
    "id" TEXT NOT NULL,
    "projectMappingId" TEXT NOT NULL,
    "clickupTaskId" TEXT NOT NULL,
    "slackChannelId" TEXT NOT NULL,
    "slackThreadTs" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatarUrl" TEXT,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_aliases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AgentToAliases" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AgentToAliases_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "project_mappings_clickupListId_key" ON "project_mappings"("clickupListId");

-- CreateIndex
CREATE UNIQUE INDEX "project_mappings_slackChannelId_key" ON "project_mappings"("slackChannelId");

-- CreateIndex
CREATE INDEX "project_mappings_tenantId_idx" ON "project_mappings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "task_mappings_clickupTaskId_key" ON "task_mappings"("clickupTaskId");

-- CreateIndex
CREATE INDEX "task_mappings_projectMappingId_idx" ON "task_mappings"("projectMappingId");

-- CreateIndex
CREATE INDEX "task_mappings_slackChannelId_slackThreadTs_idx" ON "task_mappings"("slackChannelId", "slackThreadTs");

-- CreateIndex
CREATE UNIQUE INDEX "agents_clientId_key" ON "agents"("clientId");

-- CreateIndex
CREATE INDEX "agents_tenantId_idx" ON "agents"("tenantId");

-- CreateIndex
CREATE INDEX "agents_clientId_idx" ON "agents"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_aliases_tenantId_alias_key" ON "agent_aliases"("tenantId", "alias");

-- CreateIndex
CREATE INDEX "_AgentToAliases_B_index" ON "_AgentToAliases"("B");

-- AddForeignKey
ALTER TABLE "project_mappings" ADD CONSTRAINT "project_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_mappings" ADD CONSTRAINT "task_mappings_projectMappingId_fkey" FOREIGN KEY ("projectMappingId") REFERENCES "project_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_aliases" ADD CONSTRAINT "agent_aliases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentToAliases" ADD CONSTRAINT "_AgentToAliases_A_fkey" FOREIGN KEY ("A") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentToAliases" ADD CONSTRAINT "_AgentToAliases_B_fkey" FOREIGN KEY ("B") REFERENCES "agent_aliases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
