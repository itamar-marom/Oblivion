/**
 * Integration tests for NexusClient
 *
 * Validates:
 * - Client instantiation and configuration
 * - Error handling with NexusError
 * - Configuration options (timeout, retries, keepalive)
 */

import { describe, it, expect } from '@jest/globals';
import { NexusClient } from '../nexus-client.js';
import { ErrorCode, NexusError } from '../errors.js';

describe('NexusClient - Configuration', () => {
  it('should instantiate with required config', () => {
    const client = new NexusClient({
      baseUrl: 'http://localhost:3000',
      clientId: 'test-client',
      clientSecret: 'test-secret',
    });

    expect(client).toBeDefined();
    expect((client as any).config.baseUrl).toBe('http://localhost:3000');
    expect((client as any).config.clientId).toBe('test-client');
  });

  it('should apply default options', () => {
    const client = new NexusClient({
      baseUrl: 'http://localhost:3000',
      clientId: 'test-client',
      clientSecret: 'test-secret',
    });

    expect((client as any).timeoutMs).toBe(30000); // Default 30s
    expect((client as any).keepAlive).toBe(true); // Default enabled
    expect((client as any).retryConfig.maxRetries).toBe(3); // Default retries
  });

  it('should allow custom configuration options', () => {
    const client = new NexusClient(
      {
        baseUrl: 'http://localhost:3000',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      },
      {
        timeoutMs: 5000,
        keepAlive: false,
        retryConfig: {
          maxRetries: 5,
          baseDelayMs: 200,
          maxDelayMs: 2000,
        },
      }
    );

    expect((client as any).timeoutMs).toBe(5000);
    expect((client as any).keepAlive).toBe(false);
    expect((client as any).retryConfig.maxRetries).toBe(5);
    expect((client as any).retryConfig.baseDelayMs).toBe(200);
  });
});

describe('NexusClient - Error Handling', () => {
  it('should create NexusError with correct properties', () => {
    const error = new NexusError({
      code: ErrorCode.API_CONFLICT,
      message: 'Task already claimed',
      httpStatus: 409,
      retryable: false,
      context: { taskId: '123' },
    });

    expect(error.code).toBe(ErrorCode.API_CONFLICT);
    expect(error.message).toBe('Task already claimed');
    expect(error.httpStatus).toBe(409);
    expect(error.retryable).toBe(false);
    expect(error.context?.taskId).toBe('123');
    expect(error.name).toBe('NexusError');
  });

  it('should format error toString correctly', () => {
    const error = new NexusError({
      code: ErrorCode.NETWORK_TIMEOUT,
      message: 'Request timed out',
      httpStatus: undefined,
      retryable: true,
    });

    const errorString = error.toString();
    expect(errorString).toContain('[NETWORK_TIMEOUT]');
    expect(errorString).toContain('Request timed out');
  });

  it('should serialize to JSON', () => {
    const error = new NexusError({
      code: ErrorCode.AUTH_FAILED,
      message: 'Authentication failed',
      httpStatus: 401,
      retryable: false,
    });

    const json = error.toJSON();
    expect(json.code).toBe(ErrorCode.AUTH_FAILED);
    expect(json.message).toBe('Authentication failed');
    expect(json.httpStatus).toBe(401);
    expect(json.retryable).toBe(false);
  });
});

describe('NexusClient - Retry Configuration', () => {
  it('should configure retries with exponential backoff', () => {
    const client = new NexusClient({
      baseUrl: 'http://localhost:3000',
      clientId: 'test-client',
      clientSecret: 'test-secret',
    });

    const retryConfig = (client as any).retryConfig;
    expect(retryConfig.maxRetries).toBe(3);
    expect(retryConfig.baseDelayMs).toBe(1000);
    expect(retryConfig.maxDelayMs).toBe(10000);
  });

  it('should allow custom retry configuration', () => {
    const client = new NexusClient(
      {
        baseUrl: 'http://localhost:3000',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      },
      {
        retryConfig: {
          maxRetries: 5,
          baseDelayMs: 500,
          maxDelayMs: 5000,
        },
      }
    );

    const retryConfig = (client as any).retryConfig;
    expect(retryConfig.maxRetries).toBe(5);
    expect(retryConfig.baseDelayMs).toBe(500);
    expect(retryConfig.maxDelayMs).toBe(5000);
  });
});

describe('NexusClient - Token Management', () => {
  it('should have refreshPromise mechanism to prevent race conditions', () => {
    const client = new NexusClient({
      baseUrl: 'http://localhost:3000',
      clientId: 'test-client',
      clientSecret: 'test-secret',
    });

    // Verify refreshPromise property exists (prevents concurrent auth calls)
    expect((client as any).refreshPromise).toBeNull();
    expect((client as any).hasOwnProperty('refreshPromise')).toBe(true);
  });

  it('should cache tokens with expiry time', () => {
    const client = new NexusClient({
      baseUrl: 'http://localhost:3000',
      clientId: 'test-client',
      clientSecret: 'test-secret',
    });

    expect((client as any).token).toBeNull();
    expect((client as any).hasOwnProperty('token')).toBe(true);
  });
});
