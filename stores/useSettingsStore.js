import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

const deviceLocales = getLocales();
const deviceLanguage = deviceLocales[0]?.languageCode || 'en';
const deviceRegion = deviceLocales[0]?.regionCode || 'US';
const deviceCurrency = deviceLocales[0]?.currencyCode || 'USD';

export const useSettingsStore = create(
  persist(
    (set) => ({
      language: deviceLanguage,
      region: deviceRegion,
      currency: deviceCurrency,
      setLanguage: (language) => set({ language }),
      setRegion: (region) => set({ region }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
