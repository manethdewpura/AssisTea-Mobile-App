import firestore from '@react-native-firebase/firestore';
import type { CreateWorkerInput } from '../models/Worker';

interface Worker extends CreateWorkerInput {
  id: string;
  plantationId: string;
  createdAt: number;
  updatedAt: number;
}

class WorkerService {
  private workersCollection = firestore().collection('workers');

  /**
   * Create a new worker in Firebase
   */
  async createWorker(
    plantationId: string,
    workerData: CreateWorkerInput,
  ): Promise<Worker> {
    try {
      const workerId = this.workersCollection.doc().id;
      const now = Date.now();

      const worker: Worker = {
        id: workerId,
        ...workerData,
        plantationId,
        createdAt: now,
        updatedAt: now,
      };

      await this.workersCollection.doc(workerId).set(worker);
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
      const snapshot = await this.workersCollection
        .where('plantationId', '==', plantationId)
        .get();

      // Sort manually after fetching to avoid index requirement
      const workers = snapshot.docs.map(doc => doc.data() as Worker);
      return workers.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a single worker by ID
   */
  async getWorkerById(workerId: string): Promise<Worker | null> {
    try {
      const doc = await this.workersCollection.doc(workerId).get();
      return doc.exists() ? (doc.data() as Worker) : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update worker details
   */
  async updateWorker(workerId: string, updates: Partial<Worker>): Promise<void> {
    try {
      await this.workersCollection.doc(workerId).update({
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
      await this.workersCollection.doc(workerId).delete();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if worker ID already exists
   */
  async checkWorkerIdExists(workerId: string, plantationId: string): Promise<boolean> {
    try {
      const snapshot = await this.workersCollection
        .where('workerId', '==', workerId)
        .where('plantationId', '==', plantationId)
        .get();

      return snapshot.docs.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

export const workerService = new WorkerService();
