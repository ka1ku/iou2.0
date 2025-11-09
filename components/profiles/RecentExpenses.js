import React, { useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../design/tokens';
import { calculateUserBalanceForExpense, getFormattedBalanceString, getBalanceColor, calculateExpenseTotal } from '../../utils/balanceCalculator';
import LoadingSpinner from '../LoadingSpinner';

const RecentExpenses = ({ 
  expenses, 
  loading, 
  displayedExpensesCount, 
  onLoadMore, 
  onExpensePress,
  userProfile 
}) => {
  const recentExpenses = useMemo(() => {
    return expenses.slice(0, displayedExpensesCount);
  }, [expenses, displayedExpensesCount]);

  const SkeletonLoader = memo(() => (
    <View style={styles.skeletonLoader}>
      <LoadingSpinner size="medium" />
    </View>
  ));

  // Helper function to calculate user's balance for a specific expense using universal calculator
  const getUserBalanceForExpense = useCallback((expense) => {
    if (!userProfile || !userProfile.userId) {
      return { netBalance: 0, status: 'even' };
    }
    return calculateUserBalanceForExpense(expense, userProfile.userId);
  }, [userProfile]);

  const renderExpenseSummary = useCallback((expense) => {
    // Calculate user's balance for this expense
    const userBalance = getUserBalanceForExpense(expense);
    
    // Calculate the expense total from items and fees
    const calculatedTotal = calculateExpenseTotal(expense);

    // Determine if this is a receipt or individual expense
    const isReceipt = expense.expenseType === 'receipt';
    const screenName = isReceipt ? 'AddReceipt' : 'AddExpense';
    const iconName = isReceipt ? 'receipt-outline' : 'card-outline';

    // Get balance color for status indicator
    const balanceColor = getBalanceColor(userBalance, Colors);

    return (
      <TouchableOpacity
        key={expense.id}
        style={styles.expenseSummaryCard}
        onPress={() => onExpensePress(screenName, expense)}
        activeOpacity={0.7}
      >
        <View style={[styles.statusIndicator, { backgroundColor: balanceColor }]} />
        
        <View style={styles.cardContent}>
          <View style={styles.expenseSummaryHeader}>
            <View style={styles.expenseSummaryLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${Colors.accent}15` }]}>
                <Ionicons name={iconName} size={18} color={Colors.accent} />
              </View>
              <View style={styles.titleContainer}>
                <Text style={styles.expenseSummaryTitle} numberOfLines={1}>
                  {expense.title}
                </Text>
                <View style={styles.participantsRow}>
                  <Ionicons name="people-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.participantCount}>
                    {expense.participants?.length || 0} participants
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.amountContainer}>
              <Text style={styles.expenseSummaryTotal}>
                ${calculateExpenseTotal(expense).toFixed(2)}
              </Text>
            </View>
          </View>
          
          <View style={styles.expenseSummaryDetails}>
            <View style={[styles.balancePill, { backgroundColor: `${balanceColor}15` }]}>
              <Ionicons 
                name={userBalance.status === 'owed' ? 'arrow-up-outline' : userBalance.status === 'owes' ? 'arrow-down-outline' : 'checkmark-outline'} 
                size={14} 
                color={balanceColor} 
              />
              <Text style={[styles.balanceText, { color: balanceColor }]}>
                {getFormattedBalanceString(userBalance)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [getUserBalanceForExpense, onExpensePress]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
          </View>
        </View>
        <SkeletonLoader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          {!loading && expenses.length > 0 && (
            <View style={styles.expenseTypeCounts}>
              <View style={styles.typeCount}>
                <View style={styles.typeCountBadge}>
                  <Ionicons name="card-outline" size={14} color={Colors.accent} />
                  <Text style={styles.typeCountText}>
                    {expenses.filter(exp => exp.expenseType !== 'receipt').length}
                  </Text>
                </View>
              </View>
              <View style={styles.typeCount}>
                <View style={styles.typeCountBadge}>
                  <Ionicons name="receipt-outline" size={14} color={Colors.accent} />
                  <Text style={styles.typeCountText}>
                    {expenses.filter(exp => exp.expenseType === 'receipt').length}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIconContainer}>
            <Ionicons name="receipt-outline" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.emptyStateTitle}>No expenses yet</Text>
          <Text style={styles.emptyStateSubtitle}>Start tracking your shared expenses</Text>
          <TouchableOpacity
            style={styles.createExpenseButton}
            onPress={() => onExpensePress('SetupExpense')}
          >
            <Ionicons name="add-circle-outline" size={20} color="white" style={styles.createExpenseButtonIcon} />
            <Text style={styles.createExpenseButtonText}>Create Your First Expense</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.expensesList}>
            {recentExpenses.map(renderExpenseSummary)}
          </View>
          {displayedExpensesCount < expenses.length && (
            <TouchableOpacity onPress={onLoadMore} style={styles.loadMoreButton}>
              <Text style={styles.loadMoreText}>
                Load More ({expenses.length - displayedExpensesCount} remaining)
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.accent} />
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  expenseTypeCounts: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  typeCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  typeCountText: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginLeft: Spacing.xs,
    fontSize: 12,
    fontFamily: Typography.familyMedium,
  },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderStyle: 'dashed',
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${Colors.accent}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyStateTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyStateSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  createExpenseButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createExpenseButtonIcon: {
    marginRight: Spacing.xs,
  },
  createExpenseButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: Typography.familySemiBold,
  },
  expensesList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  expenseSummaryCard: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  statusIndicator: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    padding: Spacing.md,
  },
  expenseSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  expenseSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  expenseSummaryTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantCount: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  amountContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  expenseSummaryTotal: {
    fontSize: 18,
    fontFamily: Typography.familySemiBold,
    color: Colors.textPrimary,
  },
  expenseSummaryDetails: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  balanceText: {
    ...Typography.body,
    fontSize: 13,
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.xs,
  },
  skeletonLoader: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  loadMoreButton: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  loadMoreText: {
    ...Typography.body,
    color: Colors.accent,
    marginRight: Spacing.sm,
    fontFamily: Typography.familySemiBold,
  },
});

export default RecentExpenses;