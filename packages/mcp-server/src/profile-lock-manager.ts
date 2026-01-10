/**
 * Profile Lock Manager
 *
 * Manages PID-based locking of agent profiles to enable multiple Claude Code
 * instances to automatically use different agent identities without configuration.
 *
 * Each MCP server process claims an available profile via its PID. The lock
 * is released when the process exits. Stale locks (from crashed processes) are
 * automatically cleaned up on startup.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ProfileLock {
  profile: string;
  pid: number;
  lockedAt: string;
}

export interface ProfileLocksFile {
  locks: Record<string, ProfileLock>;
}

/**
 * Get the profile locks file path
 */
function getLocksPath(): string {
  const homeDir = os.homedir();
  const oblivionDir = path.join(homeDir, '.oblivion');
  return path.join(oblivionDir, 'profile-locks.json');
}

/**
 * Load the profile locks file
 */
function loadLocksFile(): ProfileLocksFile {
  const locksPath = getLocksPath();

  if (!fs.existsSync(locksPath)) {
    return { locks: {} };
  }

  try {
    const data = fs.readFileSync(locksPath, 'utf-8');
    return JSON.parse(data) as ProfileLocksFile;
  } catch (error) {
    console.error(`⚠️  Failed to parse locks file: ${error instanceof Error ? error.message : String(error)}`);
    return { locks: {} };
  }
}

/**
 * Save the profile locks file
 */
function saveLocksFile(data: ProfileLocksFile): void {
  const homeDir = os.homedir();
  const oblivionDir = path.join(homeDir, '.oblivion');

  // Ensure directory exists
  if (!fs.existsSync(oblivionDir)) {
    fs.mkdirSync(oblivionDir, { mode: 0o700 });
  }

  const locksPath = getLocksPath();
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(locksPath, json, { mode: 0o600 }); // rw------- (owner only)
}

/**
 * Check if a process with given PID is alive
 */
function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 doesn't kill the process, just checks if it exists
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH = no such process
    return false;
  }
}

/**
 * Clean up locks for dead processes
 * Returns list of cleaned PIDs
 */
export function cleanStaleLocks(): number[] {
  const data = loadLocksFile();
  const cleanedPids: number[] = [];

  for (const [pidStr, lock] of Object.entries(data.locks)) {
    const pid = parseInt(pidStr, 10);

    if (!isProcessAlive(pid)) {
      console.error(`🧹 Cleaning stale lock: PID ${pid} (${lock.profile})`);
      delete data.locks[pidStr];
      cleanedPids.push(pid);
    }
  }

  if (cleanedPids.length > 0) {
    saveLocksFile(data);
  }

  return cleanedPids;
}

/**
 * Get the profile locked by a specific PID
 */
export function getProfileForPid(pid: number): string | null {
  const data = loadLocksFile();
  const lock = data.locks[pid.toString()];

  if (!lock) {
    return null;
  }

  // Validate the process is still alive
  if (!isProcessAlive(pid)) {
    // Stale lock - clean it up
    delete data.locks[pid.toString()];
    saveLocksFile(data);
    return null;
  }

  return lock.profile;
}

/**
 * Get list of profiles that are currently locked
 */
export function getLockedProfiles(): string[] {
  const data = loadLocksFile();
  return Object.values(data.locks).map(lock => lock.profile);
}

/**
 * Get list of available (unlocked) profiles
 *
 * @param allProfiles - List of all profile names from credentials file
 * @returns List of profiles not currently locked
 */
export function getAvailableProfiles(allProfiles: string[]): string[] {
  const locked = new Set(getLockedProfiles());
  return allProfiles.filter(profile => !locked.has(profile));
}

/**
 * Acquire a lock on a profile for the current process
 *
 * @param pid - Process ID to lock for
 * @param availableProfiles - List of available profile names
 * @returns Profile name if successful, null if all locked
 */
export function acquireProfileLock(pid: number, availableProfiles: string[]): string | null {
  // Clean stale locks first
  cleanStaleLocks();

  const available = getAvailableProfiles(availableProfiles);

  if (available.length === 0) {
    return null;
  }

  // Claim the first available profile
  const profile = available[0];

  const data = loadLocksFile();
  data.locks[pid.toString()] = {
    profile,
    pid,
    lockedAt: new Date().toISOString(),
  };

  saveLocksFile(data);

  console.error(`🔒 Locked profile '${profile}' for PID ${pid}`);

  return profile;
}

/**
 * Release the profile lock for a specific PID
 */
export function releaseProfileLock(pid: number): void {
  const data = loadLocksFile();
  const lock = data.locks[pid.toString()];

  if (lock) {
    delete data.locks[pid.toString()];
    saveLocksFile(data);
    console.error(`🔓 Released profile '${lock.profile}' for PID ${pid}`);
  }
}

/**
 * Get all current locks (for debugging)
 */
export function getAllLocks(): ProfileLock[] {
  const data = loadLocksFile();
  return Object.values(data.locks);
}
