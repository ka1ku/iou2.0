import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  Linking,
  Alert,
  AppState,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { calculateSettlement, calculateSettlementWithPartialSettlements, getSettlementSummary } from '../utils/settlementCalculator';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import { createExpense, updateExpense } from '../services/expenseService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const AVATAR_SIZE = 48;
const AVATAR_MARGIN = 6;
const BUBBLE_WIDTH = 60;

const SettleUpScreen = ({ route, navigation }) => {
  const { expense } = route.params;
  const participants = expense.participants;
  const [loading, setLoading] = useState(false);
  const [requestSentStates, setRequestSentStates] = useState({}); // Track which requests have been sent
  const [isVenmoAppActive, setIsVenmoAppActive] = useState(false);
  const [settledStates, setSettledStates] = useState({}); // Track which settlements are marked as paid
  const [paymentMadeStates, setPaymentMadeStates] = useState({}); // Track which settlements have payments made
  const [animationStates, setAnimationStates] = useState({}); // Track animation states for each settlement
  const [settlementRecalculated, setSettlementRecalculated] = useState(false); // Track if settlements were recalculated
  const [recalculationInfo, setRecalculationInfo] = useState(null); // Info about recalculation
  
  if (!expense) {
    navigation.goBack();
    return null;
  }
  
  if (!participants || participants.length === 0) {
    navigation.goBack();
    return null;
  }
  
  const name = participants[0]?.name || 'Unknown';
  
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
  
  // Initialize settlement states from existing settlements and save settlements if they don't exist
  useEffect(() => {
    if (expense.settlements && expense.settlements.length > 0) {
      const initialSettledStates = {};
      const initialRequestSentStates = {};
      const initialPaymentMadeStates = {};
      expense.settlements.forEach(settlement => {
        const settlementId = `${settlement.debtor}-${settlement.creditor}-${settlement.amount}`;
        
        if (settlement.status === 'markedAsPaid') {
          initialSettledStates[settlementId] = true;
        }
        if (settlement.status === 'paymentRequested') {
          initialRequestSentStates[settlementId] = true;
        }
        if (settlement.status === 'paymentMade') {
          initialPaymentMadeStates[settlementId] = true;
        }
      });
      
      setSettledStates(initialSettledStates);
      setRequestSentStates(initialRequestSentStates);
      setPaymentMadeStates(initialPaymentMadeStates);
    } else {
      // If no settlements exist, save the calculated ones
      const saveInitialSettlements = async () => {
        try {
          await saveSettlement();
        } catch (error) {
        }
      };
      saveInitialSettlements();
    }
  }, [expense.settlements, saveSettlement]);

  // AppState listener to detect when user returns from Venmo
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && isVenmoAppActive) {
        // User returned from Venmo app, mark the last request as sent
        setIsVenmoAppActive(false);
        
        // Find the most recent request that hasn't been marked as sent yet
        setRequestSentStates(prev => {
          const updated = { ...prev };
          // Find the first false value and mark it as true
          for (const [key, value] of Object.entries(updated)) {
            if (value === false) {
              updated[key] = true;
              break;
            }
          }
          return updated;
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isVenmoAppActive]);

  // Check if settlements need to be recalculated due to expense changes
  useEffect(() => {
    const checkSettlementRecalculation = async () => {
      if (!expense.settlements || expense.settlements.length === 0) return;
      
      try {
        // Calculate what settlements should be based on current expense data
        const currentSettlements = calculateSettlementWithPartialSettlements(expense, expense.settlements);
        const expectedSettlements = currentSettlements.settlements;
        
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
        
        // Check if settlements have changed
        const settlementsChanged = JSON.stringify(existingSettlementsNormalized.sort()) !== 
                                 JSON.stringify(expectedSettlementsNormalized.sort());
        
        if (settlementsChanged) {
          setSettlementRecalculated(true);
          setRecalculationInfo({
            paidSettlements: currentSettlements.paidSettlements,
            newSettlements: currentSettlements.newSettlements,
            totalSettlements: expectedSettlements.length
          });
        }
      } catch (error) {
      }
    };
    
    checkSettlementRecalculation();
  }, [expense]);

  // Use settlements from expense data if available, otherwise calculate them
  const settlements = expense.settlements && expense.settlements.length > 0 
    ? expense.settlements.map(s => ({
        from: s.debtor,
        to: s.creditor,
        amount: s.amount,
        status: s.status || 'noAction'
      }))
    : (() => {
        const optimalSettlement = calculateSettlement(expense);
        return optimalSettlement.settlements.map(s => ({
          ...s,
          status: 'noAction'
        }));
      })();
    
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



  const handleMakePayment = async (settlement) => {
    try {
      // Find the participant who should receive the payment
      const recipientParticipant = participants.find(p => p.name === settlement.to);
      
      if (!recipientParticipant?.userId) {
        Alert.alert('Error', 'Unable to find recipient information');
        return;
      }

      // Get the recipient's profile to get their Venmo username
      const recipientProfile = await getUserProfile(recipientParticipant.userId);
      
      if (!recipientProfile?.venmoUsername) {
        Alert.alert('Error', 'Recipient does not have a Venmo username set up');
        return;
      }
      
      // Mark that payment is being made
      const settlementId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
      setPaymentMadeStates(prev => ({
        ...prev,
        [settlementId]: true
      }));
      
      // Create Venmo deeplink
      const amount = settlement.amount.toFixed(2);
      const note = `IOU Payment - ${expense.title || 'Expense'}`;
      const deeplink = `venmo://paycharge?txn=pay&recipients=${recipientProfile.venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;
      // Open the deeplink
      const supported = await Linking.canOpenURL(deeplink);
      if (supported) {
        await Linking.openURL(deeplink);
      } else {
        Alert.alert('Error', 'Venmo is not installed on this device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open Venmo. Please try again.');
    }
  };

  const handleMarkAsPaid = useCallback((settlement) => {
    const settlementId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
    
    // Mark as settled
    setSettledStates(prev => ({
      ...prev,
      [settlementId]: true
    }));
    // Trigger the animation
    animateSettledUp(settlementId);
    
  }, [animateSettledUp]);

  const updateSettlementStatus = useCallback(async (settlement, status) => {
    try {
      if (!expense.id) {
        throw new Error('Expense ID is missing');
      }

      // Get current settlements from the expense
      const currentSettlements = expense.settlements || [];
      
      // Find and update the specific settlement
      const updatedSettlements = currentSettlements.map(s => {
        if (s.debtor === settlement.from && s.creditor === settlement.to && s.amount === settlement.amount) {
          return {
            ...s,
            status: status,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      });

      // Update the expense with the new settlements
      await updateExpense(expense.id, { settlements: updatedSettlements }, getCurrentUser()?.uid);
      
    } catch (error) {
      throw error;
    }
  }, [expense, getCurrentUser]);

  const handleUndoMarkAsPaid = useCallback((settlement) => {
    const settlementId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
    // Create animation values for the undo transition
    const undoScale = new Animated.Value(1);
    const settledUpOpacity = new Animated.Value(1);
    const buttonsOpacity = new Animated.Value(0);
    const buttonsScale = new Animated.Value(0.8);
    setSettledStates(prev => ({
        ...prev,
        [settlementId]: false
    }));
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
    
  }, []);

  const saveSettlement = useCallback(async () => {
    try {
      // Validate expense ID
      if (!expense.id) {
        throw new Error('Expense ID is missing');
      }
      
      // Create settlements array from the current settlements (which are working correctly)
      const settlementsData = (settlements || []).map(settlement => {
        const settlementId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
        const isSettled = settledStates[settlementId] === true;
        const hasRequestBeenSent = requestSentStates[settlementId] === true;
        const hasPaymentBeenMade = paymentMadeStates[settlementId] === true;
        
        // Determine status based on user actions, but preserve existing status if no new actions
        let status = settlement.status || 'noAction';
        if (isSettled == true) {
          status = 'markedAsPaid';
        }
        if (isSettled == false) {
          status = 'noAction';
        } 
        else if (hasPaymentBeenMade) {
          status = 'paymentMade';
        } else if (hasRequestBeenSent) {
          status = 'paymentRequested';
        }
        
        return {
          debtor: settlement.from || 'Unknown',
          creditor: settlement.to || 'Unknown',
          amount: settlement.amount || 0,
          updatedAt: new Date().toISOString(),
          associatedItems: [], // TODO: Map to specific items if needed
          status: status
        };
      });
      
      // Update the expense with settlements data
      await updateExpense(expense.id, { settlements: settlementsData }, getCurrentUser()?.uid);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [expense, settlements, settledStates, requestSentStates, paymentMadeStates]);

  const handleRequestPayment = async (settlement) => {
    try {
      // Find the participant who should make the payment
      const payerParticipant = participants.find(p => p.name === settlement.from);
      
      if (!payerParticipant?.userId) {
        Alert.alert('Error', 'Unable to find payer information');
        return;
      }

      // Get the payer's profile to get their Venmo username
      const payerProfile = await getUserProfile(payerParticipant.userId);
      
      if (!payerProfile?.username) {
        Alert.alert('Error', 'Payer does not have a Venmo username set up');
        return;
      }

      // Create Venmo deeplink for requesting payment
      const amount = settlement.amount.toFixed(2);
      const note = `IOU Payment Request - ${expense.title || 'Expense'}`;
      const deeplink = `venmo://paycharge?txn=charge&recipients=${payerProfile.username}&amount=${amount}&note=${encodeURIComponent(note)}`;

      // Open the deeplink
      const supported = await Linking.canOpenURL(deeplink);
      if (supported) {
        // Mark that Venmo app is being opened
        setIsVenmoAppActive(true);
        
        // Create a unique identifier for this request
        const requestId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
        
        // Store the request ID for tracking
        setRequestSentStates(prev => ({
          ...prev,
          [requestId]: false // Initially false, will be set to true when user returns
        }));
        
        await Linking.openURL(deeplink);
      } else {
        Alert.alert('Error', 'Venmo is not installed on this device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open Venmo. Please try again.');
    }
  };

  const renderSettlementItem = (settlement, index) => {
    const fromParticipant = participants.find(p => p.name === settlement.from);
    const toParticipant = participants.find(p => p.name === settlement.to);
    
    // Check if a request has been sent for this settlement
    const requestId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
    const hasRequestBeenSent = requestSentStates[requestId] === true || settlement.status === 'paymentRequested';
    
    // Check if this settlement is marked as paid/settled
    const settlementId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
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
                <Image source={{ uri: fromParticipant.profilePhoto }} style={styles.participantAvatar} />
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

          {/* Arrow and Amount */}
          <View style={styles.arrowContainer}>
            {(() => {
              // Calculate dynamic arrow positioning
              const avatarSize = AVATAR_SIZE; // Avatar width
              const avatarMargin = AVATAR_MARGIN; // Margin around avatar
              const totalAvatarWidth = avatarSize + (avatarMargin * 2);
              const arrowContainerWidth = screenWidth * 0.9 - (totalAvatarWidth * 2) - (Spacing.lg * 4); // Account for padding
              const bubbleWidth = BUBBLE_WIDTH; // Width of the amount bubble
              const arrowStartX = 10;
              const arrowEndX = arrowContainerWidth - 10;
              const bubbleCenterX = arrowContainerWidth / 2;
              const bubbleStartX = bubbleCenterX - (bubbleWidth / 2);
              const bubbleEndX = bubbleCenterX + (bubbleWidth / 2);
              
              return (
                <Svg width={arrowContainerWidth} height="50" viewBox={`0 0 ${arrowContainerWidth} 50`} style={styles.arrowSvg}>
                  <Defs>
                    <LinearGradient id={`arrowGradient-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor={Colors.accent} stopOpacity="0.3" />
                      <Stop offset="25%" stopColor={Colors.accent} stopOpacity="0.8" />
                      <Stop offset="75%" stopColor={Colors.accent} stopOpacity="0.8" />
                      <Stop offset="100%" stopColor={Colors.accent} stopOpacity="0.3" />
                    </LinearGradient>
                  </Defs>
                  
                  {/* Arrow line - dynamically positioned */}
                  <Path
                    d={`M ${arrowStartX} 25 L ${arrowEndX} 25`}
                    stroke={`url(#arrowGradient-${index})`}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  
                  {/* Amount bubble background - dynamically positioned */}
                  <Path
                    d={`M ${bubbleStartX} 10 L ${bubbleEndX} 10 A 15 15 0 0 1 ${bubbleEndX} 40 L ${bubbleStartX} 40 A 15 15 0 0 1 ${bubbleStartX} 10 Z`}
                    fill={Colors.surface}
                    stroke={Colors.accent}
                    strokeWidth="2"
                  />
                  
                  {/* Arrow head - dynamically positioned */}
                  <Path
                    d={`M ${arrowEndX - 10} 20 L ${arrowEndX} 25 L ${arrowEndX - 10} 30`}
                    stroke={Colors.accent}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              );
            })()}
            
            {/* Amount text positioned over the bubble */}
            <View style={styles.amountTextContainer}>
              <Text style={styles.amountText}>
                ${settlement.amount.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Receiver */}
          <View style={styles.participantColumn}>
            <View style={styles.participantAvatarContainer}>
              {toParticipant?.profilePhoto ? (
                <Image source={{ uri: toParticipant.profilePhoto }} style={styles.participantAvatar} />
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
                    onPress={() => handleUndoMarkAsPaid(settlement)}
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
                  onPress={() => handleMarkAsPaid(settlement)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.markAsPaidButtonText}>Mark as Paid</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={getButtonStyle()}
                  onPress={() => {
                    if (settlement.from === name) {
                      handleMakePayment(settlement);
                    } else if (settlement.to === name && !hasRequestBeenSent) {
                      handleRequestPayment(settlement);
                    } else if (settlement.to === name && hasRequestBeenSent) {
                      // Request already sent, maybe show a message or do nothing
                    } else {
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
                onPress={() => handleMarkAsPaid(settlement)}
                activeOpacity={0.8}
              >
                <Text style={styles.markAsPaidButtonText}>Mark as Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={getButtonStyle()}
                onPress={() => {
                  if (settlement.from === name) {
                    handleMakePayment(settlement);
                  } else if (settlement.to === name && !hasRequestBeenSent) {
                    handleRequestPayment(settlement);
                  } else if (settlement.to === name && hasRequestBeenSent) {
                    // Request already sent, maybe show a message or do nothing
                  } else {
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
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={30} tint="light" style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settle Up</Text>
        <View style={styles.headerSpacer} />
      </BlurView>

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
            Optimal Settlements
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
            try {
              // Save settlement data before navigating home
              const result = await saveSettlement();
              if (result.success) {
                navigation.navigate('HomeMain');
              } else {
                Alert.alert('Error', 'Failed to save settlement. Please try again.');
              }
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
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
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    flex: 1,
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
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    position: 'relative',
    height: 50,
    minWidth: 100, // Ensure minimum width for the arrow
  },
  arrowSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  amountTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  amountText: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 14,
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