import React, { useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

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
      <ActivityIndicator size="small" color={Colors.accent} />
      <Text style={styles.skeletonText}>Loading...</Text>
    </View>
  ));

  // Helper function to calculate user's balance for a specific expense
  const calculateUserBalanceForExpense = useCallback((expense) => {
    if (!expense.settlements || !Array.isArray(expense.settlements)) {
      return { amount: 0, status: 'even' };
    }

    const currentUserName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}`.trim() : 'Me';
    let userBalance = 0;

    // Calculate balance from settlements (excluding marked as paid)
    expense.settlements.forEach(settlement => {
      if (settlement.status === 'markedAsPaid') {
        return; // Skip paid settlements
      }

      const amount = parseFloat(settlement.amount) || 0;
      
      // If user is the creditor (someone owes them)
      if (settlement.creditor === currentUserName) {
        userBalance += amount;
      }
      // If user is the debtor (they owe someone)
      else if (settlement.debtor === currentUserName) {
        userBalance -= amount;
      }
    });

    // Determine status
    if (Math.abs(userBalance) < 0.01) {
      return { amount: 0, status: 'even' };
    } else if (userBalance > 0) {
      return { amount: userBalance, status: 'owed' };
    } else {
      return { amount: Math.abs(userBalance), status: 'owes' };
    }
  }, [userProfile]);

  const renderExpenseSummary = useCallback((expense) => {
    // Calculate user's balance for this expense
    const userBalance = calculateUserBalanceForExpense(expense);

    // Determine if this is a receipt or individual expense
    const isReceipt = expense.expenseType === 'receipt';
    const screenName = isReceipt ? 'AddReceipt' : 'AddExpense';
    const iconName = isReceipt ? 'receipt-outline' : 'card-outline';

    return (
      <TouchableOpacity
        key={expense.id}
        style={styles.expenseSummaryCard}
        onPress={() => onExpensePress(screenName, expense)}
      >
        <View style={styles.expenseSummaryHeader}>
          <View style={styles.expenseSummaryLeft}>
            <Ionicons name={iconName} size={20} color={Colors.accent} style={styles.expenseTypeIcon} />
            <Text style={styles.expenseSummaryTitle}>{expense.title}</Text>
          </View>
          <Text style={styles.expenseSummaryTotal}>
            ${expense.total?.toFixed(2) || '0.00'}
          </Text>
        </View>
        <View style={styles.expenseSummaryDetails}>
          <View style={styles.expenseSummaryLeft}>
            <Text style={[
              styles.expenseSummaryInfo,
              { 
                color: userBalance.status === 'even' 
                  ? Colors.textSecondary 
                  : userBalance.status === 'owed' 
                    ? Colors.green 
                    : Colors.red
              }
            ]}>
              {userBalance.status === 'even' 
                ? 'You are even' 
                : userBalance.status === 'owed' 
                  ? `You are owed $${userBalance.amount.toFixed(2)}`
                  : `You owe $${userBalance.amount.toFixed(2)}`
              }
            </Text>
          </View>
          <Text style={styles.expenseSummaryInfo}>
            {expense.participants?.length || 0} participants
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [calculateUserBalanceForExpense, onExpensePress]);

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
          {!loading && (
            <View style={styles.expenseTypeCounts}>
              <View style={styles.typeCount}>
                <Ionicons name="card-outline" size={16} color={Colors.accent} />
                <Text style={styles.typeCountText}>
                  {expenses.filter(exp => exp.expenseType !== 'receipt').length}
                </Text>
              </View>
              <View style={styles.typeCount}>
                <Ionicons name="receipt-outline" size={16} color={Colors.accent} />
                <Text style={styles.typeCountText}>
                  {expenses.filter(exp => exp.expenseType === 'receipt').length}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No expenses yet</Text>
          <TouchableOpacity
            style={styles.createExpenseButton}
            onPress={() => onExpensePress('AddExpense')}
          >
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
              <Ionicons name="chevron-down" size={16} color={Colors.accent} />
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
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  expenseTypeCounts: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  typeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  typeCountText: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
    fontSize: 12,
  },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.card,
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginVertical: Spacing.md,
  },
  createExpenseButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
  },
  createExpenseButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: Typography.familySemiBold,
  },
  expensesList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  expenseSummaryCard: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  expenseSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseTypeIcon: {
    marginRight: Spacing.sm,
  },
  expenseSummaryTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    flex: 1,
  },
  expenseSummaryTotal: {
    fontSize: 16,
    fontFamily: Typography.familySemiBold,
    color: Colors.accent,
  },
  expenseSummaryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseSummaryInfo: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  skeletonLoader: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
    ...Shadows.card,
  },
  skeletonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  loadMoreButton: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    ...Shadows.card,
  },
  loadMoreText: {
    ...Typography.body,
    color: Colors.accent,
    marginRight: Spacing.sm,
    fontFamily: Typography.familyMedium,
  },
});

export default RecentExpenses;
