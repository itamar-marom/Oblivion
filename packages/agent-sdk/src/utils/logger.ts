/**
 * Debug Logger
 *
 * Simple logger with debug mode support via DEBUG environment variable.
 * Usage: DEBUG=oblivion:* or DEBUG=oblivion:socket,oblivion:auth
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

function shouldLog(namespace: string): boolean {
  const debug = process.env.DEBUG || '';
  if (!debug) return false;

  const patterns = debug.split(',').map(p => p.trim());

  for (const pattern of patterns) {
    if (pattern === '*' || pattern === 'oblivion:*') return true;
    if (pattern === namespace) return true;
    if (pattern.endsWith('*') && namespace.startsWith(pattern.slice(0, -1))) return true;
  }

  return false;
}

function formatArgs(namespace: string, level: LogLevel, args: unknown[]): string[] {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${namespace}] [${level.toUpperCase()}]`;

  return [prefix, ...args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  )];
}

/**
 * Create a namespaced logger.
 */
export function createLogger(namespace: string): Logger {
  const enabled = shouldLog(namespace);

  return {
    debug(...args: unknown[]) {
      if (enabled) {
        console.debug(...formatArgs(namespace, 'debug', args));
      }
    },
    info(...args: unknown[]) {
      console.info(...formatArgs(namespace, 'info', args));
    },
    warn(...args: unknown[]) {
      console.warn(...formatArgs(namespace, 'warn', args));
    },
    error(...args: unknown[]) {
      console.error(...formatArgs(namespace, 'error', args));
    },
  };
}

// Pre-configured loggers for internal use
export const authLogger = createLogger('oblivion:auth');
export const socketLogger = createLogger('oblivion:socket');
export const httpLogger = createLogger('oblivion:http');
export const clientLogger = createLogger('oblivion:client');
