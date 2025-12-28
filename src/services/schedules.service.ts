import { apiClient, ApiResponse } from '../utils/apiClient.util';
import { handleFirebaseError, logError } from '../utils/errorHandling.util';

export interface IrrigationSchedule {
  id: number;
  zone_id: number;
  day_of_week: number;
  time: string;
  enabled: boolean;
  last_run?: string;
}

export interface FertigationSchedule {
  id: number;
  zone_id: number;
  day_of_week: number;
  time: string;
  enabled: boolean;
  last_run?: string;
}

export interface CreateScheduleData {
  zone_id: number;
  day_of_week: number;
  time: string;
  enabled?: boolean;
}

export interface UpdateScheduleData {
  zone_id?: number;
  day_of_week?: number;
  time?: string;
  enabled?: boolean;
}

export const schedulesService = {
  /**
   * Get all irrigation schedules
   */
  async getIrrigationSchedules(): Promise<IrrigationSchedule[]> {
    try {
      const response = await apiClient.get<{ schedules: IrrigationSchedule[] }>('/schedules/irrigation');

      if (!response.success) {
        throw new Error(response.error || 'Failed to get irrigation schedules');
      }

      return response.schedules || response.data?.schedules || [];
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'schedulesService - getIrrigationSchedules');
      throw appError;
    }
  },

  /**
   * Create a new irrigation schedule
   */
  async createIrrigationSchedule(data: CreateScheduleData): Promise<{ id: number }> {
    try {
      const response = await apiClient.post<{ id: number; message: string }>(
        '/schedules/irrigation',
        data
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to create irrigation schedule');
      }

      return { id: response.id || response.data?.id || 0 };
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'schedulesService - createIrrigationSchedule');
      throw appError;
    }
  },

  /**
   * Update an irrigation schedule
   */
  async updateIrrigationSchedule(scheduleId: number, data: UpdateScheduleData): Promise<void> {
    try {
      const response = await apiClient.put(`/schedules/irrigation/${scheduleId}`, data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update irrigation schedule');
      }
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'schedulesService - updateIrrigationSchedule');
      throw appError;
    }
  },

  /**
   * Delete an irrigation schedule
   */
  async deleteIrrigationSchedule(scheduleId: number): Promise<void> {
    try {
      const response = await apiClient.delete(`/schedules/irrigation/${scheduleId}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete irrigation schedule');
      }
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'schedulesService - deleteIrrigationSchedule');
      throw appError;
    }
  },

  /**
   * Get all fertigation schedules
   */
  async getFertigationSchedules(): Promise<FertigationSchedule[]> {
    try {
      const response = await apiClient.get<{ schedules: FertigationSchedule[] }>('/schedules/fertigation');

      if (!response.success) {
        throw new Error(response.error || 'Failed to get fertigation schedules');
      }

      return response.schedules || response.data?.schedules || [];
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'schedulesService - getFertigationSchedules');
      throw appError;
    }
  },

  /**
   * Create a new fertigation schedule
   */
  async createFertigationSchedule(data: CreateScheduleData): Promise<{ id: number }> {
    try {
      const response = await apiClient.post<{ id: number; message: string }>(
        '/schedules/fertigation',
        data
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to create fertigation schedule');
      }

      return { id: response.id || response.data?.id || 0 };
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'schedulesService - createFertigationSchedule');
      throw appError;
    }
  },

  /**
   * Update a fertigation schedule
   */
  async updateFertigationSchedule(scheduleId: number, data: UpdateScheduleData): Promise<void> {
    try {
      const response = await apiClient.put(`/schedules/fertigation/${scheduleId}`, data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update fertigation schedule');
      }
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'schedulesService - updateFertigationSchedule');
      throw appError;
    }
  },

  /**
   * Delete a fertigation schedule
   */
  async deleteFertigationSchedule(scheduleId: number): Promise<void> {
    try {
      const response = await apiClient.delete(`/schedules/fertigation/${scheduleId}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete fertigation schedule');
      }
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'schedulesService - deleteFertigationSchedule');
      throw appError;
    }
  },
};

