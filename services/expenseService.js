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
    
    const expense = {
      ...expenseData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      items: expenseData.items || [],
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
    const expensesQuery = query(
      collection(firestoreInstance, 'expenses'),
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(expensesQuery);
    
    const expenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('Fetched', expenses.length, 'expenses from Firestore');
    return expenses;
  } catch (error) {
    console.error('Error getting expenses from Firestore:', error);
    return [];
  }
};

export const updateExpense = async (expenseId, updateData, userId) => {
  try {
    console.log('Updating expense in Firestore:', expenseId);
    
    const firestoreInstance = getFirestore(getApp());
    await updateDoc(doc(firestoreInstance, 'expenses', expenseId), {
      ...updateData,
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
    const expenseSnap = await getDoc(expenseRef);
    if (!expenseSnap.exists()) throw new Error('Expense not found');
    const expense = expenseSnap.data();
    if (expense.join && expense.join.code && expense.join.token) {
      return expense.join;
    }
    if (!initializeIfMissing) return null;
    const join = {
      enabled: true,
      code: generateJoinCode(),
      token: generateInviteToken(),
      createdAt: serverTimestamp(),
    };
    await updateDoc(expenseRef, { join, updatedAt: serverTimestamp() });
    return join;
  } catch (error) {
    console.error('Error getting expense join info:', error);
    throw error;
  }
};

export const setExpenseJoinEnabled = async (expenseId, enabled) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    await updateDoc(expenseRef, { 'join.enabled': !!enabled, updatedAt: serverTimestamp() });
    return true;
  } catch (error) {
    console.error('Error updating expense join enabled:', error);
    throw error;
  }
};

export const rotateExpenseJoinCode = async (expenseId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    await updateDoc(expenseRef, { 'join.code': generateJoinCode(), 'join.token': generateInviteToken(), updatedAt: serverTimestamp() });
    return true;
  } catch (error) {
    console.error('Error rotating expense join code:', error);
    throw error;
  }
};

// Parse deep link for expense join
export const parseExpenseJoinLink = (url) => {
  try {
    if (!url.includes('expense-join')) return null;
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    const expenseId = params.get('eid');
    const token = params.get('t');
    const code = params.get('c');
    const phone = params.get('p'); // Extract phone number parameter
    if (!expenseId || (!token && !code)) return null;
    return { expenseId, token, code, phone };
  } catch (error) {
    console.error('Error parsing expense join link:', error);
    return null;
  }
};

// Generate app deep link for expense join
export const generateExpenseJoinLink = ({ expenseId, token, code, phone }) => {
  const baseUrl = 'com.kailee.iou20://expense-join';
  const params = new URLSearchParams({ eid: expenseId });
  if (token) params.set('t', token);
  if (code) params.set('c', code);
  if (phone) params.set('p', phone); // Add phone number parameter
  return `${baseUrl}?${params.toString()}`;
};

// Join an expense using a token or code
export const joinExpense = async ({ expenseId, token, code, phone, user }) => {
  try {
    if (!expenseId) throw new Error('Missing expenseId');
    if (!user) throw new Error('No user signed in');

    const firestoreInstance = getFirestore(getApp());

    // Fetch expense
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    const expenseDoc = await getDoc(expenseRef);
    if (!expenseDoc.exists()) throw new Error('Expense not found');
    const expense = expenseDoc.data();

    if (!expense.join || !expense.join.enabled) {
      throw new Error('Join by room code is disabled for this expense');
    }

    // Validate token or code if provided
    if (token && token !== expense.join.token) {
      throw new Error('Invalid join link');
    }
    if (code && code !== expense.join.code) {
      throw new Error('Invalid room code');
    }

    // Prepare participant record (non-destructive: append if not present)
    const participants = Array.isArray(expense.participants) ? [...expense.participants] : [];

    // If phone number is provided, validate that the user's phone matches the invited phone
    if (phone) {
      // Normalize phone number for comparison (remove formatting)
      const normalizedInvitedPhone = phone.replace(/\D/g, '');
      console.log('🔍 Validating phone number match. Invited phone:', normalizedInvitedPhone);
      
      // Check if the current user has a phone number and if it matches
      let userPhoneMatches = false;
      if (!user.phoneNumber) {
        throw new Error('Phone number required. Please add your phone number to your profile to join expenses.');
      }
      
      const normalizedUserPhone = user.phoneNumber.replace(/\D/g, '');
      userPhoneMatches = normalizedUserPhone === normalizedInvitedPhone;
      console.log('📱 User phone:', normalizedUserPhone, 'Invited phone:', normalizedInvitedPhone, 'Match:', userPhoneMatches);
      
      // If phone numbers don't match, block the join
      if (!userPhoneMatches) {
        throw new Error('Phone number mismatch. You can only join expenses you were specifically invited to.');
      }
      
      console.log('✅ Phone number validation passed');
      
      // Now try to match with existing participants or placeholders
      let matchedParticipant = null;
      let matchedIndex = -1;
      
      // First, try to match with existing participants by phone number
      matchedIndex = participants.findIndex(p => {
        if (p.phoneNumber) {
          const participantPhone = p.phoneNumber.replace(/\D/g, '');
          const matches = participantPhone === normalizedInvitedPhone;
          if (matches) {
            console.log('✅ Found matching participant:', p.name);
          }
          return matches;
        }
        return false;
      });
      
      if (matchedIndex >= 0) {
        matchedParticipant = participants[matchedIndex];
        console.log('🎯 Matched with existing participant at index:', matchedIndex);
      } else {
        // Try to match with placeholders by phone number
        matchedIndex = participants.findIndex(p => {
          if (p.placeholder && p.phoneNumber) {
            const placeholderPhone = p.phoneNumber.replace(/\D/g, '');
            const matches = placeholderPhone === normalizedInvitedPhone;
            if (matches) {
              console.log('✅ Found matching placeholder:', p.name);
            }
            return matches;
          }
          return false;
        });
        
        if (matchedIndex >= 0) {
          console.log('🎯 Matched with placeholder at index:', matchedIndex);
        }
      }
    }

    // If we found a match, update that participant
    if (matchedParticipant) {
      console.log('🔄 Updating matched participant with user info:', user.uid);
      participants[matchedIndex] = {
        ...matchedParticipant,
        name: `${user.firstName || 'Friend'} ${user.lastName || ''}`.trim() || (user.venmoUsername ? `@${user.venmoUsername}` : 'Friend'),
        userId: user.uid,
        placeholder: false,
        phoneNumber: phone, // Keep the phone number for future reference
      };
      console.log('✅ Successfully identified user as invited participant:', matchedParticipant.name);
    } else {
      // Try replacing first placeholder, otherwise append
      let replaced = false;
      const placeholderIndex = participants.findIndex(p => p && p.placeholder === true);
      if (placeholderIndex >= 0) {
        participants[placeholderIndex] = {
          name: `${user.firstName || 'Friend'} ${user.lastName || ''}`.trim() || (user.venmoUsername ? `@${user.venmoUsername}` : 'Friend'),
          userId: user.uid,
          placeholder: false,
          phoneNumber: phone, // Add phone number if provided
        };
        replaced = true;
      }
      if (!replaced) {
        // Create participant entry for the user
        const participantName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`.trim() 
          : (user.username ? `@${user.username}` : 'Friend');
        
        participants.push({ 
          name: participantName, 
          userId: user.uid, 
          placeholder: false,
          phoneNumber: phone, // Add phone number if provided
        });
      }
    }

    // Update expense participants only; splits are not recalculated here
    await updateDoc(expenseRef, {
      participants,
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error('Error joining expense:', error);
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
      paidByUser = Math.abs(Number(expense.total) / paidByIndices.length);
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
        participantPaid = Math.abs(Number(expense.total) / paidByIndices.length);
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

  
 