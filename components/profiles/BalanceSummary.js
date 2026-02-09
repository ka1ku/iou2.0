import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import DonutChart from '../charts/DonutChart';
import LoadingSpinner from '../LoadingSpinner';
import { useTranslation } from '../../contexts/LanguageContext';

const BalanceSummary = ({ balances, loading }) => {
  const { t } = useTranslation();
  // Donut chart shared state (stable across re-focus without rerenders)
  const segment1Value = useSharedValue(0);
  const segment2Value = useSharedValue(0);
  const totalValue = useSharedValue(0);

  // Chart visuals
  const radius = 100; // Increased from 80 to make chart bigger
  const strokeWidth = 20; // Increased for thicker paths
  const outerStrokeWidth = 24; // Increased for thicker outer ring
  const gap = 0.01; // small gap between segments
  const colors = [Colors.green, Colors.red];

  // Shared value for net balance animation - start at 0 for animation
  const netBalanceValue = useSharedValue(0);


  // Trigger animation on screen/tab focus without causing React re-renders
  useFocusEffect(
    React.useCallback(() => {
      const total = Math.max(0, (balances?.totalOwed || 0) + (balances?.totalOwes || 0));
      const segments = [balances?.totalOwed || 0, balances?.totalOwes || 0];
      const normalized = total > 0 ? segments.map((v) => v / total) : [0, 0];
      const netBalance = balances?.netBalance || 0;

      // Reset then animate to target so it re-plays on focus
      segment1Value.value = 0;
      segment2Value.value = 0;
      totalValue.value = 0;
      netBalanceValue.value = 0;

      requestAnimationFrame(() => {
        segment1Value.value = withTiming(normalized[0], { duration: 800 });
        segment2Value.value = withTiming(normalized[1], { duration: 800 });
        totalValue.value = withTiming(total, { duration: 800 });
        netBalanceValue.value = withTiming(netBalance, { duration: 800 });
      });

      return () => {};
    }, [balances]) // Only depend on balances, not the animated values
  );

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
      <LoadingSpinner size="medium" />
    </View>
  ));

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>{t('profile.balanceSummary')}</Text>
        <SkeletonLoader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('profile.balanceSummary')}</Text>
      <View style={styles.chartCard}>
        <View style={styles.chartContainer}>
          <DonutChart
            n={2}
            gap={gap}
            segment1Value={segment1Value}
            segment2Value={segment2Value}
            colors={colors}
            totalValue={totalValue}
            strokeWidth={strokeWidth}
            outerStrokeWidth={outerStrokeWidth}
            radius={radius}
            centerTitle={'Net Balance'}
            netBalanceValue={netBalanceValue}
          />
        </View>
      </View>

      <View style={styles.balanceCardsContainer}>
        {renderBalanceCard(
          t('profile.totalOwedToYou'),
          balances.totalOwed,
          Colors.green
        )}
        {renderBalanceCard(
          t('profile.totalYouOwe'),
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
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  chartContainer: {
    height: 240, // Increased to accommodate larger chart
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default BalanceSummary;