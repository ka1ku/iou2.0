import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  AppState,
  Animated,
  Easing,
  Clipboard,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { calculateSettlement, calculateSettlementWithPartialSettlements, getSettlementSummary } from '../utils/settlementCalculator';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import { createExpense, updateExpense, getExpenseById } from '../services/expenseService';

const AVATAR_SIZE = 48;

const SettleUpScreen = ({ route, navigation }) => {
  console.log('[SettleUpScreen] Component mounted');
  const { expense: initialExpense } = route.params;
  const insets = useSafeAreaInsets();
  const [expense, setExpense] = useState(initialExpense); // Store expense in state so we can refresh it
  const [loading, setLoading] = useState(false);
  const [requestSentStates, setRequestSentStates] = useState({}); // Track which requests have been sent
  const [isVenmoAppActive, setIsVenmoAppActive] = useState(false);
  const [settledStates, setSettledStates] = useState({}); // Track which settlements are marked as paid
  const [paymentMadeStates, setPaymentMadeStates] = useState({}); // Track which settlements have payments made
  const [animationStates, setAnimationStates] = useState({}); // Track animation states for each settlement
  const [settlementRecalculated, setSettlementRecalculated] = useState(false); // Track if settlements were recalculated
  const [recalculationInfo, setRecalculationInfo] = useState(null); // Info about recalculation
  
  const participants = expense?.participants || [];
  const name = participants[0]?.name || 'Unknown';
  
  // Fetch fresh expense data from Firestore when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[SettleUpScreen] useFocusEffect triggered');
      const fetchFreshExpense = async () => {
        if (!initialExpense?.id) {
          console.log('[SettleUpScreen] No expense ID, skipping fetch');
          return;
        }
        
        try {
          console.log('[SettleUpScreen] Fetching fresh expense data from Firestore for ID:', initialExpense.id);
          const freshExpense = await getExpenseById(initialExpense.id);
          if (freshExpense) {
            console.log('[SettleUpScreen] Fresh expense fetched:', {
              id: freshExpense.id,
              title: freshExpense.title,
              settlementsCount: freshExpense.settlements?.length || 0,
              settlements: freshExpense.settlements
            });
            setExpense(freshExpense);
            
            // If no settlements exist in Firestore, calculate and save them
            if (!freshExpense.settlements || freshExpense.settlements.length === 0) {
              console.log('[SettleUpScreen] No settlements in Firestore, calculating and saving');
              const optimalSettlement = calculateSettlement(freshExpense);
              const settlementsToSave = optimalSettlement.settlements.map(s => ({
                debtor: s.from,
                creditor: s.to,
                amount: s.amount,
                status: 'noAction',
                updatedAt: new Date().toISOString(),
                associatedItems: [],
              }));
              
              console.log('[SettleUpScreen] Saving calculated settlements to Firestore:', settlementsToSave);
              const currentUser = getCurrentUser();
              await updateExpense(freshExpense.id, { settlements: settlementsToSave }, currentUser?.uid);
              console.log('[SettleUpScreen] Settlements saved successfully');
              
              // Update local expense with saved settlements
              setExpense(prev => ({ ...prev, settlements: settlementsToSave }));
            }
          } else {
            console.log('[SettleUpScreen] Expense not found in Firestore');
          }
        } catch (error) {
          console.error('[SettleUpScreen] Failed to fetch fresh expense data:', error);
        }
      };
      
      fetchFreshExpense();
    }, [initialExpense?.id])
  );
  
  if (!expense) {
    console.log('[SettleUpScreen] No expense, going back');
    navigation.goBack();
    return null;
  }
  
  if (!participants || participants.length === 0) {
    console.log('[SettleUpScreen] No participants, going back');
    navigation.goBack();
    return null;
  }
  
  // Animation function for settled up state
  const animateSettledUp = useCallback((settlementId) => {
    // Create animation values for this specific settlement
    const checkmarkScale = new Animated.Value(0);
    const checkmarkOpacity = new Animated.Value(0);
    const settledTextOpacity = new Animated.Value(0);
    const buttonCombinationScale = new Animated.Value(1);

    // Store animation values for this settlement
    setAnimationStates(prev => ({
      ...prev,
      [settlementId]: {
        checkmarkScale,
        checkmarkOpacity,
        settledTextOpacity,
        buttonCombinationScale,
      }
    }));

    // First, combine the buttons with a scale animation
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

    // Then animate the checkmark and text
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
  
  // Initialize settlement states from existing settlements
  useEffect(() => {
    console.log('[SettleUpScreen] Initializing settlement states, expense.settlements:', expense?.settlements);
    if (expense?.settlements && expense.settlements.length > 0) {
      console.log('[SettleUpScreen] Found', expense.settlements.length, 'existing settlements');
      const initialSettledStates = {};
      const initialRequestSentStates = {};
      const initialPaymentMadeStates = {};
      expense.settlements.forEach(settlement => {
        // Use consistent key format (defined below, but we need to create it inline here)
        const from = settlement.debtor || settlement.from;
        const to = settlement.creditor || settlement.to;
        const roundedAmount = Math.round(settlement.amount * 100) / 100;
        const settlementId = `${from}|||${to}|||${roundedAmount}`;
        
        console.log('[SettleUpScreen] Processing settlement:', {
          id: settlementId,
          debtor: settlement.debtor,
          creditor: settlement.creditor,
          amount: settlement.amount,
          status: settlement.status
        });
        
        if (settlement.status === 'markedAsPaid') {
          initialSettledStates[settlementId] = true;
          console.log('[SettleUpScreen] Marked as paid:', settlementId);
        }
        if (settlement.status === 'paymentRequested') {
          initialRequestSentStates[settlementId] = true;
          console.log('[SettleUpScreen] Payment requested:', settlementId);
        }
        if (settlement.status === 'paymentMade') {
          initialPaymentMadeStates[settlementId] = true;
          console.log('[SettleUpScreen] Payment made:', settlementId);
        }
      });
      
      console.log('[SettleUpScreen] Setting initial states:', {
        settledStates: initialSettledStates,
        requestSentStates: initialRequestSentStates,
        paymentMadeStates: initialPaymentMadeStates
      });
      setSettledStates(initialSettledStates);
      setRequestSentStates(initialRequestSentStates);
      setPaymentMadeStates(initialPaymentMadeStates);
    } else {
      console.log('[SettleUpScreen] No settlements found in expense');
    }
  }, [expense?.settlements]);

  // AppState listener to detect when user returns from Venmo
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      console.log('[SettleUpScreen] AppState changed:', nextAppState, 'isVenmoAppActive:', isVenmoAppActive);
      if (nextAppState === 'active' && isVenmoAppActive) {
        console.log('[SettleUpScreen] User returned from Venmo app, marking request as sent');
        // User returned from Venmo app, mark the last request as sent
        setIsVenmoAppActive(false);
        
        // Find the most recent request that hasn't been marked as sent yet
        let settlementToUpdate = null;
        setRequestSentStates(prev => {
          console.log('[SettleUpScreen] Current requestSentStates:', prev);
          const updated = { ...prev };
          // Find the first false value and mark it as true
          for (const [key, value] of Object.entries(updated)) {
            if (value === false) {
              console.log('[SettleUpScreen] Found unsent request:', key);
              updated[key] = true;
              
              // Parse the settlement from the key
              // Handle names that might contain hyphens by splitting on the last two hyphens
              const parts = key.split('-');
              if (parts.length >= 3) {
                const amount = parseFloat(parts[parts.length - 1]);
                const to = parts[parts.length - 2];
                const from = parts.slice(0, -2).join('-');
                settlementToUpdate = {
                  from,
                  to,
                  amount
                };
                console.log('[SettleUpScreen] Parsed settlement from key:', settlementToUpdate);
              }
              
              break;
            }
          }
          console.log('[SettleUpScreen] Updated requestSentStates:', updated);
          return updated;
        });
        
        // Save to Firestore after state update
        if (settlementToUpdate) {
          try {
            console.log('[SettleUpScreen] Saving payment request status to Firestore:', settlementToUpdate);
            await updateSettlementStatus(settlementToUpdate, 'paymentRequested');
            console.log('[SettleUpScreen] Payment request status saved successfully');
          } catch (error) {
            console.error('[SettleUpScreen] Failed to save payment request status:', error);
            // Revert the state on error
            const requestId = getSettlementKey(settlementToUpdate);
            console.log('[SettleUpScreen] Reverting request state for:', requestId);
            setRequestSentStates(prev => ({
              ...prev,
              [requestId]: false
            }));
          }
        } else {
          console.log('[SettleUpScreen] No settlement to update found');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isVenmoAppActive, updateSettlementStatus, getSettlementKey]);

  // Check if settlements need to be recalculated due to expense changes
  useEffect(() => {
    const checkSettlementRecalculation = async () => {
      console.log('[SettleUpScreen] Checking if settlements need recalculation');
      if (!expense.settlements || expense.settlements.length === 0) {
        console.log('[SettleUpScreen] No settlements to check for recalculation');
        return;
      }
      
      try {
        // Calculate what settlements should be based on current expense data
        console.log('[SettleUpScreen] Calculating expected settlements');
        const currentSettlements = calculateSettlementWithPartialSettlements(expense, expense.settlements);
        const expectedSettlements = currentSettlements.settlements;
        console.log('[SettleUpScreen] Expected settlements count:', expectedSettlements.length);
        
        // Compare with existing settlements (ignoring status and timestamps)
        const existingSettlementsNormalized = expense.settlements.map(s => ({
          from: s.debtor,
          to: s.creditor,
          amount: s.amount
        }));
        
        const expectedSettlementsNormalized = expectedSettlements.map(s => ({
          from: s.from,
          to: s.to,
          amount: s.amount
        }));
        
        console.log('[SettleUpScreen] Comparing settlements:', {
          existing: existingSettlementsNormalized,
          expected: expectedSettlementsNormalized
        });
        
        // Check if settlements have changed
        const settlementsChanged = JSON.stringify(existingSettlementsNormalized.sort()) !== 
                                 JSON.stringify(expectedSettlementsNormalized.sort());
        
        console.log('[SettleUpScreen] Settlements changed:', settlementsChanged);
        
        if (settlementsChanged) {
          console.log('[SettleUpScreen] Settlements need recalculation');
          setSettlementRecalculated(true);
          setRecalculationInfo({
            paidSettlements: currentSettlements.paidSettlements,
            newSettlements: currentSettlements.newSettlements,
            totalSettlements: expectedSettlements.length
          });
        } else {
          console.log('[SettleUpScreen] No recalculation needed');
        }
      } catch (error) {
        console.error('[SettleUpScreen] Error checking settlement recalculation:', error);
      }
    };
    
    checkSettlementRecalculation();
  }, [expense]);

  // Use settlements from expense data if available, otherwise calculate them
  // This needs to be defined before the initialization effect
  const settlements = expense?.settlements && expense.settlements.length > 0 
    ? expense.settlements.map(s => ({
        from: s.debtor,
        to: s.creditor,
        amount: s.amount,
        status: s.status || 'noAction'
      }))
    : (expense ? (() => {
        console.log('[SettleUpScreen] No settlements in expense, calculating optimal settlement');
        const optimalSettlement = calculateSettlement(expense);
        console.log('[SettleUpScreen] Calculated optimal settlements, count:', optimalSettlement.settlements.length);
        return optimalSettlement.settlements.map(s => ({
          ...s,
          status: 'noAction'
        }));
      })() : []);
  
  console.log('[SettleUpScreen] Final settlements array:', settlements);
    
  // Function to recalculate settlements and update the expense
  const recalculateSettlements = useCallback(async () => {
    try {
      setLoading(true);
      
      // Calculate new settlements preserving paid ones
      const newSettlementResult = calculateSettlementWithPartialSettlements(expense, expense.settlements);
      const newSettlements = newSettlementResult.settlements;
      
      // Update the expense with new settlements
      await updateExpense(expense.id, { settlements: newSettlements }, getCurrentUser()?.uid);
      
      // Update local state
      setSettlementRecalculated(false);
      setRecalculationInfo(null);
      
      // Refresh the screen with updated data
      navigation.replace('SettleUp', { 
        expense: { ...expense, settlements: newSettlements } 
      });
      
    } catch (error) {
      Alert.alert('Error', 'Failed to recalculate settlements. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [expense, navigation]);

  const handleAccept = async () => {
    setLoading(true);
    try {
      // Save expense with settlement data inline
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('No user signed in');
      }

      const expenseWithSettlement = {
        ...expense,
        settlement: {
          type: 'optimal',
          settlements: settlements,
          createdAt: new Date().toISOString(),
          accepted: true
        }
      };

      await createExpense(expenseWithSettlement, currentUser.uid);
      
      Alert.alert(
        'Success', 
        `Expense created successfully with ${settlements.length} settlement${settlements.length !== 1 ? 's' : ''} proposed.`
      );

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save expense: ' + error.message);
    } finally {
      setLoading(false);
    }
  };



  // Helper function to create a consistent settlement key for matching
  // Must be defined early so it can be used by other functions
  const getSettlementKey = useCallback((settlement) => {
    // Use debtor/creditor if available (from Firestore), otherwise from/to (calculated)
    const from = settlement.debtor || settlement.from;
    const to = settlement.creditor || settlement.to;
    const amount = settlement.amount;
    // Round amount to 2 decimal places for consistent matching (avoid floating point issues)
    const roundedAmount = Math.round(amount * 100) / 100;
    return `${from}|||${to}|||${roundedAmount}`;
  }, []);

  // Helper function to check if two settlements match
  const settlementsMatch = useCallback((settlement1, settlement2) => {
    const key1 = getSettlementKey(settlement1);
    const key2 = getSettlementKey(settlement2);
    return key1 === key2;
  }, [getSettlementKey]);

  const handleMakePayment = async (settlement, copyToClipboard = false) => {
    console.log('[handleMakePayment] Called with settlement:', settlement, 'copyToClipboard:', copyToClipboard);
    try {
      // Find the participant who should receive the payment
      const recipientParticipant = participants.find(p => p.name === settlement.to);
      console.log('[handleMakePayment] Recipient participant:', recipientParticipant);
      
      if (!recipientParticipant?.userId) {
        console.error('[handleMakePayment] No recipient userId found');
        Alert.alert('Error', 'Unable to find recipient information');
        return;
      }

      // Get the recipient's profile to get their Venmo username
      console.log('[handleMakePayment] Fetching recipient profile for userId:', recipientParticipant.userId);
      const recipientProfile = await getUserProfile(recipientParticipant.userId);
      console.log('[handleMakePayment] Recipient profile:', recipientProfile);
      
      if (!recipientProfile?.venmoUsername) {
        console.error('[handleMakePayment] No venmoUsername found for recipient');
        Alert.alert('Error', 'Recipient does not have a Venmo username set up');
        return;
      }
      
      // Mark that payment is being made (use consistent key format)
      const settlementId = getSettlementKey(settlement);
      console.log('[handleMakePayment] Settlement ID:', settlementId);
      console.log('[handleMakePayment] Setting paymentMadeStates for:', settlementId);
      setPaymentMadeStates(prev => {
        const updated = { ...prev, [settlementId]: true };
        console.log('[handleMakePayment] Updated paymentMadeStates:', updated);
        return updated;
      });
      
      // Save to Firestore
      try {
        console.log('[handleMakePayment] Saving paymentMade status to Firestore for settlement:', settlement);
        await updateSettlementStatus(settlement, 'paymentMade');
        console.log('[handleMakePayment] PaymentMade status saved successfully');
      } catch (error) {
        console.error('[handleMakePayment] Failed to save settlement status:', error);
        // Revert local state on error
        console.log('[handleMakePayment] Reverting paymentMadeStates for:', settlementId);
        setPaymentMadeStates(prev => ({
          ...prev,
          [settlementId]: false
        }));
        Alert.alert('Error', 'Failed to save status. Please try again.');
        return;
      }
      
      // Create Venmo deeplink
      const amount = settlement.amount.toFixed(2);
      const note = `IOU Payment - ${expense.title || 'Expense'}`;
      const deeplink = `venmo://paycharge?txn=pay&recipients=${recipientProfile.venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;
      console.log('[handleMakePayment] Venmo deeplink:', deeplink);
      
      if (copyToClipboard) {
        // Copy to clipboard instead of opening
        console.log('[handleMakePayment] Copying deeplink to clipboard');
        Clipboard.setString(deeplink);
        Alert.alert('Copied!', 'Venmo payment link has been copied to your clipboard.');
      } else {
        // Open the deeplink (original behavior)
        const supported = await Linking.canOpenURL(deeplink);
        if (supported) {
          console.log('[handleMakePayment] Opening Venmo deeplink');
          await Linking.openURL(deeplink);
        } else {
          console.error('[handleMakePayment] Venmo is not installed');
          Alert.alert('Error', 'Venmo is not installed on this device');
        }
      }
    } catch (error) {
      console.error('[handleMakePayment] Error:', error);
      Alert.alert('Error', copyToClipboard ? 'Failed to copy to clipboard. Please try again.' : 'Failed to open Venmo. Please try again.');
    }
  };
  const handleMarkAsPaid = useCallback(async (settlement) => {
    console.log('[handleMarkAsPaid] Called with settlement:', settlement);
    // Use consistent key format for settlement ID
    const settlementId = getSettlementKey(settlement);
    console.log('[handleMarkAsPaid] Settlement ID:', settlementId);
    
    // Mark as settled
    console.log('[handleMarkAsPaid] Setting settledStates for:', settlementId);
    setSettledStates(prev => {
      const updated = { ...prev, [settlementId]: true };
      console.log('[handleMarkAsPaid] Updated settledStates:', updated);
      return updated;
    });
    // Trigger the animation
    console.log('[handleMarkAsPaid] Triggering animation for:', settlementId);
    animateSettledUp(settlementId);
    
    // Save to Firestore
    try {
      console.log('[handleMarkAsPaid] Saving markedAsPaid status to Firestore for settlement:', settlement);
      await updateSettlementStatus(settlement, 'markedAsPaid');
      console.log('[handleMarkAsPaid] MarkedAsPaid status saved successfully');
    } catch (error) {
      console.error('[handleMarkAsPaid] Failed to save settlement status:', error);
      // Revert local state on error
      console.log('[handleMarkAsPaid] Reverting settledStates for:', settlementId);
      setSettledStates(prev => ({
        ...prev,
        [settlementId]: false
      }));
      Alert.alert('Error', 'Failed to save status. Please try again.');
    }
  }, [animateSettledUp, updateSettlementStatus, getSettlementKey]);

  const updateSettlementStatus = useCallback(async (settlementToUpdate, newStatus) => {
    console.log('[updateSettlementStatus] Called with settlement:', settlementToUpdate, 'newStatus:', newStatus);
    try {
      if (!expense?.id) {
        console.error('[updateSettlementStatus] Expense ID is missing');
        throw new Error('Expense ID is missing');
      }

      console.log('[updateSettlementStatus] Expense ID:', expense.id);
      
      // Fetch the LATEST expense data from Firestore to ensure we have current state
      console.log('[updateSettlementStatus] Fetching latest expense data from Firestore');
      const latestExpense = await getExpenseById(expense.id);
      if (!latestExpense) {
        throw new Error('Expense not found in Firestore');
      }
      
      const currentSettlements = latestExpense.settlements || [];
      console.log('[updateSettlementStatus] Current settlements from Firestore:', currentSettlements.length);
      console.log('[updateSettlementStatus] All current settlements:', JSON.stringify(currentSettlements, null, 2));
      
      // Find the exact settlement to update using strict matching
      let settlementFound = false;
      let updatedCount = 0;
      
      const updatedSettlements = currentSettlements.map((s, index) => {
        const matches = settlementsMatch(s, settlementToUpdate);
        
        console.log(`[updateSettlementStatus] Settlement ${index} comparison:`, {
          stored: { debtor: s.debtor, creditor: s.creditor, amount: s.amount, status: s.status },
          target: { from: settlementToUpdate.from, to: settlementToUpdate.to, debtor: settlementToUpdate.debtor, creditor: settlementToUpdate.creditor, amount: settlementToUpdate.amount },
          matches: matches
        });
        
        if (matches) {
          if (settlementFound) {
            console.error('[updateSettlementStatus] WARNING: Multiple settlements matched! This should not happen.');
          }
          settlementFound = true;
          updatedCount++;
          console.log(`[updateSettlementStatus] ✓ MATCH FOUND - Updating settlement ${index} from status '${s.status}' to '${newStatus}'`);
          return {
            ...s, // Preserve ALL existing fields
            status: newStatus,
            updatedAt: new Date().toISOString()
          };
        }
        
        // Return settlement unchanged
        return s;
      });

      if (!settlementFound) {
        const errorMsg = `No matching settlement found! Target: ${JSON.stringify(settlementToUpdate)}`;
        console.error('[updateSettlementStatus]', errorMsg);
        console.error('[updateSettlementStatus] Available settlements:', currentSettlements.map(s => ({ debtor: s.debtor, creditor: s.creditor, amount: s.amount, status: s.status })));
        throw new Error(errorMsg);
      }

      if (updatedCount > 1) {
        console.error('[updateSettlementStatus] ERROR: Multiple settlements were updated! This is a bug.');
      }

      console.log('[updateSettlementStatus] Updated settlements array:', JSON.stringify(updatedSettlements, null, 2));
      console.log('[updateSettlementStatus] Verification - settlements before/after count:', currentSettlements.length, '->', updatedSettlements.length);
      
      // Verify we didn't accidentally modify other settlements
      const statusChanges = [];
      updatedSettlements.forEach((updated, index) => {
        const original = currentSettlements[index];
        if (original.status !== updated.status) {
          statusChanges.push({
            index,
            original: original.status,
            updated: updated.status,
            settlement: { debtor: original.debtor, creditor: original.creditor, amount: original.amount }
          });
        }
      });
      console.log('[updateSettlementStatus] Status changes detected:', statusChanges);
      
      if (statusChanges.length > 1) {
        console.error('[updateSettlementStatus] ERROR: Multiple settlements changed status! Only one should change.');
      }

      console.log('[updateSettlementStatus] Calling updateExpense with settlements');
      
      // Update the expense with the new settlements
      const currentUser = getCurrentUser();
      console.log('[updateSettlementStatus] Current user:', currentUser?.uid);
      await updateExpense(expense.id, { settlements: updatedSettlements }, currentUser?.uid);
      console.log('[updateSettlementStatus] updateExpense completed successfully');
      
      // Update local expense state with the new settlements
      setExpense(prev => ({
        ...prev,
        settlements: updatedSettlements
      }));
      console.log('[updateSettlementStatus] Local expense state updated');
      
    } catch (error) {
      console.error('[updateSettlementStatus] Error:', error);
      throw error;
    }
  }, [expense, settlementsMatch]);

  const handleUndoMarkAsPaid = useCallback(async (settlement) => {
    console.log('[handleUndoMarkAsPaid] Called with settlement:', settlement);
    // Use consistent key format for settlement ID
    const settlementId = getSettlementKey(settlement);
    console.log('[handleUndoMarkAsPaid] Settlement ID:', settlementId);
    
    // Create animation values for the undo transition
    const undoScale = new Animated.Value(1);
    const settledUpOpacity = new Animated.Value(1);
    const buttonsOpacity = new Animated.Value(0);
    const buttonsScale = new Animated.Value(0.8);
    
    console.log('[handleUndoMarkAsPaid] Setting settledStates to false for:', settlementId);
    setSettledStates(prev => {
      const updated = { ...prev, [settlementId]: false };
      console.log('[handleUndoMarkAsPaid] Updated settledStates:', updated);
      return updated;
    });
    
    // Store animation values for this settlement
    setAnimationStates(prev => ({
      ...prev,
      [settlementId]: {
        ...prev[settlementId],
        undoScale,
        settledUpOpacity,
        buttonsOpacity,
        buttonsScale,
      }
    }));
    
    // Save to Firestore
    try {
      console.log('[handleUndoMarkAsPaid] Saving noAction status to Firestore for settlement:', settlement);
      await updateSettlementStatus(settlement, 'noAction');
      console.log('[handleUndoMarkAsPaid] NoAction status saved successfully');
    } catch (error) {
      console.error('[handleUndoMarkAsPaid] Failed to save settlement status:', error);
      // Revert local state on error
      console.log('[handleUndoMarkAsPaid] Reverting settledStates for:', settlementId);
      setSettledStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      Alert.alert('Error', 'Failed to save status. Please try again.');
      return;
    }
    
    // Start the undo animation sequence
    Animated.sequence([
      // First: Scale down the undo button for feedback
      Animated.timing(undoScale, {
        toValue: 0.8,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(undoScale, {
        toValue: 1,
        duration: 100,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      // Then: Fade out settled up button and fade in original buttons
      Animated.parallel([
        Animated.timing(settledUpOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 200,
          delay: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(buttonsScale, {
          toValue: 1,
          duration: 200,
          delay: 100,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    
    // Remove from settled states after animation completes
    setTimeout(() => {
      
      
      // Remove animation state
      setAnimationStates(prev => {
        const newState = { ...prev };
        delete newState[settlementId];
        return newState;
      });
          }, 500);
    
  }, [updateSettlementStatus, getSettlementKey]);

  // REMOVED: saveSettlement function - it was causing conflicts by overwriting individual updates
  // Individual settlement updates now happen directly via updateSettlementStatus
  // This ensures each settlement update is atomic and doesn't affect others

  const handleRequestPayment = async (settlement, copyToClipboard = false) => {
    console.log('[handleRequestPayment] Called with settlement:', settlement, 'copyToClipboard:', copyToClipboard);
    try {
      // Find the participant who should make the payment
      const payerParticipant = participants.find(p => p.name === settlement.from);
      console.log('[handleRequestPayment] Payer participant:', payerParticipant);
      
      if (!payerParticipant?.userId) {
        console.error('[handleRequestPayment] No payer userId found');
        Alert.alert('Error', 'Unable to find payer information');
        return;
      }

      // Get the payer's profile to get their Venmo username
      console.log('[handleRequestPayment] Fetching payer profile for userId:', payerParticipant.userId);
      const payerProfile = await getUserProfile(payerParticipant.userId);
      console.log('[handleRequestPayment] Payer profile:', payerProfile);
      
      if (!payerProfile?.venmoUsername) {
        console.error('[handleRequestPayment] No Venmo username found for payer');
        Alert.alert('Error', 'Payer does not have a Venmo username set up');
        return;
      }

      // Create Venmo deeplink for requesting payment
      const amount = settlement.amount.toFixed(2);
      const note = `IOU Payment Request - ${expense.title || 'Expense'}`;
      const deeplink = `venmo://paycharge?txn=charge&recipients=${payerProfile.venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;
      console.log('[handleRequestPayment] Venmo deeplink:', deeplink);

      if (copyToClipboard) {
        // Copy to clipboard instead of opening
        console.log('[handleRequestPayment] Copying deeplink to clipboard');
        Clipboard.setString(deeplink);
        Alert.alert('Copied!', 'Venmo payment request link has been copied to your clipboard.');
        
        // Use consistent key format for request ID
        const requestId = getSettlementKey(settlement);
        console.log('[handleRequestPayment] Request ID:', requestId);
        
        // Mark request as sent since we copied it
        console.log('[handleRequestPayment] Setting requestSentStates for:', requestId);
        setRequestSentStates(prev => {
          const updated = { ...prev, [requestId]: true };
          console.log('[handleRequestPayment] Updated requestSentStates:', updated);
          return updated;
        });
        
        // Save to Firestore immediately since we're not tracking app state change
        try {
          console.log('[handleRequestPayment] Saving paymentRequested status to Firestore');
          await updateSettlementStatus(settlement, 'paymentRequested');
          console.log('[handleRequestPayment] PaymentRequested status saved successfully');
        } catch (error) {
          console.error('[handleRequestPayment] Failed to save payment request status:', error);
        }
      } else {
        // Open the deeplink (original behavior)
        const supported = await Linking.canOpenURL(deeplink);
        if (supported) {
          console.log('[handleRequestPayment] Venmo is supported, opening deeplink');
          // Mark that Venmo app is being opened
          setIsVenmoAppActive(true);
          console.log('[handleRequestPayment] Set isVenmoAppActive to true');
          
          // Use consistent key format for request ID
          const requestId = getSettlementKey(settlement);
          console.log('[handleRequestPayment] Request ID:', requestId);
          
          // Store the request ID for tracking (will be saved to Firestore when user returns from Venmo)
          console.log('[handleRequestPayment] Setting requestSentStates for:', requestId);
          setRequestSentStates(prev => {
            const updated = { ...prev, [requestId]: false };
            console.log('[handleRequestPayment] Updated requestSentStates:', updated);
            return updated;
          });
          
          await Linking.openURL(deeplink);
          console.log('[handleRequestPayment] Venmo deeplink opened');
        } else {
          console.error('[handleRequestPayment] Venmo is not installed');
          Alert.alert('Error', 'Venmo is not installed on this device');
        }
      }
    } catch (error) {
      console.error('[handleRequestPayment] Error:', error);
      Alert.alert('Error', copyToClipboard ? 'Failed to copy to clipboard. Please try again.' : 'Failed to open Venmo. Please try again.');
    }
  };

  const renderSettlementItem = useCallback((settlement, index) => {
    const fromParticipant = participants.find(p => p.name === settlement.from);
    const toParticipant = participants.find(p => p.name === settlement.to);
    
    // Use consistent key format for settlement IDs
    const settlementId = getSettlementKey(settlement);
    const requestId = settlementId; // Use same ID for consistency
    
    // Check if a request has been sent for this settlement
    const hasRequestBeenSent = requestSentStates[requestId] === true || settlement.status === 'paymentRequested';
    
    // Check if this settlement is marked as paid/settled
    const isSettled = settledStates[settlementId] === true || settlement.status === 'markedAsPaid';
    const animationState = animationStates[settlementId] || null;
    
    // Determine button text and styling
    const getButtonText = () => {
      if (settlement.from === name) {
        return 'Make Payment';
      } else if (settlement.to === name) {
        return hasRequestBeenSent ? 'Request Sent' : 'Request Payment';
      } else {
        return 'Send Reminder';
      }
    };
    
    const getButtonStyle = () => {
      const baseStyle = styles.requestPaymentButton;
      if (settlement.to === name && hasRequestBeenSent) {
        return [baseStyle, styles.requestSentButton];
      }
      return baseStyle;
    };
    
    const getButtonTextStyle = () => {
      const baseStyle = styles.requestPaymentButtonText;
      if (settlement.to === name && hasRequestBeenSent) {
        return [baseStyle, styles.requestSentButtonText];
      }
      return baseStyle;
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
            {/* Left Arrow */}
            <View style={styles.arrowLine}>
              <View style={styles.arrowLineInner} />
            </View>
            
            {/* Text Content */}
            <View style={styles.textContent}>
              {/* <Text style={styles.settlementLabel}>
                {settlement.from === name ? 'you owe' : 'owes you'}
              </Text> */}
              <Text style={styles.settlementAmount}>
                ${settlement.amount.toFixed(2)}
              </Text>
            </View>
            
            {/* Right Arrow */}
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
          {isSettled ? (
            // Settled Up State - Combined Button with Animation
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
                    onPress={() => {
                      console.log('[Undo Button] Pressed for settlement:', settlement);
                      handleUndoMarkAsPaid(settlement);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="arrow-undo" size={16} color={Colors.surface} />
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>
              
              {/* Original buttons that fade in during undo */}
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
                  onPress={() => {
                    console.log('[Mark as Paid Button (settled state)] Pressed for settlement:', settlement);
                    handleMarkAsPaid(settlement);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.markAsPaidButtonText}>Mark as Paid</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={getButtonStyle()}
                  onPress={() => {
                    console.log('[Action Button (settled state)] Pressed for settlement:', settlement, 'buttonText:', getButtonText());
                    if (settlement.from === name) {
                      console.log('[Action Button (settled state)] Calling handleMakePayment');
                      handleMakePayment(settlement, true);
                    } else if (settlement.to === name && !hasRequestBeenSent) {
                      console.log('[Action Button (settled state)] Calling handleRequestPayment');
                      handleRequestPayment(settlement, true);
                    } else if (settlement.to === name && hasRequestBeenSent) {
                      console.log('[Action Button (settled state)] Request already sent, doing nothing');
                      // Request already sent, maybe show a message or do nothing
                    } else {
                      console.log('[Action Button (settled state)] Send reminder (not implemented)');
                      // TODO: Add send reminder functionality
                    }
                  }}
                  activeOpacity={0.8}
                  disabled={settlement.to === name && hasRequestBeenSent}
                >
                  <Text style={getButtonTextStyle()}>
                    {getButtonText()}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          ) : (
            // Normal Button State
            <>
              <TouchableOpacity
                style={styles.markAsPaidButton}
                onPress={() => {
                  console.log('[Mark as Paid Button] Pressed for settlement:', settlement);
                  handleMarkAsPaid(settlement);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.markAsPaidButtonText}>Mark as Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={getButtonStyle()}
                onPress={() => {
                  console.log('[Action Button] Pressed for settlement:', settlement, 'buttonText:', getButtonText());
                  if (settlement.from === name) {
                    console.log('[Action Button] Calling handleMakePayment');
                    handleMakePayment(settlement,true);
                  } else if (settlement.to === name && !hasRequestBeenSent) {
                    console.log('[Action Button] Calling handleRequestPayment');
                    handleRequestPayment(settlement, true);
                  } else if (settlement.to === name && hasRequestBeenSent) {
                    console.log('[Action Button] Request already sent, doing nothing');
                    // Request already sent, maybe show a message or do nothing
                  } else {
                    console.log('[Action Button] Send reminder (not implemented)');
                    // TODO: Add send reminder functionality
                  }
                }}
                activeOpacity={0.8}
                disabled={settlement.to === name && hasRequestBeenSent}
              >
                <Text style={getButtonTextStyle()}>
                  {getButtonText()}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }, [participants, name, requestSentStates, settledStates, animationStates, getSettlementKey, handleMarkAsPaid, handleMakePayment, handleRequestPayment, handleUndoMarkAsPaid, expense]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{expense.title || 'Settle Up'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Settlement Recalculation Notification */}
        {settlementRecalculated && recalculationInfo && recalculationInfo.newSettlements > 0 && (
          <View style={styles.recalculationBanner}>
            <View style={styles.recalculationContent}>
              <Ionicons name="information-circle" size={20} color={Colors.accent} />
              <View style={styles.recalculationTextContainer}>
                <Text style={styles.recalculationText}>
                  Settlements have been updated based on expense changes.
                </Text>
                <Text style={styles.recalculationSubtext}>
                  {recalculationInfo.paidSettlements} paid settlement{recalculationInfo.paidSettlements !== 1 ? 's' : ''} preserved, {recalculationInfo.newSettlements} new settlement{recalculationInfo.newSettlements !== 1 ? 's' : ''} added.
                </Text>
              </View>
              <View style={styles.recalculationActions}>
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => setSettlementRecalculated(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Settlements List */}
        <View style={styles.settlementsSection}>
          <Text style={styles.sectionTitle}>
            Settlement Proposals
          </Text>
          
          {settlements.length > 0 ? (
            <View style={styles.settlementsList}>
              {settlements.map((settlement, index) => 
                renderSettlementItem(settlement, index)
              )}
            </View>
          ) : (
            <View style={styles.noSettlements}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              <Text style={styles.noSettlementsText}>All settled up!</Text>
              <Text style={styles.noSettlementsSubtext}>
                No payments needed - everyone is already balanced.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Return Home Button */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={styles.returnHomeButton}
          onPress={async () => {
            console.log('[Return Home Button] Pressed');
            // All settlement updates are already saved individually via updateSettlementStatus
            // No need to sync anything - just navigate
            console.log('[Return Home Button] Navigating to HomeMain');
            navigation.navigate('HomeMain');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="home" size={20} color={Colors.surface} style={styles.returnHomeIcon} />
          <Text style={styles.returnHomeButtonText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    paddingTop: 120,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  summaryContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  summaryLabel: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  summaryValue: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  settlementsSection: {
    marginBottom: Spacing.lg,
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
    gap: Spacing.md,
  },
  settlementItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    ...Shadows.card,
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
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  participantAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.avatar,
  },
  participantAvatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.avatar,
  },
  participantAvatarInitials: {
    color: Colors.surface,
    fontSize: Math.floor(AVATAR_SIZE / 2.5),
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
    fontSize: Math.ceil(AVATAR_SIZE / 2.5),
  },
  participantName: {
    ...Typography.caption,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: Math.ceil(AVATAR_SIZE / 4),
    fontWeight: '500',
    maxWidth: 80,
    marginBottom: 2,
  },
  participantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: Math.ceil(AVATAR_SIZE / 5),
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
  settlementLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  settlementAmount: {
    ...Typography.h3,
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 20,
    textAlign: 'center',
  },
  noSettlements: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noSettlementsText: {
    ...Typography.h4,
    color: Colors.success,
    marginTop: Spacing.md,
    fontWeight: '600',
  },
  noSettlementsSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  acceptButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  acceptButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
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
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xl + 20, // Extra padding for safe area
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  returnHomeButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  returnHomeIcon: {
    marginRight: Spacing.sm,
  },
  returnHomeButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  recalculationBanner: {
    backgroundColor: Colors.accent + '10',
    borderWidth: 1,
    borderColor: Colors.accent + '30',
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  recalculationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  recalculationTextContainer: {
    flex: 1,
  },
  recalculationText: {
    ...Typography.body2,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  recalculationSubtext: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  recalculationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  updateButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    ...Shadows.button,
  },
  updateButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 12,
  },
  dismissButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
});

export default SettleUpScreen;