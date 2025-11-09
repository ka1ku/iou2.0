import React, { useState, useEffect, useRef } from "react";

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
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Spacing, Radius, Typography } from "../design/tokens";

import { getCurrentUser } from "../services/authService";
import ChangeExpenseNameBottomSheet from "../components/ChangeExpenseNameBottomSheet";

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

  const [expenseTitle, setExpenseTitle] = useState(expense?.title || "");

  const changeExpenseNameBottomSheetRef = useRef(null);

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
          message: `Join my expense "${expenseTitle}" on IOU: ${inviteLink}`,
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
    changeExpenseNameBottomSheetRef.current?.open();
  };

  const handleSaveExpenseName = async (newName) => {
    try {
      if (!newName.trim()) {
        Alert.alert("Error", "Expense name cannot be empty");
        return;
      }

      if (newName.trim() === expense?.title) {
        changeExpenseNameBottomSheetRef.current?.close();
        return;
      }

      setLoading(true);

      await updateExpense(
        expense.id,
        {
          title: newName.trim(),
        },
        currentUser?.uid
      );

      expense.title = newName.trim();
      setExpenseTitle(newName.trim());

      changeExpenseNameBottomSheetRef.current?.close();

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
              style={[styles.settingItem, styles.settingItemLast]}
              onPress={handleChangeExpenseName}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, styles.iconContainerAccent]}>
                <Ionicons name="pencil-outline" size={20} color={Colors.accent} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Change Name</Text>
                <Text style={styles.settingDescription}>
                  {expenseTitle || "Untitled Expense"}
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
            <View style={[styles.settingItem, !joinEnabled && styles.settingItemLast]}>
              <View style={[styles.iconContainer, styles.iconContainerBlue]}>
                <Ionicons name="people-outline" size={20} color={Colors.blue} />
              </View>
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
                thumbColor={Colors.surface}
                ios_backgroundColor={Colors.border}
              />
            </View>

            {joinEnabled && joinInfo && (
              <>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleShareInviteLink}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, styles.iconContainerBlue]}>
                    <Ionicons name="share-outline" size={20} color={Colors.blue} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingText}>Share Link</Text>
                    <Text style={styles.settingDescription}>
                      Share the invite link with others
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingItem, styles.settingItemLast]}
                  onPress={handleCopyInviteLink}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, styles.iconContainerBlue]}>
                    <Ionicons name="copy-outline" size={20} color={Colors.blue} />
                  </View>
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
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <View style={styles.settingsList}>
              <TouchableOpacity
                style={[styles.settingItem, styles.settingItemLast, styles.settingItemDanger]}
                onPress={handleLeaveExpense}
                disabled={loading}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, styles.iconContainerDanger]}>
                  <Ionicons name="exit-outline" size={20} color={Colors.danger} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingText, styles.settingTextDanger]}>Leave Expense</Text>
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

      <ChangeExpenseNameBottomSheet
        ref={changeExpenseNameBottomSheetRef}
        expense={expense}
        onSave={handleSaveExpenseName}
        loading={loading}
      />
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
    paddingTop: Spacing.sm,
    paddingBottom: 100, // Extra padding for home bar area
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0,
    zIndex: 10,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
  },
  placeholder: {
    width: 40, // Same width as back button to center the title
  },
  settingsSection: {
    margin: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingLeft: Spacing.xs,
  },
  settingsList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
    minHeight: 76,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingText: {
    ...Typography.body,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    letterSpacing: 0.2,
  },
  settingDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  settingContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  iconContainerAccent: {
    backgroundColor: Colors.accent + '15',
  },
  iconContainerBlue: {
    backgroundColor: Colors.blue + '15',
  },
  iconContainerDanger: {
    backgroundColor: Colors.danger + '15',
  },
  settingItemDanger: {
    backgroundColor: Colors.danger + '05',
  },
  settingTextDanger: {
    color: Colors.danger,
  },
});

export default ExpenseSettingsScreen;
