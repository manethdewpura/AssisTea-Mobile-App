import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { configService } from '../../services/config.service';

export interface ConfigState {
  backendUrl: string | null;
  isLoading: boolean;
  isInitialized: boolean;
}

const initialState: ConfigState = {
  backendUrl: null,
  isLoading: false,
  isInitialized: false,
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setBackendUrl(state, action: PayloadAction<string | null>) {
      state.backendUrl = action.payload;
    },
    setConfigLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setInitialized(state, action: PayloadAction<boolean>) {
      state.isInitialized = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadBackendUrl.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadBackendUrl.fulfilled, (state, action) => {
        state.backendUrl = action.payload;
        state.isLoading = false;
        state.isInitialized = true;
      })
      .addCase(loadBackendUrl.rejected, (state) => {
        state.backendUrl = null;
        state.isLoading = false;
        state.isInitialized = true;
      })
      .addCase(saveBackendUrl.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(saveBackendUrl.fulfilled, (state, action) => {
        state.backendUrl = action.payload;
        state.isLoading = false;
      })
      .addCase(saveBackendUrl.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const { setBackendUrl, setConfigLoading, setInitialized } = configSlice.actions;

/**
 * Load backend URL from storage
 */
export const loadBackendUrl = createAsyncThunk(
  'config/loadBackendUrl',
  async (_, { rejectWithValue }) => {
    try {
      const url = await configService.getBackendUrl();
      return url;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Save backend URL to storage
 */
export const saveBackendUrl = createAsyncThunk(
  'config/saveBackendUrl',
  async (url: string, { rejectWithValue }) => {
    try {
      await configService.setBackendUrl(url);
      return url;
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

export default configSlice.reducer;

