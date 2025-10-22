import {
  ensureNetworkConnection,
  handleFirebaseError,
  logError,
} from '../utils';
import { userService } from './user.service';
import { teaPlantationDao } from './dao';
import { TeaPlantationModel } from '../models';
import { TeaPlantationDTO } from '../common/dto';
import { TeaPlantation } from '../common/interfaces';

export const teaPlantationService = {
  async createTeaPlantation(
    plantation: Omit<TeaPlantationModel, 'id'>,
    adminId: string,
  ): Promise<string> {
    try {
      await ensureNetworkConnection();

      // Check if admin already has a plantation
      const existingPlantation = await this.getPlantationByAdminId(adminId);
      if (existingPlantation) {
        throw new Error('Admin can only manage one tea plantation');
      }

      const plantationDataToSave: TeaPlantationDTO = {
        name: plantation.name,
        location: plantation.location,
        area: plantation.area,
        description: plantation.description,
        adminId,
        managerIds: plantation.managerIds,
      };
      const id = await teaPlantationDao.create(plantationDataToSave);

      // Update admin's profile with plantationId
      await userService.updateUserProfile(adminId, {
        plantationId: id,
        plantationName: plantation.name,
      });

      return id;
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - createTeaPlantation');
      throw appError;
    }
  },

  async updateTeaPlantation(
    id: string,
    plantation: Partial<TeaPlantationModel>,
  ): Promise<void> {
    try {
      await ensureNetworkConnection();
      // Build DTO-safe partial
      const updates: any = {};
      if (typeof plantation.name !== 'undefined')
        updates.name = plantation.name;
      if (typeof plantation.location !== 'undefined')
        updates.location = plantation.location;
      if (typeof plantation.area !== 'undefined')
        updates.area = plantation.area;
      if (typeof plantation.description !== 'undefined')
        updates.description = plantation.description;
      if (typeof plantation.adminId !== 'undefined')
        updates.adminId = plantation.adminId;
      if (typeof plantation.managerIds !== 'undefined')
        updates.managerIds = plantation.managerIds;
      await teaPlantationDao.update(id, updates);
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - updateTeaPlantation');
      throw appError;
    }
  },

  async deleteTeaPlantation(id: string): Promise<void> {
    try {
      await ensureNetworkConnection();
      await teaPlantationDao.delete(id);
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - deleteTeaPlantation');
      throw appError;
    }
  },

  async getTeaPlantations(): Promise<TeaPlantationModel[]> {
    try {
      await ensureNetworkConnection();
      const rows = await teaPlantationDao.getAll();
      return rows.map(row => ({
        id: row.id,
        name: row.data.name,
        location: row.data.location,
        area: row.data.area,
        description: row.data.description,
        adminId: row.data.adminId,
        managerIds: row.data.managerIds ?? [],
      }));
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - getTeaPlantations');
      throw appError;
    }
  },

  async getTeaPlantation(id: string): Promise<TeaPlantationModel | null> {
    try {
      await ensureNetworkConnection();
      const row = await teaPlantationDao.getById(id);
      if (!row) return null;
      return {
        id: row.id,
        name: row.data.name,
        location: row.data.location,
        area: row.data.area,
        description: row.data.description,
        adminId: row.data.adminId,
        managerIds: row.data.managerIds ?? [],
      };
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - getTeaPlantation');
      throw appError;
    }
  },

  async getPlantationByAdminId(adminId: string): Promise<TeaPlantation | null> {
    try {
      await ensureNetworkConnection();
      const rows = await teaPlantationDao.getAll();
      for (const row of rows) {
        if ((row.data as any).adminId === adminId) {
          return {
            id: row.id,
            name: row.data.name,
            location: row.data.location,
            area: row.data.area,
            description: row.data.description,
            adminId: row.data.adminId,
            managerIds: row.data.managerIds ?? [],
          };
        }
      }
      return null;
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - getPlantationByAdminId');
      throw appError;
    }
  },
};
