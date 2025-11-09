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
import { Linking, Platform } from 'react-native';
import { calculateSettlementWithPartialSettlements, calculateSettlement } from '../utils/settlementCalculator';
import { getUserProfile } from './friendService';

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
    
    // Create participantIds array for efficient array-contains queries
    const participantIds = [];
    if (expenseData.participants) {
      expenseData.participants.forEach((participant) => {
        if (participant.userId && !participantIds.includes(participant.userId)) {
          participantIds.push(participant.userId);
        }
      });
    }
    
    const expense = {
      ...expenseData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      items: expenseData.items || [],
      participantIds,
      join: {
        enabled: true,
        code: generateJoinCode(),
        token: generateInviteToken(),
        createdAt: serverTimestamp(),
      }
    };
    
    const firestoreInstance = getFirestore(getApp());
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
    
    // Create participantIds array for efficient array-contains queries
    if (updateData.participants) {
      const participantIds = [];
      updateData.participants.forEach((participant) => {
        if (participant.userId && !participantIds.includes(participant.userId)) {
          participantIds.push(participant.userId);
        }
      });
      finalUpdateData.participantIds = participantIds;
    }
    
    // Add updatedBy field
    finalUpdateData.updatedBy = userId;
    
    // Check if we need to recalculate settlements
    // Only recalculate if items, participants, or fees are being updated
    // AND settlements are not being explicitly updated (to avoid infinite loops)
    const shouldRecalculateSettlements = 
      !updateData.settlements && // Don't recalculate if settlements are being explicitly set
      (updateData.items !== undefined || 
       updateData.participants !== undefined || 
       updateData.fees !== undefined);
    
    if (shouldRecalculateSettlements) {
      try {
        // Fetch the current expense to get existing settlements and all expense data
        const firestoreInstance = getFirestore(getApp());
        const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
        const expenseSnap = await getDoc(expenseRef);
        
        if (expenseSnap.exists()) {
          const currentExpense = { id: expenseSnap.id, ...expenseSnap.data() };
          const existingSettlements = currentExpense.settlements || [];
          
          // Only recalculate if settlements already exist
          if (existingSettlements.length > 0) {
            // Merge the update data with current expense data to get the complete expense
            const updatedExpense = {
              ...currentExpense,
              ...finalUpdateData,
              // Ensure we have the updated items, participants, and fees
              items: updateData.items !== undefined ? updateData.items : currentExpense.items,
              participants: updateData.participants !== undefined ? updateData.participants : currentExpense.participants,
              fees: updateData.fees !== undefined ? updateData.fees : currentExpense.fees,
            };
            
            // Recalculate settlements preserving paid ones
            const settlementResult = calculateSettlementWithPartialSettlements(
              updatedExpense,
              existingSettlements
            );
            
            // Format settlements for Firestore (use debtor/creditor format)
            // The calculateSettlementWithPartialSettlements function preserves settlements where
            // money has been transferred (status !== 'noAction') and marks them with preserved: true
            const recalculatedSettlements = settlementResult.settlements.map(s => {
              // If this settlement was preserved (money already transferred), keep it fixed
              // Preserved settlements maintain their original amount and status because money was already transferred
              if (s.preserved === true) {
                // Find the original settlement to preserve all its metadata exactly
                const originalSettlement = existingSettlements.find(existing => {
                  const existingFrom = existing.debtor || existing.from;
                  const existingTo = existing.creditor || existing.to;
                  const existingAmount = existing.amount;
                  const settlementFrom = s.from || s.debtor;
                  const settlementTo = s.to || s.creditor;
                  const settlementAmount = s.amount;
                  
                  // Round amounts for comparison
                  const roundedExisting = Math.round(existingAmount * 100) / 100;
                  const roundedSettlement = Math.round(settlementAmount * 100) / 100;
                  
                  return existingFrom === settlementFrom && 
                         existingTo === settlementTo && 
                         roundedExisting === roundedSettlement;
                });
                
                // Use original settlement data exactly as it was (money already transferred)
                // This preserves the original amount, status (markedAsPaid, paymentMade, paymentRequested), and metadata
                if (originalSettlement) {
                  return {
                    debtor: originalSettlement.debtor || originalSettlement.from,
                    creditor: originalSettlement.creditor || originalSettlement.to,
                    amount: originalSettlement.amount, // Keep original amount - money already transferred
                    status: originalSettlement.status, // Preserve status (markedAsPaid, paymentMade, paymentRequested, etc.)
                    updatedAt: originalSettlement.updatedAt || new Date().toISOString(),
                    associatedItems: originalSettlement.associatedItems || [],
                  };
                } else {
                  // Fallback if original not found (shouldn't happen, but safety net)
                  // Use the preserved settlement data from the calculator
                  return {
                    debtor: s.from,
                    creditor: s.to,
                    amount: s.amount, // Preserved amount from calculator
                    status: s.status, // Should be markedAsPaid, paymentMade, paymentRequested, etc.
                    updatedAt: new Date().toISOString(),
                    associatedItems: [],
                  };
                }
              } else {
                // This is a new settlement (no money transferred yet)
                // Generated based on adjusted balances after accounting for transferred settlements
                return {
                  debtor: s.from,
                  creditor: s.to,
                  amount: s.amount,
                  status: 'noAction', // New settlements start with noAction
                  updatedAt: new Date().toISOString(),
                  associatedItems: [],
                };
              }
            });
            
            // Add recalculated settlements to update data
            finalUpdateData.settlements = recalculatedSettlements;
          }
        }
      } catch (recalcError) {
        // If recalculation fails, log but don't block the update
        console.error('[updateExpense] Failed to recalculate settlements:', recalcError);
      }
    }
    
    const firestoreInstance = getFirestore(getApp());
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
    
    // Use updateExpense instead of updateDoc to trigger settlement recalculation
    await updateExpense(expenseId, {
      items: updatedItems
    }, userId);
    
    return true;
  } catch (error) {
    throw error;
  }
};

export const updateExpenseParticipants = async (expenseId, participants, userId) => {
  try {
    
    // Create participantIds array for efficient array-contains queries
    const participantIds = [];
    participants.forEach((participant) => {
      if (participant.userId && !participantIds.includes(participant.userId)) {
        participantIds.push(participant.userId);
      }
    });
    
    await updateExpense(expenseId, {
      participants,
      participantIds
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
    
    // Create participantIds array for efficient array-contains queries
    const participantIds = [...(expenseData.participantIds || [])];
    if (!participantIds.includes(userId)) {
      participantIds.push(userId);
    }

    await updateDoc(expenseRef, {
      participants: updatedParticipants,
      participantIds,
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
    
    
    return { success: true };
  } catch (error) {
    throw error;
  }
};