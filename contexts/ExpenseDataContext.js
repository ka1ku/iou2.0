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
  const [currentUser, setCurrentUser] = useState(null);

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
      return;
    }

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
        
        setExpenses(userExpenses);
        
        const calculatedBalances = calculateUserTotalBalance(userExpenses, currentUser.uid);
        setBalances(calculatedBalances);
        
        setLoading(false);
      },
      (error) => {
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
            
            const userExpenses = allExpenses.filter(expense => {
              if (expense.createdBy === currentUser.uid) {
                return true;
              }
              
              if (expense.participants && Array.isArray(expense.participants)) {
                return expense.participants.some(participant => participant.userId === currentUser.uid);
              }
              
              if (expense.participantsMap && expense.participantsMap[currentUser.uid]) {
                return true;
              }
              
              return false;
            });
            
            setExpenses(userExpenses);
            
            const calculatedBalances = calculateUserTotalBalance(userExpenses, currentUser.uid);
            setBalances(calculatedBalances);
            
            setLoading(false);
          },
          (fallbackError) => {
            setExpenses([]);
            setBalances({ totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} });
            setLoading(false);
          }
        );
        
        return unsubscribeFallback;
      }
    );

    return unsubscribeExpenses;
  }, [currentUser]);

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