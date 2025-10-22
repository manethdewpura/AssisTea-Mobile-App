import NetInfo from '@react-native-community/netinfo';
import { AppError } from './errorHandling.util';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network connection error') {
    super(message, 'NETWORK_ERROR', 'high', true, 'Please check your internet connection and try again.');
  }
}

export async function checkNetworkConnection(): Promise<NetworkState> {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    };
  } catch (error) {
    throw new NetworkError('Failed to check network connection');
  }
}

export async function ensureNetworkConnection(): Promise<void> {
  const networkState = await checkNetworkConnection();
  
  if (!networkState.isConnected) {
    throw new NetworkError('No internet connection available');
  }
  
  if (networkState.isInternetReachable === false) {
    throw new NetworkError('Internet connection is not reachable');
  }
}

export function isNetworkError(error: any): boolean {
  return error instanceof NetworkError || 
         error?.code === 'NETWORK_ERROR' ||
         error?.message?.toLowerCase().includes('network') ||
         error?.message?.toLowerCase().includes('connection');
}
