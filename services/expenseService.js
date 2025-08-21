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
      items: expenseData.items || []
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

// Generate a random token and a 6-digit code
const generateInviteToken = () => Math.random().toString(36).slice(2, 12);
const generateJoinCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Create an invite for a placeholder participant
export const createExpenseInvite = async (expenseId, options) => {
  try {
    const {
      placeholderId,
      placeholderName,
      phoneNumber,
      ttlMinutes = 15,
    } = options || {};

    if (!expenseId) throw new Error('Missing expenseId');

    const firestoreInstance = getFirestore(getApp());

    // Validate expense exists
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    const expenseSnap = await getDoc(expenseRef);
    if (!expenseSnap.exists()) throw new Error('Expense not found');

    const token = generateInviteToken();
    const code = generateJoinCode();
    const nowMs = Date.now();
    const expiresAtMs = nowMs + ttlMinutes * 60 * 1000;

    const inviteData = {
      expenseId,
      token,
      code,
      placeholderId: placeholderId || null,
      placeholderName: placeholderName || null,
      phoneNumber: phoneNumber || null,
      used: false,
      createdAt: serverTimestamp(),
      expiresAtMs,
    };

    // Store under subcollection for better locality
    const invitesCol = collection(firestoreInstance, 'expenses', expenseId, 'invites');
    const inviteRef = await addDoc(invitesCol, inviteData);

    return {
      id: inviteRef.id,
      ...inviteData,
    };
  } catch (error) {
    console.error('Error creating expense invite:', error);
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
    if (!expenseId || (!token && !code)) return null;
    return { expenseId, token, code };
  } catch (error) {
    console.error('Error parsing expense join link:', error);
    return null;
  }
};

// Generate app deep link for expense join
export const generateExpenseJoinLink = ({ expenseId, token, code }) => {
  const baseUrl = 'com.kailee.iou20://expense-join';
  const params = new URLSearchParams({ eid: expenseId });
  if (token) params.set('t', token);
  if (code) params.set('c', code);
  return `${baseUrl}?${params.toString()}`;
};

// Join an expense using a token or code
export const joinExpense = async ({ expenseId, token, code, user }) => {
  try {
    if (!expenseId) throw new Error('Missing expenseId');
    if (!user) throw new Error('No user signed in');

    const firestoreInstance = getFirestore(getApp());

    // Load invite by token or code
    const invitesCol = collection(firestoreInstance, 'expenses', expenseId, 'invites');

    let inviteSnap = null;
    if (token) {
      // Firestore does not support direct where on subcollection by field without query
      const q = query(invitesCol, where('token', '==', token));
      const res = await getDocs(q);
      inviteSnap = res.empty ? null : res.docs[0];
    } else if (code) {
      const q = query(invitesCol, where('code', '==', code));
      const res = await getDocs(q);
      inviteSnap = res.empty ? null : res.docs[0];
    }

    if (!inviteSnap || !inviteSnap.exists()) throw new Error('Invite not found');
    const invite = inviteSnap.data();
    if (invite.used) throw new Error('Invite already used');
    if (invite.expiresAtMs && Date.now() > invite.expiresAtMs) throw new Error('Invite expired');

    // Fetch expense
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    const expenseDoc = await getDoc(expenseRef);
    if (!expenseDoc.exists()) throw new Error('Expense not found');
    const expense = expenseDoc.data();

    // Prepare participant record (non-destructive: append if not present)
    const participants = Array.isArray(expense.participants) ? [...expense.participants] : [];

    // If placeholder name exists, try to replace the first matching placeholder entry
    let replaced = false;
    if (invite.placeholderName) {
      const index = participants.findIndex(p => p && p.name === invite.placeholderName && p.placeholder === true);
      if (index >= 0) {
        participants[index] = {
          name: `${user.firstName || 'Friend'} ${user.lastName || ''}`.trim() || (user.venmoUsername ? `@${user.venmoUsername}` : 'Friend'),
          userId: user.uid,
          placeholder: false,
        };
        replaced = true;
      }
    }

    if (!replaced) {
      participants.push({
        name: `${user.firstName || 'Friend'} ${user.lastName || ''}`.trim() || (user.venmoUsername ? `@${user.venmoUsername}` : 'Friend'),
        userId: user.uid,
        placeholder: false,
      });
    }

    // Update expense participants only; splits are not recalculated here
    await updateDoc(expenseRef, {
      participants,
      updatedAt: serverTimestamp(),
    });

    // Mark invite used
    await updateDoc(inviteSnap.ref, { used: true, updatedAt: serverTimestamp() });

    return true;
  } catch (error) {
    console.error('Error joining expense:', error);
    throw error;
  }
};

// Helper function to calculate balances for profile screen
export const calculateUserBalances = (expenses, userId) => {
  let totalOwed = 0;
  let totalOwes = 0;
  const debtBreakdown = {}; // { participantName: amount } - positive means they owe you, negative means you owe them
  
  expenses.forEach(expense => {
    const currentUserIndex = 0; // Assuming current user is always the first participant
    
    expense.items?.forEach(item => {
      const paidByIndex = item.paidBy || 0;
      const paidByParticipant = expense.participants?.[paidByIndex];
      
      if (!paidByParticipant || !item.amount || !expense.participants?.length) {
        return; // Skip invalid items
      }
      
      if (item.splitType === 'even') {
        const splitAmount = parseFloat(item.amount) / expense.participants.length;
        
        // If current user paid, others owe them
        if (paidByIndex === currentUserIndex) {
          expense.participants.forEach((participant, index) => {
            if (index !== currentUserIndex) {
              totalOwed += splitAmount;
              debtBreakdown[participant.name] = (debtBreakdown[participant.name] || 0) + splitAmount;
            }
          });
        } else {
          // Someone else paid, current user owes them
          totalOwes += splitAmount;
          debtBreakdown[paidByParticipant.name] = (debtBreakdown[paidByParticipant.name] || 0) - splitAmount;
        }
      } else if (item.splitType === 'custom') {
        item.splits?.forEach(split => {
          const splitParticipant = expense.participants?.[split.participantIndex];
          const splitAmount = parseFloat(split.amount) || 0;
          
          if (!splitParticipant || splitAmount === 0) {
            return; // Skip invalid splits
          }
          
          if (paidByIndex === currentUserIndex && split.participantIndex !== currentUserIndex) {
            // Current user paid, someone else owes them
            totalOwed += splitAmount;
            debtBreakdown[splitParticipant.name] = (debtBreakdown[splitParticipant.name] || 0) + splitAmount;
          } else if (paidByIndex !== currentUserIndex && split.participantIndex === currentUserIndex) {
            // Someone else paid, current user owes them
            totalOwes += splitAmount;
            debtBreakdown[paidByParticipant.name] = (debtBreakdown[paidByParticipant.name] || 0) - splitAmount;
          }
        });
      }
    });
  });
  
  return {
    totalOwed,
    totalOwes,
    netBalance: totalOwed - totalOwes,
    debtBreakdown
  };
};
