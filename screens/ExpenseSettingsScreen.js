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

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BlurView } from "expo-blur";

import { Colors, Spacing, Radius, Shadows, Typography } from "../design/tokens";

import { getCurrentUser } from "../services/authService";

import {
  updateExpense,
  getExpenseJoinInfo,
  generateExpenseJoinLink,
  updateExpenseParticipants,
} from "../services/expenseService";

const ExpenseSettingsScreen = ({ route, navigation }) => {
  const { expense } = route.params;

  const insets = useSafeAreaInsets();

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

      tabBarStyle: { display: "none" },
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
      console.error("Error loading join info:", error);
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
      console.error("Error updating join setting:", error);

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
      console.error("Error sharing invite link:", error);

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
      console.error("Error copying invite link:", error);

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

      // Update the expense object in the route params

      expense.title = newExpenseName.trim();

      setShowNameModal(false);

      Alert.alert("Success", "Expense name updated successfully");
    } catch (error) {
      console.error("Error updating expense name:", error);

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
      console.error("Error validating leave condition:", e);
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

      // Find current user's participant index

      const currentUserIndex = expense.participants.findIndex(
        (p) => p.userId === currentUser?.uid
      );

      if (currentUserIndex === -1) {
        Alert.alert("Error", "User not found in expense participants");

        return;
      }

      // Remove user from participants

      const updatedParticipants = expense.participants.filter(
        (_, index) => index !== currentUserIndex
      );

      // Update items to remove user from splits and consumers

      const updatedItems =
        expense.items
          ?.map((item) => {
            if (!item || !item.name) return null;

            // Filter out the current user from selected consumers and adjust indices

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

            // Filter out splits for the current user and adjust indices

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

      // Update fees to remove user from splits

      const updatedFees =
        expense.fees
          ?.map((fee) => {
            if (!fee || !fee.name) return null;

            // Filter out splits for the current user and adjust indices

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

      // Ensure we have valid data before updating

      const updateData = {
        participants: updatedParticipants.filter(
          (p) => p && p.name && p.userId
        ), // Filter out invalid participants

        items: updatedItems.filter(
          (item) => item && item.name && typeof item.amount === "number"
        ), // Filter out invalid items

        fees: updatedFees.filter(
          (fee) => fee && fee.name && typeof fee.amount === "number"
        ), // Filter out invalid fees
      };

      // Additional validation - ensure no undefined values exist

      const cleanUpdateData = JSON.parse(JSON.stringify(updateData));

      console.log("Update data before sending:", cleanUpdateData);

      // Update expense in Firestore with all changes at once

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
      console.error("Error leaving expense:", error);

      Alert.alert("Error", "Failed to leave expense");
    } finally {
      setLoading(false);
    }
  };

  const canLeaveExpense = expense?.participants?.some(
    (p) => p.userId === currentUser?.uid
  );

  return (
    <View style={styles.container}>
      {/* Header */}

      <BlurView
        intensity={40}
        tint="light"
        style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Expense Settings</Text>

          <Text style={styles.headerSubtitle}>
            Manage your expense preferences
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </BlurView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 100,
          paddingBottom: 120,
        }}
      >
        {/* Expense Name Section */}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Expense Name</Text>

            <View style={styles.sectionIcon}>
              <Ionicons name="pencil-outline" size={24} color={Colors.accent} />
            </View>
          </View>

          <TouchableOpacity
            style={styles.nameRow}
            onPress={handleChangeExpenseName}
            disabled={loading}
            activeOpacity={0.7}
          >
            <View style={styles.nameInfo}>
              <Text style={styles.nameTitle}>Current Name</Text>

              <Text style={styles.nameValue}>
                {expense?.title || "Untitled Expense"}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Invite Link Section */}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Share Expense</Text>

            <View style={styles.sectionIcon}>
              <Ionicons name="share-outline" size={24} color={Colors.accent} />
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Allow others to join</Text>

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
            <View style={styles.inviteSection}>
              <View style={styles.inviteActions}>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleShareInviteLink}
                  disabled={loading}
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color={Colors.surface}
                  />

                  <Text style={styles.copyButtonText}>Share Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleCopyInviteLink}
                  disabled={loading}
                >
                  <Ionicons
                    name="copy-outline"
                    size={20}
                    color={Colors.surface}
                  />

                  <Text style={styles.shareButtonText}>Copy Link</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Leave Expense Section */}

        {canLeaveExpense && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Leave Expense</Text>

              <View style={styles.sectionIcon}>
                <Ionicons name="exit-outline" size={24} color={Colors.error} />
              </View>
            </View>

            <TouchableOpacity
              style={styles.leaveButton}
              onPress={handleLeaveExpense}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Ionicons name="exit-outline" size={20} color={Colors.error} />

              <Text style={styles.leaveButtonText}>Leave Expense</Text>
            </TouchableOpacity>

            <Text style={styles.leaveDescription}>
              You will be removed from all splits and won't be able to access
              this expense anymore.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Change Expense Name Modal */}

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
                <Text style={styles.saveButtonText}>
                  {loading ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: Colors.background,
  },

  header: {
    position: "absolute",

    top: 0,

    left: 0,

    right: 0,

    zIndex: 1000,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    paddingHorizontal: Spacing.xl,

    paddingBottom: Spacing.lg,

    borderBottomWidth: 1,

    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },

  backButton: {
    width: 40,

    height: 40,

    borderRadius: Radius.md,

    backgroundColor: "rgba(255, 255, 255, 0.7)",

    justifyContent: "center",

    alignItems: "center",

    borderWidth: 1,

    borderColor: "rgba(255, 255, 255, 0.3)",
  },

  headerTitle: {
    ...Typography.h3,

    color: Colors.textPrimary,

    fontWeight: "700",

    textAlign: "center",

    marginBottom: 2,
  },

  headerSubtitle: {
    ...Typography.caption,

    color: Colors.textSecondary,

    textAlign: "center",

    opacity: 0.8,
  },

  headerContent: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",
  },

  headerSpacer: {
    width: 40,

    height: 40,
  },

  content: {
    flex: 1,

    paddingHorizontal: Spacing.xl,
  },

  section: {
    backgroundColor: Colors.card,

    marginBottom: Spacing.xl,

    padding: Spacing.lg,

    borderRadius: Radius.lg,

    ...Shadows.card,

    borderWidth: 1,

    borderColor: "rgba(218, 163, 64, 0.1)",
  },

  sectionHeader: {
    flexDirection: "row",

    alignItems: "center",

    marginBottom: Spacing.lg,

    paddingBottom: Spacing.sm,

    borderBottomWidth: 1,

    borderBottomColor: "rgba(218, 163, 64, 0.15)",
  },

  sectionTitle: {
    ...Typography.h3,

    color: Colors.textPrimary,

    flex: 1,

    fontWeight: "700",

    letterSpacing: 0.5,
  },

  sectionIcon: {
    width: 44,

    height: 44,

    borderRadius: Radius.md,

    backgroundColor: Colors.surfaceLight,

    justifyContent: "center",

    alignItems: "center",

    ...Shadows.avatar,

    borderWidth: 1,

    borderColor: "rgba(218, 163, 64, 0.2)",
  },

  settingRow: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    marginBottom: Spacing.lg,

    paddingVertical: Spacing.md,

    paddingHorizontal: Spacing.md,

    backgroundColor: Colors.surface,

    borderRadius: Radius.sm,

    ...Shadows.button,

    borderWidth: 1,

    borderColor: Colors.border,
  },

  settingInfo: {
    flex: 1,

    marginRight: Spacing.md,
  },

  settingTitle: {
    ...Typography.body1,

    color: Colors.textPrimary,

    fontWeight: "600",

    marginBottom: Spacing.xs,

    letterSpacing: 0.3,
  },

  settingDescription: {
    ...Typography.body2,

    color: Colors.textSecondary,

    lineHeight: 20,

    opacity: 0.8,
  },

  inviteSection: {
    marginTop: Spacing.lg,

    padding: Spacing.lg,

    backgroundColor: Colors.surfaceLight,

    borderRadius: Radius.lg,

    borderWidth: 1,

    borderColor: "rgba(218, 163, 64, 0.1)",

    ...Shadows.card,
  },

  inviteActions: {
    flexDirection: "row",

    gap: Spacing.sm,
  },

  copyButton: {
    flex: 1,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: Colors.accent,

    paddingVertical: Spacing.md,

    paddingHorizontal: Spacing.lg,

    borderRadius: Radius.sm,

    gap: Spacing.xs,

    ...Shadows.button,

    borderWidth: 1,

    borderColor: Colors.accentDark,

    minHeight: 44,
  },

  copyButtonText: {
    ...Typography.body2,

    color: Colors.surface,

    fontWeight: "600",

    letterSpacing: 0.2,
  },

  shareButton: {
    flex: 1,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: Colors.blue,

    paddingVertical: Spacing.md,

    paddingHorizontal: Spacing.lg,

    borderRadius: Radius.sm,

    gap: Spacing.xs,

    ...Shadows.button,

    borderWidth: 1,

    borderColor: "#3A7BD5",

    minHeight: 44,
  },

  shareButtonText: {
    ...Typography.body2,

    color: Colors.surface,

    fontWeight: "600",

    letterSpacing: 0.2,
  },

  leaveButton: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "rgba(229, 107, 111, 0.1)",

    borderWidth: 2,

    borderColor: Colors.error,

    paddingVertical: Spacing.md,

    paddingHorizontal: Spacing.lg,

    borderRadius: Radius.sm,

    gap: Spacing.xs,

    marginBottom: Spacing.lg,

    ...Shadows.button,

    minHeight: 44,
  },

  leaveButtonText: {
    ...Typography.body2,

    color: Colors.error,

    fontWeight: "600",

    letterSpacing: 0.2,
  },

  leaveDescription: {
    ...Typography.body2,

    color: Colors.textSecondary,

    textAlign: "center",

    lineHeight: 20,

    opacity: 0.8,

    paddingHorizontal: Spacing.sm,
  },

  nameRow: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    paddingVertical: Spacing.md,

    paddingHorizontal: Spacing.md,

    backgroundColor: Colors.surfaceLight,

    borderRadius: Radius.sm,

    borderWidth: 1,

    borderColor: Colors.border,

    ...Shadows.button,

    marginTop: Spacing.sm,
  },

  nameInfo: {
    flex: 1,
  },

  nameTitle: {
    ...Typography.body2,

    color: Colors.textSecondary,

    marginBottom: Spacing.xs,

    fontWeight: "600",

    letterSpacing: 0.3,
  },

  nameValue: {
    ...Typography.body1,

    color: Colors.textPrimary,

    fontWeight: "600",

    letterSpacing: 0.2,
  },

  modalOverlay: {
    flex: 1,

    backgroundColor: "rgba(0, 0, 0, 0.6)",

    justifyContent: "center",

    alignItems: "center",

    padding: Spacing.xl,
  },

  modalContent: {
    backgroundColor: Colors.surface,

    borderRadius: Radius.xl,

    padding: Spacing.xl,

    width: "100%",

    maxWidth: 400,

    ...Shadows.card,

    borderWidth: 1,

    borderColor: "rgba(218, 163, 64, 0.15)",
  },

  modalHeader: {
    alignItems: "center",

    marginBottom: Spacing.xxl,

    paddingBottom: Spacing.lg,

    borderBottomWidth: 1,

    borderBottomColor: "rgba(218, 163, 64, 0.15)",
  },

  modalTitle: {
    ...Typography.h2,

    color: Colors.textPrimary,

    marginBottom: Spacing.sm,

    textAlign: "center",

    fontWeight: "700",

    letterSpacing: 0.5,
  },

  modalSubtitle: {
    ...Typography.body1,

    color: Colors.textSecondary,

    textAlign: "center",

    opacity: 0.8,

    lineHeight: 22,
  },

  inputContainer: {
    marginBottom: Spacing.xxl,
  },

  inputLabel: {
    ...Typography.body1,

    color: Colors.textPrimary,

    marginBottom: Spacing.md,

    fontWeight: "600",

    letterSpacing: 0.3,
  },

  textInput: {
    ...Typography.body1,

    color: Colors.textPrimary,

    backgroundColor: Colors.card,

    borderWidth: 2,

    borderColor: Colors.border,

    borderRadius: Radius.md,

    paddingHorizontal: Spacing.lg,

    paddingVertical: Spacing.lg,

    fontSize: 16,

    fontWeight: "500",

    ...Shadows.button,
  },

  modalActions: {
    flexDirection: "row",

    gap: Spacing.md,
  },

  modalButton: {
    flex: 1,

    paddingVertical: Spacing.md,

    paddingHorizontal: Spacing.lg,

    borderRadius: Radius.sm,

    alignItems: "center",

    ...Shadows.button,

    minHeight: 44,
  },

  cancelButton: {
    backgroundColor: Colors.surfaceLight,

    borderWidth: 2,

    borderColor: Colors.border,
  },

  saveButton: {
    backgroundColor: Colors.accent,

    borderWidth: 2,

    borderColor: Colors.accentDark,
  },

  cancelButtonText: {
    ...Typography.body2,

    color: Colors.textSecondary,

    fontWeight: "600",

    letterSpacing: 0.2,
  },

  saveButtonText: {
    ...Typography.body2,

    color: Colors.surface,

    fontWeight: "600",

    letterSpacing: 0.2,
  },
});

export default ExpenseSettingsScreen;
