import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  getDoc, 
  setDoc
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { getUserProfile } from './friendService';

// Firestore-based expense service
// Data model structure:
// Expense: {
//   id: string,
//   title: string,
//   total: number,
//   participants: [{ name: string, email?: string }],
//   items: [{
//     id: string,
//     name: string,
//     amount: number,
//     paidBy: number, // participantIndex of who paid for this item
//     splitType: 'even' | 'custom',
//     splits: [{ participantIndex: number, amount: number, percentage?: number }]
//   }],
//   createdBy: string (user ID),
//   createdAt: timestamp,
//   updatedAt: timestamp
// }

export const createExpense = async (expenseData, userId) => {
  try {
    console.log('Creating expense with Firestore for user:', userId);
    
    // Create a participants map for easy querying
    const participantsMap = {};
    if (expenseData.participants) {
      expenseData.participants.forEach((participant, index) => {
        if (participant.userId) {
          participantsMap[participant.userId] = {
            index,
            name: participant.name,
            phoneNumber: participant.phoneNumber,
            username: participant.username,
            profilePhoto: participant.profilePhoto
          };
        }
      });
    }
    
    const expense = {
      ...expenseData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      items: expenseData.items || [],
      participantsMap, // Add the participants map
      join: {
        enabled: true,
        code: generateJoinCode(),
        token: generateInviteToken(),
        createdAt: serverTimestamp(),
      }
    };
    
    // Add to Firestore using modular API with getApp()
    const firestoreInstance = getFirestore(getApp());
    const docRef = await addDoc(collection(firestoreInstance, 'expenses'), expense);
    
    console.log('Expense created successfully with ID:', docRef.id);
    
    return {
      ...expense,
      id: docRef.id
    };
  } catch (error) {
    console.error('Error creating expense in Firestore:', error);
    throw error;
  }
};

export const getUserExpenses = async (userId) => {
  try {
    console.log('Fetching expenses from Firestore for user:', userId);
    
    const firestoreInstance = getFirestore(getApp());
    
    // Query expenses where user is a participant (including creator)
    // We can't use orderBy with inequality on participantsMap, so we'll fetch and sort in memory
    const expensesQuery = query(
      collection(firestoreInstance, 'expenses'),
      where(`participantsMap.${userId}`, '!=', null)
    );
    
    const snapshot = await getDocs(expensesQuery);
    
    const expenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by creation date in memory
    expenses.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return dateB - dateA;
    });
    
    console.log('Fetched', expenses.length, 'expenses from Firestore where user is participant');
    return expenses;
  } catch (error) {
    console.error('Error getting expenses from Firestore:', error);
    return [];
  }
};

export const updateExpense = async (expenseId, updateData, userId) => {
  try {
    console.log('Updating expense in Firestore:', expenseId);
    
    // If participants are being updated, also update the participantsMap
    let finalUpdateData = { ...updateData };
    
    if (updateData.participants) {
      const participantsMap = {};
      updateData.participants.forEach((participant, index) => {
        if (participant.userId) {
          participantsMap[participant.userId] = {
            index,
            name: participant.name || '',
            phoneNumber: participant.phoneNumber || null,
            username: participant.username || null,
            profilePhoto: participant.profilePhoto || null
          };
        }
      });
      finalUpdateData.participantsMap = participantsMap;
    }
    
    // Deep clean the update data to remove undefined, null, and invalid values
    const deepCleanData = (obj) => {
      if (obj === null || obj === undefined) return null;
      if (typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj
          .map(item => deepCleanData(item))
          .filter(item => item !== null && item !== undefined);
      }
      
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = deepCleanData(value);
        if (cleanedValue !== null && cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return cleaned;
    };
    
    const cleanUpdateData = deepCleanData(finalUpdateData);
    
    console.log('Cleaned update data:', cleanUpdateData);
    
    const firestoreInstance = getFirestore(getApp());
    await updateDoc(doc(firestoreInstance, 'expenses', expenseId), {
      ...cleanUpdateData,
      updatedAt: serverTimestamp()
    });
    
    console.log('Expense updated successfully');
  } catch (error) {
    console.error('Error updating expense in Firestore:', error);
    throw error;
  }
};

export const deleteExpense = async (expenseId, userId) => {
  try {
    console.log('Deleting expense from Firestore:', expenseId);
    
    const firestoreInstance = getFirestore(getApp());
    await deleteDoc(doc(firestoreInstance, 'expenses', expenseId));
    
    console.log('Expense deleted successfully');
  } catch (error) {
    console.error('Error deleting expense from Firestore:', error);
    throw error;
  }
};

// ---------------- Expense Invites & Join Flow ----------------

// Generate a random token and a longer, more unique code
const generateInviteToken = () => Math.random().toString(36).slice(2, 12);
const generateJoinCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // Use uppercase for better readability
  let result = '';
  for (let i = 0; i < 12; i++) { // Increased from 8 to 12 characters
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Get or (optionally) initialize expense join info (room code)
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
    
    // If join info doesn't exist and we should initialize it
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

    // Return existing join info or null
    return expenseData.join || null;
  } catch (error) {
    console.error('Error getting expense join info:', error);
    throw error;
  }
};

