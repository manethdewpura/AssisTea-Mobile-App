import React from 'react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { selectNotifications } from '../selectors';
import { hideAlert, hideToast } from '../slices';
import CustomAlert from '../../components/molecule/CustomAlert';
import Toast from '../../components/molecule/Toast';

// Action registry for handling button actions
const actionRegistry = new Map<string, () => void>();

export const registerAction = (actionId: string, action: () => void) => {
  actionRegistry.set(actionId, action);
};

export const unregisterAction = (actionId: string) => {
  actionRegistry.delete(actionId);
};

const NotificationListener: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectNotifications);

  const handleAlertDismiss = () => {
    dispatch(hideAlert());
  };

  const handleToastHide = () => {
    dispatch(hideToast());
  };

  const handleButtonPress = (button: {
    text: string;
    actionId?: string;
    style?: string;
  }) => {
    if (button.actionId) {
      const action = actionRegistry.get(button.actionId);
      if (action) {
        action();
      }
    }
    handleAlertDismiss();
  };

  return (
    <>
      {children}

      {/* Alert Modal */}
      <CustomAlert
        visible={notifications.alert.visible}
        title={notifications.alert.title}
        message={notifications.alert.message}
        buttons={notifications.alert.buttons.map(button => ({
          text: button.text,
          style: button.style,
          onPress: button.actionId
            ? () => handleButtonPress(button)
            : undefined,
        }))}
        severity={notifications.alert.severity}
        onDismiss={handleAlertDismiss}
      />

      {/* Toast Notification */}
      <Toast
        visible={notifications.toast.visible}
        message={notifications.toast.message}
        type={notifications.toast.type}
        onHide={handleToastHide}
      />
    </>
  );
};

export default NotificationListener;
