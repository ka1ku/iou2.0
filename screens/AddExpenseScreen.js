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
import { ExpenseProvider, useExpense } from "../contexts/ExpenseContext";
import ExpenseHeader from "../components/expenses/ExpenseHeader";
import ExpenseFooter from "../components/expenses/ExpenseFooter";
import ExpenseItemCard from "../components/expenses/ExpenseItemCard";
import ExpenseViewCard from "../components/expenses/ExpenseViewCard";
import ParticipantsGrid from "../components/expenses/ParticipantsGrid";

// Internal component that uses the context
const AddExpenseScreenContent = ({ route, navigation }) => {
  const { expense, isNewExpense = false } = route.params || {};
  const isEditing = !!expense && !isNewExpense;
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);

  // Use context instead of local state
  const { state, actions, total } = useExpense();

  // Track which items are in edit mode
  const [editingItems, setEditingItems] = useState(new Set());

  // Initialize screen and load expense data
  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Edit Expense" : "Add Expense",
      tabBarStyle: { display: "none" },
    });

    // Load expense data if editing
    if (expense && (isEditing || isNewExpense)) {
      actions.initializeFromExpense(expense, isEditing, isNewExpense);
    }
  }, [expense, isEditing, isNewExpense, navigation, actions]);

  // Auto-edit the first item for new expenses
  useEffect(() => {
    if (!isEditing && state.items.length > 0) {
      // Only set the first item to edit mode if no items are currently being edited
      setEditingItems(prev => {
        if (prev.size === 0) {
          return new Set([0]); // First item (index 0) in edit mode
        }
        return prev;
      });
    }
  }, [isEditing, state.items.length]);

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

  // Helper function to prepare expense data
  const prepareExpenseData = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error("No user signed in");

    const userProfile = await getUserProfile(currentUser.uid);
    if (!userProfile) throw new Error("Failed to get user profile");

    const finalTitle =
      state.title.trim() || state.items[0]?.name.trim() || "Expense";

    const mappedParticipants = state.participants.map((p) => {
      if (p.name === "Me") {
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

  // Simplified validation
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
    return true;
  };

  // Main save function
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
      console.error("Error saving expense:", error);
      Alert.alert("Error", "Failed to save expense: " + error.message);
    } finally {
      actions.setLoading(false);
    }
  };

  // Calculate settlements
  const calculateSettlements = async () => {
    try {
      const expenseData = await prepareExpenseData();
      const settlementResult = calculateSettlement(expenseData);
      return settlementResult.settlements || [];
    } catch (error) {
      console.error("Error calculating settlements:", error);
      return [];
    }
  };

  const handleSettleNow = async () => {
    if (!validateExpense()) return;

    actions.setLoading(true);
    try {
      // Save expense first
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

      // Calculate settlements
      const settlements = await calculateSettlements();

      // Navigate to settlement screen
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
      console.error("Error saving expense before settlement:", error);
      Alert.alert("Error", "Failed to save expense: " + error.message);
    } finally {
      actions.setLoading(false);
    }
  };

  const handleEditItem = (index) => {
    setEditingItems(prev => new Set([...prev, index]));
  };

  const handleDeleteItem = (index) => {
    Alert.alert(
      "Delete Item",
      "Are you sure you want to delete this item? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // If editing an existing expense, update Firestore
              if (isEditing && expense?.id) {
                const currentUser = getCurrentUser();
                if (!currentUser) {
                  Alert.alert("Error", "User not authenticated");
                  return;
                }
                
                await deleteItemFromExpense(expense.id, index, currentUser.uid);
              }
              
              // Update local state
              actions.removeItem(index);
              setEditingItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(index);
                return newSet;
              });
            } catch (error) {
              console.error("Error deleting item:", error);
              Alert.alert("Error", "Failed to delete item: " + error.message);
            }
          }
        }
      ]
    );
  };

  // Reusable function to add a new item and set it to edit mode
  const handleAddItem = () => {
    const newIndex = state.items.length;
    actions.addItem();
    setEditingItems(prev => new Set([...prev, newIndex]));
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
              <View style={styles.memberCountBadge}>
                <Text style={styles.memberCountText}>
                  {state.participants.filter(p => p.name !== 'Me').length} {state.participants.filter(p => p.name !== 'Me').length === 1 ? 'other member' : 'other members'}
                </Text>
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

          {/* Items Section */}
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
              
              {/* Primary Add Button - Integrated in empty state */}
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleAddItem}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle" size={20} color={Colors.white} />
                <Text style={styles.emptyStateButtonText}>Add Your First Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {state.items.map((item, index) => {
                const isEditing = editingItems.has(index);

                if (isEditing) {
                  return (
                    <ExpenseItemCard
                      key={item.id}
                      item={item}
                      index={index}
                      expenseId={expense?.id}
                      isEditing={isEditing}
                      onCancelEdit={() => {
                        setEditingItems(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(index);
                          return newSet;
                        });
                      }}
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

              {/* Subtle Add Item Button - When items exist */}
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
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
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
    fontWeight: "600",
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
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
    alignSelf: "stretch",
    marginHorizontal: Spacing.md,
  },
  emptyStateButtonText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: 15,
    marginLeft: Spacing.sm,
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

// Wrapper component with provider
const AddExpenseScreen = (props) => (
  <ExpenseProvider>
    <AddExpenseScreenContent {...props} />
  </ExpenseProvider>
);

export default AddExpenseScreen;
