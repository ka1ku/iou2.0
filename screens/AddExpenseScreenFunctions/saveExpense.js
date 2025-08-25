import { Alert } from 'react-native';
import { getCurrentUser } from '../../services/authService';
import { createExpense, updateExpense } from '../../services/expenseService';

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
  calculateTotal
) => {
  if (!title.trim()) {
    Alert.alert('Error', 'Please enter an expense title');
    return;
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

  setLoading(true);
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('No user signed in');
    }

    const expenseData = {
      title: title.trim(),
      total: calculateTotal(),
      participants: participants.map(p => ({ 
        name: p.name.trim(),
        userId: p.userId,
        placeholder: p.placeholder,
        phoneNumber: p.phoneNumber,
        username: p.username,
        profilePhoto: p.profilePhoto
      })),
      items: items.map(item => ({
        ...item,
        name: item.name.trim(),
        amount: parseFloat(item.amount)
      })),
      fees: fees.map(fee => ({
        ...fee,
        name: fee.name.trim(),
        amount: parseFloat(fee.amount)
      })),
      selectedPayers: selectedPayers,
      join: {
        enabled: joinEnabled,
      }
    };

    if (isEditing) {
      await updateExpense(expense.id, expenseData, currentUser.uid);
      Alert.alert('Success', 'Expense updated successfully');
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
