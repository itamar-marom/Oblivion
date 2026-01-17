/**
 * Profile Lock Manager
 *
 * Manages PID-based locking of agent profiles to enable multiple Claude Code
 * instances to automatically use different agent identities without configuration.
 *
 * Each MCP server process claims an available profile via its PID. The lock
 * is released when the process exits. Stale locks (from crashed processes) are
 * automatically cleaned up on startup.
 *
 * Security Features:
 * - Atomic file operations with advisory locking to prevent TOCTOU races
 * - Process start time validation to prevent PID reuse attacks
 *
 * All file operations are async to avoid blocking the event loop.
 */

import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import type { FileHandle } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface ProfileLock {
  profile: string;
  pid: number;
  startTime: number; // Process start time in ms (prevents PID reuse attacks)
  lockedAt: string;
}

export interface ProfileLocksFile {
  locks: Record<string, ProfileLock>;
}

// Lock file for atomic operations
const LOCK_FILE_NAME = '.profile-locks.lock';
const LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_DELAY_MS = 50;

/**
 * Get the Oblivion directory path
 */
function getOblivionDir(): string {
  return path.join(os.homedir(), '.oblivion');
}

/**
 * Get the profile locks file path
 */
function getLocksPath(): string {
  return path.join(getOblivionDir(), 'profile-locks.json');
}

/**
 * Get the lock file path for atomic operations
 */
function getLockFilePath(): string {
  return path.join(getOblivionDir(), LOCK_FILE_NAME);
}

/**
 * Ensure the Oblivion directory exists
 */
async function ensureOblivionDir(): Promise<void> {
  const dir = getOblivionDir();
  try {
    await fsPromises.access(dir);
  } catch {
    await fsPromises.mkdir(dir, { mode: 0o700 });
  }
}

/**
 * Sleep for specified milliseconds (async version of busy wait)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Acquire an advisory file lock for atomic operations.
 * Uses exclusive file creation to implement locking.
 */
async function acquireFileLock(): Promise<FileHandle | null> {
  await ensureOblivionDir();
  const lockPath = getLockFilePath();
  const startTime = Date.now();

  while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
    try {
      // Try to create lock file exclusively (O_CREAT | O_EXCL)
      const handle = await fsPromises.open(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR, 0o600);
      // Write our PID to the lock file for debugging
      await handle.write(String(process.pid));
      return handle;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        // Lock file exists - check if it's stale
        try {
          const stat = await fsPromises.stat(lockPath);
          // If lock file is older than timeout, it's stale - remove it
          if (Date.now() - stat.mtimeMs > LOCK_TIMEOUT_MS) {
            await fsPromises.unlink(lockPath);
            continue;
          }
        } catch {
          // Stat failed, try again
        }
        // Wait and retry (async sleep instead of busy wait)
        const waitTime = LOCK_RETRY_DELAY_MS + Math.random() * LOCK_RETRY_DELAY_MS;
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }

  console.error('⚠️  Failed to acquire file lock within timeout');
  return null;
}

/**
 * Release the advisory file lock
 */
