import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import Button from '../atoms/Button';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  showIcon?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  onDismiss,
  severity = 'medium',
  showIcon = true,
}) => {
  const { colors } = useAppSelector(selectTheme);
  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [scaleAnim] = React.useState(new Animated.Value(0.8));
  const [appState, setAppState] = React.useState<AppStateStatus>(
    AppState.currentState,
  );
  const isMountedRef = React.useRef(true);

  const safeButtons: AlertButton[] = Array.isArray(buttons)
    ? buttons
    : [{ text: 'OK', style: 'default' as const }];

  // Track component mount state
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Monitor app state to prevent showing modal when app is in background
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
      // If app goes to background and modal is visible, dismiss it
      if (
        nextAppState !== 'active' &&
        visible &&
        onDismiss &&
        isMountedRef.current
      ) {
        onDismiss();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [visible, onDismiss]);

  React.useEffect(() => {
    // Only animate if component is mounted and app is active
    if (!isMountedRef.current || appState !== 'active') {
      return;
    }

    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim, appState]);

  const getSeverityColor = () => {
    switch (severity) {
      case 'critical':
        return colors.error;
      case 'high':
        return colors.error;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.primary;
      default:
        return colors.primary;
    }
  };

  const getSeverityIcon = () => {
    switch (severity) {
      case 'critical':
        return '⚠️';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚠️';
      case 'low':
        return 'ℹ️';
      default:
        return 'ℹ️';
    }
  };

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  const getButtonVariant = (style?: string) => {
    switch (style) {
      case 'destructive':
        return 'danger';
      case 'cancel':
        return 'secondary';
      default:
        return 'primary';
    }
  };

  // Only render modal if component is mounted, app is active, and visible is true
  const shouldShowModal =
    visible && isMountedRef.current && appState === 'active';

  if (!shouldShowModal) return null;

  return (
    <Modal
      transparent
      visible={shouldShowModal}
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View
        style={[
          styles.overlay,
          styles.overlayBackground,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.alertContainer,
            {
              backgroundColor: colors.surface,
              borderColor: getSeverityColor(),
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header with icon and title */}
          <View style={styles.header}>
            {showIcon && <Text style={styles.icon}>{getSeverityIcon()}</Text>}
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>

          {/* Message */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {safeButtons.map((button, index) => (
              <View
                key={index}
                style={[
                  styles.buttonWrapper,
                  safeButtons.length === 1 && styles.singleButton,
                ]}
              >
                <Button
                  title={button.text}
                  onPress={() => handleButtonPress(button)}
                  variant={getButtonVariant(button.style) as any}
                  size="medium"
                  style={[
                    styles.button,
                    index === 0 && safeButtons.length > 1 && styles.firstButton,
                    index === safeButtons.length - 1 && styles.lastButton,
                  ]}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  overlayBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertContainer: {
    width: '100%',
    maxWidth: screenWidth - 40,
    borderRadius: 12,
    borderWidth: 2,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  buttonWrapper: {
    flex: 0,
  },
  singleButton: {
    flex: 1,
  },
  button: {
    minWidth: 80,
  },
  firstButton: {
    marginRight: 4,
  },
  lastButton: {
    marginLeft: 4,
  },
});

export default CustomAlert;
