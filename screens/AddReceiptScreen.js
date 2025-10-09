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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import { createExpense, updateExpense, updateExpenseParticipants, deleteItemFromExpense } from '../services/expenseService';
import { calculateSettlement } from '../utils/settlementCalculator';
import { ExpenseProvider, useExpense } from '../contexts/ExpenseContext';
import ExpenseHeader from '../components/expenses/ExpenseHeader';
import ExpenseFooter from '../components/expenses/ExpenseFooter';
import ParticipantsGrid from '../components/expenses/ParticipantsGrid';
import PaidBySection from '../components/expenses/PaidBySection';
import ReceiptBreakdown from '../components/expenses/ReceiptBreakdown';

const AddReceiptScreenContent = ({ route, navigation }) => {
  const { expense, scannedReceipt, fromReceiptScan, isNewExpense = false } = route.params || {};
  const isEditing = !!expense && !isNewExpense;
  const insets = useSafeAreaInsets();
  const currentUserId = getCurrentUser()?.uid || null;

  const { state, actions, total } = useExpense();

  const handleAddItem = () => {
    actions.addItem();
  };

  const handleUpdateItem = (index, field, value) => {
    actions.updateItem(index, { [field]: value });
  };

  const handleRemoveItem = async (index) => {
    try {
      if (isEditing && expense?.id) {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          Alert.alert("Error", "User not authenticated");
          return;
        }
        
        await deleteItemFromExpense(expense.id, index, currentUser.uid);
      }
      
      actions.removeItem(index);
    } catch (error) {
      Alert.alert("Error", "Failed to remove item: " + error.message);
    }
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

  const prepareExpenseData = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error("No user signed in");

    const userProfile = await getUserProfile(currentUser.uid);
    if (!userProfile) throw new Error("Failed to get user profile");

    const finalTitle =
      state.title.trim() || state.items[0]?.name.trim() || "Receipt";

    const mappedParticipants = state.participants.map((p) => {
      if (p.userId === currentUser.uid) {
        return {
          ...p,
          name: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
          userId: currentUser.uid,
          phoneNumber: userProfile.phoneNumber,
          username: userProfile.username,
          profilePhoto: userProfile.profilePhoto,
        };
      }
      return {
        ...p,
        name: p.name.trim(),
        userId: p.userId || null,
      };
    });

    return {
      title: finalTitle,
      total: total,
      expenseType: "receipt",
      participants: mappedParticipants,
      items: state.items.map((item) => ({
        id: item.id,
        name: item.name.trim(),
        amount: parseFloat(item.amount) || 0,
        selectedConsumers: item.selectedConsumers || [0],
        selectedPayers: item.selectedPayers || [0],
        splits: item.splits || [],
      })),
      fees: state.fees.map((fee) => ({
        id: fee.id,
        name: fee.name.trim(),
        amount: parseFloat(fee.amount) || 0,
        type: fee.type || "fixed",
        splits: fee.splits || [],
      })),
      selectedPayers: state.selectedPayers || [0],
      join: { enabled: state.joinEnabled },
    };
  };

  const validateExpense = () => {
    if (state.participants.some((p) => !p.name.trim())) {
      Alert.alert("Error", "Please enter names for all participants");
      return false;
    }
    if (state.items.length === 0) {
      Alert.alert("Error", "Please add at least one item");
      return false;
    }
    if (
      state.items.some(
        (item) => !item.name.trim() || parseFloat(item.amount) < 0
      )
    ) {
      Alert.alert(
        "Error",
        "Please fill in all item names and ensure amounts are valid"
      );
      return false;
    }
    if (state.fees.some((fee) => !fee.name.trim())) {
      Alert.alert("Error", "Please fill in all fee names");
      return false;
    }
    if (!state.selectedPayers?.length) {
      Alert.alert(
        "Error",
        "Please select at least one person who paid for this receipt"
      );
      return false;
    }
    return true;
  };

  const calculateParticipantProportions = (items, participants, fees = []) => {
    const totalItemAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const participantAmounts = participants.map((participant, index) => {
      let participantTotal = 0;
      
      items.forEach(item => {
        const itemAmount = parseFloat(item.amount) || 0;
        const itemConsumers = item.selectedConsumers || [];
        const itemSplits = item.splits || [];
        
        if (itemConsumers.includes(index)) {
          const consumerIndex = itemConsumers.indexOf(index);
          if (itemSplits[consumerIndex] !== undefined && itemSplits[consumerIndex] !== null) {
            const splitAmount = typeof itemSplits[consumerIndex] === 'object' 
              ? parseFloat(itemSplits[consumerIndex].amount) || 0
              : parseFloat(itemSplits[consumerIndex]) || 0;
            participantTotal += splitAmount;
          } else {
            const amountPerConsumer = itemAmount / itemConsumers.length;
            participantTotal += amountPerConsumer;
          }
        }
      });
      
      return {
        participant,
        index,
        amount: participantTotal,
        proportion: totalItemAmount > 0 ? participantTotal / totalItemAmount : 0
      };
    });
    
    const totalFees = fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
    
    return participantAmounts;
  };

  const applyProportionalFeeSplits = (expenseData, participantProportions) => {
    const totalFees = expenseData.fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
    
    if (totalFees === 0) {
      return expenseData;
    }
    
    const updatedFees = expenseData.fees.map(fee => {
      const feeAmount = parseFloat(fee.amount) || 0;
      const proportionalSplits = participantProportions.map(({ index, proportion }) => ({
        participantIndex: index,
        amount: feeAmount * proportion
      }));

      return {
        ...fee,
        splits: proportionalSplits
      };
    });

    return {
      ...expenseData,
      fees: updatedFees
    };
  };

  const calculateSettlements = async () => {
    try {
      const expenseData = await prepareExpenseData();
      
      const participantProportions = calculateParticipantProportions(expenseData.items, expenseData.participants, expenseData.fees);
      
      const expenseDataWithFeeSplits = applyProportionalFeeSplits(expenseData, participantProportions);
      
      const settlementResult = calculateSettlement(expenseDataWithFeeSplits);
      
      return settlementResult.settlements || [];
    } catch (error) {
      return [];
    }
  };

  const handleSettleNow = async () => {
    if (!validateExpense()) return;

    actions.setLoading(true);
    try {
      const expenseData = await prepareExpenseData();
      const currentUser = getCurrentUser();

      const participantProportions = calculateParticipantProportions(expenseData.items, expenseData.participants, expenseData.fees);

      const expenseDataWithFeeSplits = applyProportionalFeeSplits(expenseData, participantProportions);

      if (isEditing || isNewExpense) {
        await updateExpenseParticipants(
          expense.id,
          expenseDataWithFeeSplits.participants,
          currentUser.uid
        );
        const { participants, ...otherFields } = expenseDataWithFeeSplits;
        await updateExpense(expense.id, otherFields, currentUser.uid);
      } else {
        await createExpense(expenseDataWithFeeSplits, currentUser.uid);
      }

      const settlements = await calculateSettlements();
      navigation.navigate("SettleUp", {
        expense: {
          ...expense,
          settlements: settlements.map((settlement) => ({
            debtor: settlement.from,
            creditor: settlement.to,
            amount: settlement.amount,
            status: "noAction",
            updatedAt: new Date().toISOString(),
            associatedItems: [],
          })),
        },
      });
    } catch (error) {
      Alert.alert("Error", "Failed to save expense: " + error.message);
    } finally {
      actions.setLoading(false);
    }
  };

  const handleSettleLater = handleSaveExpense;

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Receipt' : 'Add Receipt',
      tabBarStyle: { display: 'none' },
    });

    if (expense && (isEditing || isNewExpense)) {
      actions.initializeFromExpense(expense, isEditing, isNewExpense);
    }
  }, [expense, isEditing, isNewExpense, navigation, actions]);

  useEffect(() => {
    const currentUserId = getCurrentUser()?.uid;
    const meParticipant = state.participants.find((p) => p.userId === currentUserId);
    const allParticipants = [
      meParticipant || {
        name: getCurrentUser()?.fullName || getCurrentUser()?.firstName || "Unknown User",
        id: "me-participant",
        userId: currentUserId,
        placeholder: false,
        phoneNumber: null,
        username: getCurrentUser()?.username || null,
        profilePhoto: getCurrentUser()?.profilePhoto || null,
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

    const participantsChanged =
      JSON.stringify(allParticipants) !== JSON.stringify(state.participants);
    if (participantsChanged) {
      actions.setParticipants(allParticipants);
    }
  }, [state.selectedFriends, state.participants, actions]);

  useEffect(() => {
    const updatedItems = state.items.map(item => ({
      ...item,
      selectedPayers: state.selectedPayers || [0]
    }));
    
    const itemsChanged = JSON.stringify(updatedItems) !== JSON.stringify(state.items);
    if (itemsChanged) {
      actions.setItems(updatedItems);
    }
  }, [state.selectedPayers, state.items, actions]);

  useEffect(() => {
    if (scannedReceipt && fromReceiptScan) {
      actions.setTitle(scannedReceipt.title || '');
      
      // Don't set participants from scanned receipt - they're incomplete
      // The expense context already creates the current user participant properly
      
      if (scannedReceipt.items && scannedReceipt.items.length > 0) {
        const formattedItems = scannedReceipt.items.map((item, index) => ({
          id: Date.now().toString() + index,
          name: item.name || '',
          amount: parseFloat(item.amount) || 0,
          selectedConsumers: [],
          selectedPayers: [0],
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
    if (!validateExpense()) return;

    actions.setLoading(true);
    try {
      const expenseData = await prepareExpenseData();
      
      const participantProportions = calculateParticipantProportions(expenseData.items, expenseData.participants, expenseData.fees);
      
      const expenseDataWithFeeSplits = applyProportionalFeeSplits(expenseData, participantProportions);
      
      const currentUser = getCurrentUser();

      if (isEditing || isNewExpense) {
        await updateExpenseParticipants(
          expense.id,
          expenseDataWithFeeSplits.participants,
          currentUser.uid
        );
        const { participants, ...otherFields } = expenseDataWithFeeSplits;
        await updateExpense(expense.id, otherFields, currentUser.uid);
        Alert.alert(
          "Success",
          isNewExpense
            ? "Receipt created successfully"
            : "Receipt updated successfully"
        );
      } else {
        await createExpense(expenseDataWithFeeSplits, currentUser.uid);
        Alert.alert("Success", "Receipt created successfully");
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to save receipt: " + error.message);
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Participants</Text>
            <View style={styles.memberCountContainer}>
              <Text style={styles.memberCountNumber}>
                {state.participants.filter(p => p.userId !== getCurrentUser()?.uid).length}
              </Text>
              <Ionicons name="people" size={12} color={Colors.surface} />
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

          <PaidBySection />
          </View>
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
          onSavePress={handleSettleLater}
          onSettlePress={handleSettleNow}
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
    paddingTop: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  memberCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    gap: Spacing.xs,
  },
  memberCountNumber: {
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 12,
  },
});

const AddReceiptScreen = AddReceiptScreenContent;

export default AddReceiptScreen;