import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

// Helper function to filter user expenses (for fallback query)
const filterUserExpenses = (expenses, userId) => {
  return expenses.filter(expense => {
    if (expense.createdBy === userId) return true;
    if (expense.participantsMap && expense.participantsMap[userId]) return true;
    if (expense.participants && Array.isArray(expense.participants)) {
      return expense.participants.some(p => p.userId === userId);
    }
    return false;
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

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
      if (!user) {
        setExpenses([]);
        setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
        setUserProfile(null);
        setLoading(false);
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
      return;
    }

    setLoading(true);
    setHasMore(true);
    lastDocRef.current = null;

    const firestoreInstance = getFirestore(getApp());
    
    // Build the optimized query using participantsMap
    const buildQuery = () => query(
      collection(firestoreInstance, 'expenses'),
      where(`participantsMap.${currentUser.uid}`, '==', true),
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
      
      // Merge with existing expenses to handle real-time updates
      setExpenses(prevExpenses => {
        // On first load, replace. On updates, merge.
        if (prevExpenses.length === 0) {
          return userExpenses;
        }
        return mergeAndSortExpenses(prevExpenses, userExpenses);
      });
      
      setLoading(false);
    };

    // Try optimized query first
    const expensesQuery = buildQuery();
    const unsubscribeExpenses = onSnapshot(
      expensesQuery,
      handleSnapshot,
      (error) => {
        // Fallback: query all expenses and filter client-side
        console.warn('Optimized query failed, using fallback:', error);
        const fallbackQuery = query(
          collection(firestoreInstance, 'expenses'),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE * 3) // Fetch more to account for filtering
        );
        
        const unsubscribeFallback = onSnapshot(
          fallbackQuery,
          (snapshot) => {
            const allExpenses = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            const userExpenses = filterUserExpenses(allExpenses, currentUser.uid);
            
            // Create a filtered snapshot-like object
            const filteredDocs = userExpenses
              .map(e => snapshot.docs.find(d => d.id === e.id))
              .filter(Boolean)
              .slice(0, PAGE_SIZE);
            
            handleSnapshot({
              docs: filteredDocs,
              empty: filteredDocs.length === 0
            });
          },
          (fallbackError) => {
            console.error('Fallback query also failed:', fallbackError);
            setExpenses([]);
            setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
            setLoading(false);
            setHasMore(false);
          }
        );
        
        unsubscribeExpensesRef.current = unsubscribeFallback;
        return unsubscribeFallback;
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
  const loadMoreExpenses = async () => {
    if (!currentUser || loadingMore || !hasMore || !lastDocRef.current) {
      return;
    }

    setLoadingMore(true);

    try {
      const firestoreInstance = getFirestore(getApp());
      
      // Build query with pagination
      const expensesQuery = query(
        collection(firestoreInstance, 'expenses'),
        where(`participantsMap.${currentUser.uid}`, '==', true),
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
      console.error('Error loading more expenses:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

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
      },
      (error) => {
        setUserProfile(null);
      }
    );

    return unsubscribeProfile;
  }, [currentUser]);

  const value = {
    expenses,
    balances,
    userProfile,
    loading,
    loadingMore,
    hasMore,
    loadMoreExpenses,
  };

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