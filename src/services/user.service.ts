import { UserRole } from '../common/types';
import { UserProfile } from '../models';
import {
  ensureNetworkConnection,
  handleFirebaseError,
  logError,
} from '../utils';
import {
  serverTimestamp,
  getFirestore,
  collection,
  getDocs,
} from '@react-native-firebase/firestore';
import {
  getAuth,
  createUserWithEmailAndPassword,
} from '@react-native-firebase/auth';
import { teaPlantationService } from './teaPlantation.service';
import { userDao } from './dao';
import { UserDTO } from '../common/dto';

export const userService = {
  async createUserAccount(
    email: string,
    password: string,
    role: UserRole,
    plantationId?: string,
    adminId?: string,
    name?: string,
  ): Promise<void> {
    try {
      await ensureNetworkConnection();
      const auth = getAuth();
      getFirestore();

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const newUser = userCredential.user;

      let plantationName: string | undefined;
      let finalPlantationId: string | undefined;

      if (role === 'admin') {
        // For admins, plantationId is optional - they can create their own plantation later
        if (plantationId) {
          // Check if plantation already has an admin
          const plantation = await teaPlantationService.getTeaPlantation(
            plantationId,
          );
          if (plantation && plantation.adminId) {
            throw new Error('This plantation already has an admin assigned');
          }
          finalPlantationId = plantationId;
          plantationName = plantation?.name;
        }
      } else if (role === 'tea_plantation_manager') {
        // For managers, plantationId is required and must belong to the admin creating them
        if (!plantationId || !adminId) {
          throw new Error(
            'Tea plantation managers must be assigned to a plantation',
          );
        }

        const plantation = await teaPlantationService.getTeaPlantation(
          plantationId,
        );
        if (!plantation) {
          throw new Error('Plantation not found');
        }

        if (plantation.adminId !== adminId) {
          throw new Error(
            'You can only create managers for your own plantation',
          );
        }

        finalPlantationId = plantationId;
        plantationName = plantation.name;
      }

      const userDataToSave: UserDTO = {
        uid: newUser.uid,
        email: newUser.email || '',
        role,
        ...(name && { name }),
        displayName: newUser.displayName || '',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        ...(finalPlantationId && { plantationId: finalPlantationId }),
        ...(plantationName && { plantationName }),
      };

      await userDao.create(newUser.uid, userDataToSave);

      // If this is an admin and they have a plantation, update the plantation with adminId
      if (role === 'admin' && finalPlantationId) {
        await teaPlantationService.updateTeaPlantation(finalPlantationId, {
          adminId: newUser.uid,
        });
      }
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - createUserAccount');
      throw appError;
    }
  },

  async updateUserProfile(
    uid: string,
    updates: Partial<UserProfile>,
  ): Promise<void> {
    try {
      await ensureNetworkConnection();
      const partial: Partial<UserDTO> = {};
      if (typeof updates.email !== 'undefined') partial.email = updates.email;
      if (typeof updates.role !== 'undefined')
        partial.role = updates.role as any;
      if (typeof updates.name !== 'undefined') partial.name = updates.name;
      if (typeof updates.displayName !== 'undefined')
        partial.displayName = updates.displayName;
      if (typeof updates.plantationId !== 'undefined')
        partial.plantationId = updates.plantationId;
      if (typeof updates.plantationName !== 'undefined')
        partial.plantationName = updates.plantationName;
      await userDao.update(uid, partial);
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - updateUserProfile');
      throw appError;
    }
  },

  async getManagersByPlantationId(
    plantationId: string,
  ): Promise<UserProfile[]> {
    try {
      await ensureNetworkConnection();
      const firestore = getFirestore();
      const usersCollection = collection(firestore, 'users');
      const snapshot = await getDocs(usersCollection);

      return snapshot.docs
        .filter((docSnapshot: any) => {
          const data = docSnapshot.data();
          return (
            data.role === 'tea_plantation_manager' &&
            data.plantationId === plantationId
          );
        })
        .map(
          (docSnapshot: any) =>
            ({
              uid: docSnapshot.id,
              ...docSnapshot.data(),
              createdAt:
                (docSnapshot.data().createdAt?.toDate?.() ||
                  docSnapshot.data().createdAt ||
                  new Date()) instanceof Date
                  ? (
                      docSnapshot.data().createdAt?.toDate?.() || new Date()
                    ).toISOString()
                  : String(docSnapshot.data().createdAt),
              lastLoginAt:
                (docSnapshot.data().lastLoginAt?.toDate?.() ||
                  docSnapshot.data().lastLoginAt ||
                  new Date()) instanceof Date
                  ? (
                      docSnapshot.data().lastLoginAt?.toDate?.() || new Date()
                    ).toISOString()
                  : String(docSnapshot.data().lastLoginAt),
            } as UserProfile),
        );
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'authService - getManagersByPlantationId');
      throw appError;
    }
  },

  hasRole(profile: UserProfile | null, requiredRole: UserRole): boolean {
    if (!profile) return false;
    return profile.role === requiredRole;
  },

  hasAnyRole(profile: UserProfile | null, roles: UserRole[]): boolean {
    return roles.some(role => this.hasRole(profile, role));
  },
};
