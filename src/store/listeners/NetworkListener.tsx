import React, { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAppDispatch } from '../../hooks';
import { setOnline } from '../slices/network.slice';

interface NetworkListenerProps {
  children: React.ReactNode;
}

const NetworkListener: React.FC<NetworkListenerProps> = ({ children }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    NetInfo.fetch().then(state => {
      dispatch(setOnline(state.isConnected ?? false));
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      dispatch(setOnline(state.isConnected ?? false));
    });

    return () => unsubscribe();
  }, [dispatch]);

  return <>{children}</>;
};

export default NetworkListener;
