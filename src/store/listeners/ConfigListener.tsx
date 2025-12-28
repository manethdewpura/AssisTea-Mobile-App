import React, { useEffect } from 'react';
import { useAppDispatch } from '../../hooks';
import { loadBackendUrl } from '../slices/config.slice';

const ConfigListener: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Load backend URL configuration on app startup
    dispatch(loadBackendUrl());
  }, [dispatch]);

  return <>{children}</>;
};

export default ConfigListener;

