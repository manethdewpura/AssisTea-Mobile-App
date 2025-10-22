import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type NetworkState = {
  isOnline: boolean;
};

const initialState: NetworkState = {
  isOnline: true,
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setOnline(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
  },
});

export const { setOnline } = networkSlice.actions;
export default networkSlice.reducer;
