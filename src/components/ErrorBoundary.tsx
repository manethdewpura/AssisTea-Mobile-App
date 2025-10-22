import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAppSelector } from '../hooks';
import { selectTheme } from '../store/selectors';
import { logError, AppError } from '../utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({
      error,
      errorInfo,
    });

    // Log the error
    const appError = new AppError(
      error.message,
      'REACT_ERROR_BOUNDARY',
      'critical',
      true,
      'An unexpected error occurred. Please restart the app.'
    );
    logError(appError, 'ErrorBoundary');
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry }) => {
    const { colors } = useAppSelector(selectTheme);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            Oops! Something went wrong
          </Text>
          
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            We're sorry, but something unexpected happened. This has been logged and we'll look into it.
          </Text>

          {__DEV__ && error && (
            <View style={[styles.errorDetails, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.errorTitle, { color: colors.text }]}>Error Details (Development):</Text>
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                {error.message}
              </Text>
              {error.stack && (
                <Text style={[styles.stackTrace, { color: colors.textSecondary }]}>
                  {error.stack}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={onRetry}
          >
            <Text style={[styles.retryButtonText, { color: colors.buttonText }]}>
              Try Again
            </Text>
          </TouchableOpacity>

          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            If the problem persists, please contact support or restart the app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorDetails: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 8,
  },
  stackTrace: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ErrorBoundary;
