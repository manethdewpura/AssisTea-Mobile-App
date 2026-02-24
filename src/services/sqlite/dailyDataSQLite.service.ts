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

        const queries = records.map(record => {
            const enrichedRecord = record as DailyData & {
                fieldId?: string | null;
                date?: string | null;
                fieldSlope?: number | null;
            };
            return {
                query,
                params: [
                    record.id,
                    record.workerId,
                    enrichedRecord.fieldId ?? null,
                    record.plantationId,
                    enrichedRecord.date ?? null,
                    record.teaPluckedKg,
                    record.timeSpentHours,
                    enrichedRecord.fieldSlope ?? null,
                    record.createdAt,
                    record.updatedAt,
                ],
            };
        });

        await databaseService.executeTransaction(queries);
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
            records.push(this.mapRowToDailyData(result.rows.item(i)));
        }

        return records;
    }

    private mapRowToDailyData(row: any): DailyData {
        return {
            id: row.id,
            workerId: row.workerId,
            plantationId: row.plantationId,
            teaPluckedKg: row.teaPluckedKg,
            timeSpentHours: row.timeSpentHours,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            // extra fields used for ML historical stats (not in Firestore DailyData)
            ...(row.fieldId ? { fieldId: row.fieldId } : {}),
            ...(row.date ? { date: row.date } : {}),
            ...(row.fieldSlope !== null ? { fieldSlope: row.fieldSlope } : {}),
        } as DailyData;
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
