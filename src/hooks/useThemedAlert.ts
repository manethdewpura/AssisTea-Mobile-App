import { useState, useCallback } from 'react';
import type { AlertButton } from '../components/molecule/CustomAlert';

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const DEFAULT_BUTTONS: AlertButton[] = [{ text: 'OK', style: 'default' }];

export function useThemedAlert() {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    buttons: DEFAULT_BUTTONS,
    severity: 'medium',
  });

  const showAlert = useCallback(
    (
      title: string,
      message: string,
      buttons?: AlertButton[],
      severity?: 'low' | 'medium' | 'high' | 'critical',
    ) => {
      setAlertState({
        visible: true,
        title,
        message,
        buttons: buttons ?? DEFAULT_BUTTONS,
        severity: severity ?? 'medium',
      });
    },
    [],
  );

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, visible: false }));
  }, []);

  return { showAlert, hideAlert, alertState };
}
