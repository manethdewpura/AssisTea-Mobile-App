// Mock dependencies BEFORE imports
jest.mock('../backend.service', () => ({
    backendService: {
        checkBackendConnection: jest.fn(),
        syncAllWeatherData: jest.fn(),
    },
    HttpError: class extends Error {
        public statusCode?: number;
        public isNetworkFailure?: boolean;
        constructor(message: string, statusCode?: number, isNetworkFailure: boolean = false) {
            super(message);
            this.name = 'HttpError';
            this.statusCode = statusCode;
            this.isNetworkFailure = isNetworkFailure;
        }
    },
}));

jest.mock('../syncQueue.service', () => ({
    syncQueueService: {
        getUnsyncedItems: jest.fn(),
        markAsSynced: jest.fn(),
        incrementSyncAttempt: jest.fn(),
        cleanupSyncedItems: jest.fn(),
        getStats: jest.fn(),
    },
}));

jest.mock('../activityLogsSync.service', () => ({
    activityLogsSyncService: {
        syncPendingLogs: jest.fn(),
    },
}));

// Suppress console output in tests
jest.spyOn(console, 'log').mockImplementation(() => { });
jest.spyOn(console, 'warn').mockImplementation(() => { });
jest.spyOn(console, 'error').mockImplementation(() => { });

import { backgroundSyncService } from '../backgroundSync.service';
import { backendService, HttpError } from '../backend.service';
import { syncQueueService } from '../syncQueue.service';
import { activityLogsSyncService } from '../activityLogsSync.service';

// Helper to create mock queue items
const createMockQueueItem = (id: string, syncAttempts = 0) => ({
    id,
    timestamp: Date.now(),
    current: { dt: 123, main: { temp: 25 } } as any,
    forecast: { list: [] } as any,
    synced: false,
    sync_attempts: syncAttempts,
    last_sync_attempt: undefined,
});

describe('backgroundSyncService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (activityLogsSyncService.syncPendingLogs as jest.Mock).mockResolvedValue({
            synced: 0,
            failed: 0,
        });
    });

    it('returns 0 when backend is not available', async () => {
        (backendService.checkBackendConnection as jest.Mock).mockResolvedValue(false);

        const result = await backgroundSyncService.syncQueuedData();

        expect(result).toBe(0);
        expect(syncQueueService.getUnsyncedItems).not.toHaveBeenCalled();
    });

    it('returns 0 when no items to sync', async () => {
        (backendService.checkBackendConnection as jest.Mock).mockResolvedValue(true);
        (syncQueueService.getUnsyncedItems as jest.Mock).mockResolvedValue([]);

        const result = await backgroundSyncService.syncQueuedData();

        expect(result).toBe(0);
    });

    it('syncs items successfully and returns count', async () => {
        const items = [createMockQueueItem('item-1'), createMockQueueItem('item-2')];
        (backendService.checkBackendConnection as jest.Mock).mockResolvedValue(true);
        (syncQueueService.getUnsyncedItems as jest.Mock).mockResolvedValue(items);
        (backendService.syncAllWeatherData as jest.Mock).mockResolvedValue({ success: true });
        (syncQueueService.markAsSynced as jest.Mock).mockResolvedValue(undefined);
        (syncQueueService.cleanupSyncedItems as jest.Mock).mockResolvedValue(undefined);

        const result = await backgroundSyncService.syncQueuedData();

        expect(result).toBe(2);
        expect(syncQueueService.markAsSynced).toHaveBeenCalledTimes(2);
        expect(syncQueueService.cleanupSyncedItems).toHaveBeenCalledWith(7);
    });

    it('increments retry counter for 4xx errors (non-retriable by server but retriable by client logic)', async () => {
        const items = [createMockQueueItem('item-conflict')];
        (backendService.checkBackendConnection as jest.Mock).mockResolvedValue(true);
        (syncQueueService.getUnsyncedItems as jest.Mock).mockResolvedValue(items);

        // Throw an HttpError with 409 Conflict
        const error = new HttpError('Duplicate', 409);
        (backendService.syncAllWeatherData as jest.Mock).mockRejectedValue(error);
        (syncQueueService.incrementSyncAttempt as jest.Mock).mockResolvedValue(undefined);
        (syncQueueService.cleanupSyncedItems as jest.Mock).mockResolvedValue(undefined);

        const result = await backgroundSyncService.syncQueuedData();

        // 4xx should now be counted as 0 successful (they are retried as dead letters)
        expect(result).toBe(0);
        expect(syncQueueService.incrementSyncAttempt).toHaveBeenCalledWith('item-conflict');
        expect(syncQueueService.markAsSynced).not.toHaveBeenCalled();
    });

    it('increments retry counter for network errors', async () => {
        const items = [createMockQueueItem('item-network')];
        (backendService.checkBackendConnection as jest.Mock).mockResolvedValue(true);
        (syncQueueService.getUnsyncedItems as jest.Mock).mockResolvedValue(items);

        const error = new HttpError('Network unreachable', undefined, true);
        (backendService.syncAllWeatherData as jest.Mock).mockRejectedValue(error);
        (syncQueueService.incrementSyncAttempt as jest.Mock).mockResolvedValue(undefined);
        (syncQueueService.cleanupSyncedItems as jest.Mock).mockResolvedValue(undefined);

        const result = await backgroundSyncService.syncQueuedData();

        expect(result).toBe(0);
        expect(syncQueueService.incrementSyncAttempt).toHaveBeenCalledWith('item-network');
    });

    it('separates dead letter items that exceeded MAX_SYNC_ATTEMPTS', async () => {
        const retriableItem = createMockQueueItem('item-ok', 0);
        const deadLetterItem = createMockQueueItem('item-dead', 5); // Exceeds MAX_SYNC_ATTEMPTS
        (backendService.checkBackendConnection as jest.Mock).mockResolvedValue(true);
        (syncQueueService.getUnsyncedItems as jest.Mock).mockResolvedValue([
            retriableItem,
            deadLetterItem,
        ]);
        (backendService.syncAllWeatherData as jest.Mock).mockResolvedValue({ success: true });
        (syncQueueService.markAsSynced as jest.Mock).mockResolvedValue(undefined);
        (syncQueueService.cleanupSyncedItems as jest.Mock).mockResolvedValue(undefined);

        const result = await backgroundSyncService.syncQueuedData();

        // Only the retriable item should be processed
        expect(result).toBe(1);
        expect(backendService.syncAllWeatherData).toHaveBeenCalledTimes(1);
    });

    it('syncs activity logs after weather sync', async () => {
        // Activity logs are synced only when the full sync path runs (not on early-return).
        // Provide one item that syncs successfully so execution reaches the logs sync section.
        const items = [createMockQueueItem('item-log-test')];
        (backendService.checkBackendConnection as jest.Mock).mockResolvedValue(true);
        (syncQueueService.getUnsyncedItems as jest.Mock).mockResolvedValue(items);
        (backendService.syncAllWeatherData as jest.Mock).mockResolvedValue({ success: true });
        (syncQueueService.markAsSynced as jest.Mock).mockResolvedValue(undefined);
        (syncQueueService.cleanupSyncedItems as jest.Mock).mockResolvedValue(undefined);

        await backgroundSyncService.syncQueuedData();

        expect(activityLogsSyncService.syncPendingLogs).toHaveBeenCalled();
    });

    it('returns 0 on unexpected error', async () => {
        (backendService.checkBackendConnection as jest.Mock).mockRejectedValue(
            new Error('Unexpected')
        );

        const result = await backgroundSyncService.syncQueuedData();

        expect(result).toBe(0);
    });
});
