import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from '@react-native-firebase/firestore';
import { SavedSchedule, CreateScheduleInput } from '../models/SavedSchedule';
import { WorkerAssignment } from '../models/MLPrediction';

class AssignmentStorageService {
    private readonly db = getFirestore();
    private readonly collectionName = 'schedules';

    /**
     * Save a new schedule or update if one exists for the same date
     */
    async saveSchedule(scheduleData: CreateScheduleInput): Promise<SavedSchedule> {
        try {
            // Check if schedule already exists for this date
            const existing = await this.getScheduleByDate(
                scheduleData.plantationId,
                scheduleData.date
            );

            if (existing) {
                // Update existing schedule
                await this.updateSchedule(existing.id, {
                    ...scheduleData,
                    updatedAt: new Date(),
                });

                return {
                    ...existing,
                    ...scheduleData,
                    updatedAt: new Date(),
                };
            }

            // Create new schedule
            const schedulesCollection = collection(this.db, this.collectionName);
            const newDocRef = doc(schedulesCollection);
            const scheduleId = newDocRef.id;
            const now = new Date();

            const schedule: SavedSchedule = {
                id: scheduleId,
                ...scheduleData,
                createdAt: now,
                updatedAt: now,
                status: 'active',
            };

            await setDoc(newDocRef, {
                ...schedule,
                createdAt: Timestamp.fromDate(now),
                updatedAt: Timestamp.fromDate(now),
            });

            return schedule;
        } catch (error) {
            console.error('Error saving schedule:', error);
            throw error;
        }
    }

    /**
     * Get schedule for a specific date
     */
    async getScheduleByDate(
        plantationId: string,
        date: string
    ): Promise<SavedSchedule | null> {
        try {
            const schedulesCollection = collection(this.db, this.collectionName);
            const q = query(
                schedulesCollection,
                where('plantationId', '==', plantationId),
                where('date', '==', date),
                limit(1)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return null;
            }

            const docSnapshot = snapshot.docs[0];
            const data = docSnapshot.data();

            // Filter for active status
            if (data.status !== 'active') {
                return null;
            }

            return {
                ...data,
                id: docSnapshot.id,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
            } as SavedSchedule;
        } catch (error) {
            console.error('Error fetching schedule by date:', error);
            throw error;
        }
    }

    /**
     * Get the most recent schedule for a plantation (NO INDEX REQUIRED)
     */
    async getLatestSchedule(plantationId: string): Promise<SavedSchedule | null> {
        try {
            // Fetch recent schedules without where clause to avoid index
            const schedulesCollection = collection(this.db, this.collectionName);
            const q = query(
                schedulesCollection,
                orderBy('date', 'desc'),
                limit(50)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return null;
            }

            // Filter for this plantation and active status in-memory
            const filteredSchedules = snapshot.docs
                .map((docSnapshot: any) => {
                    const data = docSnapshot.data();
                    return {
                        ...data,
                        id: docSnapshot.id,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        updatedAt: data.updatedAt?.toDate() || new Date(),
                    } as SavedSchedule;
                })
                .filter((s: SavedSchedule) => s.plantationId === plantationId && s.status === 'active');

            return filteredSchedules.length > 0 ? filteredSchedules[0] : null;
        } catch (error) {
            console.error('Error fetching latest schedule:', error);
            throw error;
        }
    }

    /**
     * Get recent schedules
     */
    async getRecentSchedules(
        plantationId: string,
        limitCount: number = 10
    ): Promise<SavedSchedule[]> {
        try {
            const schedulesCollection = collection(this.db, this.collectionName);
            const q = query(
                schedulesCollection,
                where('plantationId', '==', plantationId),
                orderBy('date', 'desc'),
                limit(limitCount)
            );
            const snapshot = await getDocs(q);

            return snapshot.docs
                .map((docSnapshot: any) => {
                    const data = docSnapshot.data();
                    return {
                        ...data,
                        id: docSnapshot.id,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        updatedAt: data.updatedAt?.toDate() || new Date(),
                    } as SavedSchedule;
                })
                .filter((s: SavedSchedule) => s.status === 'active');
        } catch (error) {
            console.error('Error fetching recent schedules:', error);
            throw error;
        }
    }

    /**
     * Update an existing schedule
     */
    private async updateSchedule(
        scheduleId: string,
        updates: Partial<SavedSchedule>
    ): Promise<void> {
        try {
            const updateData: any = { ...updates };

            if (updates.updatedAt) {
                updateData.updatedAt = Timestamp.fromDate(updates.updatedAt);
            }

            const scheduleDocRef = doc(this.db, this.collectionName, scheduleId);
            await updateDoc(scheduleDocRef, updateData);
        } catch (error) {
            console.error('Error updating schedule:', error);
            throw error;
        }
    }

    /**
     * Delete a schedule (soft delete)
     */
    async deleteSchedule(scheduleId: string): Promise<void> {
        try {
            const scheduleDocRef = doc(this.db, this.collectionName, scheduleId);
            await updateDoc(scheduleDocRef, {
                status: 'archived',
                updatedAt: Timestamp.now(),
            });
        } catch (error) {
            console.error('Error deleting schedule:', error);
            throw error;
        }
    }

    /**
     * Get schedule by ID
     */
    async getScheduleById(scheduleId: string): Promise<SavedSchedule | null> {
        try {
            const scheduleDocRef = doc(this.db, this.collectionName, scheduleId);
            const docSnapshot = await getDoc(scheduleDocRef);

            if (!docSnapshot.exists()) {
                return null;
            }

            const data = docSnapshot.data()!;
            return {
                ...data,
                id: docSnapshot.id,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
            } as SavedSchedule;
        } catch (error) {
            console.error('Error fetching schedule by ID:', error);
            throw error;
        }
    }
}

export const assignmentStorageService = new AssignmentStorageService();
