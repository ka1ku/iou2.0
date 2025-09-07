import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
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
//   settlements: [{
//     debtor: string,
//     creditor: string,
//     amount: number,
//     updatedAt: string (ISO timestamp),
//     associatedItems: array,
//     status: 'markedAsPaid' | 'paymentRequested' | 'paymentMade' | 'noAction'
//   }],
//   createdBy: string (user ID),
//   createdAt: timestamp,
//   updatedAt: timestamp
// }

export const createExpense = async (expenseData, userId) => {
  try {
    console.log('Creating expense with Firestore for user:', userId);
    
    // Create a simple participants map for efficient querying
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
    
    // Try to use the optimized participantsMap query first
    try {
      const expensesQuery = query(
        collection(firestoreInstance, 'expenses'),
        where(`participantsMap.${userId}`, '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(expensesQuery);
      const expenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Fetched', expenses.length, 'expenses from Firestore using participantsMap');
      return expenses;
    } catch (mapError) {
      console.log('participantsMap query failed, falling back to client-side filtering:', mapError.message);
      
      // Fallback: Get all expenses and filter client-side
      const expensesQuery = query(
        collection(firestoreInstance, 'expenses'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(expensesQuery);
      
      // Filter expenses where user is a participant
      const allExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const userExpenses = allExpenses.filter(expense => {
        // Check if user is the creator
        if (expense.createdBy === userId) {
          return true;
        }
        
        // Check if user is in participants array
        if (expense.participants && Array.isArray(expense.participants)) {
          return expense.participants.some(participant => participant.userId === userId);
        }
        
        // Check if user is in participantsMap (for newer expenses)
        if (expense.participantsMap && expense.participantsMap[userId]) {
          return true;
        }
        
        return false;
      });
      
      console.log('Fetched', userExpenses.length, 'expenses from Firestore using client-side filtering');
      return userExpenses;
    }
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
      updateData.participants.forEach((participant) => {
        if (participant.userId) {
          participantsMap[participant.userId] = true;
        }
      });
      finalUpdateData.participantsMap = participantsMap;
    }
    
    
    const firestoreInstance = getFirestore(getApp());
    await updateDoc(doc(firestoreInstance, 'expenses', expenseId), {
      ...finalUpdateData,
      updatedAt: serverTimestamp()
    });
    
    console.log('Expense updated successfully');
  } catch (error) {
    console.error('Error updating expense in Firestore:', error);
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
    participantsMap[userId] = true;
    
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
    
    // Create simple participantsMap for efficient querying
    const participantsMap = {};
    participants.forEach((participant) => {
      if (participant.userId) {
        participantsMap[participant.userId] = true;
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

// Migration function to add participantsMap to existing expenses
export const migrateExpensesWithParticipantsMap = async () => {
  try {
    console.log('Starting migration to add participantsMap to existing expenses...');
    
    const firestoreInstance = getFirestore(getApp());
    const expensesQuery = query(collection(firestoreInstance, 'expenses'));
    const snapshot = await getDocs(expensesQuery);
    
    let migratedCount = 0;
    const batch = [];
    
    for (const docSnapshot of snapshot.docs) {
      const expenseData = docSnapshot.data();
      
      // Skip if participantsMap already exists
      if (expenseData.participantsMap) {
        continue;
      }
      
      // Create participantsMap from participants array
      const participantsMap = {};
      if (expenseData.participants && Array.isArray(expenseData.participants)) {
        expenseData.participants.forEach((participant) => {
          if (participant.userId) {
            participantsMap[participant.userId] = true;
          }
        });
      }
      
      // Add to batch update
      batch.push(updateDoc(docSnapshot.ref, { participantsMap }));
      migratedCount++;
      
      // Process in batches of 500 (Firestore limit)
      if (batch.length >= 500) {
        await Promise.all(batch);
        batch.length = 0;
        console.log(`Migrated ${migratedCount} expenses so far...`);
      }
    }
    
    // Process remaining batch
    if (batch.length > 0) {
      await Promise.all(batch);
    }
    
    console.log(`Migration completed. Updated ${migratedCount} expenses with participantsMap.`);
    return { success: true, migratedCount };
  } catch (error) {
    console.error('Error during migration:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to calculate balances for profile screen based on settlements
export const calculateUserBalances = (expenses, userId) => {
  const participantBalances = {}; // { participantName: netAmount }
  let totalOwedToUser = 0;
  let totalUserOwes = 0;

  console.log('Calculating user balances from settlements for', expenses.length, 'expenses');

  expenses.forEach(expense => {
    const settlements = Array.isArray(expense.settlements) ? expense.settlements : [];
    const participants = Array.isArray(expense.participants) ? expense.participants : [];
    
    // Get current user's name from participants (assuming user is always first participant)
    const currentUserName = participants[0]?.name;
    if (!currentUserName) {
      console.log('No current user name found for expense:', expense.title);
      return;
    }

    console.log(`Processing expense "${expense.title}" with ${settlements.length} settlements`);

    settlements.forEach(settlement => {
      // Skip settlements that are marked as paid
      if (settlement.status === 'markedAsPaid') {
        console.log(`Skipping markedAsPaid settlement: ${settlement.debtor} -> ${settlement.creditor} $${settlement.amount}`);
        return;
      }

      const debtor = settlement.debtor;
      const creditor = settlement.creditor;
      const amount = parseFloat(settlement.amount) || 0;

      console.log(`Processing settlement: ${debtor} owes ${creditor} $${amount} (status: ${settlement.status})`);

      // If current user is the creditor (someone owes them)
      if (creditor === currentUserName) {
        totalOwedToUser += amount;
        
        // Update debt breakdown for this debtor
        if (debtor !== currentUserName) {
          participantBalances[debtor] = (participantBalances[debtor] || 0) + amount;
        }
        console.log(`User is creditor: +$${amount} owed to user by ${debtor}`);
      }
      // If current user is the debtor (they owe someone)
      else if (debtor === currentUserName) {
        totalUserOwes += amount;
        
        // Update debt breakdown for this creditor
        if (creditor !== currentUserName) {
          participantBalances[creditor] = (participantBalances[creditor] || 0) - amount;
        }
        console.log(`User is debtor: +$${amount} user owes to ${creditor}`);
      }
    });
  });

  console.log('Final balances:', {
    totalOwedToUser,
    totalUserOwes,
    netBalance: totalOwedToUser - totalUserOwes,
    debtBreakdown: participantBalances
  });

  return {
    totalOwed: totalOwedToUser,
    totalOwes: totalUserOwes,
    netBalance: totalOwedToUser - totalUserOwes,
    debtBreakdown: participantBalances,
  };
};

  
 