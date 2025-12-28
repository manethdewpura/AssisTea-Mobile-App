import { apiClient, ApiResponse } from '../utils/apiClient.util';
import { handleFirebaseError, logError } from '../utils/errorHandling.util';

export interface FertigationStatus {
  is_running: boolean;
  current_zone?: number;
  start_time?: string;
  duration?: number;
  fertilizer_volume?: number;
  water_volume?: number;
  [key: string]: any;
}

export interface StartFertigationResponse {
  success: boolean;
  message?: string;
  zone_id?: number;
  [key: string]: any;
}

export const fertigationService = {
  /**
   * Start fertigation for a specific zone
   */
  async startFertigation(zoneId: number): Promise<StartFertigationResponse> {
    try {
      const response = await apiClient.post<StartFertigationResponse>(
        '/fertigation/start',
        { zone_id: zoneId }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to start fertigation');
      }

      return response.data || response;
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'fertigationService - startFertigation');
      throw appError;
    }
  },

  /**
   * Stop current fertigation
   */
  async stopFertigation(): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/fertigation/stop');

      if (!response.success) {
        throw new Error(response.error || 'Failed to stop fertigation');
      }

      return response;
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'fertigationService - stopFertigation');
      throw appError;
    }
  },

  /**
   * Get current fertigation status
   */
  async getFertigationStatus(): Promise<FertigationStatus> {
    try {
      const response = await apiClient.get<{ status: FertigationStatus }>('/fertigation/status');

      if (!response.success) {
        throw new Error(response.error || 'Failed to get fertigation status');
      }

      return response.status || response.data?.status || (response.data as FertigationStatus);
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'fertigationService - getFertigationStatus');
      throw appError;
    }
  },
};