// Regenerate join info (new room code and token)
export const regenerateExpenseJoinInfo = async (expenseId) => {
  try {
    if (!expenseId) throw new Error('Missing expenseId');

    const firestoreInstance = getFirestore(getApp());
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    
    await updateDoc(expenseRef, { 'join.code': generateJoinCode(), 'join.token': generateInviteToken(), updatedAt: serverTimestamp() });
    
    // Return the updated join info
    return await getExpenseJoinInfo(expenseId);
  } catch (error) {
    console.error('Error regenerating expense join info:', error);
    throw error;
  }
};

// Parse expense join link to extract expense ID and token
export const parseExpenseJoinLink = (url) => {
  try {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // Extract expense ID and token from the URL
    const match = url.match(/expense\/([^\/]+)\/([^\/\?]+)/);
    if (match) {
      return {
        expenseId: match[1],
        token: match[2]
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing expense join link:', error);
    return null;
  }
};

// Generate expense join link
export const generateExpenseJoinLink = ({ expenseId, token, code, phone }) => {
  // For now, return a simple format. In production, this would be your app's domain
  return `https://iou-app.com/expense/${expenseId}/${token}`;
};

// Join expense by room code or invite link
export const joinExpenseByCode = async (code, userId, userPhone) => {
  try {
    if (!code || !userId) {
      throw new Error('Missing code or user ID');
    }

    const firestoreInstance = getFirestore(getApp());
    
    // Find expense by room code
    const expensesQuery = query(
      collection(firestoreInstance, 'expenses'),
      where('join.code', '==', code)
    );
    
    const snapshot = await getDocs(expensesQuery);
    
    if (snapshot.empty) {
      throw new Error('Invalid room code');
    }
    
    const expenseDoc = snapshot.docs[0];
    const expenseData = expenseDoc.data();
    
    // Check if join is enabled
    if (!expenseData.join?.enabled) {
      throw new Error('Join by room code is disabled for this expense');
    }
    
    // Validate token if provided
    if (token && expenseData.join.token !== token) {
      throw new Error('Invalid join link');
    }
    
    // Validate room code
    if (expenseData.join.code !== code) {
      throw new Error('Invalid room code');
    }
    
    // If phone number is provided, validate that the user's phone matches the invited phone
    if (phone && userPhone) {
      const normalizedUserPhone = userPhone.replace(/\D/g, '');
      const normalizedInvitedPhone = phone.replace(/\D/g, '');
      console.log('🔍 Validating phone number match. Invited phone:', normalizedInvitedPhone);
      
      if (normalizedUserPhone && normalizedInvitedPhone) {
        const userPhoneMatches = normalizedUserPhone === normalizedInvitedPhone;
        console.log('📱 User phone:', normalizedUserPhone, 'Invited phone:', normalizedInvitedPhone, 'Match:', userPhoneMatches);
        
        if (!userPhoneMatches) {
          throw new Error('Phone number mismatch. You can only join expenses you were specifically invited to.');
        }
      }
    }
    
    // Check if user is already a participant
    const isAlreadyParticipant = expenseData.participants?.some(p => p.userId === userId);
    if (isAlreadyParticipant) {
      return { success: true, message: 'Already a participant' };
    }
    
    // Find the user's profile to get their name
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      throw new Error('User profile not found');
    }
    
    // Check if there's a placeholder participant with matching phone number
    let matchedParticipant = null;
    if (phone) {
      // Check existing participants for phone match
      expenseData.participants?.forEach(participant => {
        const participantPhone = participant.phoneNumber?.replace(/\D/g, '');
        const normalizedInvitedPhone = phone.replace(/\D/g, '');
        const matches = participantPhone === normalizedInvitedPhone;
        
        if (matches && participant.placeholder) {
          matchedParticipant = participant;
        }
      });
      
      // Check placeholder participants for phone match
      expenseData.placeholderParticipants?.forEach(participant => {
        const placeholderPhone = participant.phoneNumber?.replace(/\D/g, '');
        const normalizedInvitedPhone = phone.replace(/\D/g, '');
        const matches = placeholderPhone === normalizedInvitedPhone;
        
        if (matches && participant.placeholder) {
          matchedParticipant = participant;
        }
      });
    }
    
    if (matchedParticipant) {
      console.log('✅ Successfully identified user as invited participant:', matchedParticipant.name);
    }
    
    // Add user as participant
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
    
    // Update the expense with the new participant
    const updatedParticipants = [...(expenseData.participants || []), newParticipant];
    
    // Update participantsMap
    const participantsMap = { ...(expenseData.participantsMap || {}) };
    participantsMap[userId] = {
      index: updatedParticipants.length - 1,
      name: newParticipant.name,
      phoneNumber: newParticipant.phoneNumber,
      username: newParticipant.username,
      profilePhoto: newParticipant.profilePhoto
    };
    
    await updateDoc(expenseDoc.ref, {
      participants: updatedParticipants,
      participantsMap,
      updatedAt: serverTimestamp()
    });
    
    return { success: true, message: 'Successfully joined expense' };
  } catch (error) {
    console.error('Error joining expense:', error);
    throw error;
  }
};

// Helper function to calculate expense total from items and fees
const calculateExpenseTotal = (expense) => {
  const itemsTotal = (expense.items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const feesTotal = (expense.fees || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
  return itemsTotal + feesTotal;
};

// Helper function to add/remove participants and update participantsMap
export const updateExpenseParticipants = async (expenseId, participants, userId) => {
  try {
    console.log('Updating expense participants:', expenseId);
    
    // Create participantsMap for easy querying
    const participantsMap = {};
    participants.forEach((participant, index) => {
      if (participant.userId) {
        participantsMap[participant.userId] = {
          index,
          name: participant.name,
          phoneNumber: participant.phoneNumber,
          username: participant.username,
          profilePhoto: participant.profilePhoto
        };
      }
    });
    
    // Update the expense with both participants and participantsMap
    await updateExpense(expenseId, {
      participants,
      participantsMap
    }, userId);
    
    console.log('Expense participants updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating expense participants:', error);
    throw error;
  }
};

// Helper function to calculate balances for profile screen
export const calculateUserBalances = (expenses, userId) => {
  const currentUserIndex = 0; // By convention, user is always index 0
  const participantBalances = {}; // { participantName: netAmount }
  let totalPaidByUser = 0;
  let totalOwedByUser = 0;

  expenses.forEach(expense => {
    const paidByIndices = Array.isArray(expense.selectedPayers) ? expense.selectedPayers : [];
    const participants = Array.isArray(expense.participants) ? expense.participants : [];
    const items = Array.isArray(expense.items) ? expense.items : [];

    // --- Calculate how much the current user paid for this expense ---
    let paidByUser = 0;
    if (paidByIndices.includes(currentUserIndex) && paidByIndices.length > 0) {
      paidByUser = Math.abs(calculateExpenseTotal(expense) / paidByIndices.length);
    }

    // --- Calculate how much the current user owes for this expense ---
    let owedByUser = 0;
    items.forEach(item => {
      const itemConsumers = Array.isArray(item.selectedConsumers) ? item.selectedConsumers : [];
      const itemSplits = Array.isArray(item.splits) ? item.splits : [];
      // Find the split for the current user
      const userSplitIndex = itemConsumers.indexOf(currentUserIndex);
      if (userSplitIndex !== -1 && itemSplits[userSplitIndex]) {
        owedByUser += parseFloat(itemSplits[userSplitIndex].amount) || 0;
      }
    });

    const netBalance = paidByUser - owedByUser;
    if (netBalance > 0) {
      totalPaidByUser += netBalance;
    } else if (netBalance < 0) {
      totalOwedByUser += Math.abs(netBalance);
    }

    // --- Calculate net amounts for each participant in this expense ---
    participants.forEach((participant, participantIndex) => {
      if (participantIndex === currentUserIndex || !participant?.name) return;

      // How much this participant paid
      let participantPaid = 0;
      if (paidByIndices.includes(participantIndex) && paidByIndices.length > 0) {
        participantPaid = Math.abs(calculateExpenseTotal(expense) / paidByIndices.length);
      }

      // How much this participant owes
      let participantOwed = 0;
      items.forEach(item => {
        const itemConsumers = Array.isArray(item.selectedConsumers) ? item.selectedConsumers : [];
        const itemSplits = Array.isArray(item.splits) ? item.splits : [];
        const splitIdx = itemConsumers.indexOf(participantIndex);
        if (splitIdx !== -1 && itemSplits[splitIdx]) {
          participantOwed += parseFloat(itemSplits[splitIdx].amount) || 0;
        }
      });

      // Net for this participant: positive means they owe money, negative means they are owed money
      const participantNet = participantOwed - participantPaid;

      participantBalances[participant.name] = (participantBalances[participant.name] || 0) + participantNet
    });
  });

  // Calculate totals from the participant balances
  let totalOwed = 0;
  let totalOwes = 0;
  Object.values(participantBalances).forEach(balance => {
    if (balance > 0) {
      totalOwed += balance;
    } else {
      totalOwes += Math.abs(balance);
    }
  });

  return {
    totalOwed: totalPaidByUser,
    totalOwes: totalOwedByUser,
    netBalance: totalPaidByUser - totalOwedByUser,
    debtBreakdown: participantBalances,
  };
};

  
 