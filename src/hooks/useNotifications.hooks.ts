import { useAppDispatch } from './redux.hooks';
import { showAlert, showToast, showErrorAlert } from '../store/slices';
import { AppError } from '../utils';
import { registerAction, unregisterAction } from '../store/listeners/NotificationListener';

export const useNotifications = () => {
  const dispatch = useAppDispatch();

  const showAlertNotification = (
    title: string,
    message: string,
    options?: {
      buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>;
      severity?: 'low' | 'medium' | 'high' | 'critical';
    }
  ) => {
    dispatch(showAlert({
      title,
      message,
      buttons: options?.buttons,
      severity: options?.severity,
    }));
  };

  const showToastNotification = (
    message: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'info'
  ) => {
    dispatch(showToast({ message, type }));
  };

  const showErrorAlertNotification = (error: AppError, onRetry?: () => void) => {
    let retryActionId: string | undefined;
    
    if (onRetry) {
      retryActionId = `retry_${Date.now()}_${Math.random()}`;
      registerAction(retryActionId, () => {
        onRetry();
        unregisterAction(retryActionId!);
      });
    }
    
    // Extract serializable data from AppError
    const errorData = {
      code: error.code,
      severity: error.severity,
      recoverable: error.recoverable,
      userMessage: error.userMessage,
    };
    
    dispatch(showErrorAlert({ errorData, retryActionId }));
  };

  return {
    showAlert: showAlertNotification,
    showToast: showToastNotification,
    showErrorAlert: showErrorAlertNotification,
  };
};
