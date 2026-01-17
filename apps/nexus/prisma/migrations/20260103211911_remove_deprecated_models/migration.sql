/*
  Warnings:

  - You are about to drop the `_AgentToAliases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agent_aliases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_mappings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `task_mappings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_AgentToAliases" DROP CONSTRAINT "_AgentToAliases_A_fkey";

-- DropForeignKey
ALTER TABLE "_AgentToAliases" DROP CONSTRAINT "_AgentToAliases_B_fkey";

-- DropForeignKey
ALTER TABLE "agent_aliases" DROP CONSTRAINT "agent_aliases_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "project_mappings" DROP CONSTRAINT "project_mappings_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "task_mappings" DROP CONSTRAINT "task_mappings_projectMappingId_fkey";

-- DropTable
DROP TABLE "_AgentToAliases";

-- DropTable
DROP TABLE "agent_aliases";

-- DropTable
DROP TABLE "project_mappings";

-- DropTable
DROP TABLE "task_mappings";
