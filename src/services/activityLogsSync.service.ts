import { activityLogsSQLiteService } from './sqlite/activityLogsSQLite.service';
import { activityLogsDao } from './dao/activityLogs.dao';

class ActivityLogsSyncService {
    /**
     * Sync pending activity logs from SQLite to Firebase
     */
    async syncPendingLogs(): Promise<{ synced: number; failed: number }> {
        try {
            const pendingLogs = await activityLogsSQLiteService.getPendingSyncLogs();
            
            if (pendingLogs.length === 0) {
                console.log('📋 No pending activity logs to sync');
                return { synced: 0, failed: 0 };
            }

            console.log(`🔄 Syncing ${pendingLogs.length} activity logs to Firebase...`);

            let synced = 0;
            let failed = 0;
            const syncedIds: number[] = [];

            // Process in batches of 50 (Firestore batch limit is 500, but we use smaller batches for reliability)
            const batchSize = 50;
            for (let i = 0; i < pendingLogs.length; i += batchSize) {
                const batch = pendingLogs.slice(i, i + batchSize);
                
                try {
                    // Check which logs already exist in Firebase
                    const logsToSync: typeof batch = [];
                    for (const log of batch) {
                        const exists = await activityLogsDao.exists(log.id);
                        if (!exists) {
                            logsToSync.push(log);
                        } else {
                            // Already exists, mark as synced
                            syncedIds.push(log.id);
                            synced++;
                        }
                    }

                    if (logsToSync.length > 0) {
                        await activityLogsDao.saveBatch(logsToSync);
                        syncedIds.push(...logsToSync.map(log => log.id));
                        synced += logsToSync.length;
                    }
                } catch (error) {
                    console.error(`❌ Error syncing batch ${i / batchSize + 1}:`, error);
                    failed += batch.length;
                }
            }

            // Mark all successfully synced logs
            if (syncedIds.length > 0) {
                await activityLogsSQLiteService.markMultipleAsSynced(syncedIds);
            }

            console.log(`✅ Activity logs sync complete: ${synced} synced, ${failed} failed`);
            return { synced, failed };
        } catch (error) {
            console.error('❌ Error syncing activity logs:', error);
            throw error;
        }
    }

    /**
     * Sync a single log
     */
    async syncLog(logId: number): Promise<boolean> {
        try {
            const logs = await activityLogsSQLiteService.getLogs({ limit: 1 });
            const log = logs.find(l => l.id === logId);
            
            if (!log) {
                console.warn(`⚠️ Log ${logId} not found in SQLite`);
                return false;
            }

            const exists = await activityLogsDao.exists(logId);
            if (exists) {
                await activityLogsSQLiteService.markAsSynced(logId);
                return true;
            }

            await activityLogsDao.save(log);
            await activityLogsSQLiteService.markAsSynced(logId);
            return true;
        } catch (error) {
            console.error(`❌ Error syncing log ${logId}:`, error);
            return false;
        }
    }

    /**
     * Get sync statistics
     */
    async getSyncStats(): Promise<{
        total: number;
        pending: number;
        synced: number;
    }> {
        try {
            const total = await activityLogsSQLiteService.getLogCount();
            const pendingLogs = await activityLogsSQLiteService.getPendingSyncLogs();
            
            return {
                total,
                pending: pendingLogs.length,
                synced: total - pendingLogs.length,
            };
        } catch (error) {
            console.error('❌ Error getting sync stats:', error);
            return { total: 0, pending: 0, synced: 0 };
        }
    }
}

export const activityLogsSyncService = new ActivityLogsSyncService();

