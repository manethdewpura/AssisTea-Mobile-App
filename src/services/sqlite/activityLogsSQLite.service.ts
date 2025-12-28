import { databaseService } from '../database.service';
import { OperationalLog } from '../logs.service';

/**
 * Ensure database is initialized before use
 */
async function ensureDatabaseInitialized(): Promise<void> {
  try {
    databaseService.getDatabase();
  } catch (error) {
    // Database not initialized, try to initialize it
    await databaseService.initialize();
  }
}

class ActivityLogsSQLiteService {
    /**
     * Save an activity log to SQLite
     */
    async saveLog(log: OperationalLog): Promise<void> {
        await ensureDatabaseInitialized();
        const now = new Date().toISOString();
        const query = `
            INSERT OR REPLACE INTO activity_logs (
                id, timestamp, operation_type, zone_id, status,
                duration, pressure, flow_rate, water_volume, fertilizer_volume,
                start_moisture, end_moisture, notes,
                syncStatus, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            log.id,
            log.timestamp,
            log.operation_type,
            log.zone_id || null,
            log.status,
            log.duration || null,
            log.pressure || null,
            log.flow_rate || null,
            log.water_volume || null,
            log.fertilizer_volume || null,
            log.start_moisture || null,
            log.end_moisture || null,
            log.notes || null,
            'pending', // Mark as pending sync
            now,
            now,
        ];

        await databaseService.executeSql(query, params);
        console.log(`✅ Activity log saved to SQLite: ${log.id}`);
    }

    /**
     * Save multiple activity logs
     */
    async saveLogs(logs: OperationalLog[]): Promise<void> {
        await ensureDatabaseInitialized();
        if (logs.length === 0) return;

        const now = new Date().toISOString();
        const queries = logs.map(log => ({
            query: `
                INSERT OR REPLACE INTO activity_logs (
                    id, timestamp, operation_type, zone_id, status,
                    duration, pressure, flow_rate, water_volume, fertilizer_volume,
                    start_moisture, end_moisture, notes,
                    syncStatus, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            params: [
                log.id,
                log.timestamp,
                log.operation_type,
                log.zone_id || null,
                log.status,
                log.duration || null,
                log.pressure || null,
                log.flow_rate || null,
                log.water_volume || null,
                log.fertilizer_volume || null,
                log.start_moisture || null,
                log.end_moisture || null,
                log.notes || null,
                'pending',
                now,
                now,
            ],
        }));

        await databaseService.executeTransaction(queries);
        console.log(`✅ ${logs.length} activity logs saved to SQLite`);
    }

    /**
     * Get activity logs with optional filters
     */
    async getLogs(params?: {
        limit?: number;
        zone_id?: number;
        operation_type?: string;
        hours?: number;
    }): Promise<OperationalLog[]> {
        await ensureDatabaseInitialized();
        let query = 'SELECT * FROM activity_logs WHERE 1=1';
        const queryParams: any[] = [];

        if (params?.zone_id) {
            query += ' AND zone_id = ?';
            queryParams.push(params.zone_id);
        }

        if (params?.operation_type) {
            query += ' AND operation_type = ?';
            queryParams.push(params.operation_type);
        }

        if (params?.hours) {
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - params.hours);
            query += ' AND timestamp >= ?';
            queryParams.push(cutoffTime.toISOString());
        }

        query += ' ORDER BY timestamp DESC';

        if (params?.limit) {
            query += ' LIMIT ?';
            queryParams.push(params.limit);
        }

        const result = await databaseService.executeSql(query, queryParams);
        const logs: OperationalLog[] = [];

        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            logs.push(this.mapRowToLog(row));
        }

        return logs;
    }

    /**
     * Get logs pending sync to Firebase
     */
    async getPendingSyncLogs(): Promise<OperationalLog[]> {
        await ensureDatabaseInitialized();
        const query = `
            SELECT * FROM activity_logs 
            WHERE syncStatus = 'pending'
            ORDER BY timestamp ASC
        `;
        const result = await databaseService.executeSql(query);
        const logs: OperationalLog[] = [];

        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            logs.push(this.mapRowToLog(row));
        }

        return logs;
    }

    /**
     * Mark log as synced
     */
    async markAsSynced(logId: number): Promise<void> {
        await ensureDatabaseInitialized();
        const query = `
            UPDATE activity_logs 
            SET syncStatus = ?, updatedAt = ?
            WHERE id = ?
        `;
        await databaseService.executeSql(query, ['synced', new Date().toISOString(), logId]);
        console.log(`✅ Activity log marked as synced: ${logId}`);
    }

    /**
     * Mark multiple logs as synced
     */
    async markMultipleAsSynced(logIds: number[]): Promise<void> {
        await ensureDatabaseInitialized();
        if (logIds.length === 0) return;

        const now = new Date().toISOString();
        const queries = logIds.map(id => ({
            query: 'UPDATE activity_logs SET syncStatus = ?, updatedAt = ? WHERE id = ?',
            params: ['synced', now, id],
        }));

        await databaseService.executeTransaction(queries);
        console.log(`✅ ${logIds.length} activity logs marked as synced`);
    }

    /**
     * Delete old logs (older than specified days)
     */
    async deleteOldLogs(daysToKeep: number = 90): Promise<void> {
        await ensureDatabaseInitialized();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const query = 'DELETE FROM activity_logs WHERE timestamp < ?';
        const result = await databaseService.executeSql(query, [cutoffDate.toISOString()]);
        console.log(`✅ Deleted old activity logs before ${cutoffDate.toISOString()}`);
    }

    /**
     * Get log count
     */
    async getLogCount(): Promise<number> {
        await ensureDatabaseInitialized();
        const query = 'SELECT COUNT(*) as count FROM activity_logs';
        const result = await databaseService.executeSql(query);
        return result.rows.item(0).count;
    }

    /**
     * Map database row to OperationalLog
     */
    private mapRowToLog(row: any): OperationalLog {
        return {
            id: row.id,
            timestamp: row.timestamp,
            operation_type: row.operation_type,
            zone_id: row.zone_id,
            status: row.status,
            duration: row.duration,
            pressure: row.pressure,
            flow_rate: row.flow_rate,
            water_volume: row.water_volume,
            fertilizer_volume: row.fertilizer_volume,
            start_moisture: row.start_moisture,
            end_moisture: row.end_moisture,
            notes: row.notes,
        };
    }
}

export const activityLogsSQLiteService = new ActivityLogsSQLiteService();

