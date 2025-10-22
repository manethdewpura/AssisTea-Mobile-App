export interface AlertButton {
  text: string;
  actionId?: string;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface NotificationState {
  alert: {
    visible: boolean;
    title: string;
    message: string;
    buttons: AlertButton[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    errorData?: {
      code: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      recoverable: boolean;
      userMessage: string;
    };
    retryActionId?: string;
  };
  toast: {
    visible: boolean;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
  };
}
