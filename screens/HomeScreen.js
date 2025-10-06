import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { handleTakePhoto, handlePickImage } from '../services/imageHandler';
import { processReceiptImage } from '../services/receiptScanner';
import { requestReceiptScanningAccess } from '../services/subscriptionService';
import { useReceiptScanning } from '../App';
import { calculateUserBalanceForExpense, calculateExpenseTotal } from '../utils/balanceCalculator';
import { useExpenseData } from '../contexts/ExpenseDataContext';

const HomeScreen = ({ navigation }) => {
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const { setIsReceiptScanning, startScanningAnimation, stopScanningAnimation } = useReceiptScanning();
  
  const { expenses, loading } = useExpenseData();
  const calculateExpenseBalance = (expense) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { youOwe: 0, youPaid: 0 };
    }
    
    const balance = calculateUserBalanceForExpense(expense, currentUser.uid);
    return { youOwe: balance.netBalance, youPaid: balance.youPaid };
  };

  const getSettlementStatus = (expense) => {
    if (!expense.settlements || expense.settlements.length === 0) {
      const balance = calculateExpenseBalance(expense);
      return Math.abs(balance.youOwe) < 0.01 ? 'settled' : 'needsSettlement';
    }

    const allSettled = expense.settlements.every(settlement => 
      settlement.status === 'markedAsPaid'
    );

    return allSettled ? 'settled' : 'needsSettlement';
  };

  const handleReceiptScan = async () => {
    try {
      const hasAccess = await requestReceiptScanningAccess();
      
      if (!hasAccess) {
        return;
      }
      Alert.alert(
        'Scan Receipt',
        'Choose how you want to scan your receipt.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => handleTakePhoto(
            (imageUri) => processReceiptImage(
              imageUri,
              () => {
                setScanningReceipt(true);
                startScanningAnimation();
              },
              () => {
                stopScanningAnimation();
              },
              (receiptData) => {
                navigation.navigate('SetupExpense', { 
                  expenseType: 'receipt',
                  scannedReceipt: receiptData,
                  fromReceiptScan: true 
                });
              },
              (errorMessage) => {
                Alert.alert('Receipt Scanning Error', errorMessage);
              }
            ),
            (error) => Alert.alert('Error', error),
            setIsReceiptScanning
          ) },
          { text: 'Choose from Gallery', onPress: () => handlePickImage(
            (imageUri) => processReceiptImage(
              imageUri,
              () => {
                setScanningReceipt(true);
                startScanningAnimation();
              },
              () => {
                stopScanningAnimation();
              },
              (receiptData) => {
                navigation.navigate('SetupExpense', { 
                  expenseType: 'receipt',
                  scannedReceipt: receiptData,
                  fromReceiptScan: true 
                });
              },
              (errorMessage) => {
                Alert.alert('Receipt Scanning Error', errorMessage);
              }
            ),
            (error) => Alert.alert('Error', error),
            setIsReceiptScanning
          ) }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to start receipt scanning');
    }
  };

  const renderExpenseItem = ({ item }) => {
    const totalItems = item.items?.length || 0;
    const totalParticipants = item.participants?.length || 0;
    const expenseBalance = calculateExpenseBalance(item);
    
    const isReceipt = item.expenseType === 'receipt' || 
                     item.fromReceiptScan || 
                     (item.title && item.title.toLowerCase().includes('receipt'));
    const isExpense = item.expenseType === 'expense' || !isReceipt;
    
    const paymentSummary = {};

    const paidByIndices = Array.isArray(item.selectedPayers)
      ? item.selectedPayers
      : typeof item.selectedPayers === 'number'
        ? [item.selectedPayers]
        : [];

    const totalAmount = calculateExpenseTotal(item);
    
    const splitAmount = paidByIndices.length > 0 ? totalAmount / paidByIndices.length : 0;

    paidByIndices.forEach(idx => {
      const paidByName = item.participants?.[idx]?.name || 'Unknown';
      paymentSummary[paidByName] = (paymentSummary[paidByName] || 0) + splitAmount;
    });

    if (paidByIndices.length === 0) {
      paymentSummary['Unknown'] = (paymentSummary['Unknown'] || 0) + totalAmount;
    }

    const handleItemPress = () => {
      if (isReceipt) {
        navigation.navigate('AddReceipt', { expense: item });
      } else {
        navigation.navigate('AddExpense', { expense: item });
      }
    };

    return (
      <TouchableOpacity
        style={[styles.expenseCard, isReceipt && styles.receiptCard]}
        onPress={handleItemPress}
        activeOpacity={0.92}
      >
        
        <View style={styles.expenseHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.expenseTitle}>{item.title}</Text>
          </View>
          <View style={styles.rightHeaderSection}>
            <View style={[styles.typeBadge, isReceipt ? styles.receiptBadge : styles.expenseBadge]}>
              <Text style={[styles.typeText, isReceipt ? styles.receiptTypeText : styles.expenseTypeText]}>
                {isReceipt ? 'Receipt' : 'Expense'}
              </Text>
            </View>
            <View style={styles.expenseBalance}>
              {(() => {
                const settlementStatus = getSettlementStatus(item);
                
                if (settlementStatus === 'settled') {
                  return (
                    <View style={styles.evenContainer}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.evenText}>Settled up</Text>
                    </View>
                  );
                } else {
                  if (expenseBalance.youOwe > 0) {
                    return (
                      <View style={styles.oweContainer}>
                        <Ionicons name="arrow-up-circle" size={16} color={Colors.danger} />
                        <Text style={styles.oweText}>You owe ${expenseBalance.youOwe.toFixed(2)}</Text>
                      </View>
                    );
                  } else if (expenseBalance.youOwe < 0) {
                    return (
                      <View style={styles.owedContainer}>
                        <Ionicons name="arrow-down-circle" size={16} color={Colors.success} />
                        <Text style={styles.owedText}>You're owed ${Math.abs(expenseBalance.youOwe).toFixed(2)}</Text>
                      </View>
                    );
                  } else {
                    return (
                      <View style={styles.needsSettlementContainer}>
                        <Ionicons name="time-outline" size={16} color={Colors.warning} />
                        <Text style={styles.needsSettlementText}>Needs settlement</Text>
                      </View>
                    );
                  }
                }
              })()}
            </View>
          </View>
        </View>
        
        <View style={styles.expenseDetails}>
          <Text style={styles.expenseTotal}>${calculateExpenseTotal(item).toFixed(2)}</Text>
        </View>

        {(() => {
          const currentUserId = getCurrentUser()?.uid;
          const otherMembers = item.participants?.filter(p => p.userId !== currentUserId) || [];
          
          if (otherMembers.length === 0) return null;
          
          return (
            <View style={styles.participantsContainer}>
              <View style={styles.participantsHeader}>
                <Text style={styles.participantsLabel}>Other Members</Text>
                <View style={styles.participantCountBadge}>
                  <Ionicons name="people" size={12} color={Colors.textSecondary} />
                  <Text style={styles.participantCountText}>{otherMembers.length}</Text>
                </View>
              </View>
              <View style={styles.participantsAvatars}>
                {otherMembers.slice(0, 6).map((participant, displayIndex) => {
                  const originalIndex = item.participants?.findIndex(p => p === participant) ?? -1;
                  
                  const paidForItems = originalIndex >= 0 && (item.items?.some(item => 
                    item.selectedPayers?.includes(originalIndex)
                  ) || false);
                  
                  const isOverflowIndicator = displayIndex === 5 && otherMembers.length > 6;
                  const remainingCount = otherMembers.length - 5;
                  const getAvatarColor = (name) => {
                    const colors = ['#FF6B9D', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'];
                    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    return colors[index % colors.length];
                  };
                  
                  const avatarColor = getAvatarColor(participant.name);
                  
                  return (
                    <View key={displayIndex} style={styles.participantAvatarContainer}>
                      <View style={styles.avatarWrapper}>
                        {isOverflowIndicator ? (
                          <View style={styles.overflowAvatar}>
                            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.surface} />
                          </View>
                        ) : participant.profilePhoto ? (
                          <View style={styles.avatarImageContainer}>
                            <Image 
                              source={{ uri: participant.profilePhoto }} 
                              style={styles.participantAvatar} 
                            />
                          </View>
                        ) : (
                          <View style={[
                            styles.participantAvatarPlaceholder,
                            { backgroundColor: avatarColor }
                          ]}>
                            <Text style={styles.participantAvatarInitials}>
                              {(participant.name[0] || 'U').toUpperCase()}
                            </Text>
                          </View>
                        )}
                        {!isOverflowIndicator && paidForItems && (
                          <View style={styles.paymentIndicator}>
                            <Ionicons name="wallet" size={10} color={Colors.surface} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.participantName} numberOfLines={1}>
                        {isOverflowIndicator ? `+${remainingCount}` : participant.name.split(' ')[0]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>No expenses yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Tap the + button to create your first expense
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Loading expenses...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>My Expenses</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.receiptButton}
            onPress={handleReceiptScan}
            disabled={scanningReceipt}
            activeOpacity={0.7}
          >
            {scanningReceipt ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="scan-outline" size={26} color="white" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('SetupExpense', { expenseType: 'expense' })}
          >
            <Ionicons name="add" size={26} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={expenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={expenses.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={renderEmptyState}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  receiptButton: {
    backgroundColor: Colors.blue,
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    ...Shadows.card,
  },
  addButton: {
    backgroundColor: Colors.accent,
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  listContainer: {
    padding: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyStateText: {
    ...Typography.title,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  expenseCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.card,
    overflow: 'hidden',
  },
  receiptCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.blue + '30',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.card,
    overflow: 'hidden',
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseTitle: {
    ...Typography.title,
    fontSize: 20,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
    fontWeight: '600',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    minWidth: 70,
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  typeText: {
    ...Typography.label,
    fontWeight: '600',
    fontSize: 12,
  },
  receiptBadge: {
    backgroundColor: Colors.blue + '10',
    borderColor: Colors.blue + '30',
  },
  receiptTypeText: {
    color: Colors.blue,
  },
  expenseBadge: {
    backgroundColor: Colors.accent + '10',
    borderColor: Colors.accent + '30',
  },
  expenseTypeText: {
    color: Colors.accent,
  },
  expenseBalance: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  oweContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },
  oweText: {
    ...Typography.label,
    color: Colors.danger,
    fontWeight: '600',
    marginLeft: 4,
  },
  owedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  owedText: {
    ...Typography.label,
    color: Colors.success,
    fontWeight: '600',
    marginLeft: 4,
  },
  evenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  evenText: {
    ...Typography.label,
    color: Colors.success,
    fontWeight: '600',
    marginLeft: 4,
  },
  needsSettlementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  needsSettlementText: {
    ...Typography.label,
    color: Colors.warning,
    fontWeight: '600',
    marginLeft: 4,
  },
  rightHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  expenseDetails: {
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  expenseTotal: {
    fontSize: 32,
    fontFamily: Typography.familyBold,
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  expenseInfo: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  participantsContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  participantsLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  participantCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    gap: 4,
  },
  participantCountText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  participantsList: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  paymentSummaryContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  paymentSummaryLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  paymentSummaryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  paymentSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentSummaryName: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginRight: 6,
    fontWeight: '500',
  },
  paymentSummaryAmount: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptIndicator: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.blue + '10',
    borderRadius: Radius.pill,
    padding: Spacing.xxs,
    borderWidth: 1,
    borderColor: Colors.blue + '30',
  },
  participantsAvatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  participantAvatarContainer: {
    alignItems: 'center',
    width: 64,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.xs,
  },
  avatarImageContainer: {
    position: 'relative',
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: Colors.surface,
    backgroundColor: Colors.background,
  },
  participantAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.avatar,
  },
  participantAvatarInitials: {
    color: Colors.surface,
    fontSize: 14,
    fontFamily: Typography.familySemiBold,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  paymentIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.success,
    borderWidth: 2.5,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  participantName: {
    ...Typography.caption,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 64,
    lineHeight: 14,
  },
  overflowAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.textSecondary + '90',
    borderWidth: 2.5,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.avatar,
  },
  overflowText: {
    color: Colors.surface,
    fontSize: 13,
    fontFamily: Typography.familySemiBold,
    fontWeight: '700',
  },

});

export default HomeScreen;