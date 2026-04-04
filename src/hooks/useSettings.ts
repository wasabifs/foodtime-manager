import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserSettings, LocationType } from '../types';
import { DEFAULT_SETTINGS, LOCATION_TYPE_FIELDS } from '../types';

export function useSettings(uid: string | undefined) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const q = query(collection(db, 'settings'), where('uid', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setSettings({
          id: snapshot.docs[0].id,
          uid,
          storageLocations: data.storageLocations || DEFAULT_SETTINGS.storageLocations,
          purchaseLocations: data.purchaseLocations || DEFAULT_SETTINGS.purchaseLocations,
          recipeCategories: data.recipeCategories || DEFAULT_SETTINGS.recipeCategories,
          ingredientCategories: data.ingredientCategories || DEFAULT_SETTINGS.ingredientCategories,
        });
      } else {
        setSettings({
          uid,
          ...DEFAULT_SETTINGS,
        });
      }
      setLoading(false);
    }, (error) => {
      console.error('Settings subscription error:', error);
      setSettings({ uid, ...DEFAULT_SETTINGS });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const updateLocations = useCallback(async (type: LocationType, newLocations: string[]) => {
    if (!uid) return;
    const field = LOCATION_TYPE_FIELDS[type];

    try {
      const q = query(collection(db, 'settings'), where('uid', '==', uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        await addDoc(collection(db, 'settings'), {
          uid,
          ...DEFAULT_SETTINGS,
          [field]: newLocations,
        });
      } else {
        await updateDoc(doc(db, 'settings', snapshot.docs[0].id), {
          [field]: newLocations,
        });
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }, [uid]);

  return {
    settings,
    loading,
    updateLocations,
    storageLocations: settings?.storageLocations || DEFAULT_SETTINGS.storageLocations,
    purchaseLocations: settings?.purchaseLocations || DEFAULT_SETTINGS.purchaseLocations,
    recipeCategories: settings?.recipeCategories || DEFAULT_SETTINGS.recipeCategories,
    ingredientCategories: settings?.ingredientCategories || DEFAULT_SETTINGS.ingredientCategories,
  };
}
