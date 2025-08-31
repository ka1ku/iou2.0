import { Alert } from 'react-native';
import { getCurrentUser } from '../../services/authService';
import { getUserProfile } from '../../services/friendService';
import { createExpense, updateExpense, updateExpenseParticipants } from '../../services/expenseService';

const saveExpense = async (
  title,
  participants,
  items,
  fees,
  selectedPayers,
  joinEnabled,
  isEditing,
  expense,
  navigation,
  setLoading,
  calculateTotal,
  expenseType = 'expense', // Default to expense, can be 'receipt' or 'expense'
  resetChanges = null // New parameter for resetting change tracker
) => {
  // Generate a default title from the item name if no title is provided
  let finalTitle = title.trim();
  if (!finalTitle && items.length > 0 && items[0].name.trim()) {
    finalTitle = items[0].name.trim();
  } else if (!finalTitle) {
    finalTitle = 'Expense'; // Fallback default
  }

  if (participants.some(p => !p.name.trim())) {
    Alert.alert('Error', 'Please enter names for all participants');
    return;
  }

  if (items.length === 0) {
    Alert.alert('Error', 'Please add at least one item');
    return;
  }

  if (items.some(item => !item.name.trim() || !item.amount || parseFloat(item.amount) <= 0)) {
    Alert.alert('Error', 'Please fill in all item details with valid amounts');
    return;
  }

  if (fees.some(fee => !fee.name.trim())) {
    Alert.alert('Error', 'Please fill in all fee names');
    return;
  }

  if (!selectedPayers || selectedPayers.length === 0) {
    Alert.alert('Error', 'Please select at least one person who paid for this expense');
    return;
  }

  setLoading(true);
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('No user signed in');
    }

    // Get the current user's profile from Firestore
    const userProfile = await getUserProfile(currentUser.uid);
    if (!userProfile) {
      throw new Error('Failed to get user profile');
    }

    // Map participants with proper user data
    const mappedParticipants = participants.map((p, index) => {
      if (p.name === 'Me') {
        // Use the current user's actual profile data but preserve the existing structure
        return {
          ...p, // Preserve existing fields like id, userId, etc.
          name: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
          userId: p.userId || currentUser.uid, // Use existing userId if available, otherwise use current user's uid
          placeholder: false,
          phoneNumber: userProfile.phoneNumber,
          username: userProfile.username,
          profilePhoto: userProfile.profilePhoto
        };
      } else {
        // For other participants, preserve their existing data
        return {
          ...p, // Preserve all existing fields
          name: p.name.trim(),
          userId: p.userId || null,
          placeholder: p.placeholder || false,
          phoneNumber: p.phoneNumber || null,
          username: p.username || null,
          profilePhoto: p.profilePhoto || null
        };
      }
    });

    const expenseData = {
      title: finalTitle,
      total: calculateTotal(),
      expenseType: expenseType, // Mark as manual expense
      participants: mappedParticipants,
      items: items.map(item => ({
        id: item.id,
        name: item.name.trim(),
        amount: parseFloat(item.amount) || 0,
        selectedConsumers: item.selectedConsumers || [0],
        splits: item.splits || []
      })),
      fees: fees.map(fee => ({
        id: fee.id,
        name: fee.name.trim(),
        amount: parseFloat(fee.amount) || 0,
        type: fee.type || 'fixed',
        percentage: fee.percentage || null,
        splitType: fee.splitType || 'proportional',
        splits: fee.splits || []
      })),
      selectedPayers: selectedPayers || [0],
      join: {
        enabled: joinEnabled || false,
      }
    };
    console.log(expenseData)
    if (isEditing) {
      // Update participants separately to ensure participantsMap is updated
      await updateExpenseParticipants(expense.id, expenseData.participants, currentUser.uid);
      
      // Update other fields
      const { participants, ...otherFields } = expenseData;
      await updateExpense(expense.id, otherFields, currentUser.uid);
      
      Alert.alert('Success', 'Expense updated successfully');
      // Reset change tracker after successful update
      if (resetChanges) {
        resetChanges();
      }
    } else {
      await createExpense(expenseData, currentUser.uid);
      Alert.alert('Success', 'Expense created successfully');
    }

    navigation.goBack();
  } catch (error) {
    console.error('Error saving expense:', error);
    Alert.alert('Error', 'Failed to save expense: ' + error.message);
  } finally {
    setLoading(false);
  }
};

export default saveExpense;
