import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from '../utils/i18n';

const deviceLocales = getLocales();
const deviceLanguage = deviceLocales[0]?.languageCode || 'en';

const deviceCurrency = deviceLocales[0]?.currencyCode || 'USD';

export const useSettingsStore = create(
  persist(
    (set) => ({
      language: deviceLanguage,
      currency: deviceCurrency,
      setLanguage: (language) => set({ language }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // Set i18n locale immediately when store rehydrates from AsyncStorage
        if (state?.language) {
          i18n.locale = state.language;
        }
      },
    }
  )
);
