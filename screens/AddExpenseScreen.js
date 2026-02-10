import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography, Shadows } from "../design/tokens";
import { getCurrentUser } from "../services/authService";
import { getUserProfile } from "../services/friendService";
import {
  createExpense,
  updateExpense,
  updateExpenseParticipants,
  deleteItemFromExpense,
  getExpenseById,
} from "../services/expenseService";
import { useExpense } from "../contexts/ExpenseContext";
import ExpenseHeader from "../components/expenses/ExpenseHeader";
import ExpenseFooter from "../components/expenses/ExpenseFooter";
import ExpenseItemCard from "../components/expenses/ExpenseItemCard";
import ExpenseViewCard from "../components/expenses/ExpenseViewCard";
import ParticipantsGrid from "../components/expenses/ParticipantsGrid";
import GroupMembersModal from "../components/expenses/GroupMembersModal";
import SplitTab from "../components/expenses/SplitTab";
import useSettlementActions from "../hooks/useSettlementActions";
import useExpenseSnapshot from "../hooks/useExpenseSnapshot";
import { useTranslation } from '../contexts/LanguageContext';

const SPLIT_TOLERANCE = 0.01;

const AddExpenseScreenContent = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { expense: initialExpense, isNewExpense = false } = route.params || {};

  // Real-time expense snapshot listener for live updates between Split and Track tabs
  const { expense: liveExpense } = useExpenseSnapshot(initialExpense?.id);

  // Use live expense if available, otherwise fall back to initial expense
  const expense = liveExpense || initialExpense;

  const isEditing = !!expense && !isNewExpense;
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);

  const { state, actions, total } = useExpense();

  const [activeTab, setActiveTab] = useState('track');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingItems, setEditingItems] = useState(new Set());
  
  const [newlyAddedItems, setNewlyAddedItems] = useState(new Set());
  const itemSnapshotsRef = useRef(new Map());
  const itemLayoutMapRef = useRef({});
  const prevItemsLengthRef = useRef(state.items.length);
  const manualAddRef = useRef(false);

  const currentUserId = getCurrentUser()?.uid;

  // Settlement hook (lifted to screen level for lockedItemIds)
  const {
    settlements,
    handleAction: handleSettlementAction,
    handleItemToggle,
    handleBulkSettle,
    handleBulkAction,
    lockedItemIds,
    recalculationInfo,
    setRecalculationInfo,
  } = useSettlementActions({
    expense,
    participants: state.participants,
    items: state.items,
    fees: state.fees,
    total,
    title: expense?.title || state.title,
    currentUserId,
    selectedPayers: expense?.selectedPayers || state.selectedPayers,
  });

  useEffect(() => {
    // Tab bar hiding is handled centrally in App.js via getTabBarStyle
    if (expense && (isEditing || isNewExpense)) {
      actions.initializeFromExpense(expense, isEditing, isNewExpense);
    }
  }, [expense, isEditing, isNewExpense, navigation, actions]);

  useEffect(() => {
    const itemsAdded = state.items.length - prevItemsLengthRef.current;
    if (itemsAdded === 1 && manualAddRef.current) {
      const newItem = state.items[state.items.length - 1];
      if (newItem) {
        manualAddRef.current = false;
        scrollItemToTop(newItem.id, 100);
      }
    }
    prevItemsLengthRef.current = state.items.length;
  }, [state.items.length]);

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
      Alert.alert(t('common.error'), t('addExpense.validationError'));
      return false;
    }
    if (state.items.length === 0) {
      Alert.alert(t('common.error'), t('addExpense.validationError'));
      return false;
    }
    if (
      state.items.some(
        (item) => !item.name.trim() || parseFloat(item.amount) < 0
      )
    ) {
      Alert.alert(
        t('common.error'),
        t('addExpense.validationError')
      );
      return false;
    }
    if (state.fees.some((fee) => !fee.name.trim())) {
      Alert.alert(t('common.error'), t('addExpense.validation.feeNames'));
      return false;
    }
    if (!state.selectedPayers?.length) {
      Alert.alert(
        t('common.error'),
        t('addExpense.validationError')
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
        t('addExpense.validation.unevenSplitTitle'),
        t('addExpense.validation.unevenSplitMessage')
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
          t('common.success'),
          t('addExpense.saveSuccess')
        );
      } else {
        await createExpense(expenseData, currentUser.uid);
        Alert.alert(t('common.success'), t('addExpense.saveSuccess'));
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), t('addExpense.saveError') + ": " + error.message);
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
            Alert.alert(t('common.error'), t('addExpense.validation.unauthenticated'));
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
        Alert.alert(t('common.error'), t('addExpense.validation.deleteError', { error: error.message }));
      }
    };

    if (skipConfirmation) {
      performDelete();
    } else {
      Alert.alert(
        t('addExpense.deleteItemParams.title'),
        t('addExpense.deleteItemParams.message'),
        [
          { text: t('common.cancel'), style: "cancel" },
          {
            text: t('addExpense.deleteItemParams.confirm'),
            style: "destructive",
            onPress: performDelete
          }
        ]
      );
    }
  };

  const handleItemLayout = (itemId, event) => {
    itemLayoutMapRef.current[itemId] = event.nativeEvent.layout.y;
  };

  const scrollItemToTop = (itemId, delay = 0) => {
    setTimeout(() => {
      const itemY = itemLayoutMapRef.current[itemId];
      if (itemY != null && scrollViewRef?.current) {
        // padding top in ScrollView contentContainerStyle is insets.top + 156
        const visibleHeaderHeight = insets.top + 156;
        const margin = 20;
        
        const targetScrollY = Math.max(0, itemY - visibleHeaderHeight - margin);
        
        // Use the ref directly
        if (scrollViewRef.current.scrollTo) {
          scrollViewRef.current.scrollTo({ y: targetScrollY, animated: true });
        } else if (scrollViewRef.current.scrollToPosition) {
          // KeyboardAwareScrollView sometimes has different methods
          scrollViewRef.current.scrollToPosition(0, targetScrollY, true);
        }
      }
    }, delay);
  };

  const handleAddItem = () => {
    manualAddRef.current = true;
    const newIndex = state.items.length;
    actions.addItem();
    setEditingItems(prev => new Set([...prev, newIndex]));
    setNewlyAddedItems(prev => new Set([...prev, newIndex]));
  };



  return (
    <View style={styles.container}>
      <ExpenseHeader
        title={state.title || (isEditing ? t('addExpense.editExpenseTitle') : t('addExpense.addExpenseTitle'))}
        onBackPress={() => navigation.goBack()}
        onSettingsPress={() =>
          navigation.navigate("ExpenseSettings", {
            expense: {
              id: expense?.id,
              title: state.title,
              participants: state.participants,
              items: state.items,
              fees: state.fees,
              createdBy: currentUserId,
              join: { enabled: state.joinEnabled },
            },
          })
        }
        isEditing={isEditing}
        onPeoplePress={() => setShowMembersModal(true)}
        participantCount={state.participants.filter(p => p.userId !== currentUserId).length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />


      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 156, // matched with AddReceiptScreen for consistency
          paddingBottom: activeTab === 'split' ? 120 : Spacing.xl,
        }}
        bottomOffset={100}
      >
          {activeTab === 'track' && (
            <>
              {state.items.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyStateIconContainer}>
                    <Ionicons name="receipt-outline" size={48} color={Colors.textSecondary} />
                  </View>
                  <Text style={styles.emptyStateTitle}>{t('addExpense.noItemsTitle')}</Text>
                  <Text style={styles.emptyStateDescription}>
                    {t('addExpense.noItemsDesc')}
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={handleAddItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.emptyStateButtonIcon}>
                      <Ionicons name="add" size={20} color={Colors.white} />
                    </View>
                    <Text style={styles.emptyStateButtonText}>{t('addExpense.addFirstItem')}</Text>
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
                        <View key={item.id} onLayout={(e) => handleItemLayout(item.id, e)}>
                          <ExpenseItemCard
                            item={item}
                            index={index}
                            expenseId={expense?.id}
                            isEditing={isItemEditing}
                            isLocked={lockedItemIds?.has(item.id)}
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
                        </View>
                      );
                    } else {
                      return (
                        <View key={item.id} onLayout={(e) => handleItemLayout(item.id, e)}>
                          <ExpenseViewCard
                            item={item}
                            index={index}
                            isLocked={lockedItemIds?.has(item.id) || false}
                            onEdit={() => {
                              handleEditItem(index);
                              scrollItemToTop(item.id, 0);
                            }}
                            onDelete={() => handleDeleteItem(index)}
                          />
                        </View>
                      );
                    }
                  })}

                  <TouchableOpacity
                    style={styles.addAnotherItemButton}
                    onPress={handleAddItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addAnotherItemIcon}>
                      <Ionicons name="add" size={20} color={Colors.white} />
                    </View>
                    <Text style={styles.addAnotherItemText}>{t('addExpense.addAnotherItem')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {activeTab === 'split' && (
            <View style={styles.splitViewContainer}>
              <SplitTab
                settlements={settlements}
                participants={state.participants}
                currentUserId={currentUserId}
                handleAction={handleSettlementAction}
                handleItemToggle={handleItemToggle}
                handleBulkSettle={handleBulkSettle}
                handleBulkAction={handleBulkAction}
                changeLog={expense?.changeLog}
                recalculationInfo={recalculationInfo}
                onDismissRecalculation={() => setRecalculationInfo(null)}
                onAddPeople={() => setShowMembersModal(true)}
                containerStyle={{ paddingHorizontal: 0 }}
              />
            </View>
          )}
      </KeyboardAwareScrollView>

      <GroupMembersModal
        visible={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        expenseId={expense?.id}
      />
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
    paddingTop: Spacing.md,
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
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignSelf: "stretch",
    marginHorizontal: Spacing.md,
  },
  emptyStateButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
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
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderStyle: "solid",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  addAnotherItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  addAnotherItemText: {
    color: Colors.accent,
    fontWeight: "600",
    fontSize: 16,
  },
  splitViewContainer: {
    paddingTop: Spacing.sm,
  },
  emptySettlementContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  emptySettlementTitle: {
    marginTop: Spacing.md,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptySettlementText: {
    marginTop: Spacing.xs,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  sectionSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  settlementsList: {
    gap: Spacing.sm,
  },
  settlementItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.sm,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantColumn: {
    alignItems: 'center',
    width: 80,
  },
  participantAvatarContainer: {
    position: 'relative',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  participantAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarInitials: {
    color: Colors.surface,
    fontSize: Math.floor(48 / 2.5),
    fontFamily: Typography.familySemiBold,
  },
  currentUserAvatar: {
    borderColor: Colors.accent,
    borderWidth: 3,
    backgroundColor: Colors.accent,
  },
  currentUserInitials: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: Math.ceil(48 / 2.5),
  },
  participantName: {
    ...Typography.caption,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: Math.ceil(48 / 4),
    fontWeight: '500',
    maxWidth: 80,
    marginBottom: 2,
  },
  participantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: Math.ceil(48 / 5),
  },
  settlementTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
  },
  arrowLine: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.accent,
    opacity: 0.4,
    position: 'relative',
    justifyContent: 'center',
  },
  arrowLineInner: {
    height: 10,
    backgroundColor: Colors.accent,
  },
  arrowHead: {
    position: 'absolute',
    right: -12,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 24,
    borderRightWidth: 0,
    borderTopWidth: 18,
    borderBottomWidth: 18,
    borderLeftColor: Colors.accent,
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  textContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    zIndex: 1,
  },
  settlementAmount: {
    ...Typography.h3,
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 20,
    textAlign: 'center',
  },
  emptyStateIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.accent,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    zIndex: 1,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  requestPaymentButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  requestPaymentButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  requestSentButton: {
    backgroundColor: Colors.success,
    opacity: 0.8,
  },
  requestSentButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  confirmActionButton: {
    backgroundColor: Colors.success,
    opacity: 0.9,
  },
  confirmActionButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  reminderSentButton: {
    backgroundColor: Colors.accent,
    opacity: 0.85,
  },
  reminderSentButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  settledUpContainer: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  settledUpButton: {
    backgroundColor: Colors.success,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    minHeight: 44,
  },
  settledUpCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  originalButtonsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  checkmarkContainer: {
    marginRight: Spacing.xs,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settledUpText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  undoButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    minHeight: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  markAsPaidButton: {
    flex: 1,
    backgroundColor: Colors.success,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  markAsPaidButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  combinedActionContainer: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  combinedActionCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  combinedActionIcon: {
    marginRight: Spacing.xs,
  },
  combinedActionText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  combinedIconWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  // New Settlement Card Styles
  settlementCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  settlementCardSettled: {
    opacity: 0.8,
    borderColor: Colors.success + '40',
    backgroundColor: Colors.success + '05',
    borderStyle: 'dashed',
  },
  settlementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.xs,
  },
  avatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  participantNameSmall: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  directionArrowContainer: {
    paddingHorizontal: Spacing.sm,
  },
  amountDisplayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    flexDirection: 'row',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginRight: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  amountLarge: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  settledBadge: {
    position: 'absolute',
    top: -12,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    gap: 4,
  },
  settledBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  actionButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    width: '100%',
  },
  actionButtonPrimary: {
    backgroundColor: Colors.accent,
  },
  actionButtonSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  actionButtonSuccess: {
    backgroundColor: Colors.success,
  },
  actionButtonDisabled: {
    backgroundColor: Colors.surfaceLight,
    opacity: 0.7,
  },
  actionButtonTextNew: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  actionButtonTextSecondary: {
    color: Colors.textPrimary,
  },
  markAsPaidLink: {
    alignSelf: 'center',
    marginTop: Spacing.md,
  },
  markAsPaidText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  undoSettledLink: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  undoSettledText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});

export default AddExpenseScreenContent;
