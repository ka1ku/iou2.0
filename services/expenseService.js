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
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getApp } from '@react-native-firebase/app';
import { Linking, Platform } from 'react-native';
import { recomputeSettlementsForSave } from '../utils/settlementCalculator';
import { getUserProfile } from './friendService';
import { arrayUnion } from '@react-native-firebase/firestore';

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

    // Track whether we need to log changes (price/item/participant changes)
    const shouldLogChanges =
      (updateData.items !== undefined ||
        updateData.participants !== undefined ||
        updateData.fees !== undefined ||
        updateData.total !== undefined ||
        updateData.settlements !== undefined);

    if (shouldRecalculateSettlements || shouldLogChanges) {
      try {
        // Fetch the current expense to get existing settlements and all expense data
        const firestoreInstance = getFirestore(getApp());
        const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
        const expenseSnap = await getDoc(expenseRef);

        if (expenseSnap.exists()) {
          const currentExpense = { id: expenseSnap.id, ...expenseSnap.data() };
          const existingSettlements = currentExpense.settlements || [];

          // Recalculate whenever items/participants/fees change (handles direction flips, new items, etc.)
          if (shouldRecalculateSettlements) {
            // Merge the update data with current expense data to get the complete expense
            const updatedExpense = {
              ...currentExpense,
              ...finalUpdateData,
              // Ensure we have the updated items, participants, and fees
              items: updateData.items !== undefined ? updateData.items : currentExpense.items,
              participants: updateData.participants !== undefined ? updateData.participants : currentExpense.participants,
              fees: updateData.fees !== undefined ? updateData.fees : currentExpense.fees,
            };

            // Recompute settlements from items, preserving Firestore settled state (handles direction flips)
            const recalculatedSettlements = recomputeSettlementsForSave(
              updatedExpense,
              existingSettlements
            ).map((s) => {
              const pairKey = (a, b) => `${a}|||${b}`;
              const original = existingSettlements.find(
                (ex) =>
                  pairKey(ex.debtor || ex.from, ex.creditor || ex.to) === pairKey(s.debtor || s.from, s.creditor || s.to) ||
                  pairKey(ex.debtor || ex.from, ex.creditor || ex.to) === pairKey(s.creditor || s.to, s.debtor || s.from)
              );
              return {
                debtor: s.debtor || s.from,
                creditor: s.creditor || s.to,
                debtorUserId: s.debtorUserId,
                creditorUserId: s.creditorUserId,
                amount: s.amount,
                status: s.status,
                updatedAt: original?.updatedAt || new Date().toISOString(),
                associatedItems: s.associatedItems || [],
                settledAmount: s.settledAmount,
                remainingAmount: s.remainingAmount,
              };
            });

            finalUpdateData.settlements = recalculatedSettlements;
          }

          // --- Change Logging ---
          if (shouldLogChanges) {
            try {
              const changeLogEntries = [];
              const oldItems = currentExpense.items || [];
              const newItems = updateData.items !== undefined ? updateData.items : oldItems;
              const oldFees = currentExpense.fees || [];
              const newFees = updateData.fees !== undefined ? updateData.fees : oldFees;
              const oldTotal = oldItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
                + oldFees.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
              const newTotal = newItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
                + newFees.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
              const roundOld = Math.round(oldTotal * 100) / 100;
              const roundNew = Math.round(newTotal * 100) / 100;

              // Resolve actor name once
              let actorName = 'Someone';
              if (userId) {
                try {
                  const profile = await getUserProfile(userId);
                  if (profile) {
                    actorName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.username || 'Someone';
                  }
                } catch (_) { /* use default */ }
              }

              // Detect total change
              if (Math.abs(roundOld - roundNew) > 0.01) {
                // Find affected settlements (non-noAction ones)
                const affectedSettlements = existingSettlements
                  .filter(s => (s.status || 'noAction') !== 'noAction')
                  .map(s => {
                    const from = s.debtor || s.from;
                    const to = s.creditor || s.to;
                    const amt = Math.round(s.amount * 100) / 100;
                    return `${from}|||${to}|||${amt}`;
                  });

                // Get user name (already resolved as actorName)
                const userName = actorName;

                changeLogEntries.push({
                  type: 'priceChange',
                  userId: userId || null,
                  userName,
                  timestamp: new Date().toISOString(),
                  details: {
                    field: 'total',
                    previousValue: roundOld,
                    newValue: roundNew,
                    affectedSettlements,
                  },
                });
              }

              // Detect item additions/removals and modifications
              if (updateData.items !== undefined) {
                const oldIds = new Set(oldItems.map(i => i.id).filter(Boolean));
                const newIds = new Set(newItems.map(i => i.id).filter(Boolean));

                // 1. Added Items
                const addedItems = newItems.filter(i => i.id && !oldIds.has(i.id));

                // 2. Removed Items
                const removedItems = oldItems.filter(i => i.id && !newIds.has(i.id));

                // 3. Modified Items (Renamed, Amount Changed, Split Changed)
                const modifiedItems = newItems.filter(newItem => {
                  if (!newItem.id || !oldIds.has(newItem.id)) return false;
                  const oldItem = oldItems.find(i => i.id === newItem.id);
                  if (!oldItem) return false;

                  // Check if name changed
                  if (newItem.name !== oldItem.name) return true;

                  // Check if amount changed
                  if (parseFloat(newItem.amount) !== parseFloat(oldItem.amount)) return true;

                  // Check if splits/payers/consumers changed
                  const payersChanged = JSON.stringify(newItem.selectedPayers) !== JSON.stringify(oldItem.selectedPayers);
                  const consumersChanged = JSON.stringify(newItem.selectedConsumers) !== JSON.stringify(oldItem.selectedConsumers);
                  const splitsChanged = JSON.stringify(newItem.splits) !== JSON.stringify(oldItem.splits);

                  return payersChanged || consumersChanged || splitsChanged;
                });

                // Actor name already resolved

                // Log Added (only log items with a valid amount)
                addedItems.forEach(item => {
                  const amount = parseFloat(item.amount) || 0;
                  // Only log if item has a price > 0
                  if (amount > 0) {
                    changeLogEntries.push({
                      type: 'itemAdded',
                      userId: userId || null,
                      userName: actorName,
                      timestamp: new Date().toISOString(),
                      details: {
                        itemName: item.name || 'Unnamed item',
                        itemAmount: amount,
                      },
                    });
                  }
                });

                // Log Removed
                removedItems.forEach(item => {
                  changeLogEntries.push({
                    type: 'itemRemoved',
                    userId: userId || null,
                    userName: actorName,
                    timestamp: new Date().toISOString(),
                    details: {
                      itemName: item.name || 'Unnamed item',
                      itemAmount: parseFloat(item.amount) || 0,
                    },
                  });
                });

                // Log Modified
                modifiedItems.forEach(newItem => {
                  const oldItem = oldItems.find(i => i.id === newItem.id);
                  const changes = [];

                  if (newItem.name !== oldItem.name) {
                    changes.push('renamed');
                  }

                  // Amount change
                  if (parseFloat(newItem.amount) !== parseFloat(oldItem.amount)) {
                    changes.push('changed amount');
                  }

                  // Participant changes
                  const oldPayers = new Set(oldItem.selectedPayers || []);
                  const newPayers = new Set(newItem.selectedPayers || []);
                  const oldConsumers = new Set(oldItem.selectedConsumers || []);
                  const newConsumers = new Set(newItem.selectedConsumers || []);

                  // Check for added/removed people
                  const addedPayers = [...newPayers].filter(p => !oldPayers.has(p));
                  const removedPayers = [...oldPayers].filter(p => !newPayers.has(p));
                  const addedConsumers = [...newConsumers].filter(c => !oldConsumers.has(c));
                  const removedConsumers = [...oldConsumers].filter(c => !newConsumers.has(c));

                  if (addedConsumers.length > 0 || addedPayers.length > 0) {
                    changes.push('added person');
                  }

                  if (removedConsumers.length > 0 || removedPayers.length > 0) {
                    changes.push('removed person');
                  }

                  // If splits changed but no one was added/removed (e.g. manual adjustments)
                  if (changes.length === 0) {
                    const splitsChanged = JSON.stringify(newItem.splits) !== JSON.stringify(oldItem.splits);
                    if (splitsChanged) {
                      changes.push('updated split');
                    }
                  }

                  if (changes.length > 0) {
                    // Remove duplicates just in case
                    const uniqueChanges = [...new Set(changes)];

                    changeLogEntries.push({
                      type: 'itemModified',
                      userId: userId || null,
                      userName: actorName,
                      timestamp: new Date().toISOString(),
                      details: {
                        itemId: newItem.id,
                        itemName: newItem.name,
                        itemAmount: parseFloat(newItem.amount) || 0,
                        changes: uniqueChanges,
                      },
                    });
                  }
                });
              }

              // Detect settlement changes
              if (finalUpdateData.settlements) {
                const newSettlements = finalUpdateData.settlements;
                newSettlements.forEach(newS => {
                  const oldS = existingSettlements.find(s =>
                    (s.debtor || s.from) === (newS.debtor || newS.from) &&
                    (s.creditor || s.to) === (newS.creditor || newS.to)
                  );

                  const oldStatus = oldS?.status || 'noAction';
                  const newStatus = newS.status || 'noAction';

                  if (oldStatus !== newStatus) {
                    const isSettled = ['markedAsPaid', 'confirmed', 'complete'].includes(newStatus);
                    const wasSettled = ['markedAsPaid', 'confirmed', 'complete'].includes(oldStatus);

                    // Determine peer name
                    // If current user is debtor, peer is creditor. If current user is creditor, peer is debtor.
                    // Ideally we want the name of the OTHER person.
                    // We use actorName to check who performed the action.
                    // But for the message "{{user}} settled with {{peer}}", {{user}} is the actor.

                    const debtor = newS.debtor || newS.from;
                    const creditor = newS.creditor || newS.to;
                    const peerName = (creditor === actorName || creditor === 'You') ? debtor : creditor;

                    if (isSettled && !wasSettled) {
                      changeLogEntries.push({
                        type: 'settlementAction',
                        subtype: 'settled',
                        userId: userId || null,
                        userName: actorName,
                        timestamp: new Date().toISOString(),
                        details: {
                          amount: newS.amount,
                          peerName: peerName
                        }
                      });
                    } else if (!isSettled && wasSettled) {
                      changeLogEntries.push({
                        type: 'settlementAction',
                        subtype: 'unsettled',
                        userId: userId || null,
                        userName: actorName,
                        timestamp: new Date().toISOString(),
                        details: {
                          amount: newS.amount,
                          peerName: peerName
                        }
                      });
                    }
                  }
                });
              }

              // Participant add/remove does not add to activity (per product requirement)

              // Append change log entries using arrayUnion
              if (changeLogEntries.length > 0) {
                finalUpdateData.changeLog = arrayUnion(...changeLogEntries);
              }
            } catch (logError) {
              console.error('[updateExpense] Failed to generate change log:', logError);
              // Don't block the update if logging fails
            }
          }
        }
      } catch (recalcError) {
        // If recalculation/logging fails, log but don't block the update
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
// Function to create a payment request and trigger notification
export const createPaymentRequest = async ({ fromUserId, toUserId, amount, expenseId, expenseTitle }) => {
  try {
    const functions = getFunctions(getApp());
    const sendPaymentRequest = httpsCallable(functions, 'sendPaymentRequest');

    const result = await sendPaymentRequest({
      toUserId, // Person who should pay
      amount,
      expenseId,
      expenseTitle,
    });

    return {
      success: true,
      requestId: result.data.requestId || 'req_' + Date.now() // Fallback ID since we don't store it
    };
  } catch (error) {
    console.error('Error creating payment request:', error);
    throw error;
  }
};
