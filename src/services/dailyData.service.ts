import firestore from '@react-native-firebase/firestore';
import type { CreateDailyDataInput, DailyData } from '../models/DailyData';

class DailyDataService {
  private dailyDataCollection = firestore().collection('dailyData');

  /**
   * Create a new daily data entry in Firebase
   */
  async createDailyData(
    plantationId: string,
    data: CreateDailyDataInput,
  ): Promise<DailyData> {
    try {
      const dataId = this.dailyDataCollection.doc().id;
      const now = Date.now();

      const dailyData: DailyData = {
        id: dataId,
        ...data,
        plantationId,
        teaPluckedKg: typeof data.teaPluckedKg === 'string' 
          ? parseFloat(data.teaPluckedKg) 
          : data.teaPluckedKg,
        timeSpentHours: typeof data.timeSpentHours === 'string'
          ? parseFloat(data.timeSpentHours)
          : data.timeSpentHours,
        createdAt: now,
        updatedAt: now,
      };

      await this.dailyDataCollection.doc(dataId).set(dailyData);
      return dailyData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create multiple daily data entries (for bulk upload)
   */
  async createBulkDailyData(
    plantationId: string,
    dataArray: CreateDailyDataInput[],
  ): Promise<DailyData[]> {
    try {
      const batch = firestore().batch();
      const now = Date.now();
      const createdData: DailyData[] = [];

      dataArray.forEach(data => {
        const dataId = this.dailyDataCollection.doc().id;
        const dailyData: DailyData = {
          id: dataId,
          ...data,
          plantationId,
          teaPluckedKg: typeof data.teaPluckedKg === 'string' 
            ? parseFloat(data.teaPluckedKg) 
            : data.teaPluckedKg,
          timeSpentHours: typeof data.timeSpentHours === 'string'
            ? parseFloat(data.timeSpentHours)
            : data.timeSpentHours,
          createdAt: now,
          updatedAt: now,
        };

        const docRef = this.dailyDataCollection.doc(dataId);
        batch.set(docRef, dailyData);
        createdData.push(dailyData);
      });

      await batch.commit();
      return createdData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get daily data entries for a specific plantation
   */
  async getDailyDataByPlantation(
    plantationId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<DailyData[]> {
    try {
      // Fetch all data for the plantation first
      const snapshot = await this.dailyDataCollection
        .where('plantationId', '==', plantationId)
        .get();

      let dailyData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as DailyData[];

      // Filter by date range in memory to avoid composite index requirements
      if (startDate || endDate) {
        dailyData = dailyData.filter(data => {
          if (startDate && data.date < startDate) return false;
          if (endDate && data.date > endDate) return false;
          return true;
        });
      }

      return dailyData.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get daily data entries for a specific worker
   */
  async getDailyDataByWorker(
    workerId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<DailyData[]> {
    try {
      // Fetch all data for the worker first
      const snapshot = await this.dailyDataCollection
        .where('workerId', '==', workerId)
        .get();

      let dailyData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as DailyData[];

      // Filter by date range in memory to avoid composite index requirements
      if (startDate || endDate) {
        dailyData = dailyData.filter(data => {
          if (startDate && data.date < startDate) return false;
          if (endDate && data.date > endDate) return false;
          return true;
        });
      }

      return dailyData.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get daily data entry by ID
   */
  async getDailyDataById(dataId: string): Promise<DailyData | null> {
    try {
      const doc = await this.dailyDataCollection.doc(dataId).get();
      if (!doc.exists()) return null;
      
      // Ensure the id field is included
      return {
        ...doc.data(),
        id: doc.id,
      } as DailyData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update daily data entry
   */
  async updateDailyData(
    dataId: string,
    updates: Partial<CreateDailyDataInput>,
  ): Promise<void> {
    try {
      const updateData: any = {
        ...updates,
        updatedAt: Date.now(),
      };

      if (updates.teaPluckedKg !== undefined) {
        updateData.teaPluckedKg =
          typeof updates.teaPluckedKg === 'string'
            ? parseFloat(updates.teaPluckedKg)
            : updates.teaPluckedKg;
      }

      if (updates.timeSpentHours !== undefined) {
        updateData.timeSpentHours =
          typeof updates.timeSpentHours === 'string'
            ? parseFloat(updates.timeSpentHours)
            : updates.timeSpentHours;
      }

      await this.dailyDataCollection.doc(dataId).update(updateData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete daily data entry
   */
  async deleteDailyData(dataId: string): Promise<void> {
    try {
      await this.dailyDataCollection.doc(dataId).delete();
    } catch (error) {
      throw error;
    }
  }
}

export const dailyDataService = new DailyDataService();

