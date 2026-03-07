import { apiClient, ApiResponse } from '../utils/apiClient.util';
import { AppError, handleFirebaseError, logError } from '../utils/errorHandling.util';
import { configService } from './config.service';

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
   * Start irrigation for the configured system zone.
   * The backend now requires a zone_id, so we either
   * accept one explicitly or fall back to the zone info
   * from the configuration service.
   * @param zoneId - Optional zone ID (defaults from config)
   * @param skipWeatherCheck - If true, start irrigation without checking weather conditions
   */
  async startIrrigation(zoneId?: number, skipWeatherCheck?: boolean): Promise<StartIrrigationResponse> {
    try {
      let targetZoneId = zoneId;

      if (targetZoneId == null) {
        const zoneInfo = await configService.getZoneInfo();
        targetZoneId = zoneInfo.zone_id;
      }

      const response = await apiClient.post<StartIrrigationResponse>(
        '/irrigation/start',
        { zone_id: targetZoneId, skip_weather_check: Boolean(skipWeatherCheck) }
      );

      if (!response.success) {
        // Extract the actual error message from the response
        const errorMessage = response.message || response.error || 'Failed to start irrigation';
        throw new Error(errorMessage);
      }

      return response.data || response;
    } catch (error: any) {
      // If it's already an AppError with a user message, preserve it
      if (error instanceof AppError && error.userMessage) {
        logError(error, 'irrigationService - startIrrigation');
        throw error;
      }
      
      // Otherwise, convert to AppError preserving the message
      const appError = error instanceof AppError 
        ? error 
        : new AppError(
            error.message || 'Failed to start irrigation',
            'IRRIGATION_ERROR',
            'medium',
            true,
            error.message || 'Failed to start irrigation'
          );
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

