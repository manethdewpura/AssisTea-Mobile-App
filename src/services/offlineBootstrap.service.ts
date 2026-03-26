import type { UserProfile } from '../models';
import { databaseService } from './database.service';
import { userSQLiteService } from './sqlite/userSQLite.service';
import { plantationSQLiteService } from './sqlite/plantationSQLite.service';
import { teaPlantationService } from './teaPlantation.service';
import { unifiedFieldService } from './unifiedField.service';
import { unifiedScheduleService } from './unifiedSchedule.service';
import { workerService } from './worker.Service';
import { workerSQLiteService } from './sqlite/workerSQLite.service';
import { dailyDataService } from './dailyData.service';
import { dailyDataSQLiteService } from './sqlite/dailyDataSQLite.service';
import { userService } from './user.service';

class OfflineBootstrapService {
  /**
   * Sync all relevant data for the logged-in user from Firebase into SQLite.
   * Safe to call multiple times; operations are idempotent.
   */
  async syncAllForUser(userProfile: UserProfile): Promise<void> {
    try {
      // Ensure DB is ready
      await databaseService.initialize();

      // Always cache the user profile itself
      await userSQLiteService.upsertUser(userProfile);

      // Resolve plantation for this user (admin or manager)
      let plantationId: string | undefined = (userProfile as any).plantationId;

      if (!plantationId && userProfile.role === 'admin') {
        const plantation = await teaPlantationService.getPlantationByAdminId(
          userProfile.uid,
        );
        if (plantation) {
          plantationId = plantation.id;
        }
      }

      if (!plantationId) {
        // Nothing more to sync if user is not associated with a plantation yet
        return;
      }

      // Fetch plantation details and cache them
      const plantation = await teaPlantationService.getTeaPlantation(
        plantationId,
      );
      if (plantation) {
        await plantationSQLiteService.upsertPlantation(plantation);
      }

      // Fields: pull from Firebase and cache via unifiedFieldService/SQLite
      await unifiedFieldService.pullFromFirebase(plantationId);

      // Workers: fetch from Firebase then cache to SQLite
      try {
        const workers = await workerService.getWorkersByPlantation(plantationId);
        await workerSQLiteService.insertOrReplaceBatch(workers);
      } catch (err) {
        console.warn('⚠️ Worker sync failed during offline bootstrap:', err);
      }

      // Managers: fetch from Firebase then cache to SQLite
      try {
        const managers = await userService.getManagersByPlantationId(plantationId);
        await userSQLiteService.upsertUsers(managers);
      } catch (err) {
        console.warn('⚠️ Manager sync failed during offline bootstrap:', err);
      }

      // Daily data: full sync into SQLite
      try {
        await dailyDataService.syncToSQLite(plantationId);
      } catch (err) {
        console.warn('⚠️ Daily data sync failed during offline bootstrap:', err);
      }

      // Schedules: pull recent schedules into SQLite
      try {
        await unifiedScheduleService.pullFromFirebase(plantationId);
      } catch (err) {
        console.warn('⚠️ Schedule sync failed during offline bootstrap:', err);
      }
    } catch (error) {
      console.warn('⚠️ Offline bootstrap failed:', error);
    }
  }
}

export const offlineBootstrapService = new OfflineBootstrapService();

