import { apiClient, ApiResponse } from '../utils/apiClient.util';
import { handleFirebaseError, logError } from '../utils/errorHandling.util';
import { activityLogsSQLiteService } from './sqlite/activityLogsSQLite.service';

// Lazy import to avoid circular dependency
let activityLogsSyncService: any = null;
const getSyncService = async () => {
  if (!activityLogsSyncService) {
    const module = await import('./activityLogsSync.service');
    activityLogsSyncService = module.activityLogsSyncService;
  }
  return activityLogsSyncService;
};

export interface OperationalLog {
  id: number;
  timestamp: string;
  operation_type: string;
  zone_id?: number;
  status: string;
  duration?: number;
  pressure?: number;
  flow_rate?: number;
  water_volume?: number;
  fertilizer_volume?: number;
  start_moisture?: number;
  end_moisture?: number;
  notes?: string;
}

export interface SensorLog {
  id: number;
  timestamp: string;
  sensor_type: string;
  zone_id?: number;
  value: number;
  unit?: string;
  raw_value?: number;
  raw_unit?: string;
}

export interface SystemLog {
  id: number;
  timestamp: string;
  log_level: string;
  component?: string;
  message: string;
  error_code?: string;
  zone_id?: number;
  sensor_id?: number;
}

export interface LogsQueryParams {
  zone_id?: number;
  limit?: number;
  hours?: number;
  operation_type?: string;
  sensor_type?: string;
  log_level?: string;
  component?: string;
}

export const logsService = {
  /**
   * Get operational logs
   */
  async getOperationalLogs(params?: LogsQueryParams): Promise<OperationalLog[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.zone_id) queryParams.append('zone_id', params.zone_id.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.hours) queryParams.append('hours', params.hours.toString());
      if (params?.operation_type) queryParams.append('operation_type', params.operation_type);

      const endpoint = `/logs/operational${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get<{ logs: OperationalLog[]; count: number }>(endpoint);

      if (!response.success) {
        throw new Error(response.error || 'Failed to get operational logs');
      }

      const logs = response.logs || response.data?.logs || [];
      
      // Save logs to SQLite for offline access and Firebase sync
      if (logs.length > 0) {
        try {
          await activityLogsSQLiteService.saveLogs(logs);
          // Trigger sync in background (don't wait for it)
          getSyncService().then(syncService => {
            syncService.syncPendingLogs().catch((err: any) => {
              console.warn('Background sync failed:', err);
            });
          }).catch(err => {
            console.warn('Failed to load sync service:', err);
          });
        } catch (dbError) {
          console.warn('Failed to save logs to SQLite:', dbError);
          // Don't throw - we still want to return the logs
        }
      }

      return logs;
    } catch (error) {
      // If API fails, try to get logs from local DB
      try {
        console.log('API failed, trying to load from local DB...');
        const localLogs = await activityLogsSQLiteService.getLogs(params);
        if (localLogs.length > 0) {
          console.log(`Loaded ${localLogs.length} logs from local DB`);
          return localLogs;
        }
      } catch (dbError) {
        console.warn('Failed to load from local DB:', dbError);
      }

      const appError = handleFirebaseError(error);
      logError(appError, 'logsService - getOperationalLogs');
      throw appError;
    }
  },

  /**
   * Get sensor logs
   */
  async getSensorLogs(params?: LogsQueryParams): Promise<SensorLog[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.zone_id) queryParams.append('zone_id', params.zone_id.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.hours) queryParams.append('hours', params.hours.toString());
      if (params?.sensor_type) queryParams.append('sensor_type', params.sensor_type);

      const endpoint = `/logs/sensor${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get<{ logs: SensorLog[]; count: number }>(endpoint);

      if (!response.success) {
        throw new Error(response.error || 'Failed to get sensor logs');
      }

      return response.logs || response.data?.logs || [];
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'logsService - getSensorLogs');
      throw appError;
    }
  },

  /**
   * Get system logs
   */
  async getSystemLogs(params?: LogsQueryParams): Promise<SystemLog[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.zone_id) queryParams.append('zone_id', params.zone_id.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.hours) queryParams.append('hours', params.hours.toString());
      if (params?.log_level) queryParams.append('log_level', params.log_level);
      if (params?.component) queryParams.append('component', params.component);

      const endpoint = `/logs/system${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get<{ logs: SystemLog[]; count: number }>(endpoint);

      if (!response.success) {
        throw new Error(response.error || 'Failed to get system logs');
      }

      return response.logs || response.data?.logs || [];
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'logsService - getSystemLogs');
      throw appError;
    }
  },
};

