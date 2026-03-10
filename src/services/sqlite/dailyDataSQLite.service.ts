import { databaseService } from '../database.service';
import { DailyData } from '../../models/DailyData';

class DailyDataSQLiteService {

    /**
     * Bulk insert or replace daily data records from Firebase sync.
     * Using INSERT OR REPLACE to handle re-syncs gracefully.
     *
     * Note: We store the DailyData.fieldArea value in the SQLite
     *       column "fieldId" so that offline consumers can still
     *       resolve the worked field area, even though the schema
     *       predates the fieldArea property.
     */
    async insertOrReplaceBatch(records: DailyData[]): Promise<void> {
        if (records.length === 0) return;

        console.log(
            '[DailyDataSQLite] insertOrReplaceBatch called with records:',
            records.length,
        );

        const query = `
            INSERT OR REPLACE INTO daily_data (
                id, workerId, fieldId, plantationId, date,
                teaPluckedKg, timeSpentHours, fieldSlope,
                syncStatus, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)
        `;

        const queries = records.map((record, index) => {
            const anyRecord = record as any;
            const rawCreated = anyRecord.createdAt;
            const rawUpdated = anyRecord.updatedAt;

            const createdAt =
                typeof rawCreated === 'number'
                    ? rawCreated
                    : rawCreated?.toMillis?.() ?? Date.now();

            const updatedAt =
                typeof rawUpdated === 'number'
                    ? rawUpdated
                    : rawUpdated?.toMillis?.() ?? createdAt;

            const teaPlucked =
                typeof record.teaPluckedKg === 'string'
                    ? parseFloat(record.teaPluckedKg)
                    : record.teaPluckedKg;

            const timeSpent =
                typeof record.timeSpentHours === 'string'
                    ? parseFloat(record.timeSpentHours)
                    : record.timeSpentHours;

            if (index < 5) {
                console.log('[DailyDataSQLite] Sample record to insert:', {
                    index,
                    id: record.id,
                    workerId: record.workerId,
                    plantationId: record.plantationId,
                    date: anyRecord.date,
                    teaPluckedKg: teaPlucked,
                    timeSpentHours: timeSpent,
                    fieldArea: anyRecord.fieldArea,
                    createdAt,
                    updatedAt,
                });
            }

            return {
                query,
                params: [
                    record.id,
                    record.workerId,
                    // Persist fieldArea string in fieldId column for offline use
                    anyRecord.fieldArea ?? null,
                    record.plantationId,
                    anyRecord.date ?? null,
                    teaPlucked,
                    timeSpent,
                    anyRecord.fieldSlope ?? null,
                    createdAt,
                    updatedAt,
                ],
            };
        });

        await databaseService.executeTransaction(queries);
    }

    /**
     * Get all daily data records for a plantation (for schedule generation and UI).
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
            ...(row.date ? { date: row.date } : {}),
            // Rehydrate fieldArea from the stored fieldId column
            ...(row.fieldId ? { fieldArea: row.fieldId } : {}),
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
