/**
 * Credentials Manager
 *
 * Handles persistent storage of Nexus credentials after agent registration.
 * Supports multiple agent profiles on the same host.
 *
 * Storage format:
 * {
 *   "agents": {
 *     "profile-name": { nexusUrl, clientId, clientSecret, ... }
 *   },
 *   "activeProfile": "profile-name"
 * }
 *
 * Profile selection priority:
 * 1. OBLIVION_PROFILE env var (explicit selection)
 * 2. activeProfile field in credentials file (last used)
 *
 * All file operations are async to avoid blocking the event loop.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getProfileForPid,
  acquireProfileLock,
  getAvailableProfiles,
  cleanStaleLocks,
} from './profile-lock-manager.js';

export interface AgentCredentials {
  nexusUrl: string;
  clientId: string;
  clientSecret: string;
  agentId?: string;
  agentName?: string;
  savedAt: string;
}

export interface CredentialsFile {
  agents: Record<string, AgentCredentials>;
  activeProfile?: string;
}

/**
 * Get the credentials file path
 */
function getCredentialsPath(): string {
  const homeDir = os.homedir();
  const oblivionDir = path.join(homeDir, '.oblivion');
  return path.join(oblivionDir, 'credentials.json');
}

/**
 * Ensure the .oblivion directory exists with secure permissions
 */
async function ensureOblivionDir(): Promise<string> {
  const homeDir = os.homedir();
  const oblivionDir = path.join(homeDir, '.oblivion');

  try {
    await fs.access(oblivionDir);
  } catch {
    await fs.mkdir(oblivionDir, { mode: 0o700 }); // rwx------ (owner only)
  }

  return oblivionDir;
}

/**
 * Load the credentials file (or create empty one)
 */
async function loadCredentialsFile(): Promise<CredentialsFile> {
  const credPath = getCredentialsPath();

  try {
    const data = await fs.readFile(credPath, 'utf-8');
    return JSON.parse(data) as CredentialsFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { agents: {} };
    }
    console.error(`⚠️  Failed to parse credentials file: ${error instanceof Error ? error.message : String(error)}`);
    return { agents: {} };
  }
}

/**
 * Save the credentials file
 */
async function saveCredentialsFile(data: CredentialsFile): Promise<void> {
  await ensureOblivionDir();
  const credPath = getCredentialsPath();
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(credPath, json, { mode: 0o600 }); // rw------- (owner only)
}

/**
 * Add or update agent credentials in the profile store
 * No longer sets activeProfile - profiles are now selected via PID locking
 */
export async function saveCredentials(credentials: AgentCredentials): Promise<void> {
  try {
    const data = await loadCredentialsFile();
    const profileName = credentials.clientId; // Use clientId as profile name

    // Add/update the agent profile
    data.agents[profileName] = credentials;

    // Don't set activeProfile anymore - PID locking handles selection
    // Keep old activeProfile if it exists (for backward compatibility)

    await saveCredentialsFile(data);

    console.error(`✅ Credentials saved to ~/.oblivion/credentials.json`);
    console.error(`   Profile: ${profileName} (${credentials.agentName || 'Agent'})`);
    console.error(`   Auto-selection enabled - restart Claude Code to use this profile`);
  } catch (error) {
    console.error(`⚠️  Failed to save credentials: ${error instanceof Error ? error.message : String(error)}`);
    console.error('   You will need to manually configure credentials in Claude Code MCP settings.');
  }
}

/**
 * Load credentials for a specific profile
 */
export async function loadCredentials(profileName?: string): Promise<AgentCredentials | null> {
  try {
    const data = await loadCredentialsFile();

    // Determine which profile to use
    const profile = profileName || process.env.OBLIVION_PROFILE || data.activeProfile;

    if (!profile) {
      // Silent return - no profile is expected during bootstrap
      return null;
    }

    const credentials = data.agents[profile];

    if (!credentials) {
      console.error(`⚠️  Profile '${profile}' not found in credentials file`);
      console.error(`   Available profiles: ${Object.keys(data.agents).join(', ') || '(none)'}`);
      return null;
    }

    // Validate required fields
    if (!credentials.nexusUrl || !credentials.clientId || !credentials.clientSecret) {
      console.error('⚠️  Invalid credentials - missing required fields');
      return null;
    }

    console.error(`✅ Loaded credentials for profile: ${profile}`);
    console.error(`   Agent: ${credentials.agentName || credentials.clientId}`);

    return credentials;
  } catch (error) {
    console.error(`⚠️  Failed to load credentials: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Clear a specific profile or all credentials
 */
export async function clearCredentials(profileName?: string): Promise<boolean> {
  try {
    const credPath = getCredentialsPath();

    try {
      await fs.access(credPath);
    } catch {
      return false;
    }

    if (!profileName) {
      // Clear entire file
      await fs.unlink(credPath);
      console.error(`✅ All credentials cleared from ${credPath}`);
      return true;
    }

    // Clear specific profile
    const data = await loadCredentialsFile();
    if (data.agents[profileName]) {
      delete data.agents[profileName];

      // Clear activeProfile if it was the deleted one
      if (data.activeProfile === profileName) {
        delete data.activeProfile;
      }

      await saveCredentialsFile(data);
      console.error(`✅ Profile '${profileName}' cleared`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`⚠️  Failed to clear credentials: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Get effective credentials with automatic profile selection
 *
 * Priority:
 * 1. Explicit env vars (NEXUS_CLIENT_ID, NEXUS_CLIENT_SECRET)
 * 2. OBLIVION_PROFILE env var
 * 3. Existing PID lock (this process already claimed a profile)
 * 4. Auto-assign first available unlocked profile
 * 5. Bootstrap mode (no credentials)
 */
export async function getEffectiveCredentials(): Promise<{
  nexusUrl?: string;
  clientId?: string;
  clientSecret?: string;
  selectedProfile?: string;
  selectionMethod?: string;
}> {
  // 1. Env vars take absolute priority
  if (process.env.NEXUS_URL && process.env.NEXUS_CLIENT_ID && process.env.NEXUS_CLIENT_SECRET) {
    return {
      nexusUrl: process.env.NEXUS_URL,
      clientId: process.env.NEXUS_CLIENT_ID,
      clientSecret: process.env.NEXUS_CLIENT_SECRET,
      selectionMethod: 'env vars',
    };
  }

  // Get NEXUS_URL (required for any operation)
  const nexusUrl = process.env.NEXUS_URL;
  if (!nexusUrl) {
    return { selectionMethod: 'none' };
  }

  // 2. Explicit OBLIVION_PROFILE env var
  if (process.env.OBLIVION_PROFILE) {
    const saved = await loadCredentials(process.env.OBLIVION_PROFILE);
    if (saved) {
      return {
        nexusUrl: saved.nexusUrl,
        clientId: saved.clientId,
        clientSecret: saved.clientSecret,
        selectedProfile: process.env.OBLIVION_PROFILE,
        selectionMethod: 'env var',
      };
    }
  }

  // Clean stale locks before checking
  await cleanStaleLocks();

  // 3. Check if this PID already has a locked profile
  const existingLock = await getProfileForPid(process.pid);
  if (existingLock) {
    const saved = await loadCredentials(existingLock);
    if (saved) {
      return {
        nexusUrl: saved.nexusUrl,
        clientId: saved.clientId,
        clientSecret: saved.clientSecret,
        selectedProfile: existingLock,
        selectionMethod: 'existing lock',
      };
    }
  }

  // 4. Try to auto-assign an available profile
  const allProfiles = await listProfiles();
  if (allProfiles.length > 0) {
    const available = await getAvailableProfiles(allProfiles);

    if (available.length > 0) {
      const profile = await acquireProfileLock(process.pid, allProfiles);
      if (profile) {
        const saved = await loadCredentials(profile);
        if (saved) {
          return {
            nexusUrl: saved.nexusUrl,
            clientId: saved.clientId,
            clientSecret: saved.clientSecret,
            selectedProfile: profile,
            selectionMethod: 'auto-assigned',
          };
        }
      }
    } else {
      // All profiles locked
      return {
        nexusUrl,
        selectionMethod: 'all_locked',
      };
    }
  }

  // 5. No profiles available (bootstrap mode)
  return {
    nexusUrl,
    selectionMethod: 'bootstrap',
  };
}

/**
 * List all saved agent profiles
 */
export async function listProfiles(): Promise<string[]> {
  const data = await loadCredentialsFile();
  return Object.keys(data.agents);
}
