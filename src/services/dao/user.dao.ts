import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
} from '@react-native-firebase/firestore';
import { UserDTO } from '../../common/dto';

export const userDao = {
  async create(uid: string, data: UserDTO): Promise<void> {
    const firestore = getFirestore();
    const userDocRef = doc(firestore, 'users', uid);
    await setDoc(userDocRef, data);
  },

  async update(uid: string, updates: Partial<UserDTO>): Promise<void> {
    const firestore = getFirestore();
    const userDocRef = doc(firestore, 'users', uid);
    await updateDoc(userDocRef, updates);
  },

  async list(): Promise<Array<{ id: string; data: UserDTO }>> {
    const firestore = getFirestore();
    const usersCollection = collection(firestore, 'users');
    const snapshot = await getDocs(usersCollection);
    return snapshot.docs.map((d: any) => ({
      id: d.id,
      data: d.data() as UserDTO,
    }));
  },
};
