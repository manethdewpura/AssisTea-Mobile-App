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
   * Create a new worker in Firebase
   */
  async createWorker(
    plantationId: string,
    workerData: CreateWorkerInput,
  ): Promise<Worker> {
    try {
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

      await setDoc(newDocRef, worker);
      return worker;
    } catch (error) {
      throw error;
    }
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
   * Update worker details
   */
  async updateWorker(workerId: string, updates: Partial<Worker>): Promise<void> {
    try {
      const workerDocRef = doc(this.db, this.collectionName, workerId);
      await updateDoc(workerDocRef, {
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a worker
   */
  async deleteWorker(workerId: string): Promise<void> {
    try {
      const workerDocRef = doc(this.db, this.collectionName, workerId);
      await deleteDoc(workerDocRef);
    } catch (error) {
      throw error;
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
