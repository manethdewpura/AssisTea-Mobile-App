import { CurrentWeather, WeatherForecast } from '../common/interfaces';
import { weatherDatabaseService } from './weatherDatabase.service';

export interface QueuedWeatherData {
    id: string;
    timestamp: number;
    current: CurrentWeather;
    forecast: WeatherForecast;
    synced: boolean;
    sync_attempts?: number;
    last_sync_attempt?: number;
}

/**
 * Service for managing offline weather data queue
 * Stores weather data in SQLite when backend is unavailable and syncs when connected
 */
export const syncQueueService = {
    /**
     * Add weather data to the sync queue
     */
    async addToQueue(
        current: CurrentWeather,
        forecast: WeatherForecast,
    ): Promise<void> {
        try {
            await weatherDatabaseService.addToQueue(current, forecast);

            // Get current stats for logging
            const stats = await weatherDatabaseService.getStats();
            console.log(`[SyncQueue] Added to queue. Total items: ${stats.total}`);
        } catch (error) {
            console.error('[SyncQueue] Error adding to queue:', error);
        }
    },

    /**
     * Get all items in the sync queue
     * Returns empty array on error to allow UI to function with cached data
     */
    async getQueue(): Promise<QueuedWeatherData[]> {
        try {
            return await weatherDatabaseService.getQueue();
        } catch (error) {
            console.error('[SyncQueue] Error reading queue:', error);
            return [];
        }
    },

    /**
     * Get all unsynced items from the queue
     * Returns empty array on error to allow sync service to continue gracefully
     */
    async getUnsyncedItems(): Promise<QueuedWeatherData[]> {
        try {
            return await weatherDatabaseService.getUnsyncedItems();
        } catch (error) {
            console.error('[SyncQueue] Error getting unsynced items:', error);
            return [];
        }
    },

    /**
     * Mark an item as synced
     */
    async markAsSynced(itemId: string): Promise<void> {
        try {
            await weatherDatabaseService.markAsSynced(itemId);
            console.log(`[SyncQueue] Marked ${itemId} as synced`);
        } catch (error) {
            console.error('[SyncQueue] Error marking as synced:', error);
        }
    },

    /**
     * Increment sync attempt counter for an item
     * Used to track failed sync attempts and prevent infinite retries
     */
    async incrementSyncAttempt(itemId: string): Promise<void> {
        try {
            await weatherDatabaseService.incrementSyncAttempt(itemId);
        } catch (error) {
            console.error('[SyncQueue] Error incrementing sync attempt for', itemId, ':', error);
        }
    },

    /**
     * Remove synced items older than specified days
     * Returns 0 on error; errors are logged for visibility
     */
    async cleanupSyncedItems(daysOld: number = 7): Promise<void> {
        try {
            const removedCount = await weatherDatabaseService.cleanupSyncedItems(daysOld);
            if (removedCount > 0) {
                console.log(`[SyncQueue] Cleaned up ${removedCount} old synced items`);
            }
        } catch (error) {
            console.error('[SyncQueue] Error cleaning up:', error);
            // Cleanup failures are not critical; sync will still work
        }
    },

    /**
     * Get queue statistics
     * Returns empty stats on error to allow UI to display gracefully
     */
    async getStats(): Promise<{
        total: number;
        synced: number;
        unsynced: number;
    }> {
        try {
            return await weatherDatabaseService.getStats();
        } catch (error) {
            console.error('[SyncQueue] Error getting stats:', error);
            return { total: 0, synced: 0, unsynced: 0 };
        }
    },

    /**
     * Clear entire queue
     */
    async clearQueue(): Promise<void> {
        try {
            await weatherDatabaseService.clearQueue();
            console.log('[SyncQueue] Queue cleared');
        } catch (error) {
            console.error('[SyncQueue] Error clearing queue:', error);
        }
    },
};
