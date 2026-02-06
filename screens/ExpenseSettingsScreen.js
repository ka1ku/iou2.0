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
import { Colors, Spacing, Radius, Typography, Shadows } from "../design/tokens";
import { getCurrentUser } from "../services/authService";
import ChangeExpenseNameBottomSheet from "../components/ChangeExpenseNameBottomSheet";
import {
  updateExpense,
  getExpenseJoinInfo,
  generateExpenseJoinLink,
} from "../services/expenseService";

const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const SettingItem = ({ 
  icon, 
  title, 
  subtitle,
  onPress, 
  showChevron = true, 
  textColor = Colors.textPrimary,
  rightElement,
  danger = false
}) => (
  <TouchableOpacity 
    style={styles.settingItem}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={!onPress}
  >
    <View style={[styles.iconContainer, danger && styles.iconContainerDanger]}>
      <Ionicons name={icon} size={20} color={danger ? Colors.danger : (Colors.textPrimary === '#FFFFFF' ? Colors.textPrimary : '#555')} />
    </View>
    <View style={styles.settingContent}>
      <Text style={[styles.settingText, { color: textColor }]} numberOfLines={1}>{title}</Text>
      {subtitle && <Text style={styles.settingSubtitle} numberOfLines={1}>{subtitle}</Text>}
    </View>
    {rightElement}
    {showChevron && !rightElement && (
      <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
    )}
  </TouchableOpacity>
);

const ExpenseSettingsScreen = ({ route, navigation }) => {
  const { expense } = route.params;
  const currentUser = getCurrentUser();
  const [joinEnabled, setJoinEnabled] = useState(expense?.join?.enabled ?? true);
  const [loading, setLoading] = useState(false);
  const [joinInfo, setJoinInfo] = useState(null);
  const [expenseTitle, setExpenseTitle] = useState(expense?.title || "");
  const changeExpenseNameBottomSheetRef = useRef(null);

  useEffect(() => {
    // Hide the default header since we use a custom one
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
        { "join.enabled": value },
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
          message: `Join my expense "${expenseTitle}" on IOU.\n\nTap to join:\n${inviteLink}`,
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
        { title: newName.trim() },
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
    } catch (e) {}

    Alert.alert(
      "Leave Expense",
      "Are you sure you want to leave this expense? You will be removed from all splits and won't be able to access it anymore.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: confirmLeaveExpense },
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

      const updatedItems = expense.items?.map((item) => {
            if (!item || !item.name) return null;
            const validSelectedConsumers = item.selectedConsumers?.filter(
                    (consumerIndex) => consumerIndex !== currentUserIndex && consumerIndex >= 0 && consumerIndex < expense.participants.length
                ).map((consumerIndex) => consumerIndex > currentUserIndex ? consumerIndex - 1 : consumerIndex)
                .filter((index) => index >= 0) || [];

            const validSplits = item.splits?.filter(
                    (split) => split.participantIndex !== currentUserIndex && split.participantIndex >= 0 && split.participantIndex < expense.participants.length
                ).map((split) => ({
                  ...split,
                  participantIndex: split.participantIndex > currentUserIndex ? split.participantIndex - 1 : split.participantIndex,
                })).filter((split) => split.participantIndex >= 0) || [];

            return { ...item, selectedConsumers: validSelectedConsumers, splits: validSplits };
          }).filter(Boolean) || [];

      const updatedFees = expense.fees?.map((fee) => {
            if (!fee || !fee.name) return null;
            const validSplits = fee.splits?.filter(
                    (split) => split.participantIndex !== currentUserIndex && split.participantIndex >= 0 && split.participantIndex < expense.participants.length
                ).map((split) => ({
                  ...split,
                  participantIndex: split.participantIndex > currentUserIndex ? split.participantIndex - 1 : split.participantIndex,
                })).filter((split) => split.participantIndex >= 0) || [];

            return { ...fee, splits: validSplits };
          }).filter(Boolean) || [];

      const updateData = {
        participants: updatedParticipants.filter((p) => p && p.name && p.userId),
        items: updatedItems.filter((item) => item && item.name && typeof item.amount === "number"),
        fees: updatedFees.filter((fee) => fee && fee.name && typeof fee.amount === "number"),
      };

      const cleanUpdateData = JSON.parse(JSON.stringify(updateData));
      await updateExpense(expense.id, cleanUpdateData, currentUser?.uid);

      Alert.alert(
        "Success",
        "You have left the expense successfully",
        [{ text: "OK", onPress: () => navigation.navigate("MainTabs") }]
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
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <SectionHeader title="Expense Name" />
        <View style={styles.sectionContainer}>
          <SettingItem 
            icon="pencil-outline" 
            title="Change Name" 
            subtitle={expenseTitle || "Untitled Expense"}
            onPress={handleChangeExpenseName} 
            rightElement={null}
          />
        </View>

        <SectionHeader title="Share Expense" />
        <View style={styles.sectionContainer}>
          <View style={styles.settingItemWithSwitch}>
            <View style={styles.iconContainer}>
              <Ionicons name="people-outline" size={20} color={Colors.textPrimary === '#FFFFFF' ? Colors.textPrimary : '#555'} />
            </View>
            <View style={styles.settingContent}>
               <Text style={styles.settingText}>Allow others to join</Text>
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
              <View style={styles.separator} />
              <SettingItem 
                icon="share-outline" 
                title="Share Link" 
                onPress={handleShareInviteLink} 
              />
              <View style={styles.separator} />
              <SettingItem 
                icon="copy-outline" 
                title="Copy Link" 
                onPress={handleCopyInviteLink} 
              />
            </>
          )}
        </View>

        {canLeaveExpense && (
          <>
            <SectionHeader title="Danger Zone" />
            <View style={styles.sectionContainer}>
                <SettingItem 
                    icon="log-out-outline" 
                    title="Leave Expense" 
                    subtitle="Remove yourself from this expense"
                    onPress={handleLeaveExpense}
                    danger
                    showChevron={false}
                />
            </View>
          </>
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionHeaderText: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.card,
    elevation: 2, 
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    minHeight: 56,
  },
  settingItemWithSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    minHeight: 56,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 16 + 32 + 12, // padding + icon width + icon margin
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm, 
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  iconContainerDanger: {
    backgroundColor: '#FFE5E5',
  },
  settingContent: {
    flex: 1,
  },
  settingText: {
    ...Typography.body1,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
  },
  settingSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rightValueText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
});

export default ExpenseSettingsScreen;
