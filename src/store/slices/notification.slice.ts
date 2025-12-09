import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NotificationState, AlertButton } from '../../common/interfaces';

const initialState: NotificationState = {
  alert: {
    visible: false,
    title: '',
    message: '',
    buttons: [{ text: 'OK', style: 'default' }],
    severity: 'medium',
  },
  toast: {
    visible: false,
    message: '',
    type: 'info',
  },
  unreadCount: 0,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    showAlert: (
      state,
      action: PayloadAction<{
        title: string;
        message: string;
        buttons?: AlertButton[];
        severity?: 'low' | 'medium' | 'high' | 'critical';
      }>,
    ) => {
      state.alert = {
        visible: true,
        title: action.payload.title,
        message: action.payload.message,
        buttons: action.payload.buttons || [{ text: 'OK', style: 'default' }],
        severity: action.payload.severity || 'medium',
      };
    },
    hideAlert: state => {
      state.alert.visible = false;
    },
    showToast: (
      state,
      action: PayloadAction<{
        message: string;
        type?: 'success' | 'warning' | 'error' | 'info';
      }>,
    ) => {
      state.toast = {
        visible: true,
        message: action.payload.message,
        type: action.payload.type || 'info',
      };
    },
    hideToast: state => {
      state.toast.visible = false;
    },
    showErrorAlert: (
      state,
      action: PayloadAction<{
        errorData: {
          code: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          recoverable: boolean;
          userMessage: string;
        };
        retryActionId?: string;
      }>,
    ) => {
      const { errorData, retryActionId } = action.payload;

      const buttons: AlertButton[] = [{ text: 'OK', style: 'default' }];

      if (errorData.recoverable && retryActionId) {
        buttons.unshift({
          text: 'Retry',
          style: 'default',
          actionId: retryActionId,
        });
      }

      const getErrorTitle = (severity: string): string => {
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
      };

      state.alert = {
        visible: true,
        title: getErrorTitle(errorData.severity),
        message: errorData.userMessage,
        buttons,
        severity: errorData.severity,
        errorData,
        retryActionId,
      };
    },
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = action.payload;
    },
  },
});

export const {
  showAlert,
  hideAlert,
  showToast,
  hideToast,
  showErrorAlert,
  setUnreadCount,
} = notificationSlice.actions;
export default notificationSlice.reducer;
