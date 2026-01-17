/**
 * Structured Logger
 *
 * Supports both text and JSON output formats with contextual fields.
 * - Text format: Human-readable console output (default)
 * - JSON format: Structured logs for aggregators (Elasticsearch, Datadog, etc.)
 *
 * Configuration via environment variables:
 * - DEBUG: Namespace filtering (e.g., DEBUG=oblivion:* or DEBUG=oblivion:socket)
 * - LOG_FORMAT: Output format ('text' or 'json')
 * - LOG_LEVEL: Minimum log level ('debug', 'info', 'warn', 'error')
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFormat = 'text' | 'json';

/**
 * Contextual fields for structured logging.
 */
export interface LogContext {
  agentId?: string;
  taskId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Logger configuration.
 */
export interface LoggerConfig {
  format?: LogFormat;
  level?: LogLevel;
  context?: LogContext;
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  withContext(context: LogContext): Logger;
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

// Global logger configuration
const LOG_FORMAT: LogFormat = (process.env.LOG_FORMAT as LogFormat) || 'text';
const LOG_LEVEL_MAP: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
const MIN_LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'debug';

function shouldLogLevel(level: LogLevel): boolean {
  return LOG_LEVEL_MAP[level] >= LOG_LEVEL_MAP[MIN_LOG_LEVEL];
}

function formatMessage(args: unknown[]): string {
  return args
    .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
    .join(' ');
}

function formatOutput(
  namespace: string,
  level: LogLevel,
  args: unknown[],
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const message = formatMessage(args);

  if (LOG_FORMAT === 'json') {
    // Structured JSON format for log aggregators
    const logEntry = {
      timestamp,
      level,
      namespace,
      message,
      ...context,
    };
    return JSON.stringify(logEntry);
  }

  // Text format for human readability (default)
  const prefix = `[${timestamp}] [${namespace}] [${level.toUpperCase()}]`;
  const contextStr = context && Object.keys(context).length > 0
    ? ` ${JSON.stringify(context)}`
    : '';
  return `${prefix} ${message}${contextStr}`;
}

/**
 * Create a namespaced logger.
 */
export function createLogger(namespace: string, baseContext?: LogContext): Logger {
  const enabled = shouldLog(namespace);

  const log = (level: LogLevel, args: unknown[], context?: LogContext) => {
    // Check log level first (before expensive formatting)
    if (!shouldLogLevel(level)) return;

    // Debug logs also respect DEBUG env var
    if (level === 'debug' && !enabled) return;

    // Merge base context with call-specific context
    const mergedContext = { ...baseContext, ...context };
    const output = formatOutput(namespace, level, args, mergedContext);

    // Output to appropriate console method
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  };

  return {
    debug(...args: unknown[]) {
      log('debug', args);
    },
    info(...args: unknown[]) {
      log('info', args);
    },
    warn(...args: unknown[]) {
      log('warn', args);
    },
    error(...args: unknown[]) {
      log('error', args);
    },
    withContext(context: LogContext): Logger {
      // Create a new logger with merged context
      return createLogger(namespace, { ...baseContext, ...context });
    },
  };
}

// Pre-configured loggers for internal use
export const authLogger = createLogger('oblivion:auth');
export const socketLogger = createLogger('oblivion:socket');
export const httpLogger = createLogger('oblivion:http');
export const clientLogger = createLogger('oblivion:client');
