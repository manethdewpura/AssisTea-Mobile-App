import { scheduleSQLiteService } from './sqlite/scheduleSQLite.service';
import { assignmentStorageService } from './assignmentStorage.service';
import { SavedSchedule } from '../models/SavedSchedule';

/**
 * Unified Schedule Service - Offline-First Architecture
 */
class UnifiedScheduleService {
    async saveSchedule(scheduleData: Omit<SavedSchedule, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<SavedSchedule> {
        const schedule: SavedSchedule = {
            id: `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            ...scheduleData,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active',
        };

        await scheduleSQLiteService.saveSchedule(schedule);
        console.log('✅ Schedule saved to SQLite (offline-safe)');

        this.syncToFirebase(schedule).catch(err => {
            console.warn('⚠️ Firebase sync failed (will retry later):', err);
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
        await scheduleSQLiteService.deleteSchedule(scheduleId);
        assignmentStorageService.deleteSchedule(scheduleId).catch(() => { });
    }

    private async syncToFirebase(schedule: SavedSchedule): Promise<void> {
        await assignmentStorageService.saveSchedule({
            plantationId: schedule.plantationId,
            date: schedule.date,
            totalWorkers: schedule.totalWorkers,
            totalFields: schedule.totalFields,
            averageEfficiency: schedule.averageEfficiency,
            assignments: schedule.assignments,
        });
        await scheduleSQLiteService.markAsSynced(schedule.id);
        console.log('🔄 Schedule synced to Firebase');
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
