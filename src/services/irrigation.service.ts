import { apiClient, ApiResponse } from '../utils/apiClient.util';
import { handleFirebaseError, logError } from '../utils/errorHandling.util';

export interface IrrigationStatus {
  is_running: boolean;
  current_zone?: number;
  start_time?: string;
  duration?: number;
  pressure?: number;
  flow_rate?: number;
  water_volume?: number;
  [key: string]: any;
}

export interface StartIrrigationResponse {
  success: boolean;
  message?: string;
  zone_id?: number;
  [key: string]: any;
}

export const irrigationService = {
  /**
   * Start irrigation for a specific zone
   */
  async startIrrigation(zoneId: number): Promise<StartIrrigationResponse> {
    try {
      const response = await apiClient.post<StartIrrigationResponse>(
        '/irrigation/start',
        { zone_id: zoneId }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to start irrigation');
      }

      return response.data || response;
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'irrigationService - startIrrigation');
      throw appError;
    }
  },

  /**
   * Stop current irrigation
   */
  async stopIrrigation(): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/irrigation/stop');

      if (!response.success) {
        throw new Error(response.error || 'Failed to stop irrigation');
      }

      return response;
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'irrigationService - stopIrrigation');
      throw appError;
    }
  },

  /**
   * Get current irrigation status
   */
  async getIrrigationStatus(): Promise<IrrigationStatus> {
    try {
      const response = await apiClient.get<{ status: IrrigationStatus }>('/irrigation/status');

      if (!response.success) {
        throw new Error(response.error || 'Failed to get irrigation status');
      }

      return response.status || response.data?.status || (response.data as IrrigationStatus);
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'irrigationService - getIrrigationStatus');
      throw appError;
    }
  },
};

