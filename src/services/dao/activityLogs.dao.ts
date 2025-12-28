import firestore from '@react-native-firebase/firestore';
import { OperationalLog } from '../logs.service';

export const activityLogsDao = {
    /**
     * Save an activity log to Firebase
     */
    async save(log: OperationalLog): Promise<void> {
        try {
            const logsCollection = firestore().collection('activityLogs');
            await logsCollection.doc(log.id.toString()).set({
                ...log,
                timestamp: firestore.Timestamp.fromDate(new Date(log.timestamp)),
                createdAt: firestore.Timestamp.now(),
                updatedAt: firestore.Timestamp.now(),
            });
            console.log(`✅ Activity log saved to Firebase: ${log.id}`);
        } catch (error) {
            console.error('Error saving activity log to Firebase:', error);
            throw error;
        }
    },

    /**
     * Save multiple activity logs in batch
     */
    async saveBatch(logs: OperationalLog[]): Promise<void> {
        if (logs.length === 0) return;

        try {
            const batch = firestore().batch();
            const logsCollection = firestore().collection('activityLogs');
            const now = firestore.Timestamp.now();

            logs.forEach(log => {
                const docRef = logsCollection.doc(log.id.toString());
                batch.set(docRef, {
                    ...log,
                    timestamp: firestore.Timestamp.fromDate(new Date(log.timestamp)),
                    createdAt: now,
                    updatedAt: now,
                });
            });

            await batch.commit();
            console.log(`✅ ${logs.length} activity logs saved to Firebase`);
        } catch (error) {
            console.error('Error saving activity logs batch to Firebase:', error);
            throw error;
        }
    },

    /**
     * Get activity logs from Firebase
     */
    async getLogs(params?: {
        limit?: number;
        zone_id?: number;
        operation_type?: string;
        startAfter?: string;
    }): Promise<OperationalLog[]> {
        try {
            let query: firestore.Query = firestore().collection('activityLogs');

            if (params?.zone_id) {
                query = query.where('zone_id', '==', params.zone_id);
            }

            if (params?.operation_type) {
                query = query.where('operation_type', '==', params.operation_type);
            }

            query = query.orderBy('timestamp', 'desc');

            if (params?.limit) {
                query = query.limit(params.limit);
            }

            const snapshot = await query.get();
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: parseInt(doc.id, 10),
                    timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
                    operation_type: data.operation_type,
                    zone_id: data.zone_id,
                    status: data.status,
                    duration: data.duration,
                    pressure: data.pressure,
                    flow_rate: data.flow_rate,
                    water_volume: data.water_volume,
                    fertilizer_volume: data.fertilizer_volume,
                    start_moisture: data.start_moisture,
                    end_moisture: data.end_moisture,
                    notes: data.notes,
                } as OperationalLog;
            });
        } catch (error) {
            console.error('Error getting activity logs from Firebase:', error);
            throw error;
        }
    },

    /**
     * Check if log exists in Firebase
     */
    async exists(logId: number): Promise<boolean> {
        try {
            const docRef = firestore().collection('activityLogs').doc(logId.toString());
            const doc = await docRef.get();
            return doc.exists;
        } catch (error) {
            console.error('Error checking if log exists in Firebase:', error);
            return false;
        }
    },
};

