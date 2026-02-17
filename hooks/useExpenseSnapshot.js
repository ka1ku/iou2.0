import { useState, useEffect } from 'react';
import { getFirestore, doc, onSnapshot } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

/**
 * Hook that sets up a real-time snapshot listener for a single expense document.
 * Ensures Split and Track tabs update automatically when settlements or items change.
 *
 * @param {string} expenseId - The ID of the expense to watch
 * @returns {{ expense: object|null, loading: boolean, error: Error|null }}
 */
export default function useExpenseSnapshot(expenseId) {
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!expenseId) {
      setExpense(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const firestoreInstance = getFirestore(getApp());
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);

    const unsubscribe = onSnapshot(
      expenseRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setExpense({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          });
          setError(null);
        } else {
          setExpense(null);
          setError(new Error('Expense not found'));
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setExpense(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [expenseId]);

  return { expense, loading, error };
}
