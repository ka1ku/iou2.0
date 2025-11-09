import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Spacing, Radius } from "../design/tokens";
import { getCurrentUser } from "../services/authService";
import { getUserProfile } from "../services/friendService";
import {
  createExpense,
  updateExpense,
  updateExpenseParticipants,
  deleteItemFromExpense,
} from "../services/expenseService";
import { calculateSettlement } from "../utils/settlementCalculator";
import { useExpense } from "../contexts/ExpenseContext";
import ExpenseHeader from "../components/expenses/ExpenseHeader";
import ExpenseFooter from "../components/expenses/ExpenseFooter";
import ExpenseItemCard from "../components/expenses/ExpenseItemCard";
import ExpenseViewCard from "../components/expenses/ExpenseViewCard";
import ParticipantsGrid from "../components/expenses/ParticipantsGrid";

const SPLIT_TOLERANCE = 0.01;

const AddExpenseScreenContent = ({ route, navigation }) => {
  const { expense, isNewExpense = false } = route.params || {};
  const isEditing = !!expense && !isNewExpense;
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);

  const { state, actions, total } = useExpense();

  const [editingItems, setEditingItems] = useState(new Set());
  
  const [newlyAddedItems, setNewlyAddedItems] = useState(new Set());
  const itemSnapshotsRef = useRef(new Map());

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Edit Expense" : "Add Expense",
      tabBarStyle: { display: "none" },
    });

    if (expense && (isEditing || isNewExpense)) {
      actions.initializeFromExpense(expense, isEditing, isNewExpense);
    }
  }, [expense, isEditing, isNewExpense, navigation, actions]);

  useEffect(() => {
    if (!isEditing && state.items.length > 0) {
      setEditingItems(prev => {
        if (prev.size === 0) {
          return new Set([0]);
        }
        return prev;
      });
    }
  }, [isEditing, state.items.length]);

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

  const prepareExpenseData = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error("No user signed in");

    const userProfile = await getUserProfile(currentUser.uid);
    if (!userProfile) throw new Error("Failed to get user profile");

    const finalTitle =
      state.title.trim() || state.items[0]?.name.trim() || "Expense";

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
      expenseType: "expense",
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
        "Please select at least one person who paid for this expense"
      );
      return false;
    }
    const hasSplitMismatch = state.items.some((item) => {
      const itemTotal = parseFloat(item.amount) || 0;
      if (!(item.selectedConsumers && item.selectedConsumers.length)) return false;
      if (!item.splits || item.splits.length === 0) return itemTotal > 0;
      const totalSplits = item.splits.reduce((sum, split) => {
        if (typeof split === "object" && split !== null) {
          const amount = "amount" in split ? parseFloat(split.amount) : NaN;
          return sum + (isNaN(amount) ? 0 : amount);
        }
        const numericSplit = parseFloat(split);
        return sum + (isNaN(numericSplit) ? 0 : numericSplit);
      }, 0);
      return Math.abs(itemTotal - totalSplits) > SPLIT_TOLERANCE;
    });
    if (hasSplitMismatch) {
      Alert.alert(
        "Split Mismatch",
        "Each item's split amounts must add up to the item total before saving the expense."
      );
      return false;
    }
    return true;
  };

  const handleSaveExpense = async () => {
    if (!validateExpense()) return;

    actions.setLoading(true);
    try {
      const expenseData = await prepareExpenseData();
      const currentUser = getCurrentUser();

      if (isEditing || isNewExpense) {
        await updateExpenseParticipants(
          expense.id,
          expenseData.participants,
          currentUser.uid
        );
        const { participants, ...otherFields } = expenseData;
        await updateExpense(expense.id, otherFields, currentUser.uid);
        Alert.alert(
          "Success",
          isNewExpense
            ? "Expense created successfully"
            : "Expense updated successfully"
        );
      } else {
        await createExpense(expenseData, currentUser.uid);
        Alert.alert("Success", "Expense created successfully");
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to save expense: " + error.message);
    } finally {
      actions.setLoading(false);
    }
  };

  const calculateSettlements = async () => {
    try {
      const expenseData = await prepareExpenseData();
      const settlementResult = calculateSettlement(expenseData);
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

      if (isEditing || isNewExpense) {
        await updateExpenseParticipants(
          expense.id,
          expenseData.participants,
          currentUser.uid
        );
        const { participants, ...otherFields } = expenseData;
        await updateExpense(expense.id, otherFields, currentUser.uid);
      } else {
        await createExpense(expenseData, currentUser.uid);
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

  const handleEditItem = (index) => {
    const item = state.items[index];
    if (item && isEditing && !newlyAddedItems.has(index)) {
      itemSnapshotsRef.current.set(item.id, JSON.parse(JSON.stringify(item)));
    }
    setEditingItems(prev => new Set([...prev, index]));
  };

  const exitItemEditMode = (index, { revertChanges } = { revertChanges: false }) => {
    const currentItem = state.items[index];
    if (!currentItem) return;

    if (revertChanges) {
      const snapshot = itemSnapshotsRef.current.get(currentItem.id);
      if (snapshot) {
        const restoredItems = state.items.map((item) =>
          item.id === currentItem.id ? snapshot : item
        );
        actions.setItems(restoredItems);
      }
    }

    setEditingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });

    setNewlyAddedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });

    itemSnapshotsRef.current.delete(currentItem.id);
  };

  const handleDeleteItem = (index, skipConfirmation = false) => {
    const performDelete = async () => {
      try {
        if (isEditing && expense?.id) {
          const currentUser = getCurrentUser();
          if (!currentUser) {
            Alert.alert("Error", "User not authenticated");
            return;
          }
          
          await deleteItemFromExpense(expense.id, index, currentUser.uid);
        }
        const itemToDelete = state.items[index];
        actions.removeItem(index);
        setEditingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(index);
          return newSet;
        });
        setNewlyAddedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(index);
          return newSet;
        });
        if (itemToDelete) {
          itemSnapshotsRef.current.delete(itemToDelete.id);
        }
      } catch (error) {
        Alert.alert("Error", "Failed to delete item: " + error.message);
      }
    };

    if (skipConfirmation) {
      performDelete();
    } else {
      Alert.alert(
        "Delete Item",
        "Are you sure you want to delete this item? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete
          }
        ]
      );
    }
  };

  const handleAddItem = () => {
    const newIndex = state.items.length;
    actions.addItem();
    setEditingItems(prev => new Set([...prev, newIndex]));
    setNewlyAddedItems(prev => new Set([...prev, newIndex]));
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <View style={styles.container}>
      <ExpenseHeader
        title={state.title || (isEditing ? "Edit Expense" : "Add Expense")}
        onBackPress={() => navigation.goBack()}
        onSettingsPress={() =>
          navigation.navigate("ExpenseSettings", {
            expense: {
              id: expense?.id,
              title: state.title,
              participants: state.participants,
              items: state.items,
              fees: state.fees,
              createdBy: getCurrentUser()?.uid,
              join: { enabled: state.joinEnabled },
            },
          })
        }
        isEditing={isEditing}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 80,
            paddingBottom: 120,
          }}
        >
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
                if (
                  participant.userId &&
                  participant.userId !== getCurrentUser()?.uid
                ) {
                  navigation.navigate("FriendProfile", {
                    friendId: participant.userId,
                  });
                }
              }}
              expenseId={expense?.id}
              currentUserId={getCurrentUser()?.uid}
            />

          <Text style={styles.sectionTitle}>Items</Text>

          {state.items.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyStateIconContainer}>
                <Ionicons name="receipt-outline" size={48} color={Colors.textSecondary} />
              </View>
              <Text style={styles.emptyStateTitle}>No items yet</Text>
              <Text style={styles.emptyStateDescription}>
                Start by adding your first item to this expense
              </Text>
              
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleAddItem}
                activeOpacity={0.7}
              >
                <View style={styles.emptyStateButtonIcon}>
                  <Ionicons name="add" size={20} color={Colors.accent} />
                </View>
                <Text style={styles.emptyStateButtonText}>Add Your First Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {state.items.map((item, index) => {
                const isItemEditing = editingItems.has(index);
                const isNewlyAdded = newlyAddedItems.has(index);
                const shouldDeleteOnCancel = !isEditing || isNewlyAdded;

                if (isItemEditing) {
                  return (
                    <ExpenseItemCard
                      key={item.id}
                      item={item}
                      index={index}
                      expenseId={expense?.id}
                      isEditing={isItemEditing}
                      onCancelEdit={({ revertChanges } = { revertChanges: false }) =>
                        exitItemEditMode(index, {
                          revertChanges: shouldDeleteOnCancel ? false : revertChanges ?? false,
                        })
                      }
                      onDelete={
                        shouldDeleteOnCancel
                          ? () => handleDeleteItem(index, !isEditing || newlyAddedItems.has(index))
                          : undefined
                      }
                    />
                  );
                } else {
                  return (
                    <ExpenseViewCard
                      key={item.id}
                      item={item}
                      index={index}
                      onEdit={() => handleEditItem(index)}
                      onDelete={() => handleDeleteItem(index)}
                    />
                  );
                }
              })}

              <TouchableOpacity
                style={styles.addAnotherItemButton}
                onPress={handleAddItem}
                activeOpacity={0.7}
              >
                <View style={styles.addAnotherItemIcon}>
                  <Ionicons name="add" size={20} color={Colors.accent} />
                </View>
                <Text style={styles.addAnotherItemText}>Add Another Item</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <ExpenseFooter
          loading={state.loading}
          onSettlePress={handleSettleNow}
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
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
  emptyStateContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyStateDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent + "10",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderStyle: "dashed",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignSelf: "stretch",
    marginHorizontal: Spacing.md,
  },
  emptyStateButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  emptyStateButtonText: {
    color: Colors.accent,
    fontWeight: "600",
    fontSize: 16,
  },
  addAnotherItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent + "10",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderStyle: "dashed",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  addAnotherItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  addAnotherItemText: {
    color: Colors.accent,
    fontWeight: "600",
    fontSize: 16,
  },
});

export default AddExpenseScreenContent;
