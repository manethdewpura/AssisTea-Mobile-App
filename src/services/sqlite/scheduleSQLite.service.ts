import { databaseService } from '../database.service';
import { SavedSchedule } from '../../models/SavedSchedule';

class ScheduleSQLiteService {
    /**
     * Save a schedule with its assignments
     */
    async saveSchedule(schedule: SavedSchedule): Promise<void> {
        // Use transaction to save schedule and assignments together
        const queries = [
            // Insert/replace schedule
            {
                query: `
          INSERT OR REPLACE INTO saved_schedules (
            id, plantationId, date, totalWorkers, totalFields, 
            averageEfficiency, createdAt, updatedAt, status, syncStatus
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
                params: [
                    schedule.id,
                    schedule.plantationId,
                    schedule.date,
                    schedule.totalWorkers,
                    schedule.totalFields,
                    schedule.averageEfficiency,
                    schedule.createdAt.toISOString(),
                    schedule.updatedAt.toISOString(),
                    schedule.status,
                    'pending',
                ],
            },
        ];

        // Delete old assignments for this schedule
        queries.push({
            query: 'DELETE FROM schedule_assignments WHERE scheduleId = ?',
            params: [schedule.id],
        });

        // Insert new assignments
        for (const assignment of schedule.assignments) {
            queries.push({
                query: `
          INSERT INTO schedule_assignments (
            id, scheduleId, workerId, workerName, fieldId, 
            fieldName, predictedEfficiency, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
                params: [
                    `${schedule.id}_${assignment.workerId}`,
                    schedule.id,
                    assignment.workerId,
                    assignment.workerName,
                    assignment.fieldId,
                    assignment.fieldName,
                    assignment.predictedEfficiency,
                    'pending',
                ],
            });
        }

        await databaseService.executeTransaction(queries);
        console.log(`✅ Schedule saved to SQLite: ${schedule.date}`);
    }

    /**
     * Get schedule by date
     */
    async getScheduleByDate(
        plantationId: string,
        date: string
    ): Promise<SavedSchedule | null> {
        const query = `
      SELECT * FROM saved_schedules 
      WHERE plantationId = ? AND date = ? AND status = 'active'
      LIMIT 1
    `;
        const result = await databaseService.executeSql(query, [plantationId, date]);

        if (result.rows.length === 0) {
            return null;
        }

        const scheduleRow = result.rows.item(0);
        const assignments = await this.getAssignmentsByScheduleId(scheduleRow.id);

        return this.mapRowToSchedule(scheduleRow, assignments);
    }

    /**
     * Get latest schedule for a plantation
     */
    async getLatestSchedule(plantationId: string): Promise<SavedSchedule | null> {
        const query = `
      SELECT * FROM saved_schedules 
      WHERE plantationId = ? AND status = 'active'
      ORDER BY date DESC
      LIMIT 1
    `;
        const result = await databaseService.executeSql(query, [plantationId]);

        if (result.rows.length === 0) {
            return null;
        }

        const scheduleRow = result.rows.item(0);
        const assignments = await this.getAssignmentsByScheduleId(scheduleRow.id);

        return this.mapRowToSchedule(scheduleRow, assignments);
    }

    /**
     * Get recent schedules
     */
    async getRecentSchedules(
        plantationId: string,
        limit: number = 10
    ): Promise<SavedSchedule[]> {
        const query = `
      SELECT * FROM saved_schedules 
      WHERE plantationId = ? AND status = 'active'
      ORDER BY date DESC
      LIMIT ?
    `;
        const result = await databaseService.executeSql(query, [plantationId, limit]);

        const schedules: SavedSchedule[] = [];
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            const assignments = await this.getAssignmentsByScheduleId(row.id);
            schedules.push(this.mapRowToSchedule(row, assignments));
        }

        return schedules;
    }

    /**
     * Get assignments for a schedule
     */
    private async getAssignmentsByScheduleId(scheduleId: string): Promise<any[]> {
        const query = 'SELECT * FROM schedule_assignments WHERE scheduleId = ?';
        const result = await databaseService.executeSql(query, [scheduleId]);

        const assignments: any[] = [];
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            assignments.push({
                workerId: row.workerId,
                workerName: row.workerName,
                fieldId: row.fieldId,
                fieldName: row.fieldName,
                predictedEfficiency: row.predictedEfficiency,
            });
        }

        return assignments;
    }

    /**
     * Delete a schedule
     */
    async deleteSchedule(id: string): Promise<void> {
        await databaseService.executeTransaction([
            { query: 'DELETE FROM schedule_assignments WHERE scheduleId = ?', params: [id] },
            { query: 'DELETE FROM saved_schedules WHERE id = ?', params: [id] },
        ]);
        console.log(`✅ Schedule deleted from SQLite: ${id}`);
    }

    /**
     * Archive a schedule
     */
    async archiveSchedule(id: string): Promise<void> {
        const query = 'UPDATE saved_schedules SET status = ?, syncStatus = ? WHERE id = ?';
        await databaseService.executeSql(query, ['archived', 'pending', id]);
        console.log(`📦 Schedule archived in SQLite: ${id}`);
    }

    /**
     * Get schedules pending sync
     */
    async getPendingSyncSchedules(): Promise<SavedSchedule[]> {
        const query = `
      SELECT * FROM saved_schedules 
      WHERE syncStatus = 'pending'
      ORDER BY updatedAt ASC
    `;
        const result = await databaseService.executeSql(query);

        const schedules: SavedSchedule[] = [];
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            const assignments = await this.getAssignmentsByScheduleId(row.id);
            schedules.push(this.mapRowToSchedule(row, assignments));
        }

        return schedules;
    }

    /**
     * Mark schedule as synced
     */
    async markAsSynced(id: string): Promise<void> {
        const query = 'UPDATE saved_schedules SET syncStatus = ? WHERE id = ?';
        await databaseService.executeSql(query, ['synced', id]);
        console.log(`✅ Schedule marked as synced: ${id}`);
    }

    /**
     * Map database row to SavedSchedule object
     */
    private mapRowToSchedule(row: any, assignments: any[]): SavedSchedule {
        return {
            id: row.id,
            plantationId: row.plantationId,
            date: row.date,
            totalWorkers: row.totalWorkers,
            totalFields: row.totalFields,
            averageEfficiency: row.averageEfficiency,
            assignments,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
            status: row.status,
        };
    }
}

export const scheduleSQLiteService = new ScheduleSQLiteService();
