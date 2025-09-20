import React, { useEffect, useRef } from "react";
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
} from "../services/expenseService";
import { calculateSettlement } from "../utils/settlementCalculator";
import { ExpenseProvider, useExpense } from "../contexts/ExpenseContext";
import ExpenseHeader from "../components/expenses/ExpenseHeader";
import ExpenseFooter from "../components/expenses/ExpenseFooter";
import ExpenseItemCard from "../components/expenses/ExpenseItemCard";
import ParticipantsGrid from "../components/expenses/ParticipantsGrid";

// Internal component that uses the context
const AddExpenseScreenContent = ({ route, navigation }) => {
  const { expense, isNewExpense = false } = route.params || {};
  const isEditing = !!expense && !isNewExpense;
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);

  // Use context instead of local state
  const { state, actions, total } = useExpense();

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

  const handleSettleLater = handleSaveExpense;

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
                  {state.participants.length} {state.participants.length === 1 ? 'member' : 'members'}
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

          {state.items.map((item, index) => (
            <ExpenseItemCard
              key={item.id}
              item={item}
              index={index}
              canDelete={state.items.length > 1}
            />
          ))}

          {/* Add Item Button - Below the item cards */}
          <TouchableOpacity
            style={styles.addItemButton}
            onPress={() => {
              actions.addItem();
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color={Colors.accent} />
            <Text style={styles.addItemText}>Add Item</Text>
          </TouchableOpacity>
        </ScrollView>

        <ExpenseFooter
          isEditing={isEditing}
          loading={state.loading}
          onSavePress={handleSettleLater}
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
  section: {
    backgroundColor: Colors.card,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
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


  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginVertical: Spacing.lg,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  addItemText: {
    color: Colors.accent,
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
});

// Wrapper component with provider
const AddExpenseScreen = (props) => (
  <ExpenseProvider>
    <AddExpenseScreenContent {...props} />
  </ExpenseProvider>
);

export default AddExpenseScreen;
