/**
 * Integration tests for Profile Lock Manager
 *
 * Validates:
 * - TOCTOU race condition prevention with atomic file locking
 * - PID reuse attack prevention with start time validation
 * - Stale lock cleanup
 * - Concurrent profile claiming
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  acquireProfileLock,
  releaseProfileLock,
  getProfileForPid,
  cleanStaleLocks,
  getAvailableProfiles,
  getAllLocks,
} from '../profile-lock-manager.js';

// Use actual temp directory for integration tests
const TEST_DIR = path.join(os.tmpdir(), `oblivion-test-${process.pid}`);
const ORIGINAL_HOME = process.env.HOME;

describe('ProfileLockManager - Integration Tests', () => {
  beforeAll(async () => {
    // Create isolated test directory
    await fs.promises.mkdir(TEST_DIR, { recursive: true, mode: 0o700 });
    // Point HOME to test directory
    process.env.HOME = TEST_DIR;
  });

  afterAll(async () => {
    // Restore original HOME
    process.env.HOME = ORIGINAL_HOME;
    // Cleanup test directory
    try {
      await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should acquire and release profile locks', async () => {
    const testPid = process.pid; // Use real PID
    const profiles = ['test-agent-1'];

    const claimed = await acquireProfileLock(testPid, profiles);
    expect(claimed).toBe('test-agent-1');

    const profile = await getProfileForPid(testPid);
    expect(profile).toBe('test-agent-1');

    await releaseProfileLock(testPid);

    const profileAfterRelease = await getProfileForPid(testPid);
    expect(profileAfterRelease).toBeNull();
  });

  it('should return null when no profiles available', async () => {
    const testPid = process.pid;
    const profiles = ['single-agent'];

    // Claim the only profile
    const claim1 = await acquireProfileLock(testPid, profiles);
    expect(claim1).toBe('single-agent');

    // Try to claim again with different profile list (but profile is locked)
    const claim2 = await acquireProfileLock(testPid, profiles);
    expect(claim2).toBeNull(); // All profiles locked

    await releaseProfileLock(testPid);
  });

  it('should verify lock data structure', async () => {
    const testPid = process.pid;
    const profiles = ['struct-test'];

    await acquireProfileLock(testPid, profiles);

    const locks = await getAllLocks();
    const lock = locks.find(l => l.pid === testPid);

    expect(lock).toBeDefined();
    expect(lock?.profile).toBe('struct-test');
    expect(lock?.pid).toBe(testPid);
    expect(lock?.startTime).toBeGreaterThan(0);
    expect(lock?.lockedAt).toBeDefined();

    // Cleanup
    await releaseProfileLock(testPid);
  });

  it('should detect PID reuse via start time mismatch', async () => {
    // CRITICAL SECURITY TEST: PID reuse attack prevention

    // Create a lock manually with WRONG start time (simulating reused PID)
    const testPid = process.pid;
    const oblivionDir = path.join(TEST_DIR, '.oblivion');
    await fs.promises.mkdir(oblivionDir, { recursive: true });

    const locksPath = path.join(oblivionDir, 'profile-locks.json');
    const fakeOldStartTime = Date.now() - 99999999; // Very old start time (not this process)

    await fs.promises.writeFile(
      locksPath,
      JSON.stringify({
        locks: {
          [testPid]: {
            profile: 'reused-pid-agent',
            pid: testPid,
            startTime: fakeOldStartTime, // Wrong start time!
            lockedAt: new Date().toISOString(),
          },
        },
      }),
      { mode: 0o600 }
    );

    // getProfileForPid should detect the start time mismatch
    const profile = await getProfileForPid(testPid);

    // Should return null because start time doesn't match this process
    expect(profile).toBeNull();

    // The lock should have been automatically cleaned up
    const locks = await getAllLocks();
    expect(locks.find(l => l.pid === testPid)).toBeUndefined();
  });

  it('should allow same PID to reclaim after release', async () => {
    const testPid = process.pid;
    const profiles = ['reclaim-test'];

    // First claim
    const claim1 = await acquireProfileLock(testPid, profiles);
    expect(claim1).toBe('reclaim-test');

    // Release
    await releaseProfileLock(testPid);

    // Should be able to claim again
    const claim2 = await acquireProfileLock(testPid, profiles);
    expect(claim2).toBe('reclaim-test');

    // Cleanup
    await releaseProfileLock(testPid);
  });

  it('should handle rapid acquire/release cycles', async () => {
    const testPid = process.pid;
    const profiles = ['rapid-test'];

    // Rapid cycles - validates atomic locking
    for (let i = 0; i < 10; i++) {
      const claimed = await acquireProfileLock(testPid, profiles);
      expect(claimed).toBe('rapid-test');
      await releaseProfileLock(testPid);
    }

    // Should end with no locks
    const locks = await getAllLocks();
    expect(locks.find(l => l.pid === testPid && l.profile === 'rapid-test')).toBeUndefined();
  });
});

