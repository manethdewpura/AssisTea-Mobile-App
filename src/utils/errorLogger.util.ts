import { AppError } from './errorHandling.util';

export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  level: 'low' | 'medium' | 'high' | 'critical';
  code: string;
  message: string;
  userMessage: string;
  context?: string;
  stack?: string;
  userId?: string;
  userRole?: string;
  deviceInfo?: {
    platform: string;
    version: string;
    model?: string;
  };
  networkInfo?: {
    isConnected: boolean;
    type?: string;
  };
  recoverable: boolean;
  resolved: boolean;
  resolvedAt?: Date;
}

class ErrorLogger {
  public logs: ErrorLogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 errors
  public currentUserId?: string;
  public currentUserRole?: string;

  setUserContext(userId: string, userRole: string) {
    this.currentUserId = userId;
    this.currentUserRole = userRole;
  }

  clearUserContext() {
    this.currentUserId = undefined;
    this.currentUserRole = undefined;
  }

  logError(
    error: AppError,
    context?: string,
    additionalInfo?: Record<string, any>
  ): string {
    const logEntry: ErrorLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level: error.severity,
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      context,
      stack: error.stack,
      userId: this.currentUserId,
      userRole: this.currentUserRole,
      deviceInfo: this.getDeviceInfo(),
      networkInfo: additionalInfo?.networkInfo,
      recoverable: error.recoverable,
      resolved: false,
    };

    this.logs.unshift(logEntry); // Add to beginning
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Console logging for development
    this.consoleLog(logEntry);

    // In production, you might want to send to a remote logging service
    // this.sendToRemoteService(logEntry);

    return logEntry.id;
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  getDeviceInfo() {
    // This would be enhanced with actual device info in a real app
    return {
      platform: 'React Native',
      version: '0.81.1',
    };
  }

  private consoleLog(logEntry: ErrorLogEntry) {
    const emoji = this.getSeverityEmoji(logEntry.level);
    const timestamp = logEntry.timestamp.toISOString();
    
    console.group(`${emoji} [${logEntry.level.toUpperCase()}] ${logEntry.code}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Context: ${logEntry.context || 'Unknown'}`);
    console.log(`Message: ${logEntry.message}`);
    console.log(`User Message: ${logEntry.userMessage}`);
    console.log(`User: ${logEntry.userId || 'Anonymous'} (${logEntry.userRole || 'Unknown'})`);
    console.log(`Recoverable: ${logEntry.recoverable}`);
    
    if (logEntry.stack) {
      console.log('Stack Trace:');
      console.log(logEntry.stack);
    }
    
    if (logEntry.networkInfo) {
      console.log('Network Info:', logEntry.networkInfo);
    }
    
    console.groupEnd();
  }

  private getSeverityEmoji(level: string): string {
    switch (level) {
      case 'critical': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '❓';
    }
  }

  // Get error statistics
  getErrorStats(): {
    total: number;
    byLevel: Record<string, number>;
    byContext: Record<string, number>;
    recentErrors: ErrorLogEntry[];
    unresolvedErrors: ErrorLogEntry[];
  } {
    const byLevel = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byContext = this.logs.reduce((acc, log) => {
      const context = log.context || 'Unknown';
      acc[context] = (acc[context] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentErrors = this.logs.slice(0, 10);
    const unresolvedErrors = this.logs.filter(log => !log.resolved);

    return {
      total: this.logs.length,
      byLevel,
      byContext,
      recentErrors,
      unresolvedErrors,
    };
  }

  // Mark error as resolved
  resolveError(errorId: string): boolean {
    const logEntry = this.logs.find(log => log.id === errorId);
    if (logEntry) {
      logEntry.resolved = true;
      logEntry.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  // Get logs for a specific user
  getUserLogs(userId: string): ErrorLogEntry[] {
    return this.logs.filter(log => log.userId === userId);
  }

  // Get logs by severity level
  getLogsByLevel(level: 'low' | 'medium' | 'high' | 'critical'): ErrorLogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // Clear all logs
  clearLogs() {
    this.logs = [];
  }

  // Export logs (useful for debugging)
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Import logs (useful for debugging)
  importLogs(logsJson: string): boolean {
    try {
      const logs = JSON.parse(logsJson);
      if (Array.isArray(logs)) {
        this.logs = logs.map(log => ({
          ...log,
          timestamp: new Date(log.timestamp),
          resolvedAt: log.resolvedAt ? new Date(log.resolvedAt) : undefined,
        }));
        return true;
      }
    } catch (error) {
      console.error('Failed to import logs:', error);
    }
    return false;
  }
}

// Create singleton instance
export const errorLogger = new ErrorLogger();

// Enhanced logging functions
export function logError(error: AppError, context?: string, additionalInfo?: Record<string, any>): string {
  return errorLogger.logError(error, context, additionalInfo);
}

export function logUserAction(action: string, context?: string, additionalInfo?: Record<string, any>) {
  const logEntry = {
    id: errorLogger.generateId(),
    timestamp: new Date(),
    level: 'low' as const,
    code: 'USER_ACTION',
    message: `User performed action: ${action}`,
    userMessage: `Action: ${action}`,
    context,
    userId: errorLogger.currentUserId,
    userRole: errorLogger.currentUserRole,
    deviceInfo: errorLogger.getDeviceInfo(),
    recoverable: true,
    resolved: true,
    resolvedAt: new Date(),
  };

  errorLogger.logs.unshift(logEntry);
  console.log(`👤 User Action: ${action}`, additionalInfo);
}

export function logPerformance(operation: string, duration: number, context?: string) {
  const level: 'low' | 'medium' | 'high' | 'critical' = duration > 5000 ? 'high' : duration > 2000 ? 'medium' : 'low';
  
  const logEntry = {
    id: errorLogger.generateId(),
    timestamp: new Date(),
    level,
    code: 'PERFORMANCE',
    message: `Performance issue: ${operation} took ${duration}ms`,
    userMessage: `Operation ${operation} was slow`,
    context,
    userId: errorLogger.currentUserId,
    userRole: errorLogger.currentUserRole,
    deviceInfo: errorLogger.getDeviceInfo(),
    recoverable: true,
    resolved: true,
    resolvedAt: new Date(),
  };

  errorLogger.logs.unshift(logEntry);
  console.log(`⏱️ Performance: ${operation} took ${duration}ms`);
}

// Export the logger instance and utility functions
export { errorLogger as default };
