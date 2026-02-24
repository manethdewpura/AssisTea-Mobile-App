import { databaseService } from '../database.service';
import { DailyData } from '../../models/DailyData';

class DailyDataSQLiteService {

    /**
     * Bulk insert or replace daily data records from Firebase sync.
     * Using INSERT OR REPLACE to handle re-syncs gracefully.
     */
    async insertOrReplaceBatch(records: DailyData[]): Promise<void> {
        if (records.length === 0) return;

        const query = `
            INSERT OR REPLACE INTO daily_data (
                id, workerId, fieldId, plantationId, date,
                teaPluckedKg, timeSpentHours, fieldSlope,
                syncStatus, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)
        `;

        for (const record of records) {
            await databaseService.executeSql(query, [
                record.id,
                record.workerId,
                (record as any).fieldId ?? null,
                record.plantationId,
                (record as any).date ?? null,
                record.teaPluckedKg,
                record.timeSpentHours,
                (record as any).fieldSlope ?? null,
                record.createdAt,
                record.updatedAt,
            ]);
        }
    }

    /**
     * Get all daily data records for a plantation (for schedule generation).
     */
    async getByPlantation(plantationId: string): Promise<DailyData[]> {
        const query = `
            SELECT * FROM daily_data
            WHERE plantationId = ?
            ORDER BY createdAt ASC
        `;

        const result = await databaseService.executeSql(query, [plantationId]);
        const records: DailyData[] = [];

        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            records.push({
                id: row.id,
                workerId: row.workerId,
                plantationId: row.plantationId,
                teaPluckedKg: row.teaPluckedKg,
                timeSpentHours: row.timeSpentHours,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                // extra fields used for historical stats
                ...(row.fieldId ? { fieldId: row.fieldId } : {}),
                ...(row.date ? { date: row.date } : {}),
                ...(row.fieldSlope !== null ? { fieldSlope: row.fieldSlope } : {}),
            } as DailyData);
        }

        return records;
    }

    /**
     * Returns the number of daily data records stored for a plantation.
     * Useful to check if local cache exists before going offline.
     */
    async getCount(plantationId: string): Promise<number> {
        const result = await databaseService.executeSql(
            'SELECT COUNT(*) as cnt FROM daily_data WHERE plantationId = ?',
            [plantationId]
        );
        return result.rows.item(0).cnt ?? 0;
    }

    /**
     * Clear all daily data for a plantation (called before a full re-sync).
     */
    async clearByPlantation(plantationId: string): Promise<void> {
        await databaseService.executeSql(
            'DELETE FROM daily_data WHERE plantationId = ?',
            [plantationId]
        );
    }
}

export const dailyDataSQLiteService = new DailyDataSQLiteService();
