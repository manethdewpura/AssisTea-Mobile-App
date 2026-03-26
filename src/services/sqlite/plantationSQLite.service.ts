import { databaseService } from '../database.service';
import type { TeaPlantationModel } from '../../models';

class PlantationSQLiteService {
    async upsertPlantation(plantation: TeaPlantationModel): Promise<void> {
        const query = `
      INSERT OR REPLACE INTO plantations (
        id, name, location, area, description, adminId
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

        const params = [
            plantation.id,
            plantation.name,
            plantation.location,
            plantation.area,
            plantation.description ?? null,
            plantation.adminId,
        ];

        await databaseService.executeSql(query, params);
    }

    async getPlantation(id: string): Promise<TeaPlantationModel | null> {
        const result = await databaseService.executeSql(
            'SELECT * FROM plantations WHERE id = ?',
            [id],
        );

        if (result.rows.length === 0) return null;
        const row = result.rows.item(0);

        return {
            id: row.id,
            name: row.name,
            location: row.location,
            area: row.area,
            description: row.description ?? undefined,
            adminId: row.adminId,
            managerIds: [],
        };
    }
}

export const plantationSQLiteService = new PlantationSQLiteService();

