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
import { dailyDataSQLiteService } from './sqlite/dailyDataSQLite.service';

class DailyDataService {
  private readonly db = getFirestore();
  private readonly collectionName = 'dailyData';

  /**
   * Create a new daily data entry in Firebase
   */
  async createDailyData(
    plantationId: string,
    data: CreateDailyDataInput,
    isConnected: boolean = true,
  ): Promise<DailyData> {
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

    console.log(`[DailyDataService] createDailyData → dataId=${dataId} isConnected=${isConnected}`, JSON.stringify(dailyData));

    if (!isConnected) {
      // ── OFFLINE PATH ────────────────────────────────────────────
      // 1. Insert into SQLite immediately so the UI reflects the new record.
      console.log(`[DailyDataService] OFFLINE – inserting into SQLite for dataId=${dataId}`);
      try {
        await dailyDataSQLiteService.insertOrReplaceBatch([dailyData]);
        console.log(`[DailyDataService] SQLite insert succeeded for dataId=${dataId}`);
      } catch (sqliteError) {
        console.warn(`[DailyDataService] SQLite insert FAILED for dataId=${dataId}:`, sqliteError);
        throw sqliteError;
      }

      // 2. Queue the Firestore write – SDK auto-syncs when back online.
      console.log(`[DailyDataService] OFFLINE – queuing Firestore setDoc for dataId=${dataId}`);
      setDoc(newDocRef, dailyData).then(() => {
        console.log(`[DailyDataService] Queued Firestore setDoc flushed for dataId=${dataId}`);
      }).catch((err: unknown) => {
        console.warn(`[DailyDataService] Queued Firestore setDoc error for dataId=${dataId}:`, err);
      });
    } else {
      // ── ONLINE PATH ────────────────────────────────────────────
      // 1. Await Firestore so real server errors surface to the caller.
      console.log(`[DailyDataService] ONLINE – calling setDoc for dataId=${dataId}`);
      try {
        await setDoc(newDocRef, dailyData);
        console.log(`[DailyDataService] setDoc resolved for dataId=${dataId}`);
      } catch (firestoreError) {
        console.warn(`[DailyDataService] setDoc failed for dataId=${dataId}:`, firestoreError);
        throw firestoreError;
      }

      // 2. Mirror to SQLite so local cache is up-to-date.
      console.log(`[DailyDataService] ONLINE – inserting into SQLite for dataId=${dataId}`);
      try {
        await dailyDataSQLiteService.insertOrReplaceBatch([dailyData]);
        console.log(`[DailyDataService] SQLite insert succeeded for dataId=${dataId}`);
      } catch (sqliteError) {
        console.warn(`[DailyDataService] SQLite insert FAILED for dataId=${dataId}:`, sqliteError);
      }
    }

    return dailyData;
  }

