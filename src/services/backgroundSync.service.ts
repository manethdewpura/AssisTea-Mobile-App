import { backendService } from './backend.service';
import { syncQueueService } from './syncQueue.service';
import { activityLogsSyncService } from './activityLogsSync.service';

/**
 * Service to sync queued weather data to backend
 * Runs periodically to upload unsynced data when backend is available
 */
export const backgroundSyncService = {
    // Maximum sync attempts per item before marking as dead letter
    MAX_SYNC_ATTEMPTS: 5,
    // Batch size for concurrent sync operations
    BATCH_SIZE: 10,

    /**
     * Attempt to sync all queued data to backend
     * Uses batch processing with retry limits to prevent indefinite retries
     * Returns number of successfully synced items
     */
    async syncQueuedData(): Promise<number> {
        try {
            // Check if backend is available
            const isBackendAvailable = await backendService.checkBackendConnection();

            if (!isBackendAvailable) {
                console.log('[BackgroundSync] Backend not available, skipping sync');
                return 0;
            }

            // Get unsynced items
            const unsyncedItems = await syncQueueService.getUnsyncedItems();

            if (unsyncedItems.length === 0) {
                console.log('[BackgroundSync] No items to sync');
                return 0;
            }

            console.log(`[BackgroundSync] Syncing ${unsyncedItems.length} items...`);

            // Separate items by retry status
            const retriable = unsyncedItems.filter(
                (item) => (item.sync_attempts ?? 0) < this.MAX_SYNC_ATTEMPTS
            );
            const deadLetters = unsyncedItems.filter(
                (item) => (item.sync_attempts ?? 0) >= this.MAX_SYNC_ATTEMPTS
            );

            if (deadLetters.length > 0) {
                console.warn(
                    `[BackgroundSync] ${deadLetters.length} items exceeded max retry limit (${this.MAX_SYNC_ATTEMPTS}). Manual intervention may be required.`,
                    deadLetters.map((item) => ({
                        id: item.id,
                        attempts: item.sync_attempts,
                        lastAttempt: item.last_sync_attempt,
                    }))
                );
            }

            let successCount = 0;

            // Process retriable items in batches for better performance
            for (let i = 0; i < retriable.length; i += this.BATCH_SIZE) {
                const batch = retriable.slice(i, i + this.BATCH_SIZE);

                // Use Promise.allSettled for batch processing
                // This allows all items in batch to attempt sync, even if some fail
                const results = await Promise.allSettled(
                    batch.map((item) =>
                        backendService
                            .syncAllWeatherData(item.current, item.forecast)
                            .then(async () => {
                                await syncQueueService.markAsSynced(item.id);
                                console.log(`[BackgroundSync] Synced item ${item.id}`);
                                return { id: item.id, success: true };
                            })
                            .catch(async (error) => {
                                const statusCode = (error as any)?.statusCode;
                                const isNetworkFailure = (error as any)?.isNetworkFailure === true;

                                if (statusCode && statusCode >= 400 && statusCode < 500) {
                                    // 4xx = Client error
                                    // Non-retriable: mark as synced to stop retrying
                                    await syncQueueService.markAsSynced(item.id);
                                    console.warn(
                                        `[BackgroundSync] Item ${item.id} rejected by server (${statusCode}), marking as synced:`,
                                        error?.message?.substring(0, 200),
                                    );
                                    return { id: item.id, success: true }; // Count as handled
                                }

                                // 5xx or network failure = potentially transient, retry
                                await syncQueueService.incrementSyncAttempt(item.id);
                                const attempts = (item.sync_attempts ?? 0) + 1;
                                console.error(
                                    `[BackgroundSync] Failed to sync item ${item.id} (attempt ${attempts}/${this.MAX_SYNC_ATTEMPTS})` +
                                    `${statusCode ? ` [HTTP ${statusCode}]` : ''}` +
                                    `${isNetworkFailure ? ' [NETWORK]' : ''}:`,
                                    error?.message?.substring(0, 200),
                                );
                                return { id: item.id, success: false, attempts };
                            })
                    )
                );

                // Count successful syncs
                results.forEach((result) => {
                    if (result.status === 'fulfilled' && result.value.success) {
                        successCount++;
                    }
                });
            }

            // Cleanup old synced items
            await syncQueueService.cleanupSyncedItems(7);

            console.log(
                `[BackgroundSync] Successfully synced ${successCount}/${unsyncedItems.length} items ` +
                `(${deadLetters.length} dead letter items)`
            );

            // Also sync activity logs to Firebase
            try {
                const activityLogsResult = await activityLogsSyncService.syncPendingLogs();
                console.log(
                    `[BackgroundSync] Activity logs sync: ${activityLogsResult.synced} synced, ${activityLogsResult.failed} failed`
                );
            } catch (activityLogsError) {
                console.warn('[BackgroundSync] Failed to sync activity logs:', activityLogsError);
            }

            return successCount;
        } catch (error) {
            console.error('[BackgroundSync] Error during sync:', error);
            return 0;
        }
    },

    /**
     * Get sync queue statistics
     */
    async getSyncStats() {
        return await syncQueueService.getStats();
    },
};
