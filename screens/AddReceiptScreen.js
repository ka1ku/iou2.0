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
  Animated,
  Easing,
  AppState,
  Linking,
  Clipboard,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import { createExpense, updateExpense, updateExpenseParticipants, deleteItemFromExpense, getExpenseById, createPaymentRequest } from '../services/expenseService';
import { calculateSettlement, calculateSettlementWithPartialSettlements } from '../utils/settlementCalculator';
import { ExpenseProvider, useExpense } from '../contexts/ExpenseContext';
import ExpenseHeader from '../components/expenses/ExpenseHeader';
import GroupMembersModal from '../components/expenses/GroupMembersModal';
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
  
  // Active tab state
  const [activeTab, setActiveTab] = useState('track');
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  // Validation errors state for items
  const [itemValidationErrors, setItemValidationErrors] = useState({});

  // Tips & Fees state
  const [newlyAddedFee, setNewlyAddedFee] = useState(null);
  const [customFeeInput, setCustomFeeInput] = useState('');
  const [customFeeMode, setCustomFeeMode] = useState('percentage'); // 'percentage' or 'fixed'
  const [selectedFeeType, setSelectedFeeType] = useState('Tip'); // 'Tip', 'Tax', 'Service', 'Custom'
  const [customFeeName, setCustomFeeName] = useState('');

  // Settlement-related state
  const [requestSentStates, setRequestSentStates] = useState({});
  const [isVenmoAppActive, setIsVenmoAppActive] = useState(false);
  const [settledStates, setSettledStates] = useState({});
  const [paymentMadeStates, setPaymentMadeStates] = useState({});
  const [reminderSentStates, setReminderSentStates] = useState({});
  const [animationStates, setAnimationStates] = useState({});
  const [settlementRecalculated, setSettlementRecalculated] = useState(false);
  const [recalculationInfo, setRecalculationInfo] = useState(null);
  const [savingItemId, setSavingItemId] = useState(null);

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

  const handleAddItem = useCallback(async () => {
    actions.addItem();
    
    if ((isEditing || isNewExpense) && expense?.id) {
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) return;

        const lastItem = state.items[state.items.length - 1];
        const payersToUse = lastItem?.selectedPayers || [0];
        const newItem = {
          id: Date.now().toString(),
          name: '',
          amount: 0,
          selectedConsumers: state.participants.map((_, i) => i),
          splits: [],
          selectedPayers: payersToUse,
        };
        
        const updatedItems = [...state.items, newItem];
        await updateExpense(expense.id, { items: updatedItems }, currentUser.uid);
      } catch (error) {
        console.error("Auto-save item add failed:", error);
      }
    }
  }, [actions, isEditing, isNewExpense, expense?.id, state.items]);

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

  // Initialize settlement states from existing settlements
  useEffect(() => {
    if (expense?.settlements && expense.settlements.length > 0) {
      const initialSettledStates = {};
      const initialRequestSentStates = {};
      const initialPaymentMadeStates = {};
      const initialReminderSentStates = {};
      expense.settlements.forEach(settlement => {
        const from = settlement.debtor || settlement.from;
        const to = settlement.creditor || settlement.to;
        const roundedAmount = Math.round(settlement.amount * 100) / 100;
        const settlementId = `${from}|||${to}|||${roundedAmount}`;
        
        if (settlement.status === 'markedAsPaid') {
          initialSettledStates[settlementId] = true;
        }
        if (settlement.status === 'paymentRequested') {
          initialRequestSentStates[settlementId] = true;
        }
        if (settlement.status === 'paymentMade') {
          initialPaymentMadeStates[settlementId] = true;
        }
        if (settlement.status === 'reminderSent') {
          initialReminderSentStates[settlementId] = true;
        }
      });
      
      setSettledStates(initialSettledStates);
      setRequestSentStates(initialRequestSentStates);
      setPaymentMadeStates(initialPaymentMadeStates);
      setReminderSentStates(initialReminderSentStates);
    }
  }, [expense?.settlements]);
  
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

  // Calculate settlements reactively when expense data changes
  const calculatedSettlements = useMemo(() => {
    try {
      // If editing and we have settlements from Firestore, use those with current state
      if (expense?.settlements && expense.settlements.length > 0) {
        return expense.settlements.map(s => ({
          from: s.debtor,
          to: s.creditor,
          amount: s.amount,
          status: s.status || 'noAction',
          debtor: s.debtor,
          creditor: s.creditor
        }));
      }
      
      // Otherwise calculate from current expense data
      const expenseData = {
        title: state.title || 'Receipt',
        total: total,
        participants: state.participants,
        items: state.items,
        fees: state.fees,
        selectedPayers: state.selectedPayers || [0],
      };
      
      const settlementResult = calculateSettlement(expenseData);
      return (settlementResult.settlements || []).map(s => ({
        from: s.from,
        to: s.to,
        amount: s.amount,
        status: 'noAction',
        debtor: s.from,
        creditor: s.to
      }));
    } catch (error) {
      console.error('Error calculating settlements:', error);
      return [];
    }
  }, [expense?.settlements, state.title, total, state.participants, state.items, state.fees, state.selectedPayers]);

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

  // Animation function for settled up state
  const animateSettledUp = useCallback((settlementId) => {
    const checkmarkScale = new Animated.Value(0);
    const checkmarkOpacity = new Animated.Value(0);
    const settledTextOpacity = new Animated.Value(0);
    const buttonCombinationScale = new Animated.Value(1);

    setAnimationStates(prev => ({
      ...prev,
      [settlementId]: {
        checkmarkScale,
        checkmarkOpacity,
        settledTextOpacity,
        buttonCombinationScale,
      }
    }));

    Animated.sequence([
      Animated.timing(buttonCombinationScale, {
        toValue: 0.95,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(buttonCombinationScale, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(checkmarkScale, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(settledTextOpacity, {
          toValue: 1,
          duration: 400,
          delay: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }, 200);
  }, []);

  const animateActionCompleted = useCallback((settlementId) => {
    const buttonCombinationScale = new Animated.Value(1);
    const checkmarkScale = new Animated.Value(0);
    const checkmarkOpacity = new Animated.Value(0);
    const settledTextOpacity = new Animated.Value(0);

    setAnimationStates(prev => ({
      ...prev,
      [settlementId]: {
        ...prev[settlementId],
        buttonCombinationScale,
        checkmarkScale,
        checkmarkOpacity,
        settledTextOpacity,
      }
    }));

    Animated.sequence([
      Animated.timing(buttonCombinationScale, {
        toValue: 0.95,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(buttonCombinationScale, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(checkmarkScale, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(settledTextOpacity, {
          toValue: 1,
          duration: 350,
          delay: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }, 150);
  }, []);

  // Helper functions
  const getSettlementKey = useCallback((settlement) => {
    const from = settlement.debtor || settlement.from;
    const to = settlement.creditor || settlement.to;
    const amount = settlement.amount;
    const roundedAmount = Math.round(amount * 100) / 100;
    return `${from}|||${to}|||${roundedAmount}`;
  }, []);

  const settlementsMatch = useCallback((settlement1, settlement2) => {
    const key1 = getSettlementKey(settlement1);
    const key2 = getSettlementKey(settlement2);
    return key1 === key2;
  }, [getSettlementKey]);

  // Update settlement status in Firestore
  const updateSettlementStatus = useCallback(async (settlementToUpdate, newStatus) => {
    try {
      if (!expense?.id) {
        console.error('[AddReceiptScreen] Expense ID is missing');
        throw new Error('Expense ID is missing');
      }

      const latestExpense = await getExpenseById(expense.id);
      if (!latestExpense) {
        throw new Error('Expense not found in Firestore');
      }
      
      const currentSettlements = latestExpense.settlements || [];
      
      let settlementFound = false;
      const updatedSettlements = currentSettlements.map((s) => {
        const matches = settlementsMatch(s, settlementToUpdate);
        
        if (matches) {
          settlementFound = true;
          return {
            ...s,
            status: newStatus,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      });

      if (!settlementFound) {
        console.error('[AddReceiptScreen] No matching settlement found');
        throw new Error('No matching settlement found');
      }

      const currentUser = getCurrentUser();
      await updateExpense(expense.id, { settlements: updatedSettlements }, currentUser?.uid);
      
    } catch (error) {
      console.error('[AddReceiptScreen] Error updating settlement status:', error);
      throw error;
    }
  }, [expense, settlementsMatch]);

  // Mark settlement as paid
  const handleMarkAsPaid = useCallback(async (settlement) => {
    const settlementId = getSettlementKey(settlement);
    
    setSettledStates(prev => ({
      ...prev,
      [settlementId]: true
    }));
    
    animateSettledUp(settlementId);
    
    try {
      await updateSettlementStatus(settlement, 'markedAsPaid');
    } catch (error) {
      console.error('[AddReceiptScreen] Failed to save settlement status:', error);
      setSettledStates(prev => ({
        ...prev,
        [settlementId]: false
      }));
      Alert.alert('Error', 'Failed to save status. Please try again.');
    }
  }, [animateSettledUp, updateSettlementStatus, getSettlementKey]);

  // Make payment via Venmo
  const handleMakePayment = async (settlement, copyToClipboard = false) => {
    try {
      const recipientParticipant = state.participants.find(p => p.name === settlement.to);
      
      if (!recipientParticipant?.userId) {
        Alert.alert('Error', 'Unable to find recipient information');
        return;
      }

      const recipientProfile = await getUserProfile(recipientParticipant.userId);
      
      if (!recipientProfile?.venmoUsername) {
        Alert.alert('Error', 'Recipient does not have a Venmo username set up');
        return;
      }
      
      const settlementId = getSettlementKey(settlement);
      setPaymentMadeStates(prev => ({
        ...prev,
        [settlementId]: true
      }));

      animateActionCompleted(settlementId);
      
      try {
        await updateSettlementStatus(settlement, 'paymentMade');
      } catch (error) {
        console.error('[AddReceiptScreen] Failed to save settlement status:', error);
        setPaymentMadeStates(prev => ({
          ...prev,
          [settlementId]: false
        }));
        setAnimationStates(prev => {
          const updated = { ...prev };
          delete updated[settlementId];
          return updated;
        });
        Alert.alert('Error', 'Failed to save status. Please try again.');
        return;
      }
      
      const amount = settlement.amount.toFixed(2);
      const note = `IOU Payment - ${state.title || 'Receipt'}`;
      const deeplink = `venmo://paycharge?txn=pay&recipients=${recipientProfile.venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;
      
      if (copyToClipboard) {
        Clipboard.setString(deeplink);
      } else {
        const supported = await Linking.canOpenURL(deeplink);
        if (supported) {
          await Linking.openURL(deeplink);
        } else {
          Alert.alert('Error', 'Venmo is not installed on this device');
        }
      }
    } catch (error) {
      console.error('[AddReceiptScreen] Error in handleMakePayment:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    }
  };

  // Request payment via Venmo
  const handleRequestPayment = async (settlement, copyToClipboard = false) => {
    try {
      const payerParticipant = state.participants.find(p => p.name === settlement.from);
      
      if (!payerParticipant?.userId) {
        Alert.alert('Error', 'Unable to find payer information');
        return;
      }

      const payerProfile = await getUserProfile(payerParticipant.userId);
      
      if (!payerProfile?.venmoUsername) {
        Alert.alert('Error', 'Payer does not have a Venmo username set up');
        return;
      }

      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to request payment');
        return;
      }

      try {
        await createPaymentRequest({
          fromUserId: currentUser.uid,
          toUserId: payerParticipant.userId,
          amount: settlement.amount,
          expenseId: expense?.id,
          expenseTitle: state.title || 'Untitled Receipt'
        });
      } catch (error) {
        console.error('[AddReceiptScreen] Failed to create payment request:', error);
      }

      const amount = settlement.amount.toFixed(2);
      const note = `IOU Payment Request - ${state.title || 'Receipt'}`;
      const deeplink = `venmo://paycharge?txn=charge&recipients=${payerProfile.venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;

      if (copyToClipboard) {
        Clipboard.setString(deeplink);
        const requestId = getSettlementKey(settlement);
        setRequestSentStates(prev => ({
          ...prev,
          [requestId]: true
        }));
        animateActionCompleted(requestId);
        
        try {
          await updateSettlementStatus(settlement, 'paymentRequested');
        } catch (error) {
          console.error('[AddReceiptScreen] Failed to save payment request status:', error);
          setRequestSentStates(prev => ({
            ...prev,
            [requestId]: false
          }));
          setAnimationStates(prev => {
            const updated = { ...prev };
            delete updated[requestId];
            return updated;
          });
        }
      } else {
        const supported = await Linking.canOpenURL(deeplink);
        if (supported) {
          setIsVenmoAppActive(true);
          const requestId = getSettlementKey(settlement);
          setRequestSentStates(prev => ({
            ...prev,
            [requestId]: false
          }));
          
          await Linking.openURL(deeplink);
        } else {
          Alert.alert('Error', 'Venmo is not installed on this device');
        }
      }
    } catch (error) {
      console.error('[AddReceiptScreen] Error in handleRequestPayment:', error);
      Alert.alert('Error', 'Failed to request payment. Please try again.');
    }
  };

  // Send reminder
  const handleSendReminder = useCallback(async (settlement) => {
    try {
      const debtorName = settlement.debtor || settlement.from;
      const creditorName = settlement.creditor || settlement.to;

      const currentUserId = getCurrentUser()?.uid;
      const currentUserParticipant = state.participants.find(p => p.userId === currentUserId);
      const name = currentUserParticipant?.name;

      if (debtorName === name || creditorName === name) {
        return;
      }

      const debtorParticipant = state.participants.find((p) => p.name === debtorName);
      const creditorParticipant = state.participants.find((p) => p.name === creditorName);

      if (!debtorParticipant || !creditorParticipant?.userId) {
        Alert.alert('Error', 'Unable to find participant information');
        return;
      }

      const creditorProfile = await getUserProfile(creditorParticipant.userId);

      if (!creditorProfile?.venmoUsername) {
        Alert.alert('Error', 'Creditor does not have a Venmo username set up');
        return;
      }

      const amount = settlement.amount.toFixed(2);
      const note = `IOU Payment - ${state.title || 'Receipt'}`;
      const venmoLink = `venmo://paycharge?txn=pay&recipients=${creditorProfile.venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;
      const expenseTitle = state.title || 'this receipt';
      const message = `${debtorName} you owe ${creditorName} $${amount} for ${expenseTitle}.\n${venmoLink}`;

      const result = await Share.share({
        title: 'Send Reminder',
        message,
        url: venmoLink,
      });

      if (result && result.action === Share.dismissedAction) {
        return;
      }

      const settlementId = getSettlementKey(settlement);
      setReminderSentStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      animateActionCompleted(settlementId);

      try {
        await updateSettlementStatus(settlement, 'reminderSent');
      } catch (statusError) {
        console.error('[AddReceiptScreen] Failed to save reminderSent status:', statusError);
        setReminderSentStates(prev => ({
          ...prev,
          [settlementId]: false
        }));
        setAnimationStates(prev => {
          const updated = { ...prev };
          delete updated[settlementId];
          return updated;
        });
        throw statusError;
      }
    } catch (error) {
      console.error('[AddReceiptScreen] Error in handleSendReminder:', error);
      Alert.alert('Error', 'Failed to share reminder. Please try again.');
    }
  }, [state.participants, state.title, getSettlementKey, updateSettlementStatus, animateActionCompleted]);

  // Confirm payment made
  const handleConfirmPaymentMade = useCallback((settlement) => {
    const settlementId = getSettlementKey(settlement);
    setRequestSentStates(prev => ({
      ...prev,
      [settlementId]: false
    }));
    handleMarkAsPaid(settlement);
  }, [getSettlementKey, handleMarkAsPaid]);

  // Confirm payment received
  const handleConfirmPaymentReceived = useCallback((settlement) => {
    const settlementId = getSettlementKey(settlement);
    setPaymentMadeStates(prev => ({
      ...prev,
      [settlementId]: false
    }));
    handleMarkAsPaid(settlement);
  }, [getSettlementKey, handleMarkAsPaid]);

  // Undo payment made
  const handleUndoPaymentMade = useCallback(async (settlement) => {
    const settlementId = getSettlementKey(settlement);
    setPaymentMadeStates(prev => ({
      ...prev,
      [settlementId]: false
    }));

    try {
      await updateSettlementStatus(settlement, 'noAction');
      setAnimationStates(prev => {
        const updated = { ...prev };
        delete updated[settlementId];
        return updated;
      });
    } catch (error) {
      console.error('[AddReceiptScreen] Failed to revert status:', error);
      setPaymentMadeStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      Alert.alert('Error', 'Failed to undo payment. Please try again.');
    }
  }, [updateSettlementStatus, getSettlementKey]);

  // Undo payment requested
  const handleUndoPaymentRequested = useCallback(async (settlement) => {
    const settlementId = getSettlementKey(settlement);
    setRequestSentStates(prev => ({
      ...prev,
      [settlementId]: false
    }));

    try {
      await updateSettlementStatus(settlement, 'noAction');
      setAnimationStates(prev => {
        const updated = { ...prev };
        delete updated[settlementId];
        return updated;
      });
    } catch (error) {
      console.error('[AddReceiptScreen] Failed to revert status:', error);
      setRequestSentStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      Alert.alert('Error', 'Failed to undo request. Please try again.');
    }
  }, [updateSettlementStatus, getSettlementKey]);

  // Undo reminder sent
  const handleUndoReminderSent = useCallback(async (settlement) => {
    const settlementId = getSettlementKey(settlement);
    setReminderSentStates(prev => ({
      ...prev,
      [settlementId]: false
    }));

    try {
      await updateSettlementStatus(settlement, 'noAction');
      setAnimationStates(prev => {
        const updated = { ...prev };
        delete updated[settlementId];
        return updated;
      });
    } catch (error) {
      console.error('[AddReceiptScreen] Failed to revert status:', error);
      setReminderSentStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      Alert.alert('Error', 'Failed to undo reminder. Please try again.');
    }
  }, [updateSettlementStatus, getSettlementKey]);

  // Undo mark as paid
  const handleUndoMarkAsPaid = useCallback(async (settlement) => {
    const settlementId = getSettlementKey(settlement);
    setSettledStates(prev => ({
      ...prev,
      [settlementId]: false
    }));

    try {
      await updateSettlementStatus(settlement, 'noAction');
      setAnimationStates(prev => {
        const updated = { ...prev };
        delete updated[settlementId];
        return updated;
      });
    } catch (error) {
      console.error('[AddReceiptScreen] Failed to revert status:', error);
      setSettledStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      Alert.alert('Error', 'Failed to undo settlement. Please try again.');
    }
  }, [updateSettlementStatus, getSettlementKey]);

  // Render settlement item (from AddExpenseScreen) - Custom UI rendering
  const renderSettlementItem = useCallback((settlement, index) => {
    const fromParticipant = state.participants.find(p => p.name === settlement.from);
    const toParticipant = state.participants.find(p => p.name === settlement.to);
    
    const settlementId = getSettlementKey(settlement);
    const requestId = settlementId;
    
    const currentUserId = getCurrentUser()?.uid;
    const currentUserParticipant = state.participants.find(p => p.userId === currentUserId);
    const name = currentUserParticipant?.name;
    
    const isDebtor = settlement.from === name;
    const isCreditor = settlement.to === name;
    const isSpectator = !isDebtor && !isCreditor;
    
    const hasRequestBeenSent = requestSentStates[requestId] === true || settlement.status === 'paymentRequested';
    const isPaymentMade = paymentMadeStates[settlementId] === true || settlement.status === 'paymentMade';
    const hasReminderBeenSent = reminderSentStates[settlementId] === true || settlement.status === 'reminderSent';
    const isSettled = settledStates[settlementId] === true || settlement.status === 'markedAsPaid';
    const animationState = animationStates[settlementId] || null;
    
    const getButtonText = () => {
      if (isDebtor) {
        return hasRequestBeenSent ? 'Confirm payment made' : 'Make Payment';
      } else if (isCreditor) {
        if (isPaymentMade) {
          return 'Confirm payment received';
        }
        return hasRequestBeenSent ? 'Request Sent' : 'Request Payment';
      } else {
        return hasReminderBeenSent ? 'Reminder Sent' : 'Send Reminder';
      }
    };
    
    const getButtonStyle = () => {
      const baseStyle = styles.requestPaymentButton;
      if ((isDebtor && hasRequestBeenSent) || (isCreditor && isPaymentMade)) {
        return [baseStyle, styles.confirmActionButton];
      }
      if (isCreditor && hasRequestBeenSent) {
        return [baseStyle, styles.requestSentButton];
      }
      if (isSpectator && hasReminderBeenSent) {
        return [baseStyle, styles.reminderSentButton];
      }
      return baseStyle;
    };
    
    const getButtonTextStyle = () => {
      const baseStyle = styles.requestPaymentButtonText;
      if ((isDebtor && hasRequestBeenSent) || (isCreditor && isPaymentMade)) {
        return [baseStyle, styles.confirmActionButtonText];
      }
      if (isCreditor && hasRequestBeenSent) {
        return [baseStyle, styles.requestSentButtonText];
      }
      if (isSpectator && hasReminderBeenSent) {
        return [baseStyle, styles.reminderSentButtonText];
      }
      return baseStyle;
    };

    let combinedState = null;
    if (isSettled) {
      combinedState = 'settled';
    } else if (isPaymentMade && isDebtor) {
      combinedState = 'paymentMade';
    } else if (hasRequestBeenSent && isCreditor) {
      combinedState = 'paymentRequested';
    } else if (isSpectator && hasReminderBeenSent) {
      combinedState = 'reminderSent';
    }

    const combinedTextMap = {
      settled: 'Settled Up',
      paymentMade: 'Payment Made',
      paymentRequested: 'Payment Requested',
      reminderSent: 'Reminder Sent'
    };

    const combinedIconMap = {
      settled: 'checkmark',
      paymentMade: 'checkmark-done',
      paymentRequested: 'paper-plane',
      reminderSent: 'notifications'
    };

    const combinedBackgroundMap = {
      settled: Colors.success,
      paymentMade: Colors.accent,
      paymentRequested: Colors.accent,
      reminderSent: Colors.accent
    };

    const combinedUndoHandlers = {
      settled: () => handleUndoMarkAsPaid(settlement),
      paymentMade: () => handleUndoPaymentMade(settlement),
      paymentRequested: () => handleUndoPaymentRequested(settlement),
      reminderSent: () => handleUndoReminderSent(settlement)
    };

    return (
      <View key={index} style={styles.settlementItem}>
        <View style={styles.settlementRow}>
          {/* Payer */}
          <View style={styles.participantColumn}>
            <View style={styles.participantAvatarContainer}>
              {fromParticipant?.profilePhoto ? (
                <Image source={{ uri: fromParticipant.profilePhoto }} style={styles.participantAvatar} contentFit="cover" transition={200} />
              ) : (
                <View style={[
                  styles.participantAvatarPlaceholder,
                  fromParticipant?.name === name && styles.currentUserAvatar
                ]}>
                  <Text style={[
                    styles.participantAvatarInitials,
                    fromParticipant?.name === name && styles.currentUserInitials
                  ]}>
                    {fromParticipant?.name === name ? 'M' : (fromParticipant?.name[0] || 'U').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.participantName} numberOfLines={1}>
              {settlement.from === name ? 'Me': settlement.from}
            </Text>
            {fromParticipant?.username && (
              <Text style={styles.participantUsername} numberOfLines={1}>
                @{fromParticipant.username}
              </Text>
            )}
          </View>

          {/* Settlement Text with Arrows */}
          <View style={styles.settlementTextContainer}>
            <View style={styles.arrowLine}>
              <View style={styles.arrowLineInner} />
            </View>
            
            <View style={styles.textContent}>
              <Text style={styles.settlementAmount}>
                ${settlement.amount.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.arrowLine}>
              <View style={styles.arrowLineInner} />
              <View style={styles.arrowHead} />
            </View>
          </View>

          {/* Receiver */}
          <View style={styles.participantColumn}>
            <View style={styles.participantAvatarContainer}>
              {toParticipant?.profilePhoto ? (
                <Image source={{ uri: toParticipant.profilePhoto }} style={styles.participantAvatar} contentFit="cover" transition={200} />
              ) : (
                <View style={[
                  styles.participantAvatarPlaceholder,
                  toParticipant?.name === name && styles.currentUserAvatar
                ]}>
                  <Text style={[
                    styles.participantAvatarInitials,
                    toParticipant?.name === name && styles.currentUserInitials
                  ]}>
                    {toParticipant?.name === name ? 'M' : (toParticipant?.name[0] || 'U').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.participantName} numberOfLines={1}>
              {toParticipant?.name === name ? 'Me': settlement.to}
            </Text>
            {toParticipant?.username && (
              <Text style={styles.participantUsername} numberOfLines={1}>
                @{toParticipant.username}
              </Text>
            )}
          </View>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {combinedState === 'settled' ? (
            <Animated.View 
              style={[
                styles.settledUpContainer,
                animationState?.buttonCombinationScale ? { transform: [{ scale: animationState.buttonCombinationScale }] } : {}
              ]}
            >
              <Animated.View 
                style={[
                  styles.settledUpButton,
                  animationState?.settledUpOpacity ? { opacity: animationState.settledUpOpacity } : {}
                ]}
              >
                <View style={styles.settledUpCenter}>
                  <Animated.View
                    style={[
                      styles.checkmarkContainer,
                      animationState?.checkmarkOpacity && animationState?.checkmarkScale ? {
                        opacity: animationState.checkmarkOpacity,
                        transform: [{ scale: animationState.checkmarkScale }]
                      } : {}
                    ]}
                  >
                    <Ionicons name="checkmark" size={16} color={Colors.surface} />
                  </Animated.View>
                  <Animated.Text
                    style={[
                      styles.settledUpText,
                      animationState?.settledTextOpacity ? { opacity: animationState.settledTextOpacity } : {}
                    ]}
                  >
                    Settled Up
                  </Animated.Text>
                </View>
                <Animated.View
                  style={animationState?.undoScale ? { transform: [{ scale: animationState.undoScale }] } : {}}
                >
                  <TouchableOpacity
                    style={styles.undoButton}
                    onPress={() => handleUndoMarkAsPaid(settlement)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="arrow-undo" size={16} color={Colors.surface} />
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>
              
              <Animated.View
                style={[
                  styles.originalButtonsContainer,
                  animationState?.buttonsOpacity && animationState?.buttonsScale ? {
                    opacity: animationState.buttonsOpacity,
                    transform: [{ scale: animationState.buttonsScale }]
                  } : { opacity: 0 }
                ]}
              >
                <TouchableOpacity
                  style={styles.markAsPaidButton}
                  onPress={() => handleMarkAsPaid(settlement)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.markAsPaidButtonText}>Mark as Paid</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={getButtonStyle()}
                  onPress={() => {
                    if (settlement.from === name) {
                      handleMakePayment(settlement, true);
                    } else if (settlement.to === name && !hasRequestBeenSent) {
                      handleRequestPayment(settlement, true);
                    } else if (!isSpectator) {
                      // Do nothing if request already sent
                    } else {
                      if (hasReminderBeenSent) return;
                      handleSendReminder(settlement);
                    }
                  }}
                  activeOpacity={0.8}
                  disabled={(settlement.to === name && hasRequestBeenSent) || (isSpectator && hasReminderBeenSent)}
                >
                  <Text style={getButtonTextStyle()}>
                    {getButtonText()}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          ) : combinedState ? (
            <Animated.View
              style={[
                styles.combinedActionContainer,
                { backgroundColor: combinedBackgroundMap[combinedState] },
                animationState?.buttonCombinationScale ? { transform: [{ scale: animationState.buttonCombinationScale }] } : {}
              ]}
            >
              <Animated.View
                style={[
                  styles.combinedActionCenter,
                  animationState?.settledTextOpacity ? { opacity: animationState.settledTextOpacity } : {}
                ]}
              >
                <Animated.View
                  style={[
                    styles.combinedIconWrapper,
                    animationState?.checkmarkOpacity ? { opacity: animationState.checkmarkOpacity } : {},
                    animationState?.checkmarkScale ? { transform: [{ scale: animationState.checkmarkScale }] } : {}
                  ]}
                >
                  <Ionicons name={combinedIconMap[combinedState]} size={16} color={Colors.surface} style={styles.combinedActionIcon} />
                </Animated.View>
                <Animated.Text
                  style={[
                    styles.combinedActionText,
                    animationState?.settledTextOpacity ? { opacity: animationState.settledTextOpacity } : {}
                  ]}
                >
                  {combinedTextMap[combinedState]}
                </Animated.Text>
              </Animated.View>
              <TouchableOpacity
                style={styles.undoButton}
                onPress={combinedUndoHandlers[combinedState]}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-undo" size={16} color={Colors.surface} />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              {(isDebtor && hasRequestBeenSent) || (isCreditor && isPaymentMade) ? (
                <TouchableOpacity
                  style={[styles.requestPaymentButton, styles.confirmActionButton]}
                  onPress={() => {
                    if (isDebtor && hasRequestBeenSent) {
                      handleConfirmPaymentMade(settlement);
                    } else if (isCreditor && isPaymentMade) {
                      handleConfirmPaymentReceived(settlement);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmActionButtonText}>
                    {isDebtor && hasRequestBeenSent ? 'Confirm payment made' : 'Confirm payment received'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.markAsPaidButton}
                    onPress={() => handleMarkAsPaid(settlement)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.markAsPaidButtonText}>Mark as Paid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={getButtonStyle()}
                    onPress={() => {
                      if (isDebtor) {
                        handleMakePayment(settlement, true);
                      } else if (isCreditor) {
                        if (!hasRequestBeenSent) {
                          handleRequestPayment(settlement, true);
                        }
                      } else {
                        if (hasReminderBeenSent) return;
                        handleSendReminder(settlement);
                      }
                    }}
                    activeOpacity={0.8}
                    disabled={(isSpectator && hasReminderBeenSent)}
                  >
                    <Text style={getButtonTextStyle()}>
                      {getButtonText()}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </View>
    );
  }, [state.participants, requestSentStates, paymentMadeStates, settledStates, reminderSentStates, animationStates, getSettlementKey, handleMarkAsPaid, handleMakePayment, handleRequestPayment, handleSendReminder, handleConfirmPaymentMade, handleConfirmPaymentReceived, handleUndoMarkAsPaid, handleUndoPaymentMade, handleUndoPaymentRequested, handleUndoReminderSent]);



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
            {calculatedSettlements.length === 0 ? (
              <View style={styles.noSettlements}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                <Text style={styles.noSettlementsText}>All settled up!</Text>
                <Text style={styles.noSettlementsSubtext}>
                  No payments needed - everyone is already balanced.
                </Text>
              </View>
            ) : (
              <View style={styles.settlementsList}>
                {calculatedSettlements.map((settlement, index) =>
                  renderSettlementItem(settlement, index)
                )}
              </View>
            )}
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
    paddingHorizontal: Spacing.lg,
  },
  noSettlements: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  noSettlementsText: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    fontWeight: '600',
  },
  noSettlementsSubtext: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  settlementsList: {
    gap: Spacing.lg,
  },
  settlementItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
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
    ...Shadows.avatar,
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
    ...Shadows.avatar,
  },
  participantAvatarInitials: {
    color: Colors.surface,
    fontSize: 19,
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
    fontSize: 20,
  },
  participantName: {
    ...Typography.caption,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 80,
    marginBottom: 2,
  },
  participantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 10,
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
  actionButtonsContainer: {
    flexDirection: 'row',
    marginTop: Spacing.md,
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
    ...Shadows.button,
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
    ...Shadows.button,
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
    ...Shadows.button,
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
    ...Shadows.button,
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
  
  // Footer Styles
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    opacity: 0.6,
  },
});

export default AddReceiptScreenContent;