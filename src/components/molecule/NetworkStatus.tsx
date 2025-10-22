import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

interface NetworkStatusProps {
  showWhenConnected?: boolean;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({
  showWhenConnected = false,
}) => {
  const { colors } = useAppSelector(selectTheme);
  const [isConnected, setIsConnected] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;
      setIsConnected(connected);

      const shouldShow = !connected || showWhenConnected;
      setIsVisible(shouldShow);

      if (shouldShow) {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (!shouldShow) {
            setIsVisible(false);
          }
        });
      }
    });

    return unsubscribe;
  }, [showWhenConnected, fadeAnim]);

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isConnected ? colors.success : colors.error,
          opacity: fadeAnim,
        },
      ]}
    >
      <Text style={styles.text}>
        {isConnected ? 'Connected' : 'No Internet Connection'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

export default NetworkStatus;
