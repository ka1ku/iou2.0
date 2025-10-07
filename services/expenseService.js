import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  getDoc,
  getDocs
} from '@react-native-firebase/firestore';
import { getFirestoreInstance, createParticipantsMap } from '../utils/firestoreUtils';
import { getUserProfile } from './friendService';
import { Linking, Platform } from 'react-native';

const generateInviteToken = () => Math.random().toString(36).slice(2, 12);
const generateJoinCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const createExpense = async (expenseData, userId) => {
  try {
    
    const participantsMap = createParticipantsMap(expenseData.participants);
    
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
    
    const firestoreInstance = getFirestoreInstance();
    const docRef = await addDoc(collection(firestoreInstance, 'expenses'), expense);
    
    
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
      finalUpdateData.participantsMap = createParticipantsMap(updateData.participants);
    }
    
    const firestoreInstance = getFirestoreInstance();
    await updateDoc(doc(firestoreInstance, 'expenses', expenseId), {
      ...finalUpdateData,
      updatedAt: serverTimestamp()
    });
    
  } catch (error) {
    throw error;
  }
};

export const getExpenseById = async (expenseId) => {
  try {
    const firestoreInstance = getFirestoreInstance();
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
    
    const firestoreInstance = getFirestoreInstance();
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
    
    const participantsMap = createParticipantsMap(participants);
    
    await updateExpense(expenseId, {
      participants,
      participantsMap
    }, userId);
    
    return true;
  } catch (error) {
    throw error;
  }
};


export const getExpenseJoinInfo = async (expenseId, { initializeIfMissing = false } = {}) => {
  try {
    if (!expenseId) throw new Error('Missing expenseId');

    const firestoreInstance = getFirestoreInstance();
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

    const firestoreInstance = getFirestoreInstance();
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