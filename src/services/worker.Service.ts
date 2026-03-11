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
} from '@react-native-firebase/firestore';
import type { CreateWorkerInput } from '../models/Worker';
import { workerSQLiteService } from './sqlite/workerSQLite.service';

interface Worker extends CreateWorkerInput {
  id: string;
  plantationId: string;
  createdAt: number;
  updatedAt: number;
}

class WorkerService {
  private readonly db = getFirestore();
  private readonly collectionName = 'workers';

  /**
   * Create a new worker.
   *
   * Online  : await Firestore, then mirror to SQLite.
   * Offline : insert into SQLite immediately (so UI + assignments are correct),
   *           then queue Firestore write (SDK auto-syncs when back online).
   */
  async createWorker(
    plantationId: string,
    workerData: CreateWorkerInput,
    isConnected: boolean = true,
  ): Promise<Worker> {
    const workersCollection = collection(this.db, this.collectionName);
    const newDocRef = doc(workersCollection);
    const workerId = newDocRef.id;
    const now = Date.now();

    const worker: Worker = {
      id: workerId,
      ...workerData,
      plantationId,
      createdAt: now,
      updatedAt: now,
    };

    console.log(`[WorkerService] createWorker → workerId=${workerId} isConnected=${isConnected}`, JSON.stringify(worker));

    if (!isConnected) {
      // ── OFFLINE ──────────────────────────────────────────────────
      console.log(`[WorkerService] OFFLINE – inserting into SQLite first for workerId=${workerId}`);
      try {
        await workerSQLiteService.insertWorker(worker);
        console.log(`[WorkerService] SQLite insert succeeded for workerId=${workerId}`);
      } catch (sqliteError) {
        console.warn(`[WorkerService] SQLite insert FAILED for workerId=${workerId}:`, sqliteError);
        throw sqliteError;
      }
      console.log(`[WorkerService] OFFLINE – queuing Firestore setDoc for workerId=${workerId}`);
      setDoc(newDocRef, worker).then(() => {
        console.log(`[WorkerService] Queued Firestore setDoc flushed for workerId=${workerId}`);
      }).catch((err: unknown) => {
        console.warn(`[WorkerService] Queued Firestore setDoc error for workerId=${workerId}:`, err);
      });
    } else {
      // ── ONLINE ──────────────────────────────────────────────────
      console.log(`[WorkerService] ONLINE – calling setDoc for workerId=${workerId}`);
      try {
        await setDoc(newDocRef, worker);
        console.log(`[WorkerService] setDoc resolved for workerId=${workerId}`);
      } catch (firestoreError) {
        console.warn(`[WorkerService] setDoc failed for workerId=${workerId}:`, firestoreError);
        throw firestoreError;
      }
      console.log(`[WorkerService] ONLINE – inserting into SQLite for workerId=${workerId}`);
      try {
        await workerSQLiteService.insertWorker(worker);
        console.log(`[WorkerService] SQLite insert succeeded for workerId=${workerId}`);
      } catch (sqliteError) {
        console.warn(`[WorkerService] SQLite insert FAILED for workerId=${workerId}:`, sqliteError);
      }
    }

    return worker;
  }