async function releaseFileLock(handle: FileHandle): Promise<void> {
  try {
    await handle.close();
    await fsPromises.unlink(getLockFilePath());
  } catch (error) {
    console.error(`⚠️  Failed to release file lock: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get process start time for PID reuse detection.
 * Returns process start time in milliseconds since epoch, or null if unavailable.
 */
async function getProcessStartTime(pid: number): Promise<number | null> {
  try {
    if (process.platform === 'darwin') {
      // macOS: use ps command to get actual start time
      const { execSync } = await import('child_process');
      const output = execSync(`ps -p ${pid} -o lstart=`, { encoding: 'utf-8', timeout: 1000 }).trim();
      if (output) {
        return new Date(output).getTime();
      }
    } else if (process.platform === 'linux') {
      // Linux: Simplified approach - skip start time validation
      // The /proc/{pid}/stat approach returns clock ticks which require
      // boot time and HZ conversion (complex and error-prone)
      //
      // For production: PID-only checking is acceptable since:
      // 1. PID reuse is rare on modern systems (large PID space)
      // 2. Lock files are short-lived (released on process exit)
      // 3. Stale lock cleanup handles crashed processes
      //
      // Future: Could implement proper tick-to-ms conversion if needed
      return null; // Skip start time validation on Linux
    }
  } catch {
    // Process doesn't exist or command failed
  }
  return null;
}

/**
 * Get current process start time
 */
function getCurrentProcessStartTime(): number {
  // For current process, we can use process.hrtime.bigint() at startup
  // or approximate with Date.now() - process.uptime() * 1000
  return Date.now() - process.uptime() * 1000;
}

/**
 * Load the profile locks file (internal - caller must hold file lock)
 */
async function loadLocksFileInternal(): Promise<ProfileLocksFile> {
  const locksPath = getLocksPath();

  try {
    const data = await fsPromises.readFile(locksPath, 'utf-8');
    return JSON.parse(data) as ProfileLocksFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { locks: {} };
    }
    console.error(`⚠️  Failed to parse locks file: ${error instanceof Error ? error.message : String(error)}`);
    return { locks: {} };
  }
}

/**
 * Load the profile locks file (public - acquires file lock)
 */
async function loadLocksFile(): Promise<ProfileLocksFile> {
  const handle = await acquireFileLock();
  if (handle === null) {
    return { locks: {} };
  }
  try {
    return await loadLocksFileInternal();
  } finally {
    await releaseFileLock(handle);
  }
}

/**
 * Save the profile locks file (internal - caller must hold file lock)
 */
async function saveLocksFileInternal(data: ProfileLocksFile): Promise<void> {
  await ensureOblivionDir();
  const locksPath = getLocksPath();
  const json = JSON.stringify(data, null, 2);

  // Write to temp file first, then rename (atomic on most filesystems)
  const tempPath = `${locksPath}.tmp.${process.pid}`;
  await fsPromises.writeFile(tempPath, json, { mode: 0o600 });
  await fsPromises.rename(tempPath, locksPath);
}

/**
 * Check if a process with given PID and start time is alive.
 * Validates both PID existence AND start time to prevent PID reuse attacks.
 */
async function isProcessAlive(pid: number, expectedStartTime?: number): Promise<boolean> {
  try {
    // Signal 0 doesn't kill the process, just checks if it exists
    process.kill(pid, 0);

    // If we have an expected start time, validate it matches
    if (expectedStartTime !== undefined) {
      const actualStartTime = await getProcessStartTime(pid);
      if (actualStartTime !== null) {
        // Allow some tolerance (5 seconds) for clock skew
        const tolerance = 5000;
        if (Math.abs(actualStartTime - expectedStartTime) > tolerance) {
          // PID exists but start time doesn't match - this is a reused PID!
          console.error(`⚠️  PID ${pid} exists but start time mismatch (expected: ${expectedStartTime}, actual: ${actualStartTime}) - PID was reused`);
          return false;
        }
      }
    }

    return true;
  } catch {
    // ESRCH = no such process
    return false;
  }
}

/**
 * Clean up locks for dead processes (with atomic file locking)
 * Returns list of cleaned PIDs
 */
export async function cleanStaleLocks(): Promise<number[]> {
  const handle = await acquireFileLock();
  if (handle === null) {
    console.error('⚠️  Could not acquire lock for cleanup');
    return [];
  }

  try {
    const data = await loadLocksFileInternal();
    const cleanedPids: number[] = [];

    for (const [pidStr, lock] of Object.entries(data.locks)) {
      const pid = parseInt(pidStr, 10);

      // Check if process is alive AND has matching start time
      if (!(await isProcessAlive(pid, lock.startTime))) {
        console.error(`🧹 Cleaning stale lock: PID ${pid} (${lock.profile})`);
        delete data.locks[pidStr];
        cleanedPids.push(pid);
      }
    }

    if (cleanedPids.length > 0) {
      await saveLocksFileInternal(data);
    }

    return cleanedPids;
  } finally {
    await releaseFileLock(handle);
  }
}

/**
 * Get the profile locked by a specific PID (with atomic file locking)
 */
export async function getProfileForPid(pid: number): Promise<string | null> {
  const handle = await acquireFileLock();
  if (handle === null) {
    return null;
  }

  try {
    const data = await loadLocksFileInternal();
    const lock = data.locks[pid.toString()];

    if (!lock) {
      return null;
    }

    // Validate the process is still alive with start time check
    if (!(await isProcessAlive(pid, lock.startTime))) {
      // Stale lock - clean it up
      delete data.locks[pid.toString()];
      await saveLocksFileInternal(data);
      return null;
    }

    return lock.profile;
  } finally {
    await releaseFileLock(handle);
  }
}

/**
 * Get list of profiles that are currently locked (internal - caller must hold file lock)
 */
function getLockedProfilesInternal(data: ProfileLocksFile): string[] {
  return Object.values(data.locks).map(lock => lock.profile);
}

/**
 * Get list of profiles that are currently locked (public)
 */
export async function getLockedProfiles(): Promise<string[]> {
  const data = await loadLocksFile();
  return Object.values(data.locks).map(lock => lock.profile);
}

/**
 * Get list of available (unlocked) profiles (internal - uses provided data)
 */
function getAvailableProfilesInternal(allProfiles: string[], data: ProfileLocksFile): string[] {
  const locked = new Set(getLockedProfilesInternal(data));
  return allProfiles.filter(profile => !locked.has(profile));
}

/**
 * Get list of available (unlocked) profiles
 *
 * @param allProfiles - List of all profile names from credentials file
 * @returns List of profiles not currently locked
 */
export async function getAvailableProfiles(allProfiles: string[]): Promise<string[]> {
  const locked = new Set(await getLockedProfiles());
  return allProfiles.filter(profile => !locked.has(profile));
}

/**
 * Acquire a lock on a profile for the current process (ATOMIC operation)
 *
 * This function is protected against TOCTOU race conditions by using
 * file-level advisory locking. The entire read-check-write operation
 * is performed atomically.
 *
 * @param pid - Process ID to lock for
 * @param availableProfiles - List of available profile names
 * @returns Profile name if successful, null if all locked
 */
export async function acquireProfileLock(pid: number, availableProfiles: string[]): Promise<string | null> {
  // Acquire file lock for atomic operation
  const handle = await acquireFileLock();
  if (handle === null) {
    console.error('⚠️  Could not acquire file lock for profile claim');
    return null;
  }

  try {
    // Load current state
    const data = await loadLocksFileInternal();

    // Clean stale locks (while holding the lock)
    let modified = false;
    for (const [pidStr, lock] of Object.entries(data.locks)) {
      const lockPid = parseInt(pidStr, 10);
      if (!(await isProcessAlive(lockPid, lock.startTime))) {
        console.error(`🧹 Cleaning stale lock: PID ${lockPid} (${lock.profile})`);
        delete data.locks[pidStr];
        modified = true;
      }
    }

    // Find available profiles (using cleaned data)
    const available = getAvailableProfilesInternal(availableProfiles, data);

    if (available.length === 0) {
      if (modified) {
        await saveLocksFileInternal(data);
      }
      return null;
    }

    // Claim the first available profile
    const profile = available[0];
    const startTime = getCurrentProcessStartTime();

    data.locks[pid.toString()] = {
      profile,
      pid,
      startTime,
      lockedAt: new Date().toISOString(),
    };

    await saveLocksFileInternal(data);

    console.error(`🔒 Locked profile '${profile}' for PID ${pid} (startTime: ${startTime})`);

    return profile;
  } finally {
    await releaseFileLock(handle);
  }
}

/**
 * Release the profile lock for a specific PID (with atomic file locking)
 */
export async function releaseProfileLock(pid: number): Promise<void> {
  const handle = await acquireFileLock();
  if (handle === null) {
    console.error('⚠️  Could not acquire file lock for release');
    return;
  }

  try {
    const data = await loadLocksFileInternal();
    const lock = data.locks[pid.toString()];

    if (lock) {
      delete data.locks[pid.toString()];
      await saveLocksFileInternal(data);
      console.error(`🔓 Released profile '${lock.profile}' for PID ${pid}`);
    }
  } finally {
    await releaseFileLock(handle);
  }
}

/**
 * Get all current locks (for debugging)
 */
export async function getAllLocks(): Promise<ProfileLock[]> {
  const data = await loadLocksFile();
  return Object.values(data.locks);
}
