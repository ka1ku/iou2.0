import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, onAuthStateChange } from '../services/authService';
import { getFirestore, doc, onSnapshot, query, where, orderBy, collection } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { calculateUserTotalBalance } from '../utils/balanceCalculator';

const ExpenseDataContext = createContext();

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

  // Live listener for expenses
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setExpenses([]);
      setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
      setUserProfile(null);
      setLoading(false);
      return;
    }

    console.log('Setting up live expense listener for user:', currentUser.uid);
    setLoading(true);

    const firestoreInstance = getFirestore(getApp());
    
    // Try to use the optimized participantsMap query first
    const expensesQuery = query(
      collection(firestoreInstance, 'expenses'),
      where(`participantsMap.${currentUser.uid}`, '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeExpenses = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const userExpenses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('Live update: Fetched', userExpenses.length, 'expenses');
        setExpenses(userExpenses);
        
        // Calculate balances directly using the universal calculator
        const calculatedBalances = calculateUserTotalBalance(userExpenses, currentUser.uid);
        setBalances(calculatedBalances);
        
        setLoading(false);
      },
      (error) => {
        console.error('Error in expenses listener:', error);
        
        // Fallback: Get all expenses and filter client-side (same logic as getUserExpenses)
        console.log('Falling back to client-side filtering');
        const fallbackQuery = query(
          collection(firestoreInstance, 'expenses'),
          orderBy('createdAt', 'desc')
        );
        
        const unsubscribeFallback = onSnapshot(
          fallbackQuery,
          (snapshot) => {
            const allExpenses = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            // Use the same filtering logic as getUserExpenses
            const userExpenses = allExpenses.filter(expense => {
              // Check if user is the creator
              if (expense.createdBy === currentUser.uid) {
                return true;
              }
              
              // Check if user is in participants array
              if (expense.participants && Array.isArray(expense.participants)) {
                return expense.participants.some(participant => participant.userId === currentUser.uid);
              }
              
              // Check if user is in participantsMap (for newer expenses)
              if (expense.participantsMap && expense.participantsMap[currentUser.uid]) {
                return true;
              }
              
              return false;
            });
            
            console.log('Live update (fallback): Fetched', userExpenses.length, 'expenses');
            setExpenses(userExpenses);
            
            // Calculate balances directly using the universal calculator
            const calculatedBalances = calculateUserTotalBalance(userExpenses, currentUser.uid);
            setBalances(calculatedBalances);
            
            setLoading(false);
          },
          (fallbackError) => {
            console.error('Error in fallback expenses listener:', fallbackError);
            setExpenses([]);
            setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
            setLoading(false);
          }
        );
        
        return unsubscribeFallback;
      }
    );

    return unsubscribeExpenses;
  }, []);

  // Live listener for user profile
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    console.log('Setting up live user profile listener for user:', currentUser.uid);

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
          console.log('No user profile found for:', currentUser.uid);
          setUserProfile(null);
        }
      },
      (error) => {
        console.error('Error in user profile listener:', error);
        setUserProfile(null);
      }
    );

    return unsubscribeProfile;
  }, []);

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      if (!user) {
        setExpenses([]);
        setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
        setUserProfile(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    expenses,
    balances,
    userProfile,
    loading,
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