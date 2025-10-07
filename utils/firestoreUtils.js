import { getFirestore } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

// Centralized Firestore instance to avoid repeated getFirestore(getApp()) calls
let firestoreInstance = null;

export const getFirestoreInstance = () => {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getApp());
  }
  return firestoreInstance;
};

// Utility function to create participantsMap from participants array
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

// Utility function to check if user is participant in expense
export const isUserParticipant = (expense, userId) => {
  if (!expense || !userId) return false;
  
  // Check if user is the creator
  if (expense.createdBy === userId) {
    return true;
  }
  
  // Check participants array
  if (expense.participants && Array.isArray(expense.participants)) {
    return expense.participants.some(participant => participant.userId === userId);
  }
  
  // Check participantsMap
  if (expense.participantsMap && expense.participantsMap[userId]) {
    return true;
  }
  
  return false;
};