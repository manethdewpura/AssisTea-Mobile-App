import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserProfile } from '../../models';

type AuthState = {
  user: { uid: string } | null;
  userProfile: UserProfile | null;
  loading: boolean;
};

const initialState: AuthState = {
  user: null,
  userProfile: null,
  loading: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setUser(state, action: PayloadAction<{ uid: string } | null>) {
      state.user = action.payload;
    },
    setUserProfile(state, action: PayloadAction<UserProfile | null>) {
      state.userProfile = action.payload;
    },
    logout(state) {
      state.user = null;
      state.userProfile = null;
      state.loading = false;
    },
  },
});

export const { setLoading, setUser, setUserProfile, logout } =
  authSlice.actions;
export default authSlice.reducer;
