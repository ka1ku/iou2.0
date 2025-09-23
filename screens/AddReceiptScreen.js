import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import { createExpense, updateExpense, updateExpenseParticipants } from '../services/expenseService';
import { ExpenseProvider, useExpense } from '../contexts/ExpenseContext';
import ExpenseHeader from '../components/expenses/ExpenseHeader';
import ExpenseFooter from '../components/expenses/ExpenseFooter';
import ParticipantsGrid from '../components/expenses/ParticipantsGrid';
import PaidBySection from '../components/expenses/PaidBySection';
import ReceiptBreakdown from '../components/expenses/ReceiptBreakdown';

// Internal component that uses the context
const AddReceiptScreenContent = ({ route, navigation }) => {
  const { expense, scannedReceipt, fromReceiptScan, isNewExpense = false } = route.params || {};
  const isEditing = !!expense && !isNewExpense;
  const insets = useSafeAreaInsets();
  const currentUserId = getCurrentUser()?.uid || null;

  // Use context instead of local state
  const { state, actions, total } = useExpense();

  // Simple inline action handlers using context
  const handleAddItem = () => {
    actions.addItem();
  };

  const handleUpdateItem = (index, field, value) => {
    actions.updateItem(index, { [field]: value });
  };

  const handleRemoveItem = (index) => {
    actions.removeItem(index);
  };

  const handleAddFee = (feeData) => {
    actions.addFee(feeData);
  };

  const handleUpdateFee = (index, field, value) => {
    actions.updateFee(index, { [field]: value });
  };

  const handleRemoveFee = (index) => {
    actions.removeFee(index);
  };

  // Initialize screen and load expense data
  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Receipt' : 'Add Receipt',
      tabBarStyle: { display: 'none' },
    });

    // Load expense data if editing
    if (expense && (isEditing || isNewExpense)) {
      actions.initializeFromExpense(expense, isEditing, isNewExpense);
    }
  }, [expense, isEditing, isNewExpense, navigation, actions]);

  // Update participants when friends are selected
  useEffect(() => {
    const meParticipant = state.participants.find((p) => p.name === "Me");
    const allParticipants = [
      meParticipant || {
        name: "Me",
        id: "me-participant",
        userId: getCurrentUser()?.uid,
        placeholder: false,
        phoneNumber: null,
        username: null,
        profilePhoto: null,
      },
      ...state.selectedFriends.map((friend, index) => ({
        name: friend.name || "",
        id: `friend-${friend.id || index}`,
        userId: friend.id || null,
        phoneNumber: friend.phoneNumber || null,
        username: friend.username || null,
        profilePhoto: friend.profilePhoto || null,
        placeholder: false,
      })),
    ];

    // Only update if participants actually changed
    const participantsChanged =
      JSON.stringify(allParticipants) !== JSON.stringify(state.participants);
    if (participantsChanged) {
      actions.setParticipants(allParticipants);
    }
  }, [state.selectedFriends, state.participants, actions]);

  // Sync global selectedPayers with all items
  useEffect(() => {
    const updatedItems = state.items.map(item => ({
      ...item,
      selectedPayers: state.selectedPayers || [0]
    }));
    
    // Only update if items actually changed
    const itemsChanged = JSON.stringify(updatedItems) !== JSON.stringify(state.items);
    if (itemsChanged) {
      actions.setItems(updatedItems);
    }
  }, [state.selectedPayers, state.items, actions]);


  // Initialize "Me" participant with current user's profile data
  useEffect(() => {
    const initializeMeParticipant = async () => {
      try {
        const currentUser = getCurrentUser();
        if (currentUser) {
          const userProfile = await getUserProfile(currentUser.uid);
          if (userProfile) {
            const updatedParticipants = [...state.participants];
            if (updatedParticipants.length > 0 && updatedParticipants[0].name === 'Me') {
              updatedParticipants[0] = {
                ...updatedParticipants[0],
                name: 'Me',
                userId: currentUser.uid,
                placeholder: false,
                phoneNumber: userProfile.phoneNumber,
                username: userProfile.username,
                profilePhoto: userProfile.profilePhoto
              };
              actions.setParticipants(updatedParticipants);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing user participant:', error);
      }
    };

    initializeMeParticipant();
  }, [actions, state.participants]);

  // Handle scanned receipt data
  useEffect(() => {
    if (scannedReceipt && fromReceiptScan) {
      actions.setTitle(scannedReceipt.title || '');
      
      if (scannedReceipt.participants && scannedReceipt.participants.length > 0) {
        actions.setParticipants(scannedReceipt.participants);
      }
      
      if (scannedReceipt.items && scannedReceipt.items.length > 0) {
        const formattedItems = scannedReceipt.items.map((item, index) => ({
          id: Date.now().toString() + index,
          name: item.name || '',
          amount: parseFloat(item.amount) || 0,
          selectedConsumers: [0], // Default to first participant (Me)
          selectedPayers: [0], // Default to first participant (Me)
          splits: []
        }));
        actions.setItems(formattedItems);
      }
      
      actions.setSelectedPayers([0]);
      
      if (scannedReceipt.fees && scannedReceipt.fees.length > 0) {
        const formattedFees = scannedReceipt.fees.map((fee, index) => ({
            id: Date.now().toString() + 'fee' + index,
            name: fee.name || 'Fee',
          amount: parseFloat(fee.amount) || 0,
          type: fee.type || 'fixed',
          percentage: fee.percentage || null,
            splitType: 'proportional',
            splits: []
        }));
        actions.setFees(formattedFees);
      }
      
      Alert.alert(
        'Receipt Scanned Successfully!',
        'The receipt information has been automatically filled in. Please review and make any necessary adjustments.',
        [{ text: 'OK' }]
      );
    }
  }, [scannedReceipt, fromReceiptScan, actions]);

  const handleSaveExpense = async () => {
    const finalTitle = state.title.trim() || (state.items.length > 0 && state.items[0].name.trim()) || 'Receipt';

    if (state.participants.some(p => !p.name.trim())) {
      Alert.alert('Error', 'Please enter names for all participants');
      return;
    }

    if (state.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    if (!state.selectedPayers || state.selectedPayers.length === 0) {
      Alert.alert('Error', 'Please select at least one person who paid for this receipt');
      return;
    }

    actions.setLoading(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) throw new Error('No user signed in');

      const userProfile = await getUserProfile(currentUser.uid);
      if (!userProfile) throw new Error('Failed to get user profile');

      const mappedParticipants = state.participants.map((p) => {
        if (p.name === 'Me') {
          return {
            ...p,
            name: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
            userId: p.userId || currentUser.uid,
            placeholder: false,
            phoneNumber: userProfile.phoneNumber,
            username: userProfile.username,
            profilePhoto: userProfile.profilePhoto
          };
        }
        return {
          ...p,
          name: p.name.trim(),
          userId: p.userId || null,
          placeholder: p.placeholder || false,
          phoneNumber: p.phoneNumber || null,
          username: p.username || null,
          profilePhoto: p.profilePhoto || null
        };
      });

      const expenseData = {
        title: finalTitle,
        total: total,
        expenseType: 'receipt',
        participants: mappedParticipants,
        items: state.items.map(item => ({
          id: item.id,
          name: item.name.trim(),
          amount: parseFloat(item.amount) || 0,
          selectedConsumers: item.selectedConsumers || [],
          splits: item.splits || []
        })),
        fees: state.fees.map(fee => ({
          id: fee.id,
          name: fee.name.trim(),
          amount: parseFloat(fee.amount) || 0,
          type: fee.type || 'fixed',
          percentage: fee.percentage || null,
          splitType: fee.splitType || 'proportional',
          splits: fee.splits || []
        })),
        selectedPayers: state.selectedPayers || [0],
        join: { enabled: state.joinEnabled }
      };
      
      if (isEditing || isNewExpense) {
        // For both editing existing receipts and completing new receipts, we update the existing expense
        await updateExpenseParticipants(expense.id, expenseData.participants, currentUser.uid);
        const { participants, ...otherFields } = expenseData;
        await updateExpense(expense.id, otherFields, currentUser.uid);
        Alert.alert('Success', isNewExpense ? 'Receipt created successfully' : 'Receipt updated successfully');
      } else {
        // This case should not happen in the current flow, but keeping for safety
        await createExpense(expenseData, currentUser.uid);
        Alert.alert('Success', 'Receipt created successfully');
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving receipt:', error);
      Alert.alert('Error', 'Failed to save receipt: ' + error.message);
    } finally {
      actions.setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
        <ExpenseHeader
          title={state.title || (isEditing ? 'Edit Receipt' : 'Add Receipt')}
          onBackPress={() => navigation.goBack()}
          onSettingsPress={() => navigation.navigate('ExpenseSettings', { expense: { 
            id: expense?.id,
            title: state.title,
            participants: state.participants,
            items: state.items,
            fees: state.fees,
            createdBy: getCurrentUser()?.uid,
            join: { enabled: state.joinEnabled }
          }})}
          isEditing={isEditing}
          showTitleInput={true}
          titleValue={state.title}
          onTitleChange={actions.setTitle}
          titlePlaceholder="Receipt title..."
        />
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 100, paddingBottom: 120 }}
        >
        <View style={styles.content}>
          {/* Participants Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Participants</Text>
            <View style={styles.memberCountBadge}>
              <Text style={styles.memberCountText}>
                {state.participants.length} {state.participants.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>

          <ParticipantsGrid
            onParticipantPress={(participant, index) => {
              if (participant.userId && participant.userId !== currentUserId) {
                navigation.navigate('FriendProfile', { friendId: participant.userId });
              }
            }}
            expenseId={expense?.id}
            currentUserId={currentUserId}
          />

          {/* Who Paid Section */}
          <PaidBySection />
          </View>

          {/* Receipt Breakdown */}
          <ReceiptBreakdown
            items={state.items}
            fees={state.fees}
            participants={state.participants}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            onAddFee={handleAddFee}
            onUpdateFee={handleUpdateFee}
            onRemoveFee={handleRemoveFee}
          />

        </ScrollView>

        <ExpenseFooter
          isEditing={isEditing}
          loading={state.loading}
          onSavePress={handleSaveExpense}
          onSettlePress={handleSaveExpense}
          saveButtonText={isEditing ? 'Update Receipt' : 'Save Receipt'}
          settleButtonText={isEditing ? 'Update & Settle' : 'Settle Now'}
        />
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  memberCountBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  memberCountText: {
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 12,
  },
});

// Wrapper component with provider
const AddReceiptScreen = (props) => (
  <ExpenseProvider>
    <AddReceiptScreenContent {...props} />
  </ExpenseProvider>
);

export default AddReceiptScreen;