import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from '@react-native-firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { userDao } from './dao';
import { UserDTO } from '../common/dto';
import {
  ensureNetworkConnection,
  handleFirebaseError,
  logError,
} from '../utils';
import { UserRole } from '../common/types';

export const authService = {
  async signIn(email: string, password: string): Promise<void> {
    try {
      await ensureNetworkConnection();
      const auth = getAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      try {
        await userDao.update(cred.user.uid, {
          lastLoginAt: serverTimestamp(),
        } as Partial<UserDTO>);
      } catch (updateError) {
        const appError = handleFirebaseError(updateError);
        logError(appError, 'authService - signIn update lastLoginAt');
      }
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - signIn');
      throw appError;
    }
  },

  async signUp(
    email: string,
    password: string,
    role: UserRole = 'admin',
    plantationId?: string,
    name?: string,
  ): Promise<void> {
    try {
      await ensureNetworkConnection();
      const auth = getAuth();
      const firestore = getFirestore();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const newUser = userCredential.user;
      let plantationName: string | undefined;
      if (plantationId) {
        try {
          const plantationDocRef = doc(
            firestore,
            'teaPlantations',
            plantationId,
          );
          const plantationDoc = await getDoc(plantationDocRef);
          plantationName = plantationDoc.data()?.name;
        } catch (plantationError) {
          const appError = handleFirebaseError(plantationError);
          logError(appError, 'authService - get plantation name during signUp');
        }
      }

      const userDataToSave = {
        uid: newUser.uid,
        email: newUser.email || '',
        role,
        ...(name && { name }),
        displayName: newUser.displayName || '',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        ...(plantationId && { plantationId }),
        ...(plantationName && { plantationName }),
      };
      await userDao.create(newUser.uid, userDataToSave as UserDTO);
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - signUp');
      throw appError;
    }
  },

  async signOut(): Promise<void> {
    try {
      const auth = getAuth();
      await signOut(auth);
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - signOut');
      throw appError;
    }
  },


};
