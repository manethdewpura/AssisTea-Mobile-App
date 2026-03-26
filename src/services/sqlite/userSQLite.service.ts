import { databaseService } from '../database.service';
import type { UserProfile } from '../../models';

class UserSQLiteService {
    async upsertUser(profile: UserProfile): Promise<void> {
        const query = `
      INSERT OR REPLACE INTO users (
        uid, email, role, name, displayName,
        plantationId, plantationName, createdAt, lastLoginAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const params = [
            profile.uid,
            profile.email,
            profile.role,
            profile.name ?? null,
            profile.displayName ?? null,
            (profile as any).plantationId ?? null,
            (profile as any).plantationName ?? null,
            String((profile as any).createdAt ?? new Date().toISOString()),
            String((profile as any).lastLoginAt ?? new Date().toISOString()),
        ];

        await databaseService.executeSql(query, params);
    }

    async upsertUsers(profiles: UserProfile[]): Promise<void> {
        if (!profiles.length) return;

        const query = `
      INSERT OR REPLACE INTO users (
        uid, email, role, name, displayName,
        plantationId, plantationName, createdAt, lastLoginAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const queries = profiles.map(profile => ({
            query,
            params: [
                profile.uid,
                profile.email,
                profile.role,
                profile.name ?? null,
                profile.displayName ?? null,
                (profile as any).plantationId ?? null,
                (profile as any).plantationName ?? null,
                String((profile as any).createdAt ?? new Date().toISOString()),
                String((profile as any).lastLoginAt ?? new Date().toISOString()),
            ],
        }));

        await databaseService.executeTransaction(queries);
    }

    async getUser(uid: string): Promise<UserProfile | null> {
        const result = await databaseService.executeSql(
            'SELECT * FROM users WHERE uid = ?',
            [uid],
        );

        if (result.rows.length === 0) return null;
        const row = result.rows.item(0);

        const profile: UserProfile = {
            uid: row.uid,
            email: row.email,
            role: row.role,
            name: row.name ?? undefined,
            displayName: row.displayName ?? undefined,
            createdAt: row.createdAt,
            lastLoginAt: row.lastLoginAt,
            plantationId: row.plantationId ?? undefined,
            plantationName: row.plantationName ?? undefined,
        } as any;

        return profile;
    }

    async getManagersByPlantationId(plantationId: string): Promise<UserProfile[]> {
        const result = await databaseService.executeSql(
            'SELECT * FROM users WHERE role = ? AND plantationId = ? ORDER BY email ASC',
            ['tea_plantation_manager', plantationId],
        );

        const managers: UserProfile[] = [];
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            managers.push({
                uid: row.uid,
                email: row.email,
                role: row.role,
                name: row.name ?? undefined,
                displayName: row.displayName ?? undefined,
                createdAt: row.createdAt,
                lastLoginAt: row.lastLoginAt,
                plantationId: row.plantationId ?? undefined,
                plantationName: row.plantationName ?? undefined,
            } as any);
        }

        return managers;
    }
}

export const userSQLiteService = new UserSQLiteService();

