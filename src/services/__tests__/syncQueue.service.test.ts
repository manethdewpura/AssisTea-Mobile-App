// Mock the weatherDatabaseService BEFORE imports
jest.mock('../weatherDatabase.service', () => ({
    weatherDatabaseService: {
        addToQueue: jest.fn(),
        getQueue: jest.fn(),
        getUnsyncedItems: jest.fn(),
        markAsSynced: jest.fn(),
        incrementSyncAttempt: jest.fn(),
        cleanupSyncedItems: jest.fn(),
        getStats: jest.fn(),
        clearQueue: jest.fn(),
    },
}));

// Suppress console output in tests
jest.spyOn(console, 'log').mockImplementation(() => { });
jest.spyOn(console, 'error').mockImplementation(() => { });

import { syncQueueService } from '../syncQueue.service';
import { weatherDatabaseService } from '../weatherDatabase.service';

const mockCurrent = { dt: 123, main: { temp: 25 } } as any;
const mockForecast = { list: [{ dt: 456 }] } as any;

describe('syncQueueService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('addToQueue', () => {
        it('delegates to weatherDatabaseService and logs stats', async () => {
            (weatherDatabaseService.addToQueue as jest.Mock).mockResolvedValue('weather_123');
            (weatherDatabaseService.getStats as jest.Mock).mockResolvedValue({
                total: 10, synced: 8, unsynced: 2,
            });

            await syncQueueService.addToQueue(mockCurrent, mockForecast);

            expect(weatherDatabaseService.addToQueue).toHaveBeenCalledWith(
                mockCurrent, mockForecast
            );
        });

        it('does not throw on database error', async () => {
            (weatherDatabaseService.addToQueue as jest.Mock).mockRejectedValue(
                new Error('DB error')
            );

            // Should not throw
            await expect(
                syncQueueService.addToQueue(mockCurrent, mockForecast)
            ).resolves.toBeUndefined();
        });
    });

    describe('getQueue', () => {
        it('returns items from database', async () => {
            const mockItems = [
                { id: '1', timestamp: Date.now(), current: mockCurrent, forecast: mockForecast, synced: false },
            ];
            (weatherDatabaseService.getQueue as jest.Mock).mockResolvedValue(mockItems);

            const result = await syncQueueService.getQueue();

            expect(result).toEqual(mockItems);
        });

        it('returns empty array on database error', async () => {
            (weatherDatabaseService.getQueue as jest.Mock).mockRejectedValue(
                new Error('DB error')
            );

            const result = await syncQueueService.getQueue();

            expect(result).toEqual([]);
        });
    });

    describe('getUnsyncedItems', () => {
        it('returns unsynced items from database', async () => {
            const mockItems = [{ id: '1', synced: false }];
            (weatherDatabaseService.getUnsyncedItems as jest.Mock).mockResolvedValue(mockItems);

            const result = await syncQueueService.getUnsyncedItems();

            expect(result).toEqual(mockItems);
        });

        it('returns empty array on database error', async () => {
            (weatherDatabaseService.getUnsyncedItems as jest.Mock).mockRejectedValue(
                new Error('DB error')
            );

            const result = await syncQueueService.getUnsyncedItems();

            expect(result).toEqual([]);
        });
    });

    describe('markAsSynced', () => {
        it('delegates to weatherDatabaseService', async () => {
            (weatherDatabaseService.markAsSynced as jest.Mock).mockResolvedValue(undefined);

            await syncQueueService.markAsSynced('item-1');

            expect(weatherDatabaseService.markAsSynced).toHaveBeenCalledWith('item-1');
        });

        it('does not throw on database error', async () => {
            (weatherDatabaseService.markAsSynced as jest.Mock).mockRejectedValue(
                new Error('DB error')
            );

            await expect(syncQueueService.markAsSynced('item-1')).resolves.toBeUndefined();
        });
    });

    describe('incrementSyncAttempt', () => {
        it('delegates to weatherDatabaseService', async () => {
            (weatherDatabaseService.incrementSyncAttempt as jest.Mock).mockResolvedValue(undefined);

            await syncQueueService.incrementSyncAttempt('item-1');

            expect(weatherDatabaseService.incrementSyncAttempt).toHaveBeenCalledWith('item-1');
        });
    });

    describe('getStats', () => {
        it('returns queue statistics', async () => {
            const stats = { total: 100, synced: 90, unsynced: 10 };
            (weatherDatabaseService.getStats as jest.Mock).mockResolvedValue(stats);

            const result = await syncQueueService.getStats();

            expect(result).toEqual(stats);
        });

        it('returns zero stats on database error', async () => {
            (weatherDatabaseService.getStats as jest.Mock).mockRejectedValue(
                new Error('DB error')
            );

            const result = await syncQueueService.getStats();

            expect(result).toEqual({ total: 0, synced: 0, unsynced: 0 });
        });
    });

    describe('cleanupSyncedItems', () => {
        it('delegates cleanup to database service', async () => {
            (weatherDatabaseService.cleanupSyncedItems as jest.Mock).mockResolvedValue(5);

            await syncQueueService.cleanupSyncedItems(7);

            expect(weatherDatabaseService.cleanupSyncedItems).toHaveBeenCalledWith(7);
        });

        it('does not throw on database error', async () => {
            (weatherDatabaseService.cleanupSyncedItems as jest.Mock).mockRejectedValue(
                new Error('DB error')
            );

            await expect(syncQueueService.cleanupSyncedItems(7)).resolves.toBeUndefined();
        });
    });

    describe('clearQueue', () => {
        it('delegates to weatherDatabaseService', async () => {
            (weatherDatabaseService.clearQueue as jest.Mock).mockResolvedValue(undefined);

            await syncQueueService.clearQueue();

            expect(weatherDatabaseService.clearQueue).toHaveBeenCalled();
        });
    });
});