  /**
   * Get all workers for a specific plantation
   * Note: Removed orderBy to avoid requiring composite index
   */
  async getWorkersByPlantation(plantationId: string): Promise<Worker[]> {
    try {
      const workersCollection = collection(this.db, this.collectionName);
      const q = query(
        workersCollection,
        where('plantationId', '==', plantationId)
      );
      const snapshot = await getDocs(q);

      // Sort manually after fetching to avoid index requirement
      const workers = snapshot.docs.map((docSnapshot: any) => docSnapshot.data() as Worker);
      return workers.sort((a: Worker, b: Worker) => b.createdAt - a.createdAt);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a single worker by ID
   */
  async getWorkerById(workerId: string): Promise<Worker | null> {
    try {
      const workerDocRef = doc(this.db, this.collectionName, workerId);
      const docSnapshot = await getDoc(workerDocRef);
      return docSnapshot.exists() ? (docSnapshot.data() as Worker) : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update worker details.
   *
   * Online  : await Firestore, then mirror to SQLite.
   * Offline : update SQLite immediately, queue Firestore write.
   */
  async updateWorker(
    workerId: string,
    updates: Partial<Worker>,
    isConnected: boolean = true,
  ): Promise<void> {
    const now = Date.now();
    const updatePayload = { ...updates, updatedAt: now };

    console.log(`[WorkerService] updateWorker → workerId=${workerId} isConnected=${isConnected}`, JSON.stringify(updatePayload));

    if (!isConnected) {
      // ── OFFLINE ──────────────────────────────────────────────────
      console.log(`[WorkerService] OFFLINE – updating SQLite first for workerId=${workerId}`);
      try {
        await workerSQLiteService.updateRecord(workerId, updatePayload);
        console.log(`[WorkerService] SQLite update succeeded for workerId=${workerId}`);
      } catch (sqliteError) {
        console.warn(`[WorkerService] SQLite update FAILED for workerId=${workerId}:`, sqliteError);
        throw sqliteError;
      }
      console.log(`[WorkerService] OFFLINE – queuing Firestore updateDoc for workerId=${workerId}`);
      const workerDocRef = doc(this.db, this.collectionName, workerId);
      updateDoc(workerDocRef, updatePayload).then(() => {
        console.log(`[WorkerService] Queued Firestore updateDoc flushed for workerId=${workerId}`);
      }).catch((err: unknown) => {
        console.warn(`[WorkerService] Queued Firestore updateDoc error for workerId=${workerId}:`, err);
      });
    } else {
      // ── ONLINE ──────────────────────────────────────────────────
      console.log(`[WorkerService] ONLINE – calling updateDoc for workerId=${workerId}`);
      const workerDocRef = doc(this.db, this.collectionName, workerId);
      try {
        await updateDoc(workerDocRef, updatePayload);
        console.log(`[WorkerService] updateDoc resolved for workerId=${workerId}`);
      } catch (firestoreError) {
        console.warn(`[WorkerService] updateDoc failed for workerId=${workerId}:`, firestoreError);
        throw firestoreError;
      }
      console.log(`[WorkerService] ONLINE – writing to SQLite for workerId=${workerId}`);
      try {
        await workerSQLiteService.updateRecord(workerId, updatePayload);
        console.log(`[WorkerService] SQLite update succeeded for workerId=${workerId}`);
      } catch (sqliteError) {
        console.warn(`[WorkerService] SQLite update FAILED for workerId=${workerId}:`, sqliteError);
      }
    }
  }

  /**
   * Delete a worker.
   *
   * Online  : await Firestore, then remove from SQLite.
   * Offline : remove from SQLite immediately, queue Firestore delete.
   */
  async deleteWorker(workerId: string, isConnected: boolean = true): Promise<void> {
    console.log(`[WorkerService] deleteWorker → workerId=${workerId} isConnected=${isConnected}`);

    if (!isConnected) {
      // ── OFFLINE ──────────────────────────────────────────────────
      console.log(`[WorkerService] OFFLINE – deleting from SQLite first for workerId=${workerId}`);
      try {
        await workerSQLiteService.deleteRecord(workerId);
        console.log(`[WorkerService] SQLite delete succeeded for workerId=${workerId}`);
      } catch (sqliteError) {
        console.warn(`[WorkerService] SQLite delete FAILED for workerId=${workerId}:`, sqliteError);
        throw sqliteError;
      }
      console.log(`[WorkerService] OFFLINE – queuing Firestore deleteDoc for workerId=${workerId}`);
      const workerDocRef = doc(this.db, this.collectionName, workerId);
      deleteDoc(workerDocRef).then(() => {
        console.log(`[WorkerService] Queued Firestore deleteDoc flushed for workerId=${workerId}`);
      }).catch((err: unknown) => {
        console.warn(`[WorkerService] Queued Firestore deleteDoc error for workerId=${workerId}:`, err);
      });
    } else {
      // ── ONLINE ──────────────────────────────────────────────────
      console.log(`[WorkerService] ONLINE – calling deleteDoc for workerId=${workerId}`);
      const workerDocRef = doc(this.db, this.collectionName, workerId);
      try {
        await deleteDoc(workerDocRef);
        console.log(`[WorkerService] deleteDoc resolved for workerId=${workerId}`);
      } catch (firestoreError) {
        console.warn(`[WorkerService] deleteDoc failed for workerId=${workerId}:`, firestoreError);
        throw firestoreError;
      }
      console.log(`[WorkerService] ONLINE – deleting from SQLite for workerId=${workerId}`);
      try {
        await workerSQLiteService.deleteRecord(workerId);
        console.log(`[WorkerService] SQLite delete succeeded for workerId=${workerId}`);
      } catch (sqliteError) {
        console.warn(`[WorkerService] SQLite delete FAILED for workerId=${workerId}:`, sqliteError);
      }
    }
  }

  /**
   * Get worker by their custom workerId field (not Firebase ID)
   */
  async getWorkerByWorkerId(
    workerId: string,
    plantationId: string,
  ): Promise<Worker | null> {
    try {
      const workersCollection = collection(this.db, this.collectionName);
      const q = query(
        workersCollection,
        where('workerId', '==', workerId),
        where('plantationId', '==', plantationId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.docs.length === 0) {
        return null;
      }

      return snapshot.docs[0].data() as Worker;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if worker ID already exists
   */
  async checkWorkerIdExists(workerId: string, plantationId: string): Promise<boolean> {
    try {
      const workersCollection = collection(this.db, this.collectionName);
      const q = query(
        workersCollection,
        where('workerId', '==', workerId),
        where('plantationId', '==', plantationId)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

export const workerService = new WorkerService();
