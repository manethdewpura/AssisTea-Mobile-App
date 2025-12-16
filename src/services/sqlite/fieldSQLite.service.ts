import { databaseService } from '../database.service';
import { Field } from '../../models/Field';

class FieldSQLiteService {
    /**
     * Insert a new field into SQLite
     */
    async insertField(field: Field): Promise<void> {
        const query = `
      INSERT INTO fields (
        id, name, slope, maxWorkers, location, plantationId, 
        createdAt, updatedAt, syncStatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const params = [
            field.id,
            field.name,
            field.slope,
            field.maxWorkers,
            field.location || null,
            field.plantationId,
            field.createdAt.toISOString(),
            field.updatedAt.toISOString(),
            'pending',
        ];

        await databaseService.executeSql(query, params);
        console.log(`✅ Field inserted into SQLite: ${field.name}`);
    }

    /**
     * Update an existing field
     */
    async updateField(id: string, updates: Partial<Field>): Promise<void> {
        const setClauses: string[] = [];
        const params: any[] = [];

        if (updates.name !== undefined) {
            setClauses.push('name = ?');
            params.push(updates.name);
        }
        if (updates.slope !== undefined) {
            setClauses.push('slope = ?');
            params.push(updates.slope);
        }
        if (updates.maxWorkers !== undefined) {
            setClauses.push('maxWorkers = ?');
            params.push(updates.maxWorkers);
        }
        if (updates.location !== undefined) {
            setClauses.push('location = ?');
            params.push(updates.location);
        }

        // Always update updatedAt and syncStatus
        setClauses.push('updatedAt = ?');
        params.push(new Date().toISOString());
        setClauses.push('syncStatus = ?');
        params.push('pending');

        params.push(id);

        const query = `
      UPDATE fields 
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `;

        await databaseService.executeSql(query, params);
        console.log(`✅ Field updated in SQLite: ${id}`);
    }

    /**
     * Delete a field
     */
    async deleteField(id: string): Promise<void> {
        const query = 'DELETE FROM fields WHERE id = ?';
        await databaseService.executeSql(query, [id]);
        console.log(`✅ Field deleted from SQLite: ${id}`);
    }

    /**
     * Get field by ID
     */
    async getFieldById(id: string): Promise<Field | null> {
        const query = 'SELECT * FROM fields WHERE id = ?';
        const result = await databaseService.executeSql(query, [id]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows.item(0);
        return this.mapRowToField(row);
    }

    /**
     * Get all fields for a plantation
     */
    async getAllFields(plantationId: string): Promise<Field[]> {
        const query = `
      SELECT * FROM fields 
      WHERE plantationId = ? 
      ORDER BY createdAt DESC
    `;
        const result = await databaseService.executeSql(query, [plantationId]);

        const fields: Field[] = [];
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            fields.push(this.mapRowToField(row));
        }

        return fields;
    }

    /**
     * Get fields that need syncing
     */
    async getPendingSyncFields(): Promise<Field[]> {
        const query = `
      SELECT * FROM fields 
      WHERE syncStatus = 'pending'
      ORDER BY updatedAt ASC
    `;
        const result = await databaseService.executeSql(query);

        const fields: Field[] = [];
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            fields.push(this.mapRowToField(row));
        }

        return fields;
    }

    /**
     * Mark field as synced
     */
    async markAsSynced(id: string): Promise<void> {
        const query = 'UPDATE fields SET syncStatus = ? WHERE id = ?';
        await databaseService.executeSql(query, ['synced', id]);
        console.log(`✅ Field marked as synced: ${id}`);
    }

    /**
     * Mark field as pending sync
     */
    async markForSync(id: string): Promise<void> {
        const query = 'UPDATE fields SET syncStatus = ? WHERE id = ?';
        await databaseService.executeSql(query, ['pending', id]);
        console.log(`📤 Field marked for sync: ${id}`);
    }

    /**
     * Map database row to Field object
     */
    private mapRowToField(row: any): Field {
        return {
            id: row.id,
            name: row.name,
            slope: row.slope,
            maxWorkers: row.maxWorkers,
            location: row.location,
            plantationId: row.plantationId,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        };
    }
}

export const fieldSQLiteService = new FieldSQLiteService();
