import { backendService } from './backend.service';
import { syncQueueService } from './syncQueue.service';

/**
 * Service to sync queued weather data to backend
 * Runs periodically to upload unsynced data when backend is available
 */
export const backgroundSyncService = {
    /**
     * Attempt to sync all queued data to backend
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

            let successCount = 0;

            // Sync each item
            for (const item of unsyncedItems) {
                try {
                    await backendService.syncAllWeatherData(item.current, item.forecast);
                    await syncQueueService.markAsSynced(item.id);
                    successCount++;

                    console.log(`[BackgroundSync] Synced item ${item.id}`);
                } catch (error) {
                    console.error(`[BackgroundSync] Failed to sync item ${item.id}:`, error);
                    // Continue with next item even if this one fails
                }
            }

            // Cleanup old synced items
            await syncQueueService.cleanupSyncedItems(7);

            console.log(`[BackgroundSync] Successfully synced ${successCount}/${unsyncedItems.length} items`);

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
