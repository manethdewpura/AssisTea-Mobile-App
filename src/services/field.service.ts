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
    Timestamp,
} from '@react-native-firebase/firestore';
import { Field, CreateFieldInput } from '../models/Field';

class FieldService {
    private readonly db = getFirestore();
    private readonly collectionName = 'fields';

    /**
     * Create a new field in Firebase
     */
    async createField(
        plantationId: string,
        fieldData: CreateFieldInput,
    ): Promise<Field> {
        try {
            const fieldsCollection = collection(this.db, this.collectionName);
            const newDocRef = doc(fieldsCollection);
            const fieldId = newDocRef.id;
            const now = new Date();

            const field: Field = {
                id: fieldId,
                ...fieldData,
                plantationId,
                createdAt: now,
                updatedAt: now,
            };

            await setDoc(newDocRef, {
                ...field,
                createdAt: Timestamp.fromDate(now),
                updatedAt: Timestamp.fromDate(now),
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
            const fieldsCollection = collection(this.db, this.collectionName);
            const q = query(
                fieldsCollection,
                where('plantationId', '==', plantationId)
            );
            const snapshot = await getDocs(q);

            const fields = snapshot.docs.map((docSnapshot: any) => {
                const data = docSnapshot.data();
                return {
                    ...data,
                    id: docSnapshot.id,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                } as Field;
            });

            // Sort by creation date (newest first)
            return fields.sort((a: Field, b: Field) => b.createdAt.getTime() - a.createdAt.getTime());
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
            const fieldDocRef = doc(this.db, this.collectionName, fieldId);
            const docSnapshot = await getDoc(fieldDocRef);

            if (!docSnapshot.exists()) {
                return null;
            }

            const data = docSnapshot.data()!;
            return {
                ...data,
                id: docSnapshot.id,
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
            const fieldDocRef = doc(this.db, this.collectionName, fieldId);
            await updateDoc(fieldDocRef, {
                ...updates,
                updatedAt: Timestamp.now(),
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
            const fieldDocRef = doc(this.db, this.collectionName, fieldId);
            await deleteDoc(fieldDocRef);
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
            const fieldsCollection = collection(this.db, this.collectionName);
            const q = query(
                fieldsCollection,
                where('name', '==', name),
                where('plantationId', '==', plantationId)
            );
            const snapshot = await getDocs(q);

            return snapshot.docs.length > 0;
        } catch (error) {
            console.error('Error checking field name:', error);
            throw error;
        }
    }
}

export const fieldService = new FieldService();
