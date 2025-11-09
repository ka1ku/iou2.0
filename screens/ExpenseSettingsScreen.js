import React, { useState, useEffect } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Switch,
  Clipboard,
  TextInput,
  Modal,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Spacing, Radius, Shadows, Typography } from "../design/tokens";

import { getCurrentUser } from "../services/authService";
import LoadingSpinner from "../components/LoadingSpinner";

import {
  updateExpense,
  getExpenseJoinInfo,
  generateExpenseJoinLink,
  updateExpenseParticipants,
} from "../services/expenseService";

const ExpenseSettingsScreen = ({ route, navigation }) => {
  const { expense } = route.params;

  const currentUser = getCurrentUser();

  const [joinEnabled, setJoinEnabled] = useState(
    expense?.join?.enabled ?? true
  );

  const [loading, setLoading] = useState(false);

  const [joinInfo, setJoinInfo] = useState(null);

  const [showNameModal, setShowNameModal] = useState(false);

  const [newExpenseName, setNewExpenseName] = useState(expense?.title || "");

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (expense?.id) {
      loadJoinInfo();
    }
  }, [expense?.id]);

  const loadJoinInfo = async (options = { initializeIfMissing: true }) => {
    try {
      const info = await getExpenseJoinInfo(expense.id, options);

      setJoinInfo(info);
      return info;
    } catch (error) {
      return null;
    }
  };

  const handleToggleJoin = async (value) => {
    try {
      setLoading(true);

      await updateExpense(
        expense.id,
        {
          "join.enabled": value,
        },
        currentUser?.uid
      );

      setJoinEnabled(value);
    } catch (error) {

      Alert.alert("Error", "Failed to update join setting");
    } finally {
      setLoading(false);
    }
  };

  const handleShareInviteLink = async () => {
    try {
      let info = joinInfo;
      if (!info) {
        info = await loadJoinInfo({ initializeIfMissing: true });
      }

      if (info && joinEnabled && info.token && info.code) {
        const inviteLink = generateExpenseJoinLink({
          expenseId: expense.id,

          token: info.token,

          code: info.code,
        });

        await Share.share({
          message: `Join my expense "${expense.title}" on IOU: ${inviteLink}`,

          title: "Join Expense",

          url: inviteLink,
        });
      } else if (joinEnabled) {
        Alert.alert("Error", "Unable to generate invite link. Please try again.");
      }
    } catch (error) {

      Alert.alert("Error", "Failed to share invite link");
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      let info = joinInfo;
      if (!info) {
        info = await loadJoinInfo({ initializeIfMissing: true });
      }

      if (info && joinEnabled && info.token && info.code) {
        const inviteLink = generateExpenseJoinLink({
          expenseId: expense.id,

          token: info.token,

          code: info.code,
        });

        await Clipboard.setString(inviteLink);

        Alert.alert("Copied!", "Invite link copied to clipboard");
      } else if (joinEnabled) {
        Alert.alert("Error", "Unable to generate invite link. Please try again.");
      }
    } catch (error) {

      Alert.alert("Error", "Failed to copy invite link");
    }
  };

  const handleChangeExpenseName = () => {
    setNewExpenseName(expense?.title || "");

    setShowNameModal(true);
  };

  const handleSaveExpenseName = async () => {
    try {
      if (!newExpenseName.trim()) {
        Alert.alert("Error", "Expense name cannot be empty");

        return;
      }

      if (newExpenseName.trim() === expense?.title) {
        setShowNameModal(false);

        return;
      }

      setLoading(true);

      await updateExpense(
        expense.id,
        {
          title: newExpenseName.trim(),
        },
        currentUser?.uid
      );

      expense.title = newExpenseName.trim();

      setShowNameModal(false);

      Alert.alert("Success", "Expense name updated successfully");
    } catch (error) {

      Alert.alert("Error", "Failed to update expense name");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveExpense = () => {
    try {
      const currentUserIndex = expense.participants?.findIndex(
        (p) => p.userId === currentUser?.uid
      );

      if (currentUserIndex === -1) {
        Alert.alert("Error", "User not found in expense participants");
        return;
      }

      // Check if user is part of any items (selectedConsumers, splits, or paidBy)
      const isInAnyItem = (expense.items || []).some((item) => {
        if (!item) return false;
        const inSelectedConsumers = Array.isArray(item.selectedConsumers)
          ? item.selectedConsumers.includes(currentUserIndex)
          : false;
        const inSplits = Array.isArray(item.splits)
          ? item.splits.some((s) => s?.participantIndex === currentUserIndex)
          : false;
        const isPayer = typeof item.paidBy === "number" && item.paidBy === currentUserIndex;
        return inSelectedConsumers || inSplits || isPayer;
      });

      if (isInAnyItem) {
        Alert.alert(
          "Cannot Leave",
          "You can only leave this expense if you are not part of any items. Remove yourself from all items first."
        );
        return;
      }
    } catch (e) {
    }

    Alert.alert(
      "Leave Expense",

      "Are you sure you want to leave this expense? You will be removed from all splits and won't be able to access it anymore.",

      [
        {
          text: "Cancel",

          style: "cancel",
        },

        {
          text: "Leave",

          style: "destructive",

          onPress: confirmLeaveExpense,
        },
      ]
    );
  };

  const confirmLeaveExpense = async () => {
    try {
      setLoading(true);

      const currentUserIndex = expense.participants.findIndex(
        (p) => p.userId === currentUser?.uid
      );

      if (currentUserIndex === -1) {
        Alert.alert("Error", "User not found in expense participants");

        return;
      }

      const updatedParticipants = expense.participants.filter(
        (_, index) => index !== currentUserIndex
      );

      const updatedItems =
        expense.items
          ?.map((item) => {
            if (!item || !item.name) return null;

            const validSelectedConsumers =
              item.selectedConsumers
                ?.filter(
                  (consumerIndex) =>
                    consumerIndex !== currentUserIndex &&
                    consumerIndex >= 0 &&
                    consumerIndex < expense.participants.length
                )
                .map((consumerIndex) =>
                  consumerIndex > currentUserIndex
                    ? consumerIndex - 1
                    : consumerIndex
                )
                .filter((index) => index >= 0) || [];

            const validSplits =
              item.splits
                ?.filter(
                  (split) =>
                    split.participantIndex !== currentUserIndex &&
                    split.participantIndex >= 0 &&
                    split.participantIndex < expense.participants.length
                )
                .map((split) => ({
                  ...split,

                  participantIndex:
                    split.participantIndex > currentUserIndex
                      ? split.participantIndex - 1
                      : split.participantIndex,
                }))
                .filter((split) => split.participantIndex >= 0) || [];

            return {
              ...item,

              selectedConsumers: validSelectedConsumers,

              splits: validSplits,
            };
          })
          .filter(Boolean) || [];

      const updatedFees =
        expense.fees
          ?.map((fee) => {
            if (!fee || !fee.name) return null;

            const validSplits =
              fee.splits
                ?.filter(
                  (split) =>
                    split.participantIndex !== currentUserIndex &&
                    split.participantIndex >= 0 &&
                    split.participantIndex < expense.participants.length
                )
                .map((split) => ({
                  ...split,

                  participantIndex:
                    split.participantIndex > currentUserIndex
                      ? split.participantIndex - 1
                      : split.participantIndex,
                }))
                .filter((split) => split.participantIndex >= 0) || [];

            return {
              ...fee,

              splits: validSplits,
            };
          })
          .filter(Boolean) || [];

      const updateData = {
        participants: updatedParticipants.filter(
          (p) => p && p.name && p.userId
        ),

        items: updatedItems.filter(
          (item) => item && item.name && typeof item.amount === "number"
        ),

        fees: updatedFees.filter(
          (fee) => fee && fee.name && typeof fee.amount === "number"
        ),
      };

      const cleanUpdateData = JSON.parse(JSON.stringify(updateData));

      await updateExpense(expense.id, cleanUpdateData, currentUser?.uid);

      Alert.alert(
        "Success",

        "You have left the expense successfully",

        [
          {
            text: "OK",

            onPress: () => navigation.navigate("HomeMain"),
          },
        ]
      );
    } catch (error) {

      Alert.alert("Error", "Failed to leave expense");
    } finally {
      setLoading(false);
    }
  };

  const canLeaveExpense = expense?.participants?.some(
    (p) => p.userId === currentUser?.uid
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Settings</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Expense Name Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Expense Name</Text>
          <View style={styles.settingsList}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleChangeExpenseName}
              disabled={loading}
            >
              <Ionicons name="pencil-outline" size={24} color={Colors.textSecondary} />
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Change Name</Text>
                <Text style={styles.settingDescription}>
                  {expense?.title || "Untitled Expense"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Share Expense Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Share Expense</Text>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <Ionicons name="people-outline" size={24} color={Colors.textSecondary} />
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Allow others to join</Text>
                <Text style={styles.settingDescription}>
                  Let others join this expense using the invite link
                </Text>
              </View>
              <Switch
                value={joinEnabled}
                onValueChange={handleToggleJoin}
                disabled={loading}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={joinEnabled ? Colors.surface : Colors.textSecondary}
              />
            </View>

            {joinEnabled && joinInfo && (
              <>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleShareInviteLink}
                  disabled={loading}
                >
                  <Ionicons name="share-outline" size={24} color={Colors.textSecondary} />
                  <View style={styles.settingContent}>
                    <Text style={styles.settingText}>Share Link</Text>
                    <Text style={styles.settingDescription}>
                      Share the invite link with others
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleCopyInviteLink}
                  disabled={loading}
                >
                  <Ionicons name="copy-outline" size={24} color={Colors.textSecondary} />
                  <View style={styles.settingContent}>
                    <Text style={styles.settingText}>Copy Link</Text>
                    <Text style={styles.settingDescription}>
                      Copy the invite link to clipboard
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {canLeaveExpense && (
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Leave Expense</Text>
            <View style={styles.settingsList}>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={handleLeaveExpense}
                disabled={loading}
              >
                <Ionicons name="exit-outline" size={24} color={Colors.danger} />
                <View style={styles.settingContent}>
                  <Text style={styles.settingText}>Leave Expense</Text>
                  <Text style={styles.settingDescription}>
                    You will be removed from all splits and won't be able to access this expense anymore.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showNameModal}
        animationType="fade"
        transparent={true}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setShowNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="create-outline" size={32} color={Colors.accent} />
              </View>
              <Text style={styles.modalTitle}>Change Expense Name</Text>
              <Text style={styles.modalSubtitle}>
                Enter a new name for this expense
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Expense Name</Text>

              <TextInput
                style={styles.textInput}
                value={newExpenseName}
                onChangeText={setNewExpenseName}
                placeholder="Enter expense name"
                placeholderTextColor={Colors.textSecondary}
                autoFocus={true}
                maxLength={50}
                keyboardType="default"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowNameModal(false)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveExpenseName}
                disabled={loading || !newExpenseName.trim()}
                activeOpacity={0.7}
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="small" color={Colors.white} />
                    <Text style={styles.saveButtonText}>Saving...</Text>
                  </>
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for home bar area
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  placeholder: {
    width: 40, // Same width as back button to center the title
  },
  settingsSection: {
    margin: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  settingsList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  settingText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  settingDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  settingContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 380,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.accent,
    ...Shadows.card,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  inputContainer: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  textInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    fontSize: 16,
    fontWeight: '500',
    ...Shadows.button,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...Shadows.button,
  },
  cancelButton: {
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  saveButtonText: {
    ...Typography.body,
    color: Colors.surface,
    fontWeight: '600',
  },
});

export default ExpenseSettingsScreen;
