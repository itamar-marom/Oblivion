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
 */

import * as fs from 'fs';
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
function ensureOblivionDir(): string {
  const homeDir = os.homedir();
  const oblivionDir = path.join(homeDir, '.oblivion');

  if (!fs.existsSync(oblivionDir)) {
    fs.mkdirSync(oblivionDir, { mode: 0o700 }); // rwx------ (owner only)
  }

  return oblivionDir;
}

/**
 * Load the credentials file (or create empty one)
 */
function loadCredentialsFile(): CredentialsFile {
  const credPath = getCredentialsPath();

  if (!fs.existsSync(credPath)) {
    return { agents: {} };
  }

  try {
    const data = fs.readFileSync(credPath, 'utf-8');
    return JSON.parse(data) as CredentialsFile;
  } catch (error) {
    console.error(`⚠️  Failed to parse credentials file: ${error instanceof Error ? error.message : String(error)}`);
    return { agents: {} };
  }
}

/**
 * Save the credentials file
 */
function saveCredentialsFile(data: CredentialsFile): void {
  ensureOblivionDir();
  const credPath = getCredentialsPath();
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(credPath, json, { mode: 0o600 }); // rw------- (owner only)
}

/**
 * Add or update agent credentials in the profile store
 * No longer sets activeProfile - profiles are now selected via PID locking
 */
export function saveCredentials(credentials: AgentCredentials): void {
  try {
    const data = loadCredentialsFile();
    const profileName = credentials.clientId; // Use clientId as profile name

    // Add/update the agent profile
    data.agents[profileName] = credentials;

    // Don't set activeProfile anymore - PID locking handles selection
    // Keep old activeProfile if it exists (for backward compatibility)

    saveCredentialsFile(data);

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
export function loadCredentials(profileName?: string): AgentCredentials | null {
  try {
    const data = loadCredentialsFile();

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
export function clearCredentials(profileName?: string): boolean {
  try {
    const credPath = getCredentialsPath();

    if (!fs.existsSync(credPath)) {
      return false;
    }

    if (!profileName) {
      // Clear entire file
      fs.unlinkSync(credPath);
      console.error(`✅ All credentials cleared from ${credPath}`);
      return true;
    }

    // Clear specific profile
    const data = loadCredentialsFile();
    if (data.agents[profileName]) {
      delete data.agents[profileName];

      // Clear activeProfile if it was the deleted one
      if (data.activeProfile === profileName) {
        delete data.activeProfile;
      }

      saveCredentialsFile(data);
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
export function getEffectiveCredentials(): {
  nexusUrl?: string;
  clientId?: string;
  clientSecret?: string;
  selectedProfile?: string;
  selectionMethod?: string;
} {
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
    const saved = loadCredentials(process.env.OBLIVION_PROFILE);
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
  cleanStaleLocks();

  // 3. Check if this PID already has a locked profile
  const existingLock = getProfileForPid(process.pid);
  if (existingLock) {
    const saved = loadCredentials(existingLock);
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
  const allProfiles = listProfiles();
  if (allProfiles.length > 0) {
    const available = getAvailableProfiles(allProfiles);

    if (available.length > 0) {
      const profile = acquireProfileLock(process.pid, allProfiles);
      if (profile) {
        const saved = loadCredentials(profile);
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
export function listProfiles(): string[] {
  const data = loadCredentialsFile();
  return Object.keys(data.agents);
}
