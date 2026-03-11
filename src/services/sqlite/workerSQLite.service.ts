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
     * Bulk insert or replace workers from Firebase sync.
     */
    async insertOrReplaceBatch(workers: Worker[]): Promise<void> {
        if (workers.length === 0) return;

        const query = `
            INSERT OR REPLACE INTO workers (
                id, name, workerId, birthDate, age, experience, gender,
                plantationId, createdAt, updatedAt, syncStatus
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        `;

        const queries = workers.map(worker => ({
            query,
            params: [
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
            ],
        }));

        await databaseService.executeTransaction(queries);
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
     * Look up a worker by their custom workerId field (employee number, not Firebase doc ID).
     * Used for offline CSV import where we cannot query Firestore.
     */
    async getWorkerByCustomId(workerId: string, plantationId: string): Promise<Worker | null> {
        console.log(`[WorkerSQLite] getWorkerByCustomId → workerId="${workerId}", plantationId=${plantationId}`);
        const result = await databaseService.executeSql(
            'SELECT * FROM workers WHERE workerId = ? AND plantationId = ? LIMIT 1',
            [workerId, plantationId],
        );
        if (result.rows.length === 0) {
            console.log(`[WorkerSQLite] getWorkerByCustomId → NOT FOUND for workerId="${workerId}"`);
            return null;
        }
        const worker = this.mapRowToWorker(result.rows.item(0));
        console.log(`[WorkerSQLite] getWorkerByCustomId → found id=${worker.id} for workerId="${workerId}"`);
        return worker;
    }

    /**
     * Clear all workers (for re-sync)
     */
    async clearWorkers(plantationId: string): Promise<void> {
        const query = 'DELETE FROM workers WHERE plantationId = ?';
        await databaseService.executeSql(query, [plantationId]);
    }

    /**
     * Update specific fields of an existing worker record in SQLite.
     * Called after every Firestore update so the local cache stays in sync.
     */
    async updateRecord(
        workerId: string,
        updates: Partial<Pick<Worker, 'name' | 'birthDate' | 'age' | 'experience' | 'gender' | 'updatedAt'>>,
    ): Promise<void> {
        const sets: string[] = [];
        const params: any[] = [];

        if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
        if (updates.birthDate !== undefined) { sets.push('birthDate = ?'); params.push(updates.birthDate); }
        if (updates.age !== undefined) { sets.push('age = ?'); params.push(updates.age); }
        if (updates.experience !== undefined) { sets.push('experience = ?'); params.push(updates.experience); }
        if (updates.gender !== undefined) { sets.push('gender = ?'); params.push(updates.gender); }
        if (updates.updatedAt !== undefined) { sets.push('updatedAt = ?'); params.push(updates.updatedAt); }

        if (sets.length === 0) {
            console.warn('[WorkerSQLite] updateRecord called with no fields, skipping.');
            return;
        }

        params.push(workerId);
        const sql = `UPDATE workers SET ${sets.join(', ')} WHERE id = ?`;
        console.log(`[WorkerSQLite] updateRecord → SQL: "${sql}" params:`, JSON.stringify(params));
        const result = await databaseService.executeSql(sql, params);
        console.log(`[WorkerSQLite] updateRecord done → rowsAffected=${(result as any)?.rowsAffected ?? 'unknown'} for workerId=${workerId}`);
    }

    /**
     * Delete a worker record from SQLite.
     */
    async deleteRecord(workerId: string): Promise<void> {
        console.log(`[WorkerSQLite] deleteRecord → workerId=${workerId}`);
        const result = await databaseService.executeSql(
            'DELETE FROM workers WHERE id = ?',
            [workerId],
        );
        console.log(`[WorkerSQLite] deleteRecord done → rowsAffected=${(result as any)?.rowsAffected ?? 'unknown'} for workerId=${workerId}`);
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
