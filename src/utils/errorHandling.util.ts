import { AppState } from 'react-native';
import { logError as enhancedLogError } from './errorLogger.util';

export interface ErrorInfo {
  code: string;
  message: string;
  userMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly recoverable: boolean;
  public readonly userMessage: string;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    recoverable: boolean = true,
    userMessage?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.severity = severity;
    this.recoverable = recoverable;
    this.userMessage = userMessage || message;
  }
}

// Firebase Auth Error Codes Mapping
export const FIREBASE_AUTH_ERRORS = {
  'auth/user-not-found': {
    userMessage: 'No account found with this email address.',
    severity: 'medium' as const,
    recoverable: true,
  },
  'auth/wrong-password': {
    userMessage: 'Incorrect password. Please try again.',
    severity: 'medium' as const,
    recoverable: true,
  },
  'auth/invalid-email': {
    userMessage: 'Please enter a valid email address.',
    severity: 'low' as const,
    recoverable: true,
  },
  'auth/user-disabled': {
    userMessage: 'This account has been disabled. Please contact support.',
    severity: 'high' as const,
    recoverable: false,
  },
  'auth/too-many-requests': {
    userMessage: 'Too many failed attempts. Please try again later.',
    severity: 'medium' as const,
    recoverable: true,
  },
  'auth/email-already-in-use': {
    userMessage: 'An account with this email already exists.',
    severity: 'medium' as const,
    recoverable: true,
  },
  'auth/weak-password': {
    userMessage: 'Password should be at least 6 characters long.',
    severity: 'low' as const,
    recoverable: true,
  },
  'auth/network-request-failed': {
    userMessage: 'Network error. Please check your internet connection.',
    severity: 'high' as const,
    recoverable: true,
  },
  'auth/invalid-credential': {
    userMessage: 'Invalid credentials. Please check your email and password.',
    severity: 'medium' as const,
    recoverable: true,
  },
};

// Firestore Error Codes Mapping
export const FIRESTORE_ERRORS = {
  'permission-denied': {
    userMessage: 'You do not have permission to perform this action.',
    severity: 'high' as const,
    recoverable: false,
  },
  'unavailable': {
    userMessage: 'Service temporarily unavailable. Please try again.',
    severity: 'high' as const,
    recoverable: true,
  },
  'deadline-exceeded': {
    userMessage: 'Request timed out. Please try again.',
    severity: 'medium' as const,
    recoverable: true,
  },
};

export function handleFirebaseError(error: any): AppError {
  const errorCode = error.code || 'unknown';
  
  // Check Firebase Auth errors
  if (errorCode.startsWith('auth/')) {
    const authError = FIREBASE_AUTH_ERRORS[errorCode as keyof typeof FIREBASE_AUTH_ERRORS];
    if (authError) {
      return new AppError(
        error.message,
        errorCode,
        authError.severity,
        authError.recoverable,
        authError.userMessage
      );
    }
  }
  
  // Check Firestore errors
  if (errorCode.startsWith('firestore/') || FIRESTORE_ERRORS[errorCode as keyof typeof FIRESTORE_ERRORS]) {
    const firestoreError = FIRESTORE_ERRORS[errorCode as keyof typeof FIRESTORE_ERRORS];
    if (firestoreError) {
      return new AppError(
        error.message,
        errorCode,
        firestoreError.severity,
        firestoreError.recoverable,
        firestoreError.userMessage
      );
    }
  }
  
  // Default error handling
  return new AppError(
    error.message || 'An unexpected error occurred',
    errorCode,
    'medium',
    true,
    'Something went wrong. Please try again.'
  );
}

// This function is now deprecated - use the Redux-based notification system instead
export function showErrorAlert(error: AppError, onRetry?: () => void) {
  // Check if the app is in the foreground and ready to show alerts
  if (AppState.currentState !== 'active') {
    console.warn('Cannot show alert - app is not in active state:', error.userMessage);
    return;
  }

  // Log the error for debugging
  console.log('Error alert should be shown via Redux notification system:', {
    title: getErrorTitle(error.severity),
    message: error.userMessage,
    severity: error.severity,
    recoverable: error.recoverable,
    hasRetry: !!onRetry,
  });
  
  // Fallback to console log if Redux system is not available
  console.error(`Error: ${error.userMessage}`);
}

function getErrorTitle(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'Critical Error';
    case 'high':
      return 'Error';
    case 'medium':
      return 'Warning';
    case 'low':
      return 'Notice';
    default:
      return 'Error';
  }
}

export function logError(error: AppError, context?: string) {
  enhancedLogError(error, context);
}
