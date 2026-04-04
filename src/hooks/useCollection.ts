import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, type QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';

export function useCollection<T extends { id?: string }>(
  collectionName: string,
  constraints: QueryConstraint[],
  enabled: boolean = true
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, collectionName), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T)));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Collection "${collectionName}" error:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, enabled, JSON.stringify(constraints.map(c => c.type))]);

  return { data, loading, error };
}
