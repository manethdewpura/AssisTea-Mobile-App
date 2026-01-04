import { apiClient, ApiResponse } from '../utils/apiClient.util';
import { AppError, logError } from '../utils/errorHandling.util';

export interface SolenoidInfo {
  solenoid_name: string;
  is_open: boolean;
  last_updated?: string;
}

export interface SolenoidStatusResponse {
  success: boolean;
  solenoids?: Record<string, SolenoidInfo>;
  count?: number;
  error?: string;
}

export const solenoidService = {
  /**
   * Get status of all solenoids
   */
  async getAllSolenoidStatus(): Promise<Record<string, SolenoidInfo>> {
    try {
      const response = await apiClient.get<SolenoidStatusResponse>(
        '/solenoids/status'
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to get solenoid status');
      }

      return response.solenoids || response.data?.solenoids || {};
    } catch (error: any) {
      // If it's already an AppError with a user message, preserve it
      if (error instanceof AppError && error.userMessage) {
        logError(error, 'solenoidService - getAllSolenoidStatus');
        throw error;
      }

      // Otherwise, convert to AppError preserving the message
      const appError = error instanceof AppError
        ? error
        : new AppError(
            error.message || 'Failed to get solenoid status',
            'SOLENOID_ERROR',
            'medium',
            true,
            error.message || 'Failed to get solenoid status'
          );
      logError(appError, 'solenoidService - getAllSolenoidStatus');
      throw appError;
    }
  },

  /**
   * Get status of a specific solenoid
   */
  async getSolenoidStatus(solenoidName: string): Promise<SolenoidInfo> {
    try {
      const response = await apiClient.get<{ solenoid: SolenoidInfo }>(
        `/solenoids/status/${solenoidName}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to get solenoid status');
      }

      return response.solenoid || response.data?.solenoid;
    } catch (error: any) {
      const appError = error instanceof AppError
        ? error
        : new AppError(
            error.message || 'Failed to get solenoid status',
            'SOLENOID_ERROR',
            'medium',
            true,
            error.message || 'Failed to get solenoid status'
          );
      logError(appError, 'solenoidService - getSolenoidStatus');
      throw appError;
    }
  },
};

