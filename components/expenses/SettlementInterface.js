import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
  Linking,
  Clipboard,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../../design/tokens';
import { getCurrentUser } from '../../services/authService';
import { getUserProfile } from '../../services/friendService';

const AVATAR_SIZE = 48;

const SettlementInterface = ({ 
  settlements = [], 
  participants = [], 
  expenseTitle = '', 
  currentUserId,
  onAction,
  readOnly = false,
  recalculationInfo = null,
  onDismissRecalculation,
}) => {
  const [animationStates, setAnimationStates] = useState({});
  const [loadingStates, setLoadingStates] = useState({});

  const currentUser = participants.find(p => p.userId === currentUserId) || { name: 'Unknown' };
  const currentUserName = currentUser.name || '';

  // Helper to get unique key for settlement
  const getSettlementKey = useCallback((settlement) => {
    const from = settlement.debtor || settlement.from;
    const to = settlement.creditor || settlement.to;
    const amount = settlement.amount;
    const roundedAmount = Math.round(amount * 100) / 100;
    return `${from}|||${to}|||${roundedAmount}`;
  }, []);

  // Initialize animation states if needed
  const animateAction = useCallback((settlementId, type) => {
    const checkmarkScale = new Animated.Value(0);
    const checkmarkOpacity = new Animated.Value(0);
    const textOpacity = new Animated.Value(0);
    const buttonScale = new Animated.Value(1);

    setAnimationStates(prev => ({
      ...prev,
      [settlementId]: {
        checkmarkScale,
        checkmarkOpacity,
        textOpacity,
        buttonScale,
        type // 'settled', 'requested', 'paid', 'reminded'
      }
    }));

    // Button click effect
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    // Success state animation
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
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 350,
          delay: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }, 150);
  }, []);

  const handleActionPress = async (action, settlement) => {
    if (readOnly) return;
    
    const settlementId = getSettlementKey(settlement);
    setLoadingStates(prev => ({ ...prev, [settlementId]: true }));

    try {
      if (action === 'venmo') {
        const recipient = participants.find(p => p.name === settlement.to);
        if (recipient?.userId) {
            const profile = await getUserProfile(recipient.userId);
            if (profile?.venmoUsername) {
                const amount = settlement.amount.toFixed(2);
                const note = `IOU Payment - ${expenseTitle}`;
                const deeplink = `venmo://paycharge?txn=pay&recipients=${profile.venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;
                const supported = await Linking.canOpenURL(deeplink);
                if (supported) {
                    await Linking.openURL(deeplink);
                    
                    // After successful deep link, trigger the action callback
                    // In a real app we can't detect if they actually paid, but we treat the intent as the action
                    // We let the parent handle the status update via onAction below
                } else {
                    Alert.alert('Error', 'Venmo app is not installed');
                    setLoadingStates(prev => ({ ...prev, [settlementId]: false }));
                    return; // Exit if Venmo not supported
                }
            } else {
                Alert.alert('Error', 'Recipient does not have a Venmo username connected');
                setLoadingStates(prev => ({ ...prev, [settlementId]: false }));
                return;
            }
        }
      }

      await onAction(action, settlement);
      
      // Trigger animation for state changing actions
      if (['markAsPaid', 'requestPayment', 'paymentMade', 'sendReminder'].includes(action)) {
        animateAction(settlementId, action);
      }
    } catch (error) {
      console.error('Action failed:', error);
      Alert.alert('Error', 'Failed to perform action');
    } finally {
      setLoadingStates(prev => ({ ...prev, [settlementId]: false }));
    }
  };

  const renderSettlementItem = (settlement, index) => {
    const settlementId = getSettlementKey(settlement);
    const fromName = settlement.debtor || settlement.from;
    const toName = settlement.creditor || settlement.to;
    
    const fromParticipant = participants.find(p => p.name === fromName);
    const toParticipant = participants.find(p => p.name === toName);

    const isMeDebtor = fromParticipant?.userId === currentUserId;
    const isMeCreditor = toParticipant?.userId === currentUserId;
    
    // Determine current status
    const status = settlement.status || 'noAction';
    const isSettled = status === 'markedAsPaid' || status === 'confirmed';
    const isPaymentMade = status === 'paymentMade';
    const isRequested = status === 'paymentRequested';
    const isReminded = status === 'reminderSent';

    // Animation state
    const animState = animationStates[settlementId];
    
    // Effective state for UI (considering animation)
    const showSettled = isSettled || (animState?.type === 'markAsPaid');
    const showPaymentMade = isPaymentMade || (animState?.type === 'paymentMade');
    const showRequested = isRequested || (animState?.type === 'requestPayment');
    
    return (
      <View key={index} style={styles.settlementCard}>
        {/* Participants Row */}
        <View style={styles.settlementRow}>
            {/* Debtor (From) */}
            <View style={styles.participantColumn}>
            <View style={styles.avatarContainer}>
                {fromParticipant?.profilePhoto ? (
                <Image 
                    source={{ uri: fromParticipant.profilePhoto }} 
                    style={styles.avatar}
                    contentFit="cover"
                />
                ) : (
                <View style={[
                    styles.avatarPlaceholder,
                    isMeDebtor && styles.currentUserAvatar
                ]}>
                    <Text style={[
                        styles.avatarInitials,
                        isMeDebtor && styles.currentUserInitials
                    ]}>
                    {isMeDebtor ? 'M' : (fromName[0] || 'U').toUpperCase()}
                    </Text>
                </View>
                )}
            </View>
            <Text style={styles.participantName} numberOfLines={1}>
                {isMeDebtor ? 'Me' : fromName}
            </Text>
            {fromParticipant?.username && (
                <Text style={styles.participantUsername} numberOfLines={1}>
                    @{fromParticipant.username}
                </Text>
            )}
            </View>

            {/* Amount & Arrow */}
            <View style={styles.centerColumn}>
                <View style={styles.arrowContainer}>
                    <View style={styles.arrowLine} />
                    {/* Amount sits on top of arrow line in the middle */}
                     <Text style={styles.amountText}>${settlement.amount.toFixed(2)}</Text>
                     
                    <View style={styles.arrowLine}>
                         <View style={styles.arrowHead} />
                    </View>
                </View>
            </View>

            {/* Creditor (To) */}
            <View style={styles.participantColumn}>
            <View style={styles.avatarContainer}>
                {toParticipant?.profilePhoto ? (
                <Image 
                    source={{ uri: toParticipant.profilePhoto }} 
                    style={styles.avatar}
                    contentFit="cover"
                />
                ) : (
                <View style={[
                    styles.avatarPlaceholder,
                    isMeCreditor && styles.currentUserAvatar
                ]}>
                    <Text style={[
                        styles.avatarInitials,
                        isMeCreditor && styles.currentUserInitials
                    ]}>
                    {isMeCreditor ? 'M' : (toName[0] || 'U').toUpperCase()}
                    </Text>
                </View>
                )}
            </View>
            <Text style={styles.participantName} numberOfLines={1}>
                {isMeCreditor ? 'Me' : toName}
            </Text>
            {toParticipant?.username && (
                <Text style={styles.participantUsername} numberOfLines={1}>
                    @{toParticipant.username}
                </Text>
            )}
            </View>
        </View>

        {/* Action Buttons */}
        {!readOnly && (
            <View style={styles.actionsContainer}>
                {showSettled ? (
                    <View style={styles.statusContainer}>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        <Text style={styles.statusText}>Settled Up</Text>
                        <TouchableOpacity 
                            style={styles.undoButton}
                            onPress={() => handleActionPress('undo', settlement)}
                        >
                            <Ionicons name="arrow-undo" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                ) : showPaymentMade ? (
                    <View style={styles.statusContainer}>
                         <Ionicons name="cash" size={20} color={Colors.accent} />
                        <Text style={styles.statusText}>Payment Sent</Text>
                         {isMeCreditor && (
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={() => handleActionPress('markAsPaid', settlement)}
                            >
                                <Text style={styles.confirmButtonText}>Confirm Received</Text>
                            </TouchableOpacity>
                         )}
                         <TouchableOpacity 
                            style={styles.undoButton}
                            onPress={() => handleActionPress('undo', settlement)}
                        >
                             <Ionicons name="arrow-undo" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.buttonRow}>
                        {isMeDebtor && (
                            <>
                                <TouchableOpacity 
                                    style={[styles.actionButton, styles.markPaidButton]}
                                    onPress={() => handleActionPress('markAsPaid', settlement)}
                                >
                                    <Text style={styles.markPaidButtonText}>Mark Paid</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.actionButton, styles.venmoButton]}
                                    onPress={() => handleActionPress('venmo', settlement)}
                                >
                                    <Ionicons name="logo-venmo" size={16} color={Colors.white} style={{marginRight: 4}} />
                                    <Text style={styles.venmoButtonText}>Venmo</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        {isMeCreditor && (
                            <>
                                <TouchableOpacity 
                                    style={[styles.actionButton, styles.markPaidButton]}
                                    onPress={() => handleActionPress('markAsPaid', settlement)}
                                >
                                    <Text style={styles.markPaidButtonText}>Mark Received</Text>
                                </TouchableOpacity>
                                {!showRequested && (
                                    <TouchableOpacity 
                                        style={[styles.actionButton, styles.secondaryButton]}
                                        onPress={() => handleActionPress('requestPayment', settlement)}
                                    >
                                        <Text style={styles.secondaryButtonText}>Request</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                        {!isMeDebtor && !isMeCreditor && (
                            <TouchableOpacity 
                                style={[styles.actionButton, styles.secondaryButton]}
                                onPress={() => handleActionPress('sendReminder', settlement)}
                                disabled={isReminded}
                            >
                                <Text style={styles.secondaryButtonText}>{isReminded ? 'Reminded' : 'Remind'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        )}
      </View>
    );
  };

  if (!settlements.length && !readOnly) {
     return (
        <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            <Text style={styles.emptyTitle}>All Settled Up!</Text>
            <Text style={styles.emptyText}>Everyone is square. No payments needed.</Text>
        </View>
     );
  }

  return (
    <View style={styles.container}>
        {recalculationInfo && (
            <View style={styles.banner}>
                <Ionicons name="information-circle" size={20} color={Colors.accent} />
                <View style={styles.bannerContent}>
                    <Text style={styles.bannerText}>Settlements updated due to changes.</Text>
                    <Text style={styles.bannerSubtext}>
                        {recalculationInfo.newSettlements} new, {recalculationInfo.paidSettlements} paid preserved.
                    </Text>
                </View>
                {onDismissRecalculation && (
                    <TouchableOpacity onPress={onDismissRecalculation}>
                        <Ionicons name="close" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>
        )}
      {settlements.map(renderSettlementItem)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xl,
  },
  settlementCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
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
    width: 80, // Updated from 60 to 80
  },
  centerColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row', 
  },
  avatarContainer: {
    marginBottom: 4,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.avatar,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.avatar,
  },
  currentUserAvatar: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
    borderWidth: 3,
  },
  avatarInitials: {
    fontSize: Math.floor(AVATAR_SIZE / 2.5),
    fontWeight: '600',
    color: Colors.textSecondary,
    fontFamily: Typography.familySemiBold,
  },
  currentUserInitials: {
    color: Colors.white,
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
    fontSize: 10,
    maxWidth: 80,
  },
  arrowContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  arrowLine: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.accent,
    opacity: 0.4,
    position: 'relative',
    justifyContent: 'center',
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
  amountText: {
    ...Typography.h3,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.accent,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    zIndex: 1,
  },
  actionsContainer: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
  },
  markPaidButton: {
    backgroundColor: Colors.accent,
  },
  markPaidButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  venmoButton: {
    backgroundColor: '#008CFF', // Venmo blue
  },
  venmoButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: Spacing.xs,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  undoButton: {
    marginLeft: Spacing.md,
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
  },
  emptyTitle: {
    marginTop: Spacing.md,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyText: {
    marginTop: Spacing.xs,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  bannerContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  bannerSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginLeft: Spacing.sm,
  },
  confirmButtonText: {
    color: Colors.white,
     fontSize: 12,
     fontWeight: '600',
  }
});

export default SettlementInterface;
