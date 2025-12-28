import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import type { CreateDailyDataInput, DailyData } from '../models/DailyData';

class DailyDataService {
  private readonly db = getFirestore();
  private readonly collectionName = 'dailyData';

  /**
   * Create a new daily data entry in Firebase
   */
  async createDailyData(
    plantationId: string,
    data: CreateDailyDataInput,
  ): Promise<DailyData> {
    try {
      const dailyDataCollection = collection(this.db, this.collectionName);
      const newDocRef = doc(dailyDataCollection);
      const dataId = newDocRef.id;
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

      await setDoc(newDocRef, dailyData);
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
      const batch = writeBatch(this.db);
      const now = Date.now();
      const createdData: DailyData[] = [];
      const dailyDataCollection = collection(this.db, this.collectionName);

      dataArray.forEach(data => {
        const newDocRef = doc(dailyDataCollection);
        const dataId = newDocRef.id;
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

        batch.set(newDocRef, dailyData);
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
      const dailyDataCollection = collection(this.db, this.collectionName);
      const q = query(
        dailyDataCollection,
        where('plantationId', '==', plantationId)
      );
      const snapshot = await getDocs(q);

      let dailyData = snapshot.docs.map((docSnapshot: any) => ({
        ...docSnapshot.data(),
        id: docSnapshot.id,
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
      const dailyDataCollection = collection(this.db, this.collectionName);
      const q = query(
        dailyDataCollection,
        where('workerId', '==', workerId)
      );
      const snapshot = await getDocs(q);

      let dailyData = snapshot.docs.map((docSnapshot: any) => ({
        ...docSnapshot.data(),
        id: docSnapshot.id,
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
      const docRef = doc(this.db, this.collectionName, dataId);
      const docSnapshot = await getDoc(docRef);
      if (!docSnapshot.exists()) return null;

      // Ensure the id field is included
      return {
        ...docSnapshot.data(),
        id: docSnapshot.id,
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

      const docRef = doc(this.db, this.collectionName, dataId);
      await updateDoc(docRef, updateData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete daily data entry
   */
  async deleteDailyData(dataId: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, dataId);
      await deleteDoc(docRef);
    } catch (error) {
      throw error;
    }
  }
}

export const dailyDataService = new DailyDataService();

