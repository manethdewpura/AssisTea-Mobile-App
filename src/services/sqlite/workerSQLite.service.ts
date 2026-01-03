import { databaseService } from '../database.service';
import { Worker } from '../../models/Worker';

class WorkerSQLiteService {
    /**
     * Insert a worker into SQLite
     */
    async insertWorker(worker: Worker): Promise<void> {
        const query = `
      INSERT OR REPLACE INTO workers (
        id, name, workerId, birthDate, age, experience, gender,
        plantationId, createdAt, updatedAt, syncStatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const params = [
            worker.id,
            worker.name,
            worker.workerId,
            worker.birthDate,
            worker.age,
            worker.experience,
            worker.gender,
            worker.plantationId,
            worker.createdAt,
            worker.updatedAt,
            'synced',
        ];

        await databaseService.executeSql(query, params);
    }

    /**
     * Get all workers for a plantation
     */
    async getAllWorkers(plantationId: string): Promise<Worker[]> {
        const query = ` SELECT * FROM workers 
      WHERE plantationId = ? 
      ORDER BY name ASC
    `;
        const result = await databaseService.executeSql(query, [plantationId]);

        const workers: Worker[] = [];
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            workers.push(this.mapRowToWorker(row));
        }

        return workers;
    }

    /**
     * Clear all workers (for re-sync)
     */
    async clearWorkers(plantationId: string): Promise<void> {
        const query = 'DELETE FROM workers WHERE plantationId = ?';
        await databaseService.executeSql(query, [plantationId]);
    }

    /**
     * Map database row to Worker object
     */
    private mapRowToWorker(row: any): Worker {
        return {
            id: row.id,
            name: row.name,
            workerId: row.workerId,
            birthDate: row.birthDate,
            age: row.age,
            experience: row.experience,
            gender: row.gender,
            plantationId: row.plantationId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
}

export const workerSQLiteService = new WorkerSQLiteService();
