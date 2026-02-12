import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  LayoutAnimation,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import { createExpense, updateExpense, updateExpenseParticipants, deleteItemFromExpense } from '../services/expenseService';
import { ExpenseProvider, useExpense } from '../contexts/ExpenseContext';
import useSettlementActions from '../hooks/useSettlementActions';
import useExpenseSnapshot from '../hooks/useExpenseSnapshot';
import useExpenseInitSync from '../hooks/useExpenseInitSync';
import ExpenseHeader from '../components/expenses/ExpenseHeader';
import GroupMembersModal from '../components/expenses/GroupMembersModal';
import PaidBySection from '../components/expenses/PaidBySection';
import ReceiptBreakdown from '../components/expenses/ReceiptBreakdown';
import SplitTab from '../components/expenses/SplitTab';

import { useTranslation } from '../contexts/LanguageContext';

const SPLIT_TOLERANCE = 0.01;

const AddReceiptScreenContent = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { expense: initialExpense, scannedReceipt, fromReceiptScan, isNewExpense = false } = route.params || {};

  // Real-time expense snapshot listener for live updates between Split and Track tabs
  const { expense: liveExpense } = useExpenseSnapshot(initialExpense?.id);

  // Use live expense if available, otherwise fall back to initial expense
  const expense = liveExpense || initialExpense;


  const isEditing = !!expense && !isNewExpense;
  const insets = useSafeAreaInsets();
  const currentUserId = getCurrentUser()?.uid || null;
  const scrollRef = useRef(null);
  const isFocused = useIsFocused();

  const { state, actions, total } = useExpense();

  // Active tab state
  const [activeTab, setActiveTab] = useState('track');
  const [showMembersModal, setShowMembersModal] = useState(false);

  // Validation errors state for items
  const [itemValidationErrors, setItemValidationErrors] = useState({});
  const [savingItemId, setSavingItemId] = useState(null);

  // Tips & Fees state
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
    items: state.items, // Items now include fees
    total,
    title: expense?.title || state.title,
    currentUserId,
    selectedPayers: expense?.selectedPayers || state.selectedPayers,
  });

  // Wrap settlement actions with validation
  const handleSettlementActionWithValidation = useCallback(async (type, settlement, customAmount) => {
    // Only validate for settlement actions (markAsPaid, etc.), not for undo actions
    const SETTLEMENT_ACTIONS = ['markAsPaid', 'makePayment', 'requestPayment'];

    if (SETTLEMENT_ACTIONS.includes(type)) {
      if (!validateForSettlement()) {
        return; // Validation failed, don't proceed
      }
    }

    // Validation passed or it's an undo action, proceed with the action
    return handleSettlementAction(type, settlement, customAmount);
  }, [handleSettlementAction, validateForSettlement]);

  // Calculate totals
  const { itemsSubtotal, fees, calculatedTotal } = useMemo(() => {
    const regularItems = state.items.filter(item => !item.isExtraFee);
    const feeItems = state.items.filter(item => item.isExtraFee);

    const subtotal = regularItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const feesTotal = feeItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    return {
      itemsSubtotal: subtotal,
      fees: feeItems,
      calculatedTotal: subtotal + feesTotal
    };
  }, [state.items]);

  const handleAddItem = useCallback(() => {
    // Only add item to local state - don't persist to Firestore
    // Item will be persisted when user clicks "Save Changes"
    actions.addItem();
  }, [actions]);

  const handleUpdateItem = useCallback((index, field, value) => {
    actions.updateItem(index, { [field]: value });
  }, [actions]);

  const handleRemoveItem = useCallback((index) => {
    Alert.alert(
      t('addExpense.deleteItemParams.title'),
      t('addExpense.deleteItemParams.message'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('addExpense.deleteItemParams.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (isEditing && expense?.id) {
                const currentUser = getCurrentUser();
                if (!currentUser) {
                  Alert.alert(t('common.error'), t('addExpense.validation.unauthenticated'));
                  return;
                }

                await deleteItemFromExpense(expense.id, index, currentUser.uid);
              }

              actions.removeItem(index);
            } catch (error) {
              Alert.alert(t('common.error'), t('addExpense.validation.deleteError', { error: error.message }));
            }
          },
        },
      ]
    );
  }, [isEditing, expense?.id, actions, t]);

  const handleToggleParticipant = useCallback(async (itemIndex, participantIndex) => {
    const item = state.items[itemIndex];
    if (!item || !expense?.id) return;

    // Calculate new consumers array
    const currentConsumers = item.selectedConsumers || [];
    const isSelected = currentConsumers.includes(participantIndex);
    const newConsumers = isSelected
      ? currentConsumers.filter(i => i !== participantIndex)
      : [...currentConsumers, participantIndex];

    // Store original consumers for rollback
    const originalConsumers = [...currentConsumers];

    // Optimistic update - update local state immediately
    actions.updateItem(itemIndex, { selectedConsumers: newConsumers });

    // Save to Firestore (reuse existing onSaveItem logic)
    try {
      const expenseData = await prepareExpenseData();

      // Update the specific item with the new consumers
      expenseData.items[itemIndex].selectedConsumers = newConsumers;

      const currentUser = getCurrentUser();
      const { participants, ...otherFields } = expenseData;

      await updateExpenseParticipants(expense.id, participants, currentUser.uid);
      await updateExpense(expense.id, otherFields, currentUser.uid);

      // Success haptic feedback is handled in ReceiptBreakdown
    } catch (error) {
      console.error('Failed to toggle participant:', error);

      // Rollback optimistic update on error
      actions.updateItem(itemIndex, { selectedConsumers: originalConsumers });

      Alert.alert(t('common.error'), 'Failed to update split. Please try again.');
      throw error; // Re-throw so ReceiptBreakdown knows it failed
    }
  }, [state.items, expense?.id, actions, prepareExpenseData, t]);

  const handleTogglePayer = useCallback(async (participantIndex) => {
    if (!expense?.id) return;

    try {
      const currentUser = getCurrentUser();
      if (!currentUser) throw new Error('Not authenticated');

      // Single selection only - always set to the clicked participant
      const newPayers = [participantIndex];

      // Update Firestore directly - snapshot listener will update UI
      await updateExpense(expense.id, {
        selectedPayers: newPayers,
      }, currentUser.uid);

      // Success haptic
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Failed to toggle payer:', error);
      Alert.alert('Error', 'Failed to update payer. Please try again.');
    }
  }, [expense?.id]);

  const prepareExpenseData = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error(t('setupExpense.errors.noUser'));

    const userProfile = await getUserProfile(currentUser.uid);
    if (!userProfile) throw new Error(t('setupExpense.errors.profileError'));

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
        isExtraFee: item.isExtraFee || false, // Preserve isExtraFee flag
      })),
      fees: [], // Receipts: fees are items with isExtraFee, not a separate array
      selectedPayers: state.selectedPayers || [0],
      join: { enabled: state.joinEnabled },
    };
  };

  // Validate that everything is ready for settlement
  const validateForSettlement = () => {
    // Check if there's a payer
    if (!state.selectedPayers?.length) {
      Alert.alert(
        'Cannot Settle',
        'Please select who paid for this receipt before settling.'
      );
      return false;
    }

    // Check if all items are assigned
    const unassignedItems = state.items.filter(
      item => !item.selectedConsumers || item.selectedConsumers.length === 0
    );

    if (unassignedItems.length > 0) {
      Alert.alert(
        'Cannot Settle',
        `${unassignedItems.length} item${unassignedItems.length > 1 ? 's are' : ' is'} not assigned to anyone. Please assign all items before settling.\n\nUnassigned:\n${unassignedItems.map(i => `• ${i.name}`).join('\n')}`
      );
      return false;
    }

    // Check if all items have valid amounts
    const invalidItems = state.items.filter(
      item => !item.amount || parseFloat(item.amount) <= 0
    );

    if (invalidItems.length > 0) {
      Alert.alert(
        'Cannot Settle',
        'All items must have a valid price greater than $0.00'
      );
      return false;
    }

    return true;
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
    if (!state.selectedPayers?.length) {
      Alert.alert(
        t('common.error'),
        t('addExpense.validationError')
      );
      return false;
    }

    // Check for items with no assigned people or zero price
    const errors = {};
    let hasErrors = false;

    state.items.forEach((item, index) => {
      const itemErrors = {};

      // Check if item has zero or negative price
      const amount = parseFloat(item.amount);
      if (!amount || amount <= 0 || isNaN(amount)) {
        itemErrors.amount = true;
        hasErrors = true;
      }

      // Check if item has no assigned consumers
      if (!item.selectedConsumers || item.selectedConsumers.length === 0) {
        itemErrors.consumers = true;
        hasErrors = true;
      }

      if (Object.keys(itemErrors).length > 0) {
        errors[item.id] = itemErrors;
      }
    });

    if (hasErrors) {
      setItemValidationErrors(errors);
      Alert.alert(
        t('addReceipt.incompleteItems'),
        t('addReceipt.incompleteItemsDesc')
      );
      return false;
    }

    // Clear any previous validation errors
    setItemValidationErrors({});
    return true;
  };

  useExpenseInitSync({
    expense,
    isEditing,
    isNewExpense,
    state,
    actions,
    skipSync: !!savingItemId,
  });

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

  const hasUpdatedScannedItems = useRef(false);

  useEffect(() => {
    const updateScannedItems = async () => {
      if (scannedReceipt && fromReceiptScan && !hasUpdatedScannedItems.current) {
        actions.setTitle(scannedReceipt.title || '');

        // All items including fees (fees have isExtraFee: true)
        let formattedItems = [];
        if (scannedReceipt.items && scannedReceipt.items.length > 0) {
          formattedItems = scannedReceipt.items.map((item, index) => ({
            id: Date.now().toString() + index,
            name: item.name || '',
            amount: parseFloat(item.amount) || 0,
            selectedConsumers: [],
            selectedPayers: [0],
            splits: [],
            isExtraFee: item.isExtraFee || false // Preserve the isExtraFee flag from scanner
          }));
          actions.setItems(formattedItems);
        }

        actions.setSelectedPayers([0]);

        if (isNewExpense && expense?.id) {
          try {
            const currentUser = getCurrentUser();
            if (currentUser) {
              await updateExpense(expense.id, {
                items: formattedItems, // Use formatted items directly, not state
                title: scannedReceipt.title || ''
              }, currentUser.uid);
              hasUpdatedScannedItems.current = true;
            }
          } catch (error) {
            console.error('Failed to update scanned items in Firestore:', error);
          }
        }
      }
    };

    updateScannedItems();
  }, [scannedReceipt, fromReceiptScan, isNewExpense, expense?.id, actions]);



  // Check if ANYTHING is settled - if so, lock EVERYTHING
  const isSettled = useMemo(() => {
    const hasSettled = settlements.some(s =>
      ['markedAsPaid', 'confirmed', 'complete', 'partial'].includes(s.status) ||
      (s.settledAmount && s.settledAmount > 0)
    );

    // Enhanced debug logging
    console.log('[AddReceiptScreen] isSettled check:', {
      settlementsCount: settlements.length,
      settlements: settlements.map(s => ({
        from: s.from,
        to: s.to,
        status: s.status,
        settledAmount: s.settledAmount,
        amount: s.amount,
      })),
      hasSettled,
    });

    return hasSettled;
  }, [settlements]);

  return (
    <View style={styles.container}>
      <ExpenseHeader
        title={state.title || (isEditing ? t('addReceipt.editReceiptTitle') : t('addReceipt.addReceiptTitle'))}
        onBackPress={() => navigation.goBack()}
        onSettingsPress={() => navigation.navigate('ExpenseSettings', {
          expense: {
            id: expense?.id,
            title: state.title,
            participants: state.participants,
            items: state.items, // Items now include fees with isExtraFee flag
            createdBy: getCurrentUser()?.uid,
            join: { enabled: state.joinEnabled }
          }
        })}
        isEditing={isEditing}
        onPeoplePress={() => setShowMembersModal(true)}
        participantCount={state.participants.filter(p => p.userId !== currentUserId).length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 156,
            paddingBottom: activeTab === 'split' ? 120 : 120
          }}
        >

          {activeTab === 'track' && (
            <>
              {/* Settlement Warning Banner */}
              {isSettled && (
                <View style={styles.warningBanner}>
                  <Ionicons name="lock-closed" size={20} color={Colors.warning} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <Text style={styles.warningBannerTitle}>Receipt Is Settled</Text>
                    <Text style={styles.warningBannerText}>
                      This receipt has been settled. No items or fees can be added or modified. To make changes, go to Split tab and unsettle first.
                    </Text>
                  </View>
                </View>
              )}

              {/* Paid By Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.headerRow}>
                  <Text style={styles.sectionHeaderText}>{t('addReceipt.paidBy')}</Text>
                  {isSettled && (
                    <Text style={{ fontSize: 12, color: Colors.textSecondary, marginLeft: 8 }}>
                      (Settled - cannot change)
                    </Text>
                  )}
                </View>
                <View style={styles.cardContainer}>
                  <View style={styles.paidByWrapper}>
                    <PaidBySection disabled={isSettled} onTogglePayer={handleTogglePayer} />
                  </View>
                </View>
              </View>

              {/* Receipt Items Section (handled by component, acts as a section) */}
              <View onLayout={(e) => {
                if (scrollRef.current) {
                  scrollRef.current.receiptContainerY = e.nativeEvent.layout.y;
                }
              }}>
                <ReceiptBreakdown
                  items={state.items}
                  participants={state.participants}
                  lockedItemIds={lockedItemIds}
                  isSettled={isSettled}
                  onAddItem={handleAddItem}
                  onUpdateItem={handleUpdateItem}
                  onRemoveItem={handleRemoveItem}
                  onSaveItem={async (index) => {
                    const item = state.items[index];
                    if (!item || !expense?.id) return;

                    setSavingItemId(item.id);
                    try {
                      const expenseData = await prepareExpenseData();

                      const currentUser = getCurrentUser();
                      const { participants, ...otherFields } = expenseData;

                      await updateExpenseParticipants(expense.id, participants, currentUser.uid);
                      await updateExpense(expense.id, otherFields, currentUser.uid);
                    } catch (error) {
                      Alert.alert(t('common.error'), t('components.expenses.expenseItemCard.alerts.saveError', { error: error.message }));
                    } finally {
                      setSavingItemId(null);
                    }
                  }}
                  isSavingItemId={savingItemId}
                  scrollRef={scrollRef}
                  isFocused={isFocused}
                  validationErrors={itemValidationErrors}
                  onClearValidationError={(itemId, field) => {
                    setItemValidationErrors(prev => {
                      const newErrors = { ...prev };
                      if (newErrors[itemId]) {
                        const itemErrors = { ...newErrors[itemId] };
                        delete itemErrors[field];
                        if (Object.keys(itemErrors).length === 0) {
                          delete newErrors[itemId];
                        } else {
                          newErrors[itemId] = itemErrors;
                        }
                      }
                      return newErrors;
                    });
                  }}
                  visibleHeaderHeight={insets.top + 156}
                  onToggleParticipant={handleToggleParticipant}
                />
              </View>

              {/* Totals Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.headerRow}>
                  <Text style={styles.sectionHeaderText}>{t('addReceipt.totals')}</Text>
                </View>
                <View style={styles.cardContainer}>
                  {/* Subtotal (regular items) */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t('addReceipt.subtotal') || 'Subtotal'}</Text>
                    <Text style={styles.totalValue}>${itemsSubtotal.toFixed(2)}</Text>
                  </View>

                  {/* Fees */}
                  {fees.map((fee, index) => (
                    <View key={fee.id || index} style={styles.totalRow}>
                      <Text style={styles.totalLabel}>{fee.name}</Text>
                      <Text style={styles.totalValue}>${(parseFloat(fee.amount) || 0).toFixed(2)}</Text>
                    </View>
                  ))}

                  {/* Separator before total if there are fees */}
                  {fees.length > 0 && <View style={styles.separator} />}

                  {/* Grand Total */}
                  <View style={styles.totalRow}>
                    <Text style={styles.grandTotalLabel}>{t('addReceipt.total')}</Text>
                    <Text style={styles.grandTotalValue}>${calculatedTotal.toFixed(2)}</Text>
                  </View>
                </View>
              </View>

            </>
          )}

          {activeTab === 'split' && (
            <View style={styles.splitViewContainer}>
              <SplitTab
                settlements={settlements}
                participants={state.participants}
                currentUserId={currentUserId}
                handleAction={handleSettlementActionWithValidation}
                handleItemToggle={handleItemToggle}
                handleBulkSettle={handleBulkSettle}
                handleBulkAction={handleBulkAction}
                changeLog={expense?.changeLog}
                recalculationInfo={recalculationInfo}
                onDismissRecalculation={() => setRecalculationInfo(null)}
                onAddPeople={() => setShowMembersModal(true)}
                expenseType="receipt"
              />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

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
  sectionContainer: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    justifyContent: 'space-between',
  },
  sectionHeaderText: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  countText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '700',
    fontSize: 10,
  },
  cardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.card,
    elevation: 2,
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  participantsWrapper: {
    padding: Spacing.md,
  },
  paidByWrapper: {
    padding: Spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
  },

  // Fee Selector
  feeTypeRow: {
    flexDirection: 'row',
  },
  feeTypeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  feeTypeButtonSelected: {
    backgroundColor: Colors.brandLight,
  },
  feeTypeBorderRight: {
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
  },
  feeTypeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  feeTypeLabelSelected: {
    color: Colors.accent,
  },

  // Inputs
  inputArea: {
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  customNameContainer: {
    marginBottom: Spacing.md,
  },
  inlineInput: {
    ...Typography.body1,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  amountInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  currencySuffix: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  amountInput: {
    ...Typography.h3,
    color: Colors.textPrimary,
    height: 40,
    minWidth: 100,
    textAlign: 'left',
  },
  toggleWrapper: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    padding: 3,
  },
  toggleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm - 2,
  },
  toggleOptionActive: {
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  toggleText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },

  addItemButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonDisabled: {
    opacity: 0.5,
  },
  addItemText: {
    ...Typography.body1,
    color: Colors.accent,
    fontWeight: '600',
  },

  // Fee List Items
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    justifyContent: 'space-between',
  },
  feeRowHighlighted: {
    backgroundColor: Colors.brandLight,
  },
  feeInfo: {
    flex: 1,
  },
  feeName: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  feeSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  feeRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeAmount: {
    ...Typography.body1,
    fontFamily: Typography.familyBold,
    color: Colors.textPrimary,
    marginRight: Spacing.md,
  },
  removeFeeBtn: {
    padding: 4,
  },

  // Total Rows
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    minHeight: 50,
  },
  totalLabel: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  totalValue: {
    ...Typography.body1,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
  },
  grandTotalLabel: {
    ...Typography.title, // or h3
    fontSize: 18,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  grandTotalValue: {
    ...Typography.title,
    fontSize: 18,
    color: Colors.accent,
    fontWeight: '700',
  },

  // Settlement Split Tab Styles
  splitViewContainer: {
    paddingTop: Spacing.sm,
  },

  // Warning Banner Styles
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.warning + '15',
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.md,
  },
  warningBannerTitle: {
    ...Typography.body1,
    fontWeight: '600',
    color: Colors.warning,
    marginBottom: 4,
  },
  warningBannerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Add Fee Button Styles
  addFeeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent + '10',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  addFeeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  addFeeText: {
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 16,
  },

});

export default AddReceiptScreenContent;