import { scheduleSQLiteService } from './sqlite/scheduleSQLite.service';
import { assignmentStorageService } from './assignmentStorage.service';
import { SavedSchedule } from '../models/SavedSchedule';
import { checkNetworkConnection } from '../utils/network.util';

/**
 * Unified Schedule Service - Offline-First Architecture
 */
class UnifiedScheduleService {
    async saveSchedule(scheduleData: Omit<SavedSchedule, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<SavedSchedule> {
        let isConnected = false;
        try {
            const netResult = await checkNetworkConnection();
            isConnected = !!netResult?.isConnected;
        } catch { /* ignore — treated as offline */ }

        console.log(`🔧 [UnifiedSchedule.saveSchedule] date=${scheduleData.date}, isConnected=${isConnected}`);

        const schedule: SavedSchedule = {
            id: `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            ...scheduleData,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active',
        };

        console.log(`💾 [UnifiedSchedule] Step 1 — Writing to SQLite: id=${schedule.id}, assignments=${schedule.assignments.length}`);
        await scheduleSQLiteService.saveSchedule(schedule);
        console.log(`✅ [UnifiedSchedule] SQLite save complete for schedule ${schedule.id}`);

        if (isConnected) {
            console.log(`🌐 [UnifiedSchedule] Online — firing Firebase sync in background...`);
        } else {
            console.log(`📴 [UnifiedSchedule] Offline — Firebase sync queued (will auto-flush when online)`);
        }
        this.syncToFirebase(schedule).catch(err => {
            console.warn('⚠️ [UnifiedSchedule] Firebase sync failed (will retry later):', err);
        });

        return schedule;
    }

    async getLatestSchedule(plantationId: string): Promise<SavedSchedule | null> {
        const schedule = await scheduleSQLiteService.getLatestSchedule(plantationId);
        return schedule;
    }

    async getRecentSchedules(plantationId: string, limit: number = 10): Promise<SavedSchedule[]> {
        return await scheduleSQLiteService.getRecentSchedules(plantationId, limit);
    }

    async deleteSchedule(scheduleId: string): Promise<void> {
        let isConnected = false;
        try {
            const netResult = await checkNetworkConnection();
            isConnected = !!netResult?.isConnected;
        } catch { /* ignore */ }

        console.log(`🗑️ [UnifiedSchedule.deleteSchedule] id=${scheduleId}, isConnected=${isConnected}`);
        console.log(`💾 [UnifiedSchedule] Step 1 — Deleting from SQLite...`);
        await scheduleSQLiteService.deleteSchedule(scheduleId);
        console.log(`✅ [UnifiedSchedule] SQLite delete complete`);

        if (isConnected) {
            console.log(`🌐 [UnifiedSchedule] Online — firing Firebase delete in background...`);
        } else {
            console.log(`📴 [UnifiedSchedule] Offline — Firebase delete queued`);
        }
        assignmentStorageService.deleteSchedule(scheduleId).catch((error) => {
            console.error('⚠️ [UnifiedSchedule] Failed to delete schedule from Firebase:', error);
        });
    }

    private async syncToFirebase(schedule: SavedSchedule): Promise<void> {
        console.log(`🔄 [UnifiedSchedule.syncToFirebase] Attempting Firebase sync for schedule id=${schedule.id}, date=${schedule.date}...`);
        await assignmentStorageService.saveSchedule({
            plantationId: schedule.plantationId,
            date: schedule.date,
            totalWorkers: schedule.totalWorkers,
            totalFields: schedule.totalFields,
            averageEfficiency: schedule.averageEfficiency,
            assignments: schedule.assignments,
        });
        await scheduleSQLiteService.markAsSynced(schedule.id);
        console.log(`✅ [UnifiedSchedule.syncToFirebase] Firebase sync complete for ${schedule.id}, syncStatus=synced`);
    }

    async pullFromFirebase(plantationId: string): Promise<void> {
        try {
            const firebaseSchedules = await assignmentStorageService.getRecentSchedules(plantationId, 30);
            for (const schedule of firebaseSchedules) {
                const localSchedule = await scheduleSQLiteService.getScheduleByDate(plantationId, schedule.date);
                if (!localSchedule) {
                    await scheduleSQLiteService.saveSchedule(schedule);
                    await scheduleSQLiteService.markAsSynced(schedule.id);
                }
            }
        } catch (error) {
            console.error('Error pulling from Firebase:', error);
        }
    }
}

export const unifiedScheduleService = new UnifiedScheduleService();
