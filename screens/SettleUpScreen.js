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
import { calculateSettlement, calculateHubSettlement, getSettlementSummary } from '../utils/settlementCalculator';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import { createExpense, updateExpense } from '../services/expenseService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const AVATAR_SIZE = 48;
const AVATAR_MARGIN = 6;
const BUBBLE_WIDTH = 60;

const SettleUpScreen = ({ route, navigation }) => {
  const { expense, participants } = route.params;
  const [settlementType, setSettlementType] = useState('optimal'); // 'optimal' or 'hub'
  const [loading, setLoading] = useState(false);
  const [requestSentStates, setRequestSentStates] = useState({}); // Track which requests have been sent
  const [isVenmoAppActive, setIsVenmoAppActive] = useState(false);
  const [settledStates, setSettledStates] = useState({}); // Track which settlements are marked as paid
  const [animationStates, setAnimationStates] = useState({}); // Track animation states for each settlement
  console.log('settlupexpense', expense);
  console.log('settleupparticipants', participants);
  if (!expense) {
    navigation.goBack();
    return null;
  }

  const name = participants[0].name;
  
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

  // Calculate settlements based on current type
  const optimalSettlement = calculateSettlement(expense);
  console.log('optimalSettlement', optimalSettlement);
  const settlements = settlementType === 'optimal' 
    ? optimalSettlement.settlements
    : calculateHubSettlement(optimalSettlement.balances || []);
  
  const summary = getSettlementSummary(settlements);
  
  // Find the hub participant for hub settlements
  const hubParticipant = settlementType === 'hub' && settlements.length > 0 
    ? settlements[0].to // The hub is always the receiver in hub settlements
    : null;

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
          type: settlementType,
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
      console.error('Error saving expense with settlement:', error);
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
      console.log('recipientProfile', recipientProfile);
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
      console.error('Error opening Venmo deeplink:', error);
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
    
    console.log('Marked as paid:', settlement);
  }, [animateSettledUp]);

  const handleUndoMarkAsPaid = useCallback((settlement) => {
    const settlementId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
    
    // Create animation values for the undo transition
    const undoScale = new Animated.Value(1);
    const settledUpOpacity = new Animated.Value(1);
    const buttonsOpacity = new Animated.Value(0);
    const buttonsScale = new Animated.Value(0.8);
    
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
      setSettledStates(prev => {
        const newState = { ...prev };
        delete newState[settlementId];
        return newState;
      });
      
      // Remove animation state
      setAnimationStates(prev => {
        const newState = { ...prev };
        delete newState[settlementId];
        return newState;
      });
    }, 500);
    
    console.log('Undid mark as paid:', settlement);
  }, []);

  const saveSettlement = useCallback(async () => {
    try {
      console.log('Saving settlement for expense:', expense.id);
      
      // Validate expense ID
      if (!expense.id) {
        throw new Error('Expense ID is missing');
      }
      
      // Get settlement summary data
      const summary = getSettlementSummary(settlements);
      
      // Create settleUps array from settlements with status mapping
      const settleUps = (settlements || []).map(settlement => {
        const settlementId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
        const isSettled = settledStates[settlementId] === true;
        const hasRequestBeenSent = requestSentStates[settlementId] === true;
        
        // Determine status based on user actions
        let status = 'awaitingAction';
        if (isSettled) {
          status = 'markedAsPaid';
        } else if (hasRequestBeenSent) {
          status = 'paymentRequested';
        }
        // Note: 'paymentSent' would be set when user actually sends payment via Venmo
        
        return {
          debtor: settlement.from || 'Unknown',
          creditor: settlement.to || 'Unknown',
          amount: settlement.amount || 0,
          status: status
        };
      });
      
      // Create settlement data structure with fallback values
      const settlementData = {
        settlementMethod: settlementType || 'optimal',
        totalTransactions: summary.totalTransactions || 0,
        amountTransacted: summary.amountTransacted || 0,
        peopleInvolved: summary.peopleInvolved || 0,
        settleUps: settleUps || []
      };
      
      // Debug logging to identify undefined fields
      console.log('Settlement data to save:', settlementData);
      console.log('Settlement method:', settlementType, typeof settlementType);
      console.log('Total transactions:', summary.totalTransactions, typeof summary.totalTransactions);
      console.log('Amount transacted:', summary.amountTransacted, typeof summary.amountTransacted);
      console.log('People involved:', summary.peopleInvolved, typeof summary.peopleInvolved);
      console.log('Settle ups:', settleUps);
      console.log('Settle ups length:', settleUps.length);
      
      // Check each settleUp for undefined values
      settleUps.forEach((settleUp, index) => {
        console.log(`SettleUp ${index}:`, settleUp);
        console.log(`  - debtor: ${settleUp.debtor} (${typeof settleUp.debtor})`);
        console.log(`  - creditor: ${settleUp.creditor} (${typeof settleUp.creditor})`);
        console.log(`  - amount: ${settleUp.amount} (${typeof settleUp.amount})`);
        console.log(`  - status: ${settleUp.status} (${typeof settleUp.status})`);
      });
      
      // Update the expense with settlement data
      await updateExpense(expense.id, { settlement: settlementData }, getCurrentUser()?.uid);
      
      console.log('Settlement saved successfully');
      return { success: true };
    } catch (error) {
      console.error('Error saving settlement:', error);
      return { success: false, error: error.message };
    }
  }, [expense, settlements, settlementType, settledStates, requestSentStates]);

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
      console.error('Error opening Venmo deeplink:', error);
      Alert.alert('Error', 'Failed to open Venmo. Please try again.');
    }
  };

  const renderSettlementItem = (settlement, index) => {
    const fromParticipant = participants.find(p => p.name === settlement.from);
    const toParticipant = participants.find(p => p.name === settlement.to);
    
    // Check if a request has been sent for this settlement
    const requestId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
    const hasRequestBeenSent = requestSentStates[requestId] === true;
    
    // Check if this settlement is marked as paid/settled
    const settlementId = `${settlement.from}-${settlement.to}-${settlement.amount}`;
    const isSettled = settledStates[settlementId] === true;
    const animationState = animationStates[settlementId];
    
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
                animationState ? { transform: [{ scale: animationState.buttonCombinationScale }] } : {}
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
                      animationState ? {
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
                      animationState ? { opacity: animationState.settledTextOpacity } : {}
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
                  animationState?.buttonsOpacity ? {
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
                      console.log('Request already sent for:', settlement);
                    } else {
                      // TODO: Add send reminder functionality
                      console.log('Send reminder for:', settlement);
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
                    console.log('Request already sent for:', settlement);
                  } else {
                    // TODO: Add send reminder functionality
                    console.log('Send reminder for:', settlement);
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

  const renderSettlementTypeSelector = () => (
    <View style={styles.typeSelector}>
      <Text style={styles.typeSelectorLabel}>Settlement Method:</Text>
      <View style={styles.typeButtons}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            settlementType === 'optimal' && styles.typeButtonActive
          ]}
          onPress={() => setSettlementType('optimal')}
        >
          <Text style={[
            styles.typeButtonText,
            settlementType === 'optimal' && styles.typeButtonTextActive
          ]}>
            Optimal
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeButton,
            settlementType === 'hub' && styles.typeButtonActive
          ]}
          onPress={() => setSettlementType('hub')}
        >
          <Text style={[
            styles.typeButtonText,
            settlementType === 'hub' && styles.typeButtonTextActive
          ]}>
            Hub
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSummary = () => (
    <View style={styles.summaryContainer}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Total Transactions:</Text>
        <Text style={styles.summaryValue}>{summary.totalTransactions}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Total Amount:</Text>
        <Text style={styles.summaryValue}>${summary.totalAmount.toFixed(2)}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>People Involved:</Text>
        <Text style={styles.summaryValue}>
          {summary.uniquePeople} people
        </Text>
      </View>
    </View>
  );

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
        {/* Settlement Type Selector */}
        {renderSettlementTypeSelector()}

        {/* Summary */}
        {renderSummary()}

        {/* Settlements List */}
        <View style={styles.settlementsSection}>
          <Text style={styles.sectionTitle}>
            {settlementType === 'optimal' ? 'Optimal Settlements' : 'Hub Settlements'}
            {settlementType === 'hub' && hubParticipant && (
              <Text style={styles.hubTitleIndicator}>
                {' '}(Hub: {hubParticipant === name ? 'Me' : hubParticipant})
              </Text>
            )}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {settlementType === 'optimal' 
              ? 'Minimizes total number of transactions'
              : 'One person acts as the central hub for all payments'
            }
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
                console.log('Settlement saved successfully, navigating home');
                navigation.navigate('HomeMain');
              } else {
                console.error('Failed to save settlement:', result.error);
                Alert.alert('Error', 'Failed to save settlement. Please try again.');
              }
            } catch (error) {
              console.error('Error in return home handler:', error);
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
  typeSelector: {
    marginBottom: Spacing.lg,
  },
  typeSelectorLabel: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  typeButtons: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: Spacing.xxs,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.accent,
  },
  typeButtonText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: Colors.surface,
    fontWeight: '600',
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
  hubTitleIndicator: {
    ...Typography.body2,
    color: Colors.accent,
    fontWeight: '500',
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
});

export default SettleUpScreen;
