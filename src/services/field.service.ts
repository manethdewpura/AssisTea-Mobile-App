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
import { fieldSQLiteService } from './sqlite/fieldSQLite.service';

class FieldService {
    private readonly db = getFirestore();
    private readonly collectionName = 'fields';

    /**
     * Create a new field.
     *
     * Online  : await Firestore, then mirror to SQLite.
     * Offline : insert into SQLite immediately (so UI reflects new record),
     *           then queue Firestore write (SDK auto-syncs when back online).
     */
    async createField(
        plantationId: string,
        fieldData: CreateFieldInput,
        isConnected: boolean = true,
    ): Promise<Field> {
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

        console.log(`[FieldService] createField → fieldId=${fieldId} isConnected=${isConnected}`, JSON.stringify({ ...fieldData, plantationId }));

        if (!isConnected) {
            // ── OFFLINE ────────────────────────────────────────────
            console.log(`[FieldService] OFFLINE – upserting into SQLite first for fieldId=${fieldId}`);
            try {
                await fieldSQLiteService.upsertField(field, 'pending');
                console.log(`[FieldService] SQLite upsert succeeded for fieldId=${fieldId}`);
            } catch (sqliteError) {
                console.warn(`[FieldService] SQLite upsert FAILED for fieldId=${fieldId}:`, sqliteError);
                throw sqliteError;
            }
            console.log(`[FieldService] OFFLINE – queuing Firestore setDoc for fieldId=${fieldId}`);
            setDoc(newDocRef, {
                ...field,
                createdAt: Timestamp.fromDate(now),
                updatedAt: Timestamp.fromDate(now),
            }).then(() => {
                console.log(`[FieldService] Queued Firestore setDoc flushed for fieldId=${fieldId}`);
            }).catch((err: unknown) => {
                console.warn(`[FieldService] Queued Firestore setDoc error for fieldId=${fieldId}:`, err);
            });
        } else {
            // ── ONLINE ────────────────────────────────────────────
            console.log(`[FieldService] ONLINE – calling setDoc for fieldId=${fieldId}`);
            try {
                await setDoc(newDocRef, {
                    ...field,
                    createdAt: Timestamp.fromDate(now),
                    updatedAt: Timestamp.fromDate(now),
                });
                console.log(`[FieldService] setDoc resolved for fieldId=${fieldId}`);
            } catch (firestoreError) {
                console.warn(`[FieldService] setDoc failed for fieldId=${fieldId}:`, firestoreError);
                throw firestoreError;
            }
            console.log(`[FieldService] ONLINE – upserting into SQLite for fieldId=${fieldId}`);
            try {
                await fieldSQLiteService.upsertField(field, 'synced');
                console.log(`[FieldService] SQLite upsert succeeded for fieldId=${fieldId}`);
            } catch (sqliteError) {
                console.warn(`[FieldService] SQLite upsert FAILED for fieldId=${fieldId}:`, sqliteError);
            }
        }

        return field;
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
     * Update field details.
     *
     * Online  : await Firestore, then mirror to SQLite.
     * Offline : update SQLite immediately, queue Firestore write.
     */
    async updateField(
        fieldId: string,
        updates: Partial<CreateFieldInput>,
        isConnected: boolean = true,
    ): Promise<void> {
        const now = new Date();
        console.log(`[FieldService] updateField → fieldId=${fieldId} isConnected=${isConnected}`, JSON.stringify(updates));

        if (!isConnected) {
            // ── OFFLINE ────────────────────────────────────────────
            console.log(`[FieldService] OFFLINE – updating SQLite first for fieldId=${fieldId}`);
            try {
                await fieldSQLiteService.updateField(fieldId, updates, 'pending');
                console.log(`[FieldService] SQLite update succeeded for fieldId=${fieldId}`);
            } catch (sqliteError) {
                console.warn(`[FieldService] SQLite update FAILED for fieldId=${fieldId}:`, sqliteError);
                throw sqliteError;
            }
            console.log(`[FieldService] OFFLINE – queuing Firestore updateDoc for fieldId=${fieldId}`);
            const fieldDocRef = doc(this.db, this.collectionName, fieldId);
            updateDoc(fieldDocRef, { ...updates, updatedAt: Timestamp.fromDate(now) }).then(() => {
                console.log(`[FieldService] Queued Firestore updateDoc flushed for fieldId=${fieldId}`);
            }).catch((err: unknown) => {
                console.warn(`[FieldService] Queued Firestore updateDoc error for fieldId=${fieldId}:`, err);
            });
        } else {
            // ── ONLINE ────────────────────────────────────────────
            console.log(`[FieldService] ONLINE – calling updateDoc for fieldId=${fieldId}`);
            const fieldDocRef = doc(this.db, this.collectionName, fieldId);
            try {
                await updateDoc(fieldDocRef, { ...updates, updatedAt: Timestamp.now() });
                console.log(`[FieldService] updateDoc resolved for fieldId=${fieldId}`);
            } catch (firestoreError) {
                console.warn(`[FieldService] updateDoc failed for fieldId=${fieldId}:`, firestoreError);
                throw firestoreError;
            }
            console.log(`[FieldService] ONLINE – writing to SQLite for fieldId=${fieldId}`);
            try {
                await fieldSQLiteService.updateField(fieldId, updates, 'synced');
                console.log(`[FieldService] SQLite update succeeded for fieldId=${fieldId}`);
            } catch (sqliteError) {
                console.warn(`[FieldService] SQLite update FAILED for fieldId=${fieldId}:`, sqliteError);
            }
        }
    }

    /**
     * Delete a field.
     *
     * Online  : await Firestore, then remove from SQLite.
     * Offline : remove from SQLite immediately, queue Firestore delete.
     */
    async deleteField(fieldId: string, isConnected: boolean = true): Promise<void> {
        console.log(`[FieldService] deleteField → fieldId=${fieldId} isConnected=${isConnected}`);

        if (!isConnected) {
            // ── OFFLINE ────────────────────────────────────────────
            console.log(`[FieldService] OFFLINE – deleting from SQLite first for fieldId=${fieldId}`);
            try {
                await fieldSQLiteService.deleteField(fieldId);
                console.log(`[FieldService] SQLite delete succeeded for fieldId=${fieldId}`);
            } catch (sqliteError) {
                console.warn(`[FieldService] SQLite delete FAILED for fieldId=${fieldId}:`, sqliteError);
                throw sqliteError;
            }
            console.log(`[FieldService] OFFLINE – queuing Firestore deleteDoc for fieldId=${fieldId}`);
            const fieldDocRef = doc(this.db, this.collectionName, fieldId);
            deleteDoc(fieldDocRef).then(() => {
                console.log(`[FieldService] Queued Firestore deleteDoc flushed for fieldId=${fieldId}`);
            }).catch((err: unknown) => {
                console.warn(`[FieldService] Queued Firestore deleteDoc error for fieldId=${fieldId}:`, err);
            });
        } else {
            // ── ONLINE ────────────────────────────────────────────
            console.log(`[FieldService] ONLINE – calling deleteDoc for fieldId=${fieldId}`);
            const fieldDocRef = doc(this.db, this.collectionName, fieldId);
            try {
                await deleteDoc(fieldDocRef);
                console.log(`[FieldService] deleteDoc resolved for fieldId=${fieldId}`);
            } catch (firestoreError) {
                console.warn(`[FieldService] deleteDoc failed for fieldId=${fieldId}:`, firestoreError);
                throw firestoreError;
            }
            console.log(`[FieldService] ONLINE – deleting from SQLite for fieldId=${fieldId}`);
            try {
                await fieldSQLiteService.deleteField(fieldId);
                console.log(`[FieldService] SQLite delete succeeded for fieldId=${fieldId}`);
            } catch (sqliteError) {
                console.warn(`[FieldService] SQLite delete FAILED for fieldId=${fieldId}:`, sqliteError);
            }
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
