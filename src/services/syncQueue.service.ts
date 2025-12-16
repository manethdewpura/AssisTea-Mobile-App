import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurrentWeather, WeatherForecast } from '../common/interfaces';

const SYNC_QUEUE_KEY = '@weather_sync_queue';

export interface QueuedWeatherData {
    id: string;
    timestamp: number;
    current: CurrentWeather;
    forecast: WeatherForecast;
    synced: boolean;
}

/**
 * Service for managing offline weather data queue
 * Stores weather data when backend is unavailable and syncs when connected
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
            const queue = await this.getQueue();

            const queueItem: QueuedWeatherData = {
                id: `weather_${Date.now()}`,
                timestamp: Date.now(),
                current,
                forecast,
                synced: false,
            };

            queue.push(queueItem);
            await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

            console.log(`[SyncQueue] Added to queue. Total items: ${queue.length}`);
        } catch (error) {
            console.error('[SyncQueue] Error adding to queue:', error);
        }
    },

    /**
     * Get all items in the sync queue
     */
    async getQueue(): Promise<QueuedWeatherData[]> {
        try {
            const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
            return queueJson ? JSON.parse(queueJson) : [];
        } catch (error) {
            console.error('[SyncQueue] Error reading queue:', error);
            return [];
        }
    },

    /**
     * Get all unsynced items
     */
    async getUnsyncedItems(): Promise<QueuedWeatherData[]> {
        const queue = await this.getQueue();
        return queue.filter(item => !item.synced);
    },

    /**
     * Mark an item as synced
     */
    async markAsSynced(itemId: string): Promise<void> {
        try {
            const queue = await this.getQueue();
            const updatedQueue = queue.map(item =>
                item.id === itemId ? { ...item, synced: true } : item
            );

            await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));
            console.log(`[SyncQueue] Marked ${itemId} as synced`);
        } catch (error) {
            console.error('[SyncQueue] Error marking as synced:', error);
        }
    },

    /**
     * Remove synced items older than X days (cleanup)
     */
    async cleanupSyncedItems(daysOld: number = 7): Promise<void> {
        try {
            const queue = await this.getQueue();
            const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

            const cleanedQueue = queue.filter(
                item => !item.synced || item.timestamp > cutoffTime
            );

            await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(cleanedQueue));

            const removed = queue.length - cleanedQueue.length;
            if (removed > 0) {
                console.log(`[SyncQueue] Cleaned up ${removed} old synced items`);
            }
        } catch (error) {
            console.error('[SyncQueue] Error cleaning up:', error);
        }
    },

    /**
     * Get queue statistics
     */
    async getStats(): Promise<{
        total: number;
        synced: number;
        unsynced: number;
    }> {
        const queue = await this.getQueue();
        const synced = queue.filter(item => item.synced).length;

        return {
            total: queue.length,
            synced,
            unsynced: queue.length - synced,
        };
    },

    /**
     * Clear entire queue
     */
    async clearQueue(): Promise<void> {
        try {
            await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
            console.log('[SyncQueue] Queue cleared');
        } catch (error) {
            console.error('[SyncQueue] Error clearing queue:', error);
        }
    },
};
