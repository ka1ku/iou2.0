import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

const BalanceSummary = ({ balances, loading }) => {
  const renderBalanceCard = (title, amount, color) => (
    <View style={[styles.balanceCard, { borderLeftColor: color }]}>
      <View style={styles.balanceHeader}>
        <Text style={styles.balanceTitle}>{title}</Text>
      </View>
      <Text style={[styles.balanceAmount, { color }]}>
        ${Math.abs(amount).toFixed(2)}
      </Text>
    </View>
  );

  const SkeletonLoader = memo(() => (
    <View style={styles.skeletonLoader}>
      <ActivityIndicator size="small" color={Colors.accent} />
      <Text style={styles.skeletonText}>Loading...</Text>
    </View>
  ));

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Balance Summary</Text>
        <SkeletonLoader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Balance Summary</Text>
      
      <View style={styles.netBalanceCard}>
        <Text style={styles.netBalanceLabel}>Net Balance</Text>
        <Text style={[
          styles.netBalanceAmount,
          { 
            color: balances.netBalance === 0 
              ? Colors.textSecondary 
              : balances.netBalance > 0 
                ? Colors.green 
                : Colors.red
          }
        ]}>
          {balances.netBalance === 0 
            ? '$0.00' 
            : `$${balances.netBalance >= 0 ? '+' : ''}${balances.netBalance.toFixed(2)}`
          }
        </Text>
        <Text style={styles.netBalanceSubtext}>
          {balances.netBalance === 0 
            ? 'You are all even' 
            : balances.netBalance > 0 
              ? 'You are owed money overall' 
              : 'You owe money overall'
          }
        </Text>
      </View>

      <View style={styles.balanceCardsContainer}>
        {renderBalanceCard(
          'Total Owed to You',
          balances.totalOwed,
          Colors.green
        )}
        {renderBalanceCard(
          'Total You Owe',
          balances.totalOwes,
          Colors.red
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  netBalanceCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  netBalanceLabel: {
    ...Typography.h2,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  netBalanceAmount: {
    fontSize: 32,
    fontFamily: Typography.familyBold,
    marginBottom: Spacing.xs,
  },
  netBalanceSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  balanceCardsContainer: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  balanceCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flex: 1,
    borderLeftWidth: 4,
    alignItems: 'center',
    ...Shadows.card,
  },
  balanceHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceTitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  balanceAmount: {
    fontSize: 20,
    fontFamily: Typography.familySemiBold,
    textAlign: 'center',
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
});

export default BalanceSummary;
