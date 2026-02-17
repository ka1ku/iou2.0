import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getCurrentUser, onAuthStateChange } from '../services/authService';
import { getFirestore, doc, onSnapshot, query, where, orderBy, collection, limit, startAfter, getDocs } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { calculateUserTotalBalance } from '../utils/balanceCalculator';

const ExpenseDataContext = createContext();

const PAGE_SIZE = 10;

// Helper function to parse Firestore timestamp to milliseconds
const getTimestampMs = (timestamp) => {
  if (!timestamp) return 0;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime();
  }
  if (timestamp.seconds) {
    return timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
  }
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  return 0;
};

// Helper function to merge and sort expenses
const mergeAndSortExpenses = (existingExpenses, newExpenses) => {
  const expenseMap = new Map(existingExpenses.map(e => [e.id, e]));
  newExpenses.forEach(expense => {
    expenseMap.set(expense.id, expense);
  });

  return Array.from(expenseMap.values()).sort((a, b) => {
    const aTime = getTimestampMs(a.createdAt);
    const bTime = getTimestampMs(b.createdAt);
    return bTime - aTime;
  });
};

export const ExpenseDataProvider = ({ children }) => {
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({
    totalOwed: 0,
    totalOwes: 0,
    netBalance: 0,
    debtBreakdown: {}
  });
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const lastDocRef = useRef(null);
  const unsubscribeExpensesRef = useRef(null);
  const hasReceivedInitialSnapshot = useRef(false);

  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
      if (!user) {
        setExpenses([]);
        setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
        setUserProfile(null);
        setIsProfileLoading(false); // No user, so profile loading is done (it's null)
        setLoading(false);
      } else {
        setIsProfileLoading(true); // User exists, start loading profile
      }
    });

    return unsubscribe;
  }, []);

  // Set up expenses listener when user changes
  useEffect(() => {
    if (!currentUser) {
      setExpenses([]);
      setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
      setLoading(false);
      setHasMore(true);
      lastDocRef.current = null;
      hasReceivedInitialSnapshot.current = false;
      return;
    }

    setLoading(true);
    setHasMore(true);
    lastDocRef.current = null;
    hasReceivedInitialSnapshot.current = false;

    const firestoreInstance = getFirestore(getApp());

    // Build the optimized query using participantIds array
    const buildQuery = () => query(
      collection(firestoreInstance, 'expenses'),
      where('participantIds', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    const handleSnapshot = (snapshot) => {
      const userExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Update pagination state
      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } else {
        lastDocRef.current = null;
        setHasMore(false);
      }

      // Replace expenses intelligently to handle removals
      setExpenses(prevExpenses => {
        // On first load, just use the snapshot results
        if (prevExpenses.length === 0 && !hasReceivedInitialSnapshot.current) {
          return userExpenses;
        }

        // The onSnapshot only covers the first PAGE_SIZE expenses
        // So we need to:
        // 1. Use the snapshot results as the source of truth for the first PAGE_SIZE
        // 2. Keep any expenses beyond PAGE_SIZE that were loaded via pagination

        // Get IDs from the snapshot
        const snapshotIds = new Set(userExpenses.map(e => e.id));

        // Keep only expenses that were loaded via pagination (not in the first PAGE_SIZE from onSnapshot)
        // These are expenses beyond the initial query that we loaded with loadMoreExpenses
        const paginatedExpenses = prevExpenses.filter(e => {
          // If the expense is in the snapshot, it will be replaced
          if (snapshotIds.has(e.id)) return false;

          // Keep expenses that are likely from pagination (beyond PAGE_SIZE)
          // We identify these by checking if they're older than the last snapshot expense
          const lastSnapshotTime = userExpenses.length > 0
            ? getTimestampMs(userExpenses[userExpenses.length - 1].createdAt)
            : Infinity;
          const expenseTime = getTimestampMs(e.createdAt);

          return expenseTime < lastSnapshotTime;
        });

        // Combine snapshot results with paginated expenses
        return [...userExpenses, ...paginatedExpenses];
      });

      // Only set loading to false after we've received the initial snapshot
      if (!hasReceivedInitialSnapshot.current) {
        hasReceivedInitialSnapshot.current = true;
      }
      setLoading(false);
    };

    // Set up the query with array-contains
    const expensesQuery = buildQuery();
    const unsubscribeExpenses = onSnapshot(
      expensesQuery,
      handleSnapshot,
      (error) => {
        setExpenses([]);
        setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
        setLoading(false);
        setHasMore(false);
        hasReceivedInitialSnapshot.current = true;
      }
    );

    unsubscribeExpensesRef.current = unsubscribeExpenses;
    return () => {
      if (unsubscribeExpensesRef.current) {
        unsubscribeExpensesRef.current();
      }
    };
  }, [currentUser]);

  // Function to load more expenses
  const loadMoreExpenses = useCallback(async () => {
    if (!currentUser || loadingMore || !hasMore || !lastDocRef.current) {
      return;
    }

    setLoadingMore(true);

    try {
      const firestoreInstance = getFirestore(getApp());

      // Build query with pagination
      const expensesQuery = query(
        collection(firestoreInstance, 'expenses'),
        where('participantIds', 'array-contains', currentUser.uid),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(expensesQuery);

      if (snapshot.empty) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      const newExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Update last document reference
      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      setHasMore(snapshot.docs.length === PAGE_SIZE);

      // Append new expenses (avoid duplicates)
      setExpenses(prevExpenses => {
        const existingIds = new Set(prevExpenses.map(e => e.id));
        const uniqueNewExpenses = newExpenses.filter(e => !existingIds.has(e.id));
        return mergeAndSortExpenses(prevExpenses, uniqueNewExpenses);
      });

    } catch (error) {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [currentUser, loadingMore, hasMore]);

  // Calculate balances only when expenses or user changes
  useEffect(() => {
    if (!currentUser || expenses.length === 0) {
      setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
      return;
    }

    const calculatedBalances = calculateUserTotalBalance(expenses, currentUser.uid);
    setBalances(calculatedBalances);
  }, [expenses, currentUser]);

  // Set up user profile listener when user changes
  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    const firestoreInstance = getFirestore(getApp());
    const userRef = doc(firestoreInstance, 'users', currentUser.uid);

    const unsubscribeProfile = onSnapshot(
      userRef,
      (doc) => {
        if (doc.exists()) {
          const profileData = doc.data();
          setUserProfile({
            ...profileData,
            userId: currentUser.uid
          });
        } else {
          setUserProfile(null);
        }
        setIsProfileLoading(false); // Profile load attempt complete (found or not found)
      },
      (error) => {
        setUserProfile(null);
        setIsProfileLoading(false); // Profile load attempt complete (failed)
      }
    );

    return unsubscribeProfile;
  }, [currentUser]);

  const value = useMemo(() => ({
    expenses,
    balances,
    userProfile,
    isProfileLoading,
    loading,
    loadingMore,
    hasMore,
    loadMoreExpenses,
  }), [expenses, balances, userProfile, isProfileLoading, loading, loadingMore, hasMore, loadMoreExpenses]);

  return (
    <ExpenseDataContext.Provider value={value}>
      {children}
    </ExpenseDataContext.Provider>
  );
};

export const useExpenseData = () => {
  const context = useContext(ExpenseDataContext);
  if (!context) {
    throw new Error('useExpenseData must be used within an ExpenseDataProvider');
  }
  return context;
};

export default ExpenseDataContext;