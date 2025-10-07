import { getFirestore } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

/**
 * Get a Firestore instance for the app
 * Centralizes the pattern of getting Firestore instance
 */
export const getFirestoreInstance = () => {
  return getFirestore(getApp());
};

/**
 * Common error handling for Firestore operations
 */
export const handleFirestoreError = (error, operation = 'Firestore operation') => {
  console.error(`Error in ${operation}:`, error);
  throw error;
};

/**
 * Standardized error handling for async operations
 */
export const handleAsyncError = (error, context = '') => {
  const errorMessage = context ? `${context}: ${error.message}` : error.message;
  console.error(errorMessage, error);
  throw new Error(errorMessage);
};

/**
 * Safe async operation wrapper with error handling
 */
export const safeAsyncOperation = async (operation, context = '') => {
  try {
    return await operation();
  } catch (error) {
    handleAsyncError(error, context);
  }
};

/**
 * Create a participantsMap from participants array
 * Centralizes the logic for creating participant maps
 */
export const createParticipantsMap = (participants) => {
  const participantsMap = {};
  if (participants && Array.isArray(participants)) {
    participants.forEach((participant) => {
      if (participant.userId) {
        participantsMap[participant.userId] = true;
      }
    });
  }
  return participantsMap;
};

/**
 * Default state for expense data when user is not authenticated
 */
export const getDefaultExpenseState = () => ({
  expenses: [],
  balances: { totalOwed: 0, totalOwes: 0, netBalance: 0, debtBreakdown: {} },
  userProfile: null,
  loading: false
});

/**
 * Default state for balances when user is not authenticated
 */
export const getDefaultBalanceState = () => ({
  totalOwed: 0,
  totalOwes: 0,
  netBalance: 0,
  debtBreakdown: {}
});

/**
 * Check if a user is a participant in an expense
 * Centralizes the logic for determining expense participation
 */
export const isUserParticipant = (expense, userId) => {
  if (!expense || !userId) return false;
  
  // Check if user created the expense
  if (expense.createdBy === userId) {
    return true;
  }
  
  // Check participantsMap first (most efficient)
  if (expense.participantsMap && expense.participantsMap[userId]) {
    return true;
  }
  
  // Fallback to checking participants array
  if (expense.participants && Array.isArray(expense.participants)) {
    return expense.participants.some(participant => participant.userId === userId);
  }
  
  return false;
};