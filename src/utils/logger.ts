// src/utils/logger.ts
// Purpose: Structured logging utility

import { config } from '../config/environment';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    // Set log level from config
    const configLevel = config.logLevel.toLowerCase();
    this.logLevel = this.parseLogLevel(configLevel);
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry;
    
    // In production, output JSON for log aggregation
    if (config.nodeEnv === 'production') {
      return JSON.stringify({
        timestamp,
        level,
        message,
        context,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
      });
    }
    
    // In development, output readable format
    let output = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (context) {
      output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
    }
    
    if (error) {
      output += `\n  Error: ${error.message}`;
      if (error.stack) {
        output += `\n  Stack: ${error.stack}`;
      }
    }
    
    return output;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    const formatted = this.formatLogEntry(entry);

    // Output to appropriate stream
    if (level === LogLevel.ERROR) {
      console.error(formatted);
    } else if (level === LogLevel.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Helper for logging HTTP requests
  http(method: string, path: string, statusCode: number, duration: number, context?: Record<string, any>): void {
    const message = `${method} ${path} ${statusCode} - ${duration}ms`;
    const fullContext = {
      method,
      path,
      statusCode,
      duration,
      ...context,
    };
    
    if (statusCode >= 500) {
      this.error(message, undefined, fullContext);
    } else if (statusCode >= 400) {
      this.warn(message, fullContext);
    } else {
      this.info(message, fullContext);
    }
  }
}

// Export singleton instance
export const logger = new Logger();