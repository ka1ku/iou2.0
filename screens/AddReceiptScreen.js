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
import ExpenseHeader from '../components/expenses/ExpenseHeader';
import GroupMembersModal from '../components/expenses/GroupMembersModal';
import PaidBySection from '../components/expenses/PaidBySection';
import ReceiptBreakdown from '../components/expenses/ReceiptBreakdown';
import SplitTab from '../components/expenses/SplitTab';

const SPLIT_TOLERANCE = 0.01;

const AddReceiptScreenContent = ({ route, navigation }) => {
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
  const [newlyAddedFee, setNewlyAddedFee] = useState(null);
  const [customFeeInput, setCustomFeeInput] = useState('');
  const [customFeeMode, setCustomFeeMode] = useState('percentage'); // 'percentage' or 'fixed'
  const [selectedFeeType, setSelectedFeeType] = useState('Tip'); // 'Tip', 'Tax', 'Service', 'Custom'
  const [customFeeName, setCustomFeeName] = useState('');

  // Settlement hook (lifted to screen level for lockedItemIds)
  const {
    settlements,
    handleAction: handleSettlementAction,
    handleItemToggle,
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

  // Calculate totals
  const itemsSubtotal = useMemo(
    () => state.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    [state.items]
  );

  const feesSubtotal = useMemo(
    () => state.fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0),
    [state.fees]
  );

  const calculatedTotal = itemsSubtotal + feesSubtotal;

  const handleAddItem = useCallback(() => {
    // Only add item to local state - don't persist to Firestore
    // Item will be persisted when user clicks "Save Changes"
    actions.addItem();
  }, [actions]);

  const handleUpdateItem = useCallback((index, field, value) => {
    actions.updateItem(index, { [field]: value });
  }, [actions]);

  const handleRemoveItem = useCallback(async (index) => {
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
  }, [isEditing, expense?.id, actions]);

  const handleAddFee = useCallback((feeData) => {
    actions.addFee(feeData);
  }, [actions]);

  const handleUpdateFee = useCallback((index, field, value) => {
    actions.updateFee(index, { [field]: value });
  }, [actions]);

  const handleRemoveFee = useCallback((index) => {
    actions.removeFee(index);
  }, [actions]);

  const handleCustomFeeAdd = useCallback(() => {
    const value = parseFloat(customFeeInput);
    if (!value || value <= 0) return;

    let feeName = selectedFeeType;
    if (selectedFeeType === 'Custom') {
      feeName = customFeeName.trim() || 'Fee';
    }

    let newFee;
    const feeId = Date.now().toString();
    if (customFeeMode === 'percentage') {
      const feeAmount = (itemsSubtotal * (value / 100)).toFixed(2);
      newFee = {
        id: feeId,
        name: selectedFeeType === 'Tip' ? `${value}% Tip` : `${feeName} (${value}%)`,
        amount: parseFloat(feeAmount),
        type: 'percentage',
        percentage: value / 100,
        splitType: 'proportional',
        splits: []
      };
    } else {
      newFee = {
        id: feeId,
        name: feeName,
        amount: value,
        type: 'fixed',
        splitType: 'proportional',
        splits: []
      };
    }

    // Add animation feedback
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    handleAddFee(newFee);
    
    // Clear input and highlight
    setCustomFeeInput('');
    setCustomFeeName('');
    setNewlyAddedFee(feeId);
    setTimeout(() => setNewlyAddedFee(null), 2000);
  }, [customFeeInput, selectedFeeType, customFeeName, customFeeMode, itemsSubtotal, handleAddFee]);

  // Auto-save for Fees and Payers
  useEffect(() => {
    if ((!isEditing && !isNewExpense) || !expense?.id || !isFocused) return;
    
    const timer = setTimeout(async () => {
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        // Use the common updateExpense which also recalculates settlements
        await updateExpense(expense.id, { 
          fees: state.fees,
          selectedPayers: state.selectedPayers,
          participants: state.participants,
          title: state.title,
        }, currentUser.uid);
      } catch (error) {
        console.error("Auto-save fees/payers/title failed:", error);
      }
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [state.fees, state.selectedPayers, state.participants, state.title]);



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
        "Incomplete Items",
        "Please ensure all items have a price greater than zero and at least one person assigned to split the cost."
      );
      return false;
    }
    
    // Clear any previous validation errors
    setItemValidationErrors({});
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





  useEffect(() => {
    // Tab bar hiding is handled centrally in App.js via getTabBarStyle
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

  const hasUpdatedScannedItems = useRef(false);

  useEffect(() => {
    const updateScannedItems = async () => {
      if (scannedReceipt && fromReceiptScan && !hasUpdatedScannedItems.current) {
        actions.setTitle(scannedReceipt.title || '');
        
        let formattedItems = [];
        let formattedFees = [];
        
        if (scannedReceipt.items && scannedReceipt.items.length > 0) {
          formattedItems = scannedReceipt.items.map((item, index) => ({
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
          formattedFees = scannedReceipt.fees.map((fee, index) => ({
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
        
        if (isNewExpense && expense?.id) {
          try {
            const currentUser = getCurrentUser();
            if (currentUser) {
              await updateExpense(expense.id, {
                items: formattedItems,
                fees: formattedFees,
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

  // handleSaveExpense removed - saving now handled per-item and via auto-save

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
        {/* Paid By Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionHeaderText}>PAID BY</Text>
          </View>
          <View style={styles.cardContainer}>
            <View style={styles.paidByWrapper}>
                <PaidBySection />
            </View>
          </View>
        </View>

        {/* Receipt Items Section (handled by component, acts as a section) */}
          <ReceiptBreakdown
            items={state.items}
            participants={state.participants}
            lockedItemIds={lockedItemIds}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            onSaveItem={async (index) => {
                const item = state.items[index];
                if (!item || !expense?.id) return;

                setSavingItemId(item.id);
                try {
                    const expenseData = await prepareExpenseData();
                    const participantProportions = calculateParticipantProportions(
                        expenseData.items, 
                        expenseData.participants, 
                        expenseData.fees
                    );
                    const expenseDataWithFeeSplits = applyProportionalFeeSplits(
                        expenseData, 
                        participantProportions
                    );
                    
                    const currentUser = getCurrentUser();
                    const { participants, ...otherFields } = expenseDataWithFeeSplits;
                    
                    await updateExpenseParticipants(expense.id, participants, currentUser.uid);
                    await updateExpense(expense.id, otherFields, currentUser.uid);
                } catch (error) {
                    Alert.alert("Error", "Failed to save item changes: " + error.message);
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
          />

          {/* Tips & Fees Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.sectionHeaderText}>EXTRA CHARGES</Text>
            </View>
            
            <View style={styles.cardContainer}>
                 {/* Fee Type Selector */}
                <View style={styles.feeTypeRow}>
                {['Tip', 'Tax', 'Service', 'Custom'].map((type, index) => {
                    const isSelected = selectedFeeType === type;
                    const isLast = index === 3;
                    return (
                    <TouchableOpacity
                        key={type}
                        style={[
                        styles.feeTypeButton,
                        isSelected && styles.feeTypeButtonSelected,
                        !isLast && styles.feeTypeBorderRight
                        ]}
                        onPress={() => setSelectedFeeType(type)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                        styles.feeTypeLabel,
                        isSelected && styles.feeTypeLabelSelected
                        ]}>
                        {type}
                        </Text>
                    </TouchableOpacity>
                    );
                })}
                </View>
                
                <View style={styles.separator} />

                {/* Input Area */}
                <View style={styles.inputArea}>
                    {/* Custom Name Input */}
                    {selectedFeeType === 'Custom' && (
                        <View style={styles.customNameContainer}>
                        <TextInput
                            style={styles.inlineInput}
                            placeholder="Fee Name (e.g. Corkage)"
                            placeholderTextColor={Colors.textSecondary}
                            value={customFeeName}
                            onChangeText={setCustomFeeName}
                            autoCorrect={false}
                        />
                         <View style={styles.separator} />
                        </View>
                    )}

                    <View style={styles.amountRow}>
                        <View style={styles.amountInputContainer}>
                            <Text style={styles.currencyPrefix}>
                                {customFeeMode === 'fixed' ? '$' : ''}
                            </Text>
                            <TextInput
                                style={styles.amountInput}
                                placeholder="0.00"
                                placeholderTextColor={Colors.textSecondary + '60'}
                                keyboardType="decimal-pad"
                                value={customFeeInput}
                                onChangeText={setCustomFeeInput}
                                returnKeyType="done"
                            />
                            <Text style={styles.currencySuffix}>
                                {customFeeMode === 'percentage' ? '%' : ''}
                            </Text>
                        </View>
                        
                        {/* Toggle */}
                        <View style={styles.toggleWrapper}>
                            <TouchableOpacity 
                                style={[styles.toggleOption, customFeeMode === 'fixed' && styles.toggleOptionActive]}
                                onPress={() => {
                                setCustomFeeMode('fixed');
                                setCustomFeeInput('');
                                }}
                            >
                                <Text style={[styles.toggleText, customFeeMode === 'fixed' && styles.toggleTextActive]}>$</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.toggleOption, customFeeMode === 'percentage' && styles.toggleOptionActive]}
                                onPress={() => {
                                setCustomFeeMode('percentage');
                                setCustomFeeInput('');
                                }}
                            >
                                <Text style={[styles.toggleText, customFeeMode === 'percentage' && styles.toggleTextActive]}>%</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                 <View style={styles.separator} />
                 
                <TouchableOpacity 
                    style={[
                    styles.addItemButton,
                    (!customFeeInput || parseFloat(customFeeInput) <= 0 || 
                    (selectedFeeType === 'Custom' && !customFeeName.trim())) && styles.addItemButtonDisabled
                    ]}
                    onPress={handleCustomFeeAdd}
                    disabled={!customFeeInput || parseFloat(customFeeInput) <= 0 || 
                    (selectedFeeType === 'Custom' && !customFeeName.trim())}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.addItemText, (!customFeeInput || parseFloat(customFeeInput) <= 0) && { color: Colors.textSecondary }]}>
                        Add {selectedFeeType}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Added Fees List - Outside the input card, maybe as separate small cards or rows? 
                Let's put them in a separate card if they exist, or appended to the list?
                For "Settings" look, list items usually appear in a group.
            */}
            {state.fees.length > 0 && (
              <View style={[styles.cardContainer, { marginTop: Spacing.md }]}>
                {state.fees.map((fee, index) => (
                  <View key={fee.id}>
                    <View style={[
                        styles.feeRow,
                        newlyAddedFee === fee.id && styles.feeRowHighlighted
                    ]}>
                        <View style={styles.feeInfo}>
                            <Text style={styles.feeName}>{fee.name}</Text>
                            <Text style={styles.feeSubtitle}>
                                {fee.type === 'percentage' ? `${(fee.percentage * 100).toFixed(0)}%` : 'Fixed amount'}
                            </Text>
                        </View>
                        <View style={styles.feeRight}>
                             <Text style={styles.feeAmount}>
                                +${(parseFloat(fee.amount) || 0).toFixed(2)}
                            </Text>
                            <TouchableOpacity 
                                onPress={() => handleRemoveFee(index)} 
                                style={styles.removeFeeBtn}
                            >
                                <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {index < state.fees.length - 1 && <View style={styles.separator} />}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Totals Section */}
          <View style={styles.sectionContainer}>
             <View style={styles.headerRow}>
              <Text style={styles.sectionHeaderText}>TOTALS</Text>
            </View>
            <View style={styles.cardContainer}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>${itemsSubtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.separator} />
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Fees & Tip</Text>
                    <Text style={styles.totalValue}>${feesSubtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.separator} />
                <View style={styles.totalRow}>
                    <Text style={styles.grandTotalLabel}>Total</Text>
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
              handleAction={handleSettlementAction}
              handleItemToggle={handleItemToggle}
              changeLog={expense?.changeLog}
              recalculationInfo={recalculationInfo}
              onDismissRecalculation={() => setRecalculationInfo(null)}
              onAddPeople={() => setShowMembersModal(true)}
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
      flex: 1,
      color: Colors.textPrimary,
      height: 40,
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

});

export default AddReceiptScreenContent;