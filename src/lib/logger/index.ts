// src/lib/logger/index.ts

/**
 * 錯誤日誌工具
 * 統一管理應用程式的錯誤記錄
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  source?: string
  userId?: string
  documentId?: string
  action?: string
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  error?: Error
  context?: LogContext
}

/**
 * 格式化 log entry 為可讀字串
 */
function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, message, error, context } = entry
  const parts = [
    `[${timestamp}]`,
    `[${level.toUpperCase()}]`,
    message,
  ]

  if (context?.source) {
    parts.splice(2, 0, `[${context.source}]`)
  }

  if (error?.stack) {
    parts.push(`\n${error.stack}`)
  }

  if (context && Object.keys(context).filter((k) => k !== 'source').length > 0) {
    const { source, ...rest } = context
    parts.push(`\nContext: ${JSON.stringify(rest, null, 2)}`)
  }

  return parts.join(' ')
}

/**
 * 取得 ISO 時間戳
 */
function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * 判斷是否為開發環境
 */
function isDev(): boolean {
  return process.env.NODE_ENV !== 'production'
}

/**
 * 主要 Logger 類別
 */
class Logger {
  private source?: string

  constructor(source?: string) {
    this.source = source
  }

  /**
   * 建立帶有來源標記的 logger
   */
  withSource(source: string): Logger {
    return new Logger(source)
  }

  /**
   * 內部 log 方法
   */
  private log(level: LogLevel, message: string, error?: Error, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: getTimestamp(),
      level,
      message,
      error,
      context: {
        ...context,
        source: this.source || context?.source,
      },
    }

    const formatted = formatLogEntry(entry)

    // Console 輸出
    switch (level) {
      case 'debug':
        if (isDev()) console.debug(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }

    // 未來可擴展：發送到錯誤追蹤服務
    // if (level === 'error' && !isDev()) {
    //   sendToErrorTracking(entry)
    // }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, undefined, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, undefined, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, undefined, context)
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : undefined
    this.log('error', message, err, context)
  }
}

// 預設 logger 實例
export const logger = new Logger()

// 專用 loggers
export const sanityLogger = new Logger('Sanity')
export const apiLogger = new Logger('API')
export const pdfLogger = new Logger('PDF')

// 導出 Logger 類別供自訂使用
export { Logger }
