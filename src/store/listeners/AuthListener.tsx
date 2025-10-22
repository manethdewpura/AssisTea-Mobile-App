import React, { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { getFirestore, doc, onSnapshot } from '@react-native-firebase/firestore';
import { useAppDispatch } from '../../hooks';
import { setLoading, setUser, setUserProfile } from '../slices';
import { handleFirebaseError, logError } from '../../utils';
import { errorLogger } from '../../utils/errorLogger.util';

const AuthListener: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();

  useEffect(() => {

    const auth = getAuth();
    const firestore = getFirestore();

    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      dispatch(setUser(firebaseUser ? { uid: firebaseUser.uid } : null));

      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (firebaseUser) {
        try {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          unsubscribeUserDoc = onSnapshot(
            userDocRef,
            async userDoc => {
              if (userDoc.exists()) {
                const profileData: any = userDoc.data();
                // Convert Firebase Timestamps/Dates to ISO strings for Redux serializability
                const createdAt = profileData?.createdAt
                  ? profileData.createdAt.toDate
                    ? profileData.createdAt.toDate().toISOString()
                    : profileData.createdAt instanceof Date
                    ? profileData.createdAt.toISOString()
                    : String(profileData.createdAt)
                  : new Date().toISOString();
                const lastLoginAt = profileData?.lastLoginAt
                  ? profileData.lastLoginAt.toDate
                    ? profileData.lastLoginAt.toDate().toISOString()
                    : profileData.lastLoginAt instanceof Date
                    ? profileData.lastLoginAt.toISOString()
                    : String(profileData.lastLoginAt)
                  : new Date().toISOString();

                const userProfile = {
                  uid: firebaseUser.uid,
                  email: profileData?.email || firebaseUser.email || '',
                  role: profileData?.role || 'admin',
                  name: profileData?.name || undefined,
                  displayName:
                    profileData?.displayName || firebaseUser.displayName || '',
                  createdAt,
                  lastLoginAt,
                  plantationId: profileData?.plantationId,
                  plantationName: profileData?.plantationName,
                };

                dispatch(setUserProfile(userProfile));
                errorLogger.setUserContext(
                  firebaseUser.uid,
                  profileData?.role || 'admin',
                );
              } else {
                dispatch(setUserProfile(null));
              }
              dispatch(setLoading(false));
            },
            error => {
              const appError = handleFirebaseError(error);
              logError(appError, 'AuthListener - onSnapshot user profile');
              dispatch(setUserProfile(null));
              dispatch(setLoading(false));
            },
          );
        } catch (error) {
          const appError = handleFirebaseError(error);
          logError(appError, 'AuthListener - Setup user profile listener');
          dispatch(setUserProfile(null));
          dispatch(setLoading(false));
        }
      } else {
        dispatch(setUserProfile(null));
        errorLogger.clearUserContext();
        dispatch(setLoading(false));
      }
    });

    return () => {
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribe();
    };
  }, [dispatch]);

  return <>{children}</>;
};

export default AuthListener;
