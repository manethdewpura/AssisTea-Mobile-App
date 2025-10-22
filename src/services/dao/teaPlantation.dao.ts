import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
} from '@react-native-firebase/firestore';
import { TeaPlantationDTO } from '../../common/dto';

export const teaPlantationDao = {
  async create(data: TeaPlantationDTO): Promise<string> {
    const firestore = getFirestore();
    const plantationsCollection = collection(firestore, 'teaPlantations');
    const docRef = await addDoc(plantationsCollection, data);
    return docRef.id;
  },

  async update(id: string, updates: Partial<TeaPlantationDTO>): Promise<void> {
    const firestore = getFirestore();
    const plantationDocRef = doc(firestore, 'teaPlantations', id);
    await updateDoc(plantationDocRef, updates);
  },

  async delete(id: string): Promise<void> {
    const firestore = getFirestore();
    const plantationDocRef = doc(firestore, 'teaPlantations', id);
    await deleteDoc(plantationDocRef);
  },

  async getAll(): Promise<Array<{ id: string; data: TeaPlantationDTO }>> {
    const firestore = getFirestore();
    const plantationsCollection = collection(firestore, 'teaPlantations');
    const snapshot = await getDocs(plantationsCollection);
    return snapshot.docs.map((d: any) => ({
      id: d.id,
      data: d.data() as TeaPlantationDTO,
    }));
  },

  async getById(
    id: string,
  ): Promise<{ id: string; data: TeaPlantationDTO } | null> {
    const firestore = getFirestore();
    const plantationDocRef = doc(firestore, 'teaPlantations', id);
    const plantationDoc = await getDoc(plantationDocRef);
    if (!plantationDoc.exists()) return null;
    return {
      id: plantationDoc.id,
      data: plantationDoc.data() as TeaPlantationDTO,
    };
  },
};
