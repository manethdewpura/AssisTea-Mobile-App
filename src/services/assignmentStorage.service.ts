import firestore from '@react-native-firebase/firestore';
import { SavedSchedule, CreateScheduleInput } from '../models/SavedSchedule';
import { WorkerAssignment } from '../models/MLPrediction';

class AssignmentStorageService {
    private schedulesCollection = firestore().collection('schedules');

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
            const scheduleId = this.schedulesCollection.doc().id;
            const now = new Date();

            const schedule: SavedSchedule = {
                id: scheduleId,
                ...scheduleData,
                createdAt: now,
                updatedAt: now,
                status: 'active',
            };

            await this.schedulesCollection.doc(scheduleId).set({
                ...schedule,
                createdAt: firestore.Timestamp.fromDate(now),
                updatedAt: firestore.Timestamp.fromDate(now),
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
            const snapshot = await this.schedulesCollection
                .where('plantationId', '==', plantationId)
                .where('date', '==', date)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return null;
            }

            const doc = snapshot.docs[0];
            const data = doc.data();

            // Filter for active status
            if (data.status !== 'active') {
                return null;
            }

            return {
                ...data,
                id: doc.id,
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
            const snapshot = await this.schedulesCollection
                .orderBy('date', 'desc')
                .limit(50)
                .get();

            if (snapshot.empty) {
                return null;
            }

            // Filter for this plantation and active status in-memory
            const filteredSchedules = snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        id: doc.id,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        updatedAt: data.updatedAt?.toDate() || new Date(),
                    } as SavedSchedule;
                })
                .filter(s => s.plantationId === plantationId && s.status === 'active');

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
        limit: number = 10
    ): Promise<SavedSchedule[]> {
        try {
            const snapshot = await this.schedulesCollection
                .where('plantationId', '==', plantationId)
                .orderBy('date', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        id: doc.id,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        updatedAt: data.updatedAt?.toDate() || new Date(),
                    } as SavedSchedule;
                })
                .filter(s => s.status === 'active');
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
                updateData.updatedAt = firestore.Timestamp.fromDate(updates.updatedAt);
            }

            await this.schedulesCollection.doc(scheduleId).update(updateData);
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
            await this.schedulesCollection.doc(scheduleId).update({
                status: 'archived',
                updatedAt: firestore.Timestamp.now(),
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
            const doc = await this.schedulesCollection.doc(scheduleId).get();

            if (!doc.exists) {
                return null;
            }

            const data = doc.data()!;
            return {
                ...data,
                id: doc.id,
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
