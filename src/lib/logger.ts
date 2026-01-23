/**
 * Centralized logging utility for consistent log formatting and levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

// Log levels that should output in production
const PRODUCTION_LEVELS: LogLevel[] = ['warn', 'error']

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production'

// Format timestamp
function getTimestamp(): string {
  return new Date().toISOString()
}

// Format log message
function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = getTimestamp()
  const contextStr = context ? ` ${JSON.stringify(context)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
}

// Logger class
class Logger {
  private prefix: string

  constructor(prefix = 'APP') {
    this.prefix = prefix
  }

  private shouldLog(level: LogLevel): boolean {
    if (!isProduction) return true
    return PRODUCTION_LEVELS.includes(level)
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return
    console.log(formatLog('debug', `[${this.prefix}] ${message}`, context))
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return
    console.log(formatLog('info', `[${this.prefix}] ${message}`, context))
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return
    console.warn(formatLog('warn', `[${this.prefix}] ${message}`, context))
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return
    const errorContext = error instanceof Error
      ? { ...context, error: error.message, stack: error.stack }
      : { ...context, error: String(error) }
    console.error(formatLog('error', `[${this.prefix}] ${message}`, errorContext))
  }

  // Create a child logger with a specific prefix
  child(prefix: string): Logger {
    return new Logger(`${this.prefix}:${prefix}`)
  }
}

// Default app logger
export const logger = new Logger('APP')

// Create specific loggers for different modules
export const apiLogger = new Logger('API')
export const dbLogger = new Logger('DB')
export const authLogger = new Logger('AUTH')
export const sanityLogger = new Logger('SANITY')
export const pdfLogger = new Logger('PDF')

// Export Logger class for custom loggers
export { Logger }
