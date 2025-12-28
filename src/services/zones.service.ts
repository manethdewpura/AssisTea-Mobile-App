import { apiClient, ApiResponse } from '../utils/apiClient.util';
import { handleFirebaseError, logError } from '../utils/errorHandling.util';

export interface ZoneConfig {
  zone_id: number;
  name: string;
  altitude: number; // meters above sea level
  slope: number; // degrees
  area: number; // square meters
  base_pressure: number; // kPa
  valve_gpio_pin: number;
  pump_gpio_pin?: number;
  soil_moisture_sensor_pin?: number;
  pressure_sensor_pin?: number;
  enabled: string; // 'true' or 'false'
}

export interface CreateZoneConfigData {
  zone_id: number;
  name: string;
  altitude: number;
  slope: number;
  area: number;
  base_pressure: number;
  valve_gpio_pin: number;
  pump_gpio_pin?: number;
  soil_moisture_sensor_pin?: number;
  pressure_sensor_pin?: number;
  enabled?: string;
}

export interface UpdateZoneConfigData {
  name?: string;
  altitude?: number;
  slope?: number;
  area?: number;
  base_pressure?: number;
  valve_gpio_pin?: number;
  pump_gpio_pin?: number;
  soil_moisture_sensor_pin?: number;
  pressure_sensor_pin?: number;
  enabled?: string;
}

export const zonesService = {
  /**
   * Get all zone configurations
   */
  async getZoneConfigs(): Promise<ZoneConfig[]> {
    try {
      const response = await apiClient.get<{ zones: ZoneConfig[] }>('/zones');

      if (!response.success) {
        // If 404, return empty array (endpoint might not exist yet)
        if (response.error?.includes('404') || response.error?.includes('Not Found')) {
          console.warn('Zones endpoint not found, returning empty array');
          return [];
        }
        throw new Error(response.error || 'Failed to get zone configurations');
      }

      return response.zones || response.data?.zones || [];
    } catch (error: any) {
      // Handle 404 gracefully - endpoint might not be implemented yet
      if (error.message?.includes('404') || error.message?.includes('Not Found') || 
          error.userMessage?.includes('404') || error.userMessage?.includes('Not Found')) {
        console.warn('Zones endpoint not found, returning empty array');
        return [];
      }
      const appError = handleFirebaseError(error);
      logError(appError, 'zonesService - getZoneConfigs');
      throw appError;
    }
  },

  /**
   * Get a specific zone configuration
   */
  async getZoneConfig(zoneId: number): Promise<ZoneConfig> {
    try {
      const response = await apiClient.get<{ zone: ZoneConfig }>(`/zones/${zoneId}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to get zone configuration');
      }

      return response.zone || response.data?.zone;
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'zonesService - getZoneConfig');
      throw appError;
    }
  },

  /**
   * Create a new zone configuration
   */
  async createZoneConfig(data: CreateZoneConfigData): Promise<ZoneConfig> {
    try {
      const response = await apiClient.post<{ zone: ZoneConfig }>('/zones', data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create zone configuration');
      }

      return response.zone || response.data?.zone;
    } catch (error: any) {
      // Handle 404 - endpoint might not be implemented yet
      if (error.message?.includes('404') || error.message?.includes('Not Found') || 
          error.userMessage?.includes('404') || error.userMessage?.includes('Not Found')) {
        throw new Error('Zones API endpoint not available. Please ensure the backend server is updated.');
      }
      const appError = handleFirebaseError(error);
      logError(appError, 'zonesService - createZoneConfig');
      throw appError;
    }
  },

  /**
   * Update a zone configuration
   */
  async updateZoneConfig(zoneId: number, data: UpdateZoneConfigData): Promise<ZoneConfig> {
    try {
      const response = await apiClient.put<{ zone: ZoneConfig }>(`/zones/${zoneId}`, data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update zone configuration');
      }

      return response.zone || response.data?.zone;
    } catch (error: any) {
      // Handle 404 - endpoint might not be implemented yet
      if (error.message?.includes('404') || error.message?.includes('Not Found') || 
          error.userMessage?.includes('404') || error.userMessage?.includes('Not Found')) {
        throw new Error('Zones API endpoint not available. Please ensure the backend server is updated.');
      }
      const appError = handleFirebaseError(error);
      logError(appError, 'zonesService - updateZoneConfig');
      throw appError;
    }
  },

  /**
   * Delete a zone configuration
   */
  async deleteZoneConfig(zoneId: number): Promise<void> {
    try {
      const response = await apiClient.delete(`/zones/${zoneId}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete zone configuration');
      }
    } catch (error: any) {
      // Handle 404 - endpoint might not be implemented yet
      if (error.message?.includes('404') || error.message?.includes('Not Found') || 
          error.userMessage?.includes('404') || error.userMessage?.includes('Not Found')) {
        throw new Error('Zones API endpoint not available. Please ensure the backend server is updated.');
      }
      const appError = handleFirebaseError(error);
      logError(appError, 'zonesService - deleteZoneConfig');
      throw appError;
    }
  },
};

