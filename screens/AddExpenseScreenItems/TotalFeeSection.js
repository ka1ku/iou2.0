import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../../design/tokens';

/**
 * TotalFeeSection Component
 * 
 * Displays the total fee amount section showing the calculated fee total
 * in a prominent, easy-to-read format.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {number} props.feeAmount - Total fee amount to display
 * @returns {React.ReactElement} Total fee display section
 */
const TotalFeeSection = ({ feeAmount }) => {
  return (
    <View style={styles.feeTotalSection}>
      <Text style={styles.feeTotalLabel}>Total Fee</Text>
      <Text style={styles.feeTotalAmount}>${(feeAmount || 0).toFixed(2)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  feeTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  feeTotalLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  feeTotalAmount: {
    ...Typography.title,
    color: Colors.accent,
    fontWeight: '700',
  },
});

export default TotalFeeSection;
