import firestore from '@react-native-firebase/firestore';
import { Field, CreateFieldInput } from '../models/Field';

class FieldService {
    private fieldsCollection = firestore().collection('fields');

    /**
     * Create a new field in Firebase
     */
    async createField(
        plantationId: string,
        fieldData: CreateFieldInput,
    ): Promise<Field> {
        try {
            const fieldId = this.fieldsCollection.doc().id;
            const now = new Date();

            const field: Field = {
                id: fieldId,
                ...fieldData,
                plantationId,
                createdAt: now,
                updatedAt: now,
            };

            await this.fieldsCollection.doc(fieldId).set({
                ...field,
                createdAt: firestore.Timestamp.fromDate(now),
                updatedAt: firestore.Timestamp.fromDate(now),
            });

            return field;
        } catch (error) {
            console.error('Error creating field:', error);
            throw error;
        }
    }

    /**
     * Get all fields for a specific plantation
     */
    async getFieldsByPlantation(plantationId: string): Promise<Field[]> {
        try {
            const snapshot = await this.fieldsCollection
                .where('plantationId', '==', plantationId)
                .get();

            const fields = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                } as Field;
            });

            // Sort by creation date (newest first)
            return fields.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } catch (error) {
            console.error('Error fetching fields:', error);
            throw error;
        }
    }

    /**
     * Get a single field by ID
     */
    async getFieldById(fieldId: string): Promise<Field | null> {
        try {
            const doc = await this.fieldsCollection.doc(fieldId).get();

            if (!doc.exists) {
                return null;
            }

            const data = doc.data()!;
            return {
                ...data,
                id: doc.id,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
            } as Field;
        } catch (error) {
            console.error('Error fetching field:', error);
            throw error;
        }
    }

    /**
     * Update field details
     */
    async updateField(fieldId: string, updates: Partial<CreateFieldInput>): Promise<void> {
        try {
            await this.fieldsCollection.doc(fieldId).update({
                ...updates,
                updatedAt: firestore.Timestamp.now(),
            });
        } catch (error) {
            console.error('Error updating field:', error);
            throw error;
        }
    }

    /**
     * Delete a field
     */
    async deleteField(fieldId: string): Promise<void> {
        try {
            await this.fieldsCollection.doc(fieldId).delete();
        } catch (error) {
            console.error('Error deleting field:', error);
            throw error;
        }
    }

    /**
     * Check if field name already exists for plantation
     */
    async checkFieldNameExists(name: string, plantationId: string): Promise<boolean> {
        try {
            const snapshot = await this.fieldsCollection
                .where('name', '==', name)
                .where('plantationId', '==', plantationId)
                .get();

            return snapshot.docs.length > 0;
        } catch (error) {
            console.error('Error checking field name:', error);
            throw error;
        }
    }
}

export const fieldService = new FieldService();
