import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  duration?: number;
  onHide?: () => void;
  position?: 'top' | 'bottom';
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
  position = 'top',
}) => {
  const { colors } = useAppSelector(selectTheme);
  const translateY = useRef(
    new Animated.Value(position === 'top' ? -100 : 100),
  ).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onHide) {
        onHide();
      }
    });
  }, [onHide, position, opacity, translateY]);

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, hideToast, opacity, translateY]);

  const getTypeColor = () => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      case 'info':
      default:
        return colors.primary;
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✕';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const positionStyle = useMemo(
    () => (position === 'top' ? { top: 50 } : { bottom: 50 }),
    [position],
  );

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderLeftColor: getTypeColor(),
          transform: [{ translateY }],
          opacity,
        },
        positionStyle,
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={hideToast}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, { color: getTypeColor() }]}>
            {getTypeIcon()}
          </Text>
        </View>
        <Text
          style={[styles.message, { color: colors.text }]}
          numberOfLines={2}
        >
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default Toast;
