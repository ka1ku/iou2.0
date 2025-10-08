import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  getDoc,
  getDocs
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { getUserProfile } from './friendService';
import { Linking, Platform } from 'react-native';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

const generateInviteToken = () => Math.random().toString(36).slice(2, 12);
const generateJoinCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Helper function to send notifications for expense events
const sendExpenseNotification = async (type, expenseId, targetUserIds, additionalData = {}) => {
  try {
    const functions = getFunctions();
    const sendNotificationToUser = httpsCallable(functions, 'sendNotificationToUser');
    
    // Send notifications to all target users
    const notificationPromises = targetUserIds.map(async (userId) => {
      try {
        await sendNotificationToUser({
          targetUserId: userId,
          title: additionalData.title || 'Expense Update',
          body: additionalData.body || 'You have a new expense notification',
          data: {
            type: type,
            expenseId: expenseId,
            ...additionalData
          }
        });
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
      }
    });
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Failed to send expense notifications:', error);
  }
};

export const createExpense = async (expenseData, userId) => {
  try {
    
    const participantsMap = {};
    if (expenseData.participants) {
      expenseData.participants.forEach((participant) => {
        if (participant.userId) {
          participantsMap[participant.userId] = true;
        }
      });
    }
    
    const expense = {
      ...expenseData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      items: expenseData.items || [],
      participantsMap,
      join: {
        enabled: true,
        code: generateJoinCode(),
        token: generateInviteToken(),
        createdAt: serverTimestamp(),
      }
    };
    
    const firestoreInstance = getFirestore(getApp());
    const docRef = await addDoc(collection(firestoreInstance, 'expenses'), expense);
    
    // Send notifications to all participants (excluding creator)
    const participantIds = Object.keys(participantsMap).filter(id => id !== userId);
    if (participantIds.length > 0) {
      // Get creator info for notification
      const creatorProfile = await getUserProfile(userId);
      const creatorName = creatorProfile ? `${creatorProfile.firstName} ${creatorProfile.lastName}`.trim() : 'Someone';
      
      await sendExpenseNotification('expense_created', docRef.id, participantIds, {
        title: 'New Expense Added',
        body: `${creatorName} added a new expense: ${expenseData.title || 'Untitled'}`,
        route: 'expense',
        createdBy: userId
      });
    }
    
    return {
      ...expense,
      id: docRef.id
    };
  } catch (error) {
    throw error;
  }
};

export const updateExpense = async (expenseId, updateData, userId) => {
  try {
    
    let finalUpdateData = { ...updateData };
    
    if (updateData.participants) {
      const participantsMap = {};
      updateData.participants.forEach((participant) => {
        if (participant.userId) {
          participantsMap[participant.userId] = true;
        }
      });
      finalUpdateData.participantsMap = participantsMap;
    }
    
    // Add updatedBy field
    finalUpdateData.updatedBy = userId;
    
    const firestoreInstance = getFirestore(getApp());
    await updateDoc(doc(firestoreInstance, 'expenses', expenseId), {
      ...finalUpdateData,
      updatedAt: serverTimestamp()
    });
    
    // Send notifications to all participants (excluding updater)
    const currentExpense = await getExpenseById(expenseId);
    if (currentExpense && currentExpense.participantsMap) {
      const participantIds = Object.keys(currentExpense.participantsMap).filter(id => id !== userId);
      if (participantIds.length > 0) {
        // Get updater info for notification
        const updaterProfile = await getUserProfile(userId);
        const updaterName = updaterProfile ? `${updaterProfile.firstName} ${updaterProfile.lastName}`.trim() : 'Someone';
        
        await sendExpenseNotification('expense_updated', expenseId, participantIds, {
          title: 'Expense Updated',
          body: `${updaterName} updated the expense: ${currentExpense.title || 'Untitled'}`,
          route: 'expense',
          updatedBy: userId
        });
      }
    }
    
  } catch (error) {
    throw error;
  }
};

export const getExpenseById = async (expenseId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    const snap = await getDoc(expenseRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    return null;
  }
};

