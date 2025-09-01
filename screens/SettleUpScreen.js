import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { calculateSettlement, calculateHubSettlement, getSettlementSummary } from '../utils/settlementCalculator';
import { getCurrentUser } from '../services/authService';
import { saveExpenseWithSettlement } from './AddExpenseScreenFunctions';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const AVATAR_SIZE = 48;
const AVATAR_MARGIN = 6;
const BUBBLE_WIDTH = 60;

const SettleUpScreen = ({ route, navigation }) => {
  const { expense, participants } = route.params;
  const [settlementType, setSettlementType] = useState('optimal'); // 'optimal' or 'hub'
  const [loading, setLoading] = useState(false);
  console.log('settlupexpense', expense);
  console.log('settleupparticipants', participants);
  if (!expense) {
    navigation.goBack();
    return null;
  }

  const name = participants[0].name;

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
      await saveExpenseWithSettlement(
        expense,
        getCurrentUser(),
        settlements,
        settlementType,
        navigation,
        () => {} // resetChanges function - not needed here
      );
    } catch (error) {
      console.error('Error saving expense with settlement:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Navigate back to home screen without saving settlement
    navigation.getParent()?.getParent()?.reset({
      index: 0,
      routes: [
        {
          name: 'Home',
          state: {
            routes: [{ name: 'HomeMain' }],
            index: 0,
          },
        },
      ],
    });
  };

  const renderSettlementItem = (settlement, index) => {
    const fromParticipant = participants.find(p => p.name === settlement.from);
    const toParticipant = participants.find(p => p.name === settlement.to);

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

      {/* Footer */}
      <BlurView intensity={30} tint="light" style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleSkip}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptButton, loading && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={loading}
        >
          <Ionicons name="checkmark" size={20} color={Colors.surface} />
          <Text style={styles.acceptButtonText}>
            {loading ? 'Saving...' : 'Accept Proposal'}
          </Text>
        </TouchableOpacity>
      </BlurView>
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  cancelButtonText: {
    ...Typography.title,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    ...Shadows.button,
  },
  acceptButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  acceptButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
});

export default SettleUpScreen;
