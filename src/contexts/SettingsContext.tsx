import { createContext, useContext, type ReactNode } from 'react';
import { useSettings } from '../hooks/useSettings';
import type { LocationType } from '../types';

interface SettingsContextValue {
  storageLocations: string[];
  purchaseLocations: string[];
  recipeCategories: string[];
  ingredientCategories: string[];
  loading: boolean;
  updateLocations: (type: LocationType, locations: string[]) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const settings = useSettings(uid);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsContext must be used within SettingsProvider');
  return ctx;
}
