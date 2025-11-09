import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { calculateUserBalanceForExpense, calculateExpenseTotal } from '../utils/balanceCalculator';
import { useExpenseData } from '../contexts/ExpenseDataContext';
import AnimatedSearchHeader from '../components/AnimatedSearchHeader';

const HomeScreen = ({ navigation }) => {
  const { expenses, loading, loadingMore, hasMore, loadMoreExpenses, balances } = useExpenseData();
  const [searchQuery, setSearchQuery] = useState('');
  const searchHeaderRef = useRef(null);
  const calculateExpenseBalance = (expense) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { youOwe: 0, youPaid: 0 };
    }
    
    const balance = calculateUserBalanceForExpense(expense, currentUser.uid);
    
    // Calculate pending confirmation amounts to subtract from the balance
    let pendingAmount = 0;
    if (expense.settlements && expense.settlements.length > 0) {
      const currentUserParticipant = expense.participants?.find(p => p.userId === currentUser.uid);
      const currentUserName = currentUserParticipant?.name;
      
      expense.settlements.forEach(settlement => {
        // Check if settlement is in paymentRequested or paymentMade status
        if (settlement.status === 'paymentRequested' || settlement.status === 'paymentMade') {
          const isDebtor = settlement.debtor === currentUserName || settlement.from === currentUserName;
          const isCreditor = settlement.creditor === currentUserName || settlement.to === currentUserName;
          
          if (isDebtor) {
            // User owes this amount, but it's pending confirmation
            pendingAmount += settlement.amount;
          } else if (isCreditor) {
            // User is owed this amount, but it's pending confirmation
            pendingAmount -= settlement.amount;
          }
        }
      });
    }
    
    // Subtract pending amounts from the balance
    const adjustedBalance = balance.netBalance - pendingAmount;
    
    return { youOwe: adjustedBalance, youPaid: balance.youPaid };
  };

  const getSettlementStatus = (expense) => {
    if (!expense.settlements || expense.settlements.length === 0) {
      const balance = calculateExpenseBalance(expense);
      return Math.abs(balance.youOwe) < 0.01 ? 'settled' : 'needsSettlement';
    }

    const currentUserId = getCurrentUser()?.uid;
    const currentUserParticipant = expense.participants?.find(p => p.userId === currentUserId);
    const currentUserName = currentUserParticipant?.name;

    const allSettled = expense.settlements.every(settlement => 
      settlement.status === 'markedAsPaid'
    );

    if (allSettled) {
      return 'settled';
    }

    // Check settlement statuses to determine badge
    // User needs to confirm if:
    // 1) paymentRequested status AND user is debtor (creditor requested payment)
    // 2) paymentMade status AND user is creditor (debtor made payment)
    // User is awaiting confirmation if:
    // 1) paymentRequested status AND user is creditor (user requested payment)
    // 2) paymentMade status AND user is debtor (user made payment)
    
    let needsConfirmation = false;
    let awaitingConfirmation = false;

    expense.settlements.forEach(settlement => {
      const isDebtor = settlement.debtor === currentUserName || settlement.from === currentUserName;
      const isCreditor = settlement.creditor === currentUserName || settlement.to === currentUserName;
      
      if (settlement.status === 'paymentRequested') {
        if (isDebtor) {
          // Creditor requested payment, debtor needs to confirm
          needsConfirmation = true;
        } else if (isCreditor) {
          // User is creditor who requested payment, awaiting debtor confirmation
          awaitingConfirmation = true;
        }
      } else if (settlement.status === 'paymentMade') {
        if (isCreditor) {
          // Debtor made payment, creditor needs to confirm
          needsConfirmation = true;
        } else if (isDebtor) {
          // User is debtor who made payment, awaiting creditor confirmation
          awaitingConfirmation = true;
        }
      }
    });

    if (needsConfirmation) {
      return 'confirmPayment';
    }

    if (awaitingConfirmation) {
      return 'awaitingConfirmation';
    }

    return 'needsSettlement';
  };

  // Filter expenses based on search query
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) {
      return expenses;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return expenses.filter(expense => {
      // Search by expense title
      const titleMatch = expense.title?.toLowerCase().includes(query);
      
      // Search by participant names
      const participantMatch = expense.participants?.some(participant => 
        participant.name?.toLowerCase().includes(query) ||
        participant.username?.toLowerCase().includes(query)
      );
      
      return titleMatch || participantMatch;
    });
  }, [expenses, searchQuery]);

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
            <Text style={styles.expenseTotal}>${calculateExpenseTotal(item).toFixed(2)}</Text>
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
                
                // Priority 1: Show settled status
                if (settlementStatus === 'settled') {
                  return (
                    <View style={styles.evenContainer}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.evenText}>Settled up</Text>
                    </View>
                  );
                }
                
                // Priority 2: Show owe/owed amounts (takes precedence over confirmation badges)
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
                }
                
                // Priority 3: Show confirmation badges only if balance is zero
                if (settlementStatus === 'confirmPayment') {
                  return (
                    <View style={styles.confirmPaymentContainer}>
                      <Ionicons name="alert-circle" size={16} color={Colors.accent} />
                      <Text style={styles.confirmPaymentText}>Confirm payment</Text>
                    </View>
                  );
                } else if (settlementStatus === 'awaitingConfirmation') {
                  return (
                    <View style={styles.awaitingConfirmationContainer}>
                      <Ionicons name="time-outline" size={16} color={Colors.warning} />
                      <Text style={styles.awaitingConfirmationText}>Awaiting confirmation</Text>
                    </View>
                  );
                }
                
                // Priority 4: Needs settlement (fallback)
                return (
                  <View style={styles.needsSettlementContainer}>
                    <Ionicons name="time-outline" size={16} color={Colors.warning} />
                    <Text style={styles.needsSettlementText}>Needs settlement</Text>
                  </View>
                );
              })()}
            </View>
          </View>
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
                              contentFit="cover"
                              transition={200} 
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
      <Ionicons 
        name={searchQuery.trim() ? "search-outline" : "receipt-outline"} 
        size={64} 
        color="#ccc" 
      />
      <Text style={styles.emptyStateText}>
        {searchQuery.trim() ? 'No expenses found' : 'No expenses yet'}
      </Text>
      <Text style={styles.emptyStateSubtext}>
        {searchQuery.trim() 
          ? 'Try a different search term'
          : 'Tap the Create button to add your first expense'
        }
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <Text style={styles.footerLoaderText}>Loading more expenses...</Text>
      </View>
    );
  };

  const handleEndReached = () => {
    // Only load more if not searching and there are more expenses to load
    if (!searchQuery.trim() && hasMore && !loadingMore) {
      loadMoreExpenses();
    }
  };

  // Close search when screen loses focus (user navigates away or switches tabs)
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Screen is blurring, close search if open
        if (searchHeaderRef.current) {
          searchHeaderRef.current.close();
        }
      };
    }, [])
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
      <AnimatedSearchHeader
        ref={searchHeaderRef}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClose={() => setSearchQuery('')}
      />

      <FlatList
        data={filteredExpenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredExpenses.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        style={styles.list}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    flex: 1,
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
    marginBottom: Spacing.sm,
  },
  titleContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
  },
  expenseTitle: {
    ...Typography.title,
    fontSize: 20,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
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
  awaitingConfirmationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  awaitingConfirmationText: {
    ...Typography.label,
    color: Colors.warning,
    fontWeight: '600',
    marginLeft: 4,
  },
  confirmPaymentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  confirmPaymentText: {
    ...Typography.label,
    color: Colors.accent,
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
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },

  expenseTotal: {
    fontSize: 24,
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
    marginBottom: Spacing.xs,
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
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 64,
    lineHeight: 16,
    letterSpacing: 0.2,
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
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoaderText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 14,
  },

});

export default HomeScreen;