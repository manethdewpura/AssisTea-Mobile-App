import { apiClient } from '../utils/apiClient.util';
import { handleFirebaseError, logError } from '../utils/errorHandling.util';

export interface SensorReading {
  sensor_id: string;
  sensor_type: string;
  zone_id?: number;
  value: number;
  unit: string;
  raw_value?: number;
  raw_unit?: string;
  value_percent?: number; // For tank level
  timestamp: string;
  is_healthy: boolean;
  error?: string;
}

export interface SensorReadingsResponse {
  success: boolean;
  readings: SensorReading[];
  count: number;
  timestamp: string;
  error?: string;
}

export const sensorsService = {
  /**
   * Get current readings from all sensors
   */
  async getCurrentSensorReadings(): Promise<SensorReading[]> {
    try {
      const response = await apiClient.get<SensorReadingsResponse>('/sensors/current');

      if (!response.success) {
        throw new Error(response.error || 'Failed to get sensor readings');
      }

      return response.readings || response.data?.readings || [];
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'sensorsService - getCurrentSensorReadings');
      throw appError;
    }
  },

  /**
   * Get current reading from a specific sensor type
   */
  async getCurrentSensorReading(sensorType: string): Promise<SensorReading> {
    try {
      const response = await apiClient.get<{ success: boolean; reading: SensorReading; error?: string }>(
        `/sensors/current/${sensorType}`
      );

      if (!response.success) {
        throw new Error(response.error || `Failed to get sensor reading for ${sensorType}`);
      }

      if (!response.reading) {
        throw new Error(`No reading data returned for ${sensorType}`);
      }

      return response.reading;
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, `sensorsService - getCurrentSensorReading(${sensorType})`);
      throw appError;
    }
  },
};

