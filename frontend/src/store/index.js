import { configureStore } from '@reduxjs/toolkit';
import rcaReducer from './rcaSlice';

export const store = configureStore({
  reducer: { rca: rcaReducer },
});