  /**
   * Create multiple daily data entries (for bulk upload).
   *
   * @param isConnected - Network state. Same online/offline split as createDailyData:
   *   - Online  : Firestore batch first (awaited), then SQLite mirror.
   *   - Offline : SQLite first (awaited), then batch fire-and-forget (SDK queues).
   */
  async createBulkDailyData(
    plantationId: string,
    dataArray: CreateDailyDataInput[],
    isConnected: boolean = true,
  ): Promise<DailyData[]> {
    console.log(`[DailyDataService] createBulkDailyData → count=${dataArray.length}, isConnected=${isConnected}, plantationId=${plantationId}`);

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

    console.log(`[DailyDataService] createBulkDailyData → prepared ${createdData.length} DailyData objects`);

    if (!isConnected) {
      // ── OFFLINE PATH ───────────────────────────────────────────────────────
      // 1. Insert into SQLite immediately so UI reflects the new records.
      console.log(`[DailyDataService] OFFLINE – inserting ${createdData.length} records into SQLite...`);
      try {
        await dailyDataSQLiteService.insertOrReplaceBatch(createdData);
        console.log(`[DailyDataService] SQLite bulk insert succeeded for ${createdData.length} records`);
      } catch (sqliteError) {
        console.warn(`[DailyDataService] SQLite bulk insert FAILED:`, sqliteError);
        throw sqliteError;
      }

      // 2. Queue the batch – SDK auto-syncs when back online.
      console.log(`[DailyDataService] OFFLINE – queuing Firebase batch.commit for ${createdData.length} records`);
      batch.commit().then(() => {
        console.log(`[DailyDataService] Queued Firebase batch.commit flushed for ${createdData.length} records`);
      }).catch((err: unknown) => {
        console.warn(`[DailyDataService] Queued Firebase batch.commit error:`, err);
      });
    } else {
      // ── ONLINE PATH ────────────────────────────────────────────────────────
      // 1. Await Firestore batch so real server errors surface to the caller.
      console.log(`[DailyDataService] ONLINE – calling Firebase batch.commit for ${createdData.length} records...`);
      try {
        await batch.commit();
        console.log(`[DailyDataService] Firebase batch.commit succeeded for ${createdData.length} records`);
      } catch (firestoreError) {
        console.warn(`[DailyDataService] Firebase batch.commit FAILED:`, firestoreError);
        throw firestoreError;
      }

      // 2. Mirror to SQLite so the local cache is up-to-date.
      console.log(`[DailyDataService] ONLINE – inserting ${createdData.length} records into SQLite...`);
      try {
        await dailyDataSQLiteService.insertOrReplaceBatch(createdData);
        console.log(`[DailyDataService] SQLite bulk insert succeeded for ${createdData.length} records`);
      } catch (sqliteError) {
        console.warn(`[DailyDataService] SQLite bulk insert FAILED (Firebase succeeded):`, sqliteError);
      }
    }

    return createdData;
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
   * Update daily data entry.
   *
   * @param isConnected - Pass the current network state so the method can
   *   decide whether to await Firestore or fire-and-forget.
   *   - Online  : Firestore is awaited first, then SQLite is mirrored.
   *   - Offline : SQLite is updated immediately (so the UI refreshes at once),
   *               then Firestore write is queued by the SDK and synced later.
   */
  async updateDailyData(
    dataId: string,
    updates: Partial<CreateDailyDataInput>,
    isConnected: boolean = true,
  ): Promise<void> {
    const now = Date.now();

    const updateData: any = { ...updates, updatedAt: now };

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
    const sqlitePayload = { ...updates, updatedAt: now };

    if (!isConnected) {
      // ── OFFLINE PATH ─────────────────────────────────────────────────────────
      // 1. Update SQLite immediately so the UI reflects the change right away.
      console.log(`[DailyDataService] OFFLINE – updating SQLite first for dataId=${dataId}:`, JSON.stringify(sqlitePayload));
      try {
        await dailyDataSQLiteService.updateRecord(dataId, sqlitePayload);
        console.log(`[DailyDataService] SQLite update succeeded for dataId=${dataId}`);
      } catch (sqliteError) {
        console.warn(`[DailyDataService] SQLite update FAILED for dataId=${dataId}:`, sqliteError);
        throw sqliteError;
      }

      // 2. Queue the Firestore write – SDK will sync when connection is restored.
      console.log(`[DailyDataService] OFFLINE – queuing Firestore write for dataId=${dataId}:`, JSON.stringify(updateData));
      updateDoc(docRef, updateData).then(() => {
        console.log(`[DailyDataService] Queued Firestore write flushed for dataId=${dataId}`);
      }).catch((err: unknown) => {
        console.warn(`[DailyDataService] Queued Firestore write error for dataId=${dataId}:`, err);
      });
    } else {
      // ── ONLINE PATH ──────────────────────────────────────────────────────────
      // 1. Await Firestore so we surface real server errors to the caller.
      console.log(`[DailyDataService] ONLINE – calling updateDoc for dataId=${dataId}:`, JSON.stringify(updateData));
      try {
        await updateDoc(docRef, updateData);
        console.log(`[DailyDataService] updateDoc resolved for dataId=${dataId}`);
      } catch (firestoreError) {
        console.warn(`[DailyDataService] updateDoc failed for dataId=${dataId}:`, firestoreError);
        throw firestoreError;
      }

      // 2. Mirror to SQLite so the local cache is up-to-date.
      console.log(`[DailyDataService] ONLINE – writing to SQLite for dataId=${dataId}:`, JSON.stringify(sqlitePayload));
      try {
        await dailyDataSQLiteService.updateRecord(dataId, sqlitePayload);
        console.log(`[DailyDataService] SQLite update succeeded for dataId=${dataId}`);
      } catch (sqliteError) {
        console.warn(`[DailyDataService] SQLite update FAILED for dataId=${dataId}:`, sqliteError);
      }
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

  /**
   * Sync all Firebase daily data for a plantation into SQLite.
   * Call this when internet is available so offline schedule generation works.
   */
  async syncToSQLite(plantationId: string): Promise<void> {
    try {
      console.log(
        '[DailyDataService] Starting syncToSQLite for plantation:',
        plantationId,
      );
      const records = await this.getDailyDataByPlantation(plantationId);
      console.log(records)
      if (records.length > 0) {
        await dailyDataSQLiteService.insertOrReplaceBatch(records);
        const countAfter = await dailyDataSQLiteService.getCount(plantationId);
        console.log(
          `✅ Synced ${records.length} daily records to SQLite (daily_data count for plantation=${plantationId}: ${countAfter})`,
        );
      } else {
        console.log(
          '[DailyDataService] No daily data records found in Firestore for plantation:',
          plantationId,
        );
      }
    } catch (error) {
      console.warn('⚠️ Could not sync daily data to SQLite:', error);
      // Non-fatal — offline mode will use whatever is already cached
    }
  }
}

export const dailyDataService = new DailyDataService();

