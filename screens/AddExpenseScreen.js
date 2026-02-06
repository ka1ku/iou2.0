import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Animated,
  Easing,
  AppState,
  Linking,
  Clipboard,
  Share,
} from "react-native";
import { KeyboardAwareScrollView, KeyboardToolbar } from "react-native-keyboard-controller";
import { Image } from 'expo-image';
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, Typography, Shadows } from "../design/tokens";
import { getCurrentUser } from "../services/authService";
import { getUserProfile } from "../services/friendService";
import {
  createExpense,
  updateExpense,
  updateExpenseParticipants,
  deleteItemFromExpense,
  getExpenseById,
  createPaymentRequest,
} from "../services/expenseService";
import {
  calculateSettlement,
  calculateSettlementWithPartialSettlements,
} from "../utils/settlementCalculator";
import { useExpense } from "../contexts/ExpenseContext";
import ExpenseHeader from "../components/expenses/ExpenseHeader";
import ExpenseFooter from "../components/expenses/ExpenseFooter";
import ExpenseItemCard from "../components/expenses/ExpenseItemCard";
import ExpenseViewCard from "../components/expenses/ExpenseViewCard";
import ParticipantsGrid from "../components/expenses/ParticipantsGrid";
import GroupMembersModal from "../components/expenses/GroupMembersModal";
import SettlementInterface from "../components/expenses/SettlementInterface";

const SPLIT_TOLERANCE = 0.01;

const AddExpenseScreenContent = ({ route, navigation }) => {
  const { expense, isNewExpense = false } = route.params || {};
  const isEditing = !!expense && !isNewExpense;
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);

  const { state, actions, total } = useExpense();

  const [activeTab, setActiveTab] = useState('track');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingItems, setEditingItems] = useState(new Set());
  
  const [newlyAddedItems, setNewlyAddedItems] = useState(new Set());
  const itemSnapshotsRef = useRef(new Map());

  // Settlement-related state from SettleUpScreen
  const [requestSentStates, setRequestSentStates] = useState({});
  const [isVenmoAppActive, setIsVenmoAppActive] = useState(false);
  const [settledStates, setSettledStates] = useState({});
  const [paymentMadeStates, setPaymentMadeStates] = useState({});
  const [reminderSentStates, setReminderSentStates] = useState({});
  const [animationStates, setAnimationStates] = useState({});
  const [settlementRecalculated, setSettlementRecalculated] = useState(false);
  const [recalculationInfo, setRecalculationInfo] = useState(null);

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
        title: state.title || 'Expense',
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

  // Animation function for settled up state (from SettleUpScreen)
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

  // Helper functions from SettleUpScreen
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

  // Update settlement status in Firestore (from SettleUpScreen)
  const updateSettlementStatus = useCallback(async (settlementToUpdate, newStatus) => {
    try {
      if (!expense?.id) {
        console.error('[AddExpenseScreen] Expense ID is missing');
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
        console.error('[AddExpenseScreen] No matching settlement found');
        throw new Error('No matching settlement found');
      }

      const currentUser = getCurrentUser();
      await updateExpense(expense.id, { settlements: updatedSettlements }, currentUser?.uid);
      
    } catch (error) {
      console.error('[AddExpenseScreen] Error updating settlement status:', error);
      throw error;
    }
  }, [expense, settlementsMatch]);

  // Mark settlement as paid (from SettleUpScreen)
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
      console.error('[AddExpenseScreen] Failed to save settlement status:', error);
      setSettledStates(prev => ({
        ...prev,
        [settlementId]: false
      }));
      Alert.alert('Error', 'Failed to save status. Please try again.');
    }
  }, [animateSettledUp, updateSettlementStatus, getSettlementKey]);

  // Make payment via Venmo (from SettleUpScreen)
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
        console.error('[AddExpenseScreen] Failed to save settlement status:', error);
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
      const note = `IOU Payment - ${state.title || 'Expense'}`;
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
      console.error('[AddExpenseScreen] Error in handleMakePayment:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    }
  };

  // Request payment via Venmo (from SettleUpScreen)
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
          expenseTitle: state.title || 'Untitled Expense'
        });
      } catch (error) {
        console.error('[AddExpenseScreen] Failed to create payment request:', error);
      }

      const amount = settlement.amount.toFixed(2);
      const note = `IOU Payment Request - ${state.title || 'Expense'}`;
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
          console.error('[AddExpenseScreen] Failed to save payment request status:', error);
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
      console.error('[AddExpenseScreen] Error in handleRequestPayment:', error);
      Alert.alert('Error', 'Failed to request payment. Please try again.');
    }
  };

  // Send reminder (from SettleUpScreen)
  const handleSendReminder = useCallback(async (settlement) => {
    console. log('[AddExpenseScreen] handleSendReminder - settlement:', settlement);
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
      const note = `IOU Payment - ${state.title || 'Expense'}`;
      const venmoLink = `venmo://paycharge?txn=pay&recipients=${creditorProfile.venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;
      const expenseTitle = state.title || 'this expense';
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
        console.error('[AddExpenseScreen] Failed to save reminderSent status:', statusError);
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
      console.error('[AddExpenseScreen] Error in handleSendReminder:', error);
      Alert.alert('Error', 'Failed to share reminder. Please try again.');
    }
  }, [state.participants, state.title, getSettlementKey, updateSettlementStatus, animateActionCompleted]);

  // Confirm payment made (from SettleUpScreen)
  const handleConfirmPaymentMade = useCallback((settlement) => {
    const settlementId = getSettlementKey(settlement);
    setRequestSentStates(prev => ({
      ...prev,
      [settlementId]: false
    }));
    handleMarkAsPaid(settlement);
  }, [getSettlementKey, handleMarkAsPaid]);

  // Confirm payment received (from SettleUpScreen)
  const handleConfirmPaymentReceived = useCallback((settlement) => {
    const settlementId = getSettlementKey(settlement);
    setPaymentMadeStates(prev => ({
      ...prev,
      [settlementId]: false
    }));
    handleMarkAsPaid(settlement);
  }, [getSettlementKey, handleMarkAsPaid]);

  // Undo payment made (from SettleUpScreen)
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
      console.error('[AddExpenseScreen] Failed to revert status:', error);
      setPaymentMadeStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      Alert.alert('Error', 'Failed to undo payment. Please try again.');
    }
  }, [updateSettlementStatus, getSettlementKey]);

  // Undo payment requested (from SettleUpScreen)
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
      console.error('[AddExpenseScreen] Failed to revert status:', error);
      setRequestSentStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      Alert.alert('Error', 'Failed to undo request. Please try again.');
    }
  }, [updateSettlementStatus, getSettlementKey]);

  // Undo reminder sent (from SettleUpScreen)
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
      console.error('[AddExpenseScreen] Failed to revert status:', error);
      setReminderSentStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      Alert.alert('Error', 'Failed to undo reminder. Please try again.');
    }
  }, [updateSettlementStatus, getSettlementKey]);

  // Undo mark as paid (from SettleUpScreen)
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
      console.error('[AddExpenseScreen] Failed to revert status:', error);
      setSettledStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      Alert.alert('Error', 'Failed to undo settlement. Please try again.');
    }
  }, [updateSettlementStatus, getSettlementKey]);

  useEffect(() => {
    // Tab bar hiding is handled centrally in App.js via getTabBarStyle
    if (expense && (isEditing || isNewExpense)) {
      actions.initializeFromExpense(expense, isEditing, isNewExpense);
    }
  }, [expense, isEditing, isNewExpense, navigation, actions]);

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
        "Split Mismatch",
        "Each item's split amounts must add up to the item total before saving the expense."
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
      Alert.alert("Error", "Failed to save expense: " + error.message);
    } finally {
      actions.setLoading(false);
    }
  };

  const calculateSettlements = async () => {
    try {
      const expenseData = await prepareExpenseData();
      const settlementResult = calculateSettlement(expenseData);
      return settlementResult.settlements || [];
    } catch (error) {
      return [];
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
            Alert.alert("Error", "User not authenticated");
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
        Alert.alert("Error", "Failed to delete item: " + error.message);
      }
    };

    if (skipConfirmation) {
      performDelete();
    } else {
      Alert.alert(
        "Delete Item",
        "Are you sure you want to delete this item? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete
          }
        ]
      );
    }
  };

  const handleAddItem = () => {
    const newIndex = state.items.length;
    actions.addItem();
    setEditingItems(prev => new Set([...prev, newIndex]));
    setNewlyAddedItems(prev => new Set([...prev, newIndex]));
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Render settlement item (from SettleUpScreen) - Custom UI rendering
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
        onPeoplePress={() => setShowMembersModal(true)}
        participantCount={state.participants.filter(p => p.userId !== getCurrentUser()?.uid).length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />


      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 140, // Increased spacing for more breathing room under header
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
                  <Text style={styles.emptyStateTitle}>No items yet</Text>
                  <Text style={styles.emptyStateDescription}>
                    Start by adding your first item to this expense
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={handleAddItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.emptyStateButtonIcon}>
                      <Ionicons name="add" size={20} color={Colors.white} />
                    </View>
                    <Text style={styles.emptyStateButtonText}>Add Your First Item</Text>
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
                        <ExpenseItemCard
                          key={item.id}
                          item={item}
                          index={index}
                          expenseId={expense?.id}
                          isEditing={isItemEditing}
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
                      );
                    } else {
                      return (
                        <ExpenseViewCard
                          key={item.id}
                          item={item}
                          index={index}
                          onEdit={() => handleEditItem(index)}
                          onDelete={() => handleDeleteItem(index)}
                        />
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
                    <Text style={styles.addAnotherItemText}>Add Another Item</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {activeTab === 'split' && (
            <View style={styles.splitViewContainer}>
              {state.participants.length <= 1 ? (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyStateIconContainer}>
                    <Ionicons name="people-outline" size={48} color={Colors.textSecondary} />
                    <View style={styles.emptyStateIconBadge}>
                      <Ionicons name="add" size={16} color={Colors.white} />
                    </View>
                  </View>
                  <Text style={styles.emptyStateTitle}>Split with friends</Text>
                  <Text style={styles.emptyStateDescription}>
                    Add people to this expense to automatically calculate who owes what.
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => setShowMembersModal(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.emptyStateButtonIcon}>
                      <Ionicons name="person-add" size={18} color={Colors.white} />
                    </View>
                    <Text style={styles.emptyStateButtonText}>Add People</Text>
                  </TouchableOpacity>
                </View>
              ) : calculatedSettlements.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <View style={[styles.emptyStateIconContainer, { backgroundColor: Colors.success + '10' }]}>
                    <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                  </View>
                  <Text style={[styles.emptyStateTitle, { color: Colors.success }]}>All settled up!</Text>
                  <Text style={styles.emptyStateDescription}>
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
});

export default AddExpenseScreenContent;
