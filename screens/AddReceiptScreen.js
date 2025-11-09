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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import { createExpense, updateExpense, updateExpenseParticipants, deleteItemFromExpense } from '../services/expenseService';
import { calculateSettlement, calculateSettlementWithPartialSettlements } from '../utils/settlementCalculator';
import { ExpenseProvider, useExpense } from '../contexts/ExpenseContext';
import ExpenseHeader from '../components/expenses/ExpenseHeader';
import ExpenseFooter from '../components/expenses/ExpenseFooter';
import ParticipantsGrid from '../components/expenses/ParticipantsGrid';
import PaidBySection from '../components/expenses/PaidBySection';
import ReceiptBreakdown from '../components/expenses/ReceiptBreakdown';

const SPLIT_TOLERANCE = 0.01;

const AddReceiptScreenContent = ({ route, navigation }) => {
  const { expense, scannedReceipt, fromReceiptScan, isNewExpense = false } = route.params || {};
  const isEditing = !!expense && !isNewExpense;
  const insets = useSafeAreaInsets();
  const currentUserId = getCurrentUser()?.uid || null;
  const scrollRef = useRef(null);
  const isFocused = useIsFocused();

  const { state, actions, total } = useExpense();
  
  // Validation errors state for items
  const [itemValidationErrors, setItemValidationErrors] = useState({});

  // Tips & Fees state
  const [newlyAddedFee, setNewlyAddedFee] = useState(null);
  const [customFeeInput, setCustomFeeInput] = useState('');
  const [customFeeMode, setCustomFeeMode] = useState('percentage'); // 'percentage' or 'fixed'
  const [selectedFeeType, setSelectedFeeType] = useState('Tip'); // 'Tip', 'Tax', 'Service', 'Custom'
  const [customFeeName, setCustomFeeName] = useState('');

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

  const calculateSettlements = async () => {
    try {
      const expenseData = await prepareExpenseData();
      
      const participantProportions = calculateParticipantProportions(expenseData.items, expenseData.participants, expenseData.fees);
      
      const expenseDataWithFeeSplits = applyProportionalFeeSplits(expenseData, participantProportions);

      const existingSettlements = expense?.settlements || [];
      let settlementResult;

      if (existingSettlements.length > 0) {
        settlementResult = calculateSettlementWithPartialSettlements(
          expenseDataWithFeeSplits,
          existingSettlements
        );
      } else {
        settlementResult = calculateSettlement(expenseDataWithFeeSplits);
      }

      const mappedSettlements = (settlementResult.settlements || []).map((settlement) => {
        const from = settlement.debtor || settlement.from;
        const to = settlement.creditor || settlement.to;
        const amount = settlement.amount;
        const status = settlement.status || 'noAction';
        const isPreserved = settlement.preserved === true;

        if (isPreserved) {
          const matchedExisting = existingSettlements.find(existing => {
            const existingFrom = existing.debtor || existing.from;
            const existingTo = existing.creditor || existing.to;
            const existingAmount = existing.amount;

            const roundedExisting = Math.round(existingAmount * 100) / 100;
            const roundedAmount = Math.round(amount * 100) / 100;

            return existingFrom === from &&
                   existingTo === to &&
                   roundedExisting === roundedAmount;
          });

          return {
            debtor: from,
            creditor: to,
            amount,
            status: matchedExisting?.status || status,
            updatedAt: matchedExisting?.updatedAt || new Date().toISOString(),
            associatedItems: matchedExisting?.associatedItems || [],
          };
        }

        return {
          debtor: from,
          creditor: to,
          amount,
          status,
          updatedAt: new Date().toISOString(),
          associatedItems: [],
        };
      });
      
      return mappedSettlements;
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

      const participantProportions = calculateParticipantProportions(expenseData.items, expenseData.participants, expenseData.fees);

      const expenseDataWithFeeSplits = applyProportionalFeeSplits(expenseData, participantProportions);

      if (isEditing || isNewExpense) {
        await updateExpenseParticipants(
          expense.id,
          expenseDataWithFeeSplits.participants,
          currentUser.uid
        );
        const { participants, ...otherFields } = expenseDataWithFeeSplits;
        await updateExpense(expense.id, otherFields, currentUser.uid);
      } else {
        await createExpense(expenseDataWithFeeSplits, currentUser.uid);
      }

      const settlements = await calculateSettlements();
      navigation.navigate("SettleUp", {
        expense: {
          ...expense,
          settlements: settlements,
        },
      });
    } catch (error) {
      Alert.alert("Error", "Failed to save expense: " + error.message);
    } finally {
      actions.setLoading(false);
    }
  };

  const handleSettleLater = handleSaveExpense;

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Receipt' : 'Add Receipt',
      tabBarStyle: { display: 'none' },
    });

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
        
        // Don't set participants from scanned receipt - they're incomplete
        // The expense context already creates the current user participant properly
        
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
        
        // Update Firestore with the scanned items if this is a new expense
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

  const handleSaveExpense = async () => {
    if (!validateExpense()) return;

    actions.setLoading(true);
    try {
      const expenseData = await prepareExpenseData();
      
      const participantProportions = calculateParticipantProportions(expenseData.items, expenseData.participants, expenseData.fees);
      
      const expenseDataWithFeeSplits = applyProportionalFeeSplits(expenseData, participantProportions);
      
      const currentUser = getCurrentUser();

      if (isEditing || isNewExpense) {
        await updateExpenseParticipants(
          expense.id,
          expenseDataWithFeeSplits.participants,
          currentUser.uid
        );
        const { participants, ...otherFields } = expenseDataWithFeeSplits;
        await updateExpense(expense.id, otherFields, currentUser.uid);
        Alert.alert(
          "Success",
          isNewExpense
            ? "Receipt created successfully"
            : "Receipt updated successfully"
        );
      } else {
        await createExpense(expenseDataWithFeeSplits, currentUser.uid);
        Alert.alert("Success", "Receipt created successfully");
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to save receipt: " + error.message);
    } finally {
      actions.setLoading(false);
    }
  };

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
        />
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 90, paddingBottom: 120 }}
        >
        <View style={styles.content}>
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
              if (participant.userId && participant.userId !== currentUserId) {
                navigation.navigate('FriendProfile', { friendId: participant.userId });
              }
            }}
            expenseId={expense?.id}
            currentUserId={currentUserId}
          />

          <PaidBySection />
          </View>
          <ReceiptBreakdown
            items={state.items}
            participants={state.participants}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
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
          />

          {/* Tips & Fees Section */}
          <View style={styles.addFeesSection}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="cash-outline" size={20} color={Colors.accent} />
              <Text style={styles.addFeesTitle}>Add Tips & Fees</Text>
            </View>
            
            {/* Unified Custom Fee/Tip Input */}
            <View style={styles.customFeeContainer}>
              <Text style={styles.sectionLabel}>Add Custom Fee or Tip</Text>
              
              {/* Fee Type Selector */}
              <View style={styles.feeTypeSelector}>
                {['Tip', 'Tax', 'Service', 'Custom'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.feeTypeChip,
                      selectedFeeType === type && styles.feeTypeChipSelected
                    ]}
                    onPress={() => setSelectedFeeType(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.feeTypeChipText,
                      selectedFeeType === type && styles.feeTypeChipTextSelected
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Name Input (only for Custom type) */}
              {selectedFeeType === 'Custom' && (
                <TextInput
                  style={styles.customNameInput}
                  placeholder="Fee name (e.g., Corkage)"
                  placeholderTextColor="#B8B8B8"
                  value={customFeeName}
                  onChangeText={setCustomFeeName}
                  returnKeyType="next"
                  keyboardType="default"
                  autoCorrect={false}
                />
              )}

              {/* Amount Input Row */}
              <View style={styles.customFeeRow}>
                <View style={styles.customFeeInputWrapper}>
                  <Text style={styles.customFeePrefix}>
                    {customFeeMode === 'percentage' ? '' : '$'}
                  </Text>
                  <TextInput
                    style={styles.customFeeInput}
                    placeholder={customFeeMode === 'percentage' ? '10' : '5.00'}
                    placeholderTextColor="#B8B8B8"
                    keyboardType="decimal-pad"
                    value={customFeeInput}
                    onChangeText={setCustomFeeInput}
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                  <Text style={styles.customFeeSuffix}>
                    {customFeeMode === 'percentage' ? '%' : ''}
                  </Text>
                </View>
                
                <View style={styles.modeSwitchContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.modeSwitchOption,
                      customFeeMode === 'percentage' && styles.modeSwitchOptionActive
                    ]}
                    onPress={() => {
                      setCustomFeeMode('percentage');
                      setCustomFeeInput('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modeSwitchLabel,
                      customFeeMode === 'percentage' && styles.modeSwitchLabelActive
                    ]}>
                      %
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.modeSwitchOption,
                      customFeeMode === 'fixed' && styles.modeSwitchOptionActive
                    ]}
                    onPress={() => {
                      setCustomFeeMode('fixed');
                      setCustomFeeInput('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modeSwitchLabel,
                      customFeeMode === 'fixed' && styles.modeSwitchLabelActive
                    ]}>
                      $
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity 
                  style={[
                    styles.addCustomButton,
                    (!customFeeInput || parseFloat(customFeeInput) <= 0 || 
                    (selectedFeeType === 'Custom' && !customFeeName.trim())) && styles.addCustomButtonDisabled
                  ]}
                  onPress={handleCustomFeeAdd}
                  disabled={!customFeeInput || parseFloat(customFeeInput) <= 0 || 
                    (selectedFeeType === 'Custom' && !customFeeName.trim())}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Added Fees List */}
            {state.fees.length > 0 && (
              <View style={styles.addedFeesContainer}>
                <Text style={styles.sectionLabel}>Current Fees & Tips</Text>
                {state.fees.map((fee, index) => (
                  <View key={fee.id} style={[
                    styles.compactFeeItem,
                    newlyAddedFee === fee.id && styles.compactFeeItemHighlighted
                  ]}>
                    <View style={styles.compactFeeLeft}>
                      <Ionicons 
                        name={fee.type === 'percentage' ? 'cash-outline' : 'receipt-outline'} 
                        size={16} 
                        color={fee.type === 'percentage' ? Colors.accent : Colors.textSecondary} 
                      />
                      <Text style={styles.compactFeeName}>
                        {fee.name}
                      </Text>
                    </View>
                    <View style={styles.compactFeeRight}>
                      <Text style={styles.compactFeeAmount}>
                        ${(parseFloat(fee.amount) || 0).toFixed(2)}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => handleRemoveFee(index)} 
                        style={styles.compactFeeRemove}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle-outline" size={20} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Totals Section */}
          <View style={styles.totalsContainer}>
            <View style={styles.lineItem}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.fillerDots} numberOfLines={1}>..................................................................................................</Text>
              <Text style={styles.totalValue}>${itemsSubtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.lineItem}>
              <Text style={styles.totalLabel}>Fees & Tip</Text>
              <Text style={styles.fillerDots} numberOfLines={1}>..................................................................................................</Text>
              <Text style={styles.totalValue}>${feesSubtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.grandTotalLine}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.fillerDots} numberOfLines={1}>..................................................................................................</Text>
              <Text style={styles.grandTotalValue}>${calculatedTotal.toFixed(2)}</Text>
            </View>
          </View>

        </ScrollView>

        <ExpenseFooter
          isEditing={isEditing}
          loading={state.loading}
          onSavePress={handleSettleLater}
          onSettlePress={handleSettleNow}
          saveButtonText={isEditing ? 'Update Receipt' : 'Save Receipt'}
          settleButtonText={isEditing ? 'Update & Settle' : 'Settle Now'}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
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
  // Tips & Fees Section Styles
  addFeesSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addFeesTitle: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontFamily: Typography.familySemiBold,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customFeeContainer: {
    marginBottom: Spacing.sm,
  },
  feeTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  feeTypeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.divider,
  },
  feeTypeChipSelected: {
    backgroundColor: `${Colors.accent}20`,
    borderColor: Colors.accent,
  },
  feeTypeChipText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontFamily: Typography.familySemiBold,
  },
  feeTypeChipTextSelected: {
    color: Colors.accent,
    fontFamily: Typography.familyBold,
  },
  customNameInput: {
    ...Typography.body1,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.familyMedium,
    marginBottom: Spacing.md,
  },
  customFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customFeeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  customFeePrefix: {
    ...Typography.body1,
    color: '#B8B8B8',
    fontFamily: Typography.familySemiBold,
    marginRight: Spacing.xs,
  },
  customFeeInput: {
    ...Typography.body1,
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    padding: 0,
    minHeight: 24,
  },
  customFeeSuffix: {
    ...Typography.body1,
    color: '#B8B8B8',
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.xs,
  },
  modeSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: 2,
  },
  modeSwitchOption: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
  },
  modeSwitchOptionActive: {
    backgroundColor: Colors.accent,
  },
  modeSwitchLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Typography.familyBold,
  },
  modeSwitchLabelActive: {
    color: Colors.white,
  },
  addCustomButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
  },
  addCustomButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    opacity: 0.4,
  },
  addedFeesContainer: {
    marginTop: Spacing.sm,
  },
  compactFeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  compactFeeItemHighlighted: {
    borderColor: Colors.accent,
    backgroundColor: `${Colors.accent}15`,
    borderWidth: 1.5,
  },
  compactFeeLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactFeeName: {
    ...Typography.body1,
    color: Colors.textPrimary,
    flex: 1,
    fontFamily: Typography.familySemiBold,
  },
  compactFeeAmount: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    minWidth: 80,
    maxWidth: 120,
    textAlign: 'right',
  },
  compactFeeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactFeeRemove: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
    flexShrink: 0,
  },
  // Totals Section Styles
  totalsContainer: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  totalLabel: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  fillerDots: {
    ...Typography.body1,
    color: Colors.divider,
    flex: 1,
    textAlign: 'right',
    marginHorizontal: Spacing.sm,
  },
  totalValue: {
    ...Typography.body1,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
  },
  grandTotalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 2,
    borderColor: Colors.divider,
  },
  grandTotalLabel: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontFamily: Typography.familyBold,
  },
  grandTotalValue: {
    ...Typography.title,
    color: Colors.accent,
    fontFamily: Typography.familyBold,
  },
});

const AddReceiptScreen = AddReceiptScreenContent;

export default AddReceiptScreen;