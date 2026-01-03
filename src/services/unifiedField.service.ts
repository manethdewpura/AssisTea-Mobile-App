import { fieldSQLiteService } from './sqlite/fieldSQLite.service';
import { Field } from '../models/Field';
import firestore from '@react-native-firebase/firestore';

/**
 * Unified Field Service - SQLite-First Offline Architecture
 */
class UnifiedFieldService {
    /**
     * Generate Firestore-compatible ID
     */
    private generateFirestoreId(): string {
        // Use Firestore's built-in auto-ID generation to avoid weak randomness and collisions
        return firestore().collection('fields').doc().id;
    }

    /**
     * Sync to Firebase using the SAME ID
     */
    private async syncToFirebase(field: Field): Promise<void> {
        await firestore()
            .collection('fields')
            .doc(field.id)
            .set({
                name: field.name,
                slope: field.slope,
                maxWorkers: field.maxWorkers,
                location: field.location || '',
                plantationId: field.plantationId,
                createdAt: firestore.Timestamp.fromDate(field.createdAt),
                updatedAt: firestore.Timestamp.fromDate(field.updatedAt),
            });

        await fieldSQLiteService.markAsSynced(field.id);
        console.log('🔄 Synced to Firebase:', field.name);
    }

    /**
     * Add field - SQLite FIRST, then Firebase
     */
    async addField(fieldData: Omit<Field, 'id' | 'createdAt' | 'updatedAt'>): Promise<Field> {
        const field: Field = {
            id: this.generateFirestoreId(),
            ...fieldData,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await fieldSQLiteService.insertField(field);
        console.log('✅ Saved to SQLite (offline-safe):', field.name);

        this.syncToFirebase(field).catch(err => {
            console.warn('⚠️ Sync failed, will retry:', err);
        });

        return field;
    }

    async updateField(fieldId: string, updates: Partial<Field>): Promise<void> {
        await fieldSQLiteService.updateField(fieldId, updates);
        const field = await fieldSQLiteService.getFieldById(fieldId);
        if (field) {
            this.syncToFirebase(field).catch(err => console.warn('⚠️ Sync failed:', err));
        }
    }

    async deleteField(fieldId: string): Promise<void> {
        await fieldSQLiteService.deleteField(fieldId);
        firestore()
            .collection('fields')
            .doc(fieldId)
            .delete()
            .catch(error => {
                console.warn('⚠️ Failed to delete field from Firebase:', fieldId, error);
            });
    }

    async getFields(plantationId: string): Promise<Field[]> {
        return await fieldSQLiteService.getAllFields(plantationId);
    }

    async getFieldById(fieldId: string): Promise<Field | null> {
        return await fieldSQLiteService.getFieldById(fieldId);
    }

    async pullFromFirebase(plantationId: string): Promise<void> {
        try {
            const snapshot = await firestore()
                .collection('fields')
                .where('plantationId', '==', plantationId)
                .get();

            for (const doc of snapshot.docs) {
                const data = doc.data();
                const field: Field = {
                    id: doc.id,
                    name: data.name,
                    slope: data.slope,
                    maxWorkers: data.maxWorkers,
                    location: data.location || '',
                    plantationId: data.plantationId,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                };

                const local = await fieldSQLiteService.getFieldById(field.id);
                if (!local) {
                    await fieldSQLiteService.insertField(field);
                    await fieldSQLiteService.markAsSynced(field.id);
                }
            }
        } catch (error) {
            console.error('Pull failed:', error);
        }
    }
}

export const unifiedFieldService = new UnifiedFieldService();