export const deleteItemFromExpense = async (expenseId, itemIndex, userId) => {
  try {
    
    const firestoreInstance = getFirestore(getApp());
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    
    const expenseSnap = await getDoc(expenseRef);
    if (!expenseSnap.exists()) {
      throw new Error('Expense not found');
    }
    
    const expenseData = expenseSnap.data();
    const currentItems = expenseData.items || [];
    
    const updatedItems = currentItems.filter((_, index) => index !== itemIndex);
    
    await updateDoc(expenseRef, {
      items: updatedItems,
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    throw error;
  }
};

export const updateExpenseParticipants = async (expenseId, participants, userId) => {
  try {
    
    const participantsMap = {};
    participants.forEach((participant) => {
      if (participant.userId) {
        participantsMap[participant.userId] = true;
      }
    });
    
    await updateExpense(expenseId, {
      participants,
      participantsMap
    }, userId);
    
    return true;
  } catch (error) {
    throw error;
  }
};

export const deleteExpense = async (expenseId, userId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    
    // Verify the expense exists and user has permission to delete it
    const expenseSnap = await getDoc(expenseRef);
    if (!expenseSnap.exists()) {
      throw new Error('Expense not found');
    }
    
    const expenseData = expenseSnap.data();
    if (expenseData.createdBy !== userId) {
      throw new Error('You do not have permission to delete this expense');
    }
    
    await deleteDoc(expenseRef);
    return true;
  } catch (error) {
    throw error;
  }
};


export const getExpenseJoinInfo = async (expenseId, { initializeIfMissing = false } = {}) => {
  try {
    if (!expenseId) throw new Error('Missing expenseId');

    const firestoreInstance = getFirestore(getApp());
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    const expenseDoc = await getDoc(expenseRef);

    if (!expenseDoc.exists()) {
      throw new Error('Expense not found');
    }

    const expenseData = expenseDoc.data();
    
    if (!expenseData.join && initializeIfMissing) {
      const joinInfo = {
        enabled: true,
        code: generateJoinCode(),
        token: generateInviteToken(),
        createdAt: serverTimestamp(),
      };
      
      await updateDoc(expenseRef, { join: joinInfo });
      return joinInfo;
    }

    return expenseData.join || null;
  } catch (error) {
    throw error;
  }
};

export const parseExpenseJoinLink = (url) => {
  try {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const match = url.match(/expense\/([^\/]+)\/([^\/\?]+)/);
    const queryIndex = url.indexOf('?');
    const queryString = queryIndex !== -1 ? url.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(queryString);

    if (match) {
      return {
        expenseId: match[1],
        token: match[2],
        code: params.get('code') || null,
        phone: params.get('phone') || null,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
};

export const generateExpenseJoinLink = ({ expenseId, token, code, phone, preferUniversal = false }) => {
  const base = preferUniversal ? 'https://kailee.iou20.com/' : 'com.kailee.iou20://';
  const path = `expense/${expenseId}/${token}`;
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (phone) params.set('phone', phone);
  const query = params.toString();
  return query ? `${base}${path}?${query}` : `${base}${path}`;
};

export const joinExpense = async ({ expenseId, token, code, userId, userPhone }) => {
  try {
    if (!userId) {
      throw new Error('Missing user ID');
    }

    const firestoreInstance = getFirestore(getApp());
    let expenseData, expenseRef;

    if (expenseId && token) {
      expenseRef = doc(firestoreInstance, 'expenses', expenseId);
      const expenseSnap = await getDoc(expenseRef);
      if (!expenseSnap.exists()) {
        throw new Error('Expense not found');
      }
      expenseData = expenseSnap.data();

      if (expenseData.join?.token !== token) {
        throw new Error('Invalid join link');
      }

      if (code && expenseData.join?.code !== code) {
        throw new Error('Invalid room code');
      }
    } else if (code) {
      const expensesQuery = query(
        collection(firestoreInstance, 'expenses'),
        where('join.code', '==', code)
      );
      
      const snapshot = await getDocs(expensesQuery);
      
      if (snapshot.empty) {
        throw new Error('Invalid room code');
      }
      
      const expenseDoc = snapshot.docs[0];
      expenseData = expenseDoc.data();
      expenseRef = expenseDoc.ref;
    } else {
      throw new Error('Missing join parameters');
    }

    if (!expenseData.join?.enabled) {
      throw new Error('Joining is disabled for this expense');
    }

    const isAlreadyParticipant = expenseData.participants?.some(p => p.userId === userId);
    if (isAlreadyParticipant) {
      return { success: true, message: 'Already a participant' };
    }

    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    const newParticipant = {
      name: userProfile.firstName && userProfile.lastName 
        ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
        : (userProfile.username ? `@${userProfile.username}` : 'Friend'),
      userId: userId,
      phoneNumber: userProfile.phoneNumber,
      username: userProfile.username,
      profilePhoto: userProfile.profilePhoto,
      placeholder: false
    };

    const updatedParticipants = [...(expenseData.participants || []), newParticipant];
    const participantsMap = { ...(expenseData.participantsMap || {}) };
    participantsMap[userId] = true;

    await updateDoc(expenseRef, {
      participants: updatedParticipants,
      participantsMap,
      updatedAt: serverTimestamp()
    });

    return { success: true, message: 'Successfully joined expense' };
  } catch (error) {
    throw error;
  }
};

export const sendExpenseInviteSMS = async ({ expenseId, phoneNumber, contactName, preferUniversal = false }) => {
  const digitsOnly = (phoneNumber || '').replace(/\D/g, '');
  if (!digitsOnly) {
    throw new Error('Phone number required');
  }

  const nameForMessage = contactName || 'there';
  let message = `Hi ${nameForMessage}! I'd like to invite you to join IOU App so we can split expenses together. Download it from the App Store!`;

  if (expenseId) {
    const joinInfo = await getExpenseJoinInfo(expenseId, { initializeIfMissing: true });
    if (joinInfo?.code && joinInfo?.token) {
      const deepLink = generateExpenseJoinLink({
        expenseId,
        token: joinInfo.token,
        code: joinInfo.code,
        phone: digitsOnly,
        preferUniversal,
      });
      message = `Hi ${nameForMessage}! Join me on IOU App to split expenses: ${deepLink}`;
    }
  }

  const body = encodeURIComponent(message);
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const smsUrl = `sms:${digitsOnly}${separator}body=${body}`;
  try {
    await Linking.openURL(smsUrl);
  } catch (e) {
    await Linking.openURL(`sms:${digitsOnly}`);
  }
};

// Function to mark expense as settled and send notifications
export const settleExpense = async (expenseId, userId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    await updateDoc(doc(firestoreInstance, 'expenses', expenseId), {
      settled: true,
      settledAt: serverTimestamp(),
      settledBy: userId,
      updatedAt: serverTimestamp()
    });
    
    // Send notifications to all participants
    const expense = await getExpenseById(expenseId);
    if (expense && expense.participantsMap) {
      const participantIds = Object.keys(expense.participantsMap);
      if (participantIds.length > 0) {
        await sendExpenseNotification('expense_settled', expenseId, participantIds, {
          title: 'Expense Settled',
          body: `The expense "${expense.title || 'Untitled'}" has been settled!`,
          route: 'expense'
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    throw error;
  }
};