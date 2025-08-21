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
  serverTimestamp 
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
