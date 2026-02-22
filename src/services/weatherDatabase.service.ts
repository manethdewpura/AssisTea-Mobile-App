import SQLite from 'react-native-sqlite-storage';
import { CurrentWeather, WeatherForecast } from '../common/interfaces';
import type { QueuedWeatherData } from './syncQueue.service';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

class WeatherDatabaseService {
    private db: SQLite.SQLiteDatabase | null = null;
    private readonly DATABASE_NAME = 'weather.db';
    private readonly DATABASE_VERSION = 1;
    private initializationPromise: Promise<void> | null = null;
    private isClosed = false;

    // Backoff mechanism to prevent thundering herd on initialization failures
    private lastInitializationAttempt: number = 0;
    private initializationAttempts: number = 0;
    private readonly MIN_RETRY_DELAY_MS = 1000; // 1 second
    private readonly MAX_RETRY_DELAY_MS = 30000; // 30 seconds
    private lastInitializationError: Error | null = null;

    /**
     * Initialize database and create tables
     * @throws Error if database initialization fails and no retry is scheduled
     */
    async initialize(): Promise<void> {
        // Return existing promise if initialization is in progress
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // Return immediately if already initialized
        if (this.db) {
            return Promise.resolve();
        }

        // Check if we're still in backoff period from a previous failure
        const timeSinceLastAttempt = Date.now() - this.lastInitializationAttempt;
        if (this.lastInitializationError && timeSinceLastAttempt < this.getRetryDelayMs()) {
            // Still in backoff period, return the last error to prevent retry storm
            const delayRemaining = this.getRetryDelayMs() - timeSinceLastAttempt;
            console.warn(
                `[WeatherDB] In backoff period (${delayRemaining}ms remaining). Previous error:`,
                this.lastInitializationError.message
            );
            return Promise.reject(this.lastInitializationError);
        }

        // Exit backoff period or first attempt - start new initialization
        this.initializationAttempts++;
        this.initializationPromise = this._performInitialization();
        return this.initializationPromise;
    }

    /**
     * Calculate exponential backoff delay based on number of failed attempts
     */
    private getRetryDelayMs(): number {
        // Exponential backoff with jitter: min * 2^attempts + random
        const exponentialDelay = this.MIN_RETRY_DELAY_MS * Math.pow(2, Math.max(0, this.initializationAttempts - 1));
        const delayWithJitter = exponentialDelay + Math.random() * 1000; // Add up to 1s jitter
        return Math.min(delayWithJitter, this.MAX_RETRY_DELAY_MS);
    }

    private async _performInitialization(): Promise<void> {
        try {
            console.log('[WeatherDB] Opening SQLite database...');
            this.db = await SQLite.openDatabase({
                name: this.DATABASE_NAME,
                location: 'default',
            });

            console.log('[WeatherDB] Database opened successfully');
            await this.createTables();

            // Success: reset error tracking
            this.lastInitializationError = null;
            this.initializationAttempts = 0;
        } catch (error) {
            console.error('[WeatherDB] Error initializing database (attempt ' + this.initializationAttempts + '):', error);

            // Track the error and timestamp for backoff calculation
            this.lastInitializationError = error as Error;
            this.lastInitializationAttempt = Date.now();

            // Clear the promise so backoff logic can control next retry
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Create weather queue table
     */
    private async createTables(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            console.log('[WeatherDB] Creating weather_queue table...');

            await this.db.executeSql(`
                CREATE TABLE IF NOT EXISTS weather_queue (
                    id TEXT PRIMARY KEY,
                    timestamp INTEGER NOT NULL,
                    current_data TEXT NOT NULL,
                    forecast_data TEXT NOT NULL,
                    synced INTEGER DEFAULT 0,
                    sync_attempts INTEGER DEFAULT 0,
                    last_sync_attempt INTEGER
                );
            `);

            // Create indexes for better query performance
            await this.db.executeSql(`
                CREATE INDEX IF NOT EXISTS idx_weather_queue_timestamp 
                ON weather_queue(timestamp DESC);
            `);

            await this.db.executeSql(`
                CREATE INDEX IF NOT EXISTS idx_weather_queue_synced 
                ON weather_queue(synced, timestamp DESC);
            `);

            console.log('[WeatherDB] Tables and indexes created successfully');
        } catch (error) {
            console.error('[WeatherDB] Error creating tables:', error);
            throw error;
        }
    }

    /**
     * Ensure database is initialized before operations
     * @throws Error if the service has been closed
     */
    private async ensureInitialized(): Promise<void> {
        if (this.isClosed) {
            throw new Error('Database service has been closed and cannot be used');
        }
        if (!this.db) {
            await this.initialize();
        }
    }

    /**
     * Add weather data to the queue
     */
    async addToQueue(
        current: CurrentWeather,
        forecast: WeatherForecast,
        id?: string,
        timestamp?: number
    ): Promise<string> {
        await this.ensureInitialized();

        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const queueId = id || `weather_${Date.now()}`;
            const queueTimestamp = timestamp || Date.now();

            await this.db.executeSql(
                `INSERT OR REPLACE INTO weather_queue 
                (id, timestamp, current_data, forecast_data, synced, sync_attempts, last_sync_attempt) 
                VALUES (?, ?, ?, ?, 0, 0, NULL)`,
                [
                    queueId,
                    queueTimestamp,
                    JSON.stringify(current),
                    JSON.stringify(forecast)
                ]
            );

            console.log(`[WeatherDB] Added item ${queueId} to queue`);
            return queueId;
        } catch (error) {
            console.error('[WeatherDB] Error adding to queue:', error);
            throw error;
        }
    }

    /**
     * Get all items in the queue
     * @throws Error if database operation fails
     */
    async getQueue(): Promise<QueuedWeatherData[]> {
        await this.ensureInitialized();

        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const [result] = await this.db.executeSql(
                'SELECT * FROM weather_queue ORDER BY timestamp DESC'
            );

            const queue: QueuedWeatherData[] = [];
            for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                queue.push({
                    id: row.id,
                    timestamp: row.timestamp,
                    current: JSON.parse(row.current_data),
                    forecast: JSON.parse(row.forecast_data),
                    synced: row.synced === 1,
                    sync_attempts: row.sync_attempts,
                    last_sync_attempt: row.last_sync_attempt,
                });
            }

            return queue;
        } catch (error) {
            console.error('[WeatherDB] Error reading queue:', error);
            throw error;
        }
    }

    /**
     * Get all unsynced items
     * @throws Error if database operation fails
     */
    async getUnsyncedItems(): Promise<QueuedWeatherData[]> {
        await this.ensureInitialized();

        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const [result] = await this.db.executeSql(
                'SELECT * FROM weather_queue WHERE synced = 0 ORDER BY timestamp ASC'
            );

            const unsyncedItems: QueuedWeatherData[] = [];
            for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                unsyncedItems.push({
                    id: row.id,
                    timestamp: row.timestamp,
                    current: JSON.parse(row.current_data),
                    forecast: JSON.parse(row.forecast_data),
                    synced: false,
                    sync_attempts: row.sync_attempts,
                    last_sync_attempt: row.last_sync_attempt,
                });
            }

            return unsyncedItems;
        } catch (error) {
            console.error('[WeatherDB] Error getting unsynced items:', error);
            throw error;
        }
    }

    /**
     * Mark an item as synced
     */
    async markAsSynced(itemId: string): Promise<void> {
        await this.ensureInitialized();

        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            await this.db.executeSql(
                `UPDATE weather_queue 
                SET synced = 1, last_sync_attempt = ? 
                WHERE id = ?`,
                [Date.now(), itemId]
            );

            console.log(`[WeatherDB] Marked ${itemId} as synced`);
        } catch (error) {
            console.error('[WeatherDB] Error marking as synced:', error);
            throw error;
        }
    }

    /**
     * Increment sync attempt counter
     */
    async incrementSyncAttempt(itemId: string): Promise<void> {
        await this.ensureInitialized();

        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            await this.db.executeSql(
                `UPDATE weather_queue 
                SET sync_attempts = sync_attempts + 1, last_sync_attempt = ? 
                WHERE id = ?`,
                [Date.now(), itemId]
            );
        } catch (error) {
            console.error('[WeatherDB] Error incrementing sync attempt:', error);
            throw error;
        }
    }

    /**
     * Remove synced items older than X days
     * @throws Error if database operation fails
     */
    async cleanupSyncedItems(daysOld: number = 7): Promise<number> {
        await this.ensureInitialized();

        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

            const [result] = await this.db.executeSql(
                'DELETE FROM weather_queue WHERE synced = 1 AND timestamp < ?',
                [cutoffTime]
            );

            const rowsAffected = result.rowsAffected || 0;
            if (rowsAffected > 0) {
                console.log(`[WeatherDB] Cleaned up ${rowsAffected} old synced items`);
            }

            return rowsAffected;
        } catch (error) {
            console.error('[WeatherDB] Error cleaning up:', error);
            throw error;
        }
    }

    /**
     * Get queue statistics
     * @throws Error if database operation fails
     */
    async getStats(): Promise<{
        total: number;
        synced: number;
        unsynced: number;
    }> {
        await this.ensureInitialized();

        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const [totalResult] = await this.db.executeSql(
                'SELECT COUNT(*) as count FROM weather_queue'
            );
            const total = totalResult.rows.item(0).count;

            const [syncedResult] = await this.db.executeSql(
                'SELECT COUNT(*) as count FROM weather_queue WHERE synced = 1'
            );
            const synced = syncedResult.rows.item(0).count;

            return {
                total,
                synced,
                unsynced: total - synced,
            };
        } catch (error) {
            console.error('[WeatherDB] Error getting stats:', error);
            throw error;
        }
    }

    /**
     * Clear entire queue
     */
    async clearQueue(): Promise<void> {
        await this.ensureInitialized();

        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            await this.db.executeSql('DELETE FROM weather_queue');
            console.log('[WeatherDB] Queue cleared');
        } catch (error) {
            console.error('[WeatherDB] Error clearing queue:', error);
            throw error;
        }
    }

    /**
     * Close database connection and prevent further operations
     */
    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            this.initializationPromise = null;
            this.isClosed = true;

            // Reset backoff state so service can be reinitialized if needed
            this.lastInitializationAttempt = 0;
            this.initializationAttempts = 0;
            this.lastInitializationError = null;

            console.log('[WeatherDB] Database closed and service marked as unavailable');
        }
    }
}

export const weatherDatabaseService = new WeatherDatabaseService();
