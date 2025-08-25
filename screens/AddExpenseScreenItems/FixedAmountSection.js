import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../../design/tokens';
import PriceInput from '../../components/PriceInput';

/**
 * FixedAmountSection Component
 * 
 * Displays the fixed amount section for fees that have a set dollar amount
 * rather than being percentage-based.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {number} props.amount - Fixed fee amount
 * @param {Function} props.onAmountChange - Callback when amount changes
 * @returns {React.ReactElement} Fixed amount input section
 */
const FixedAmountSection = ({ amount, onAmountChange }) => {
  return (
    <View style={styles.fixedAmountSection}>
      <Text style={styles.fixedAmountLabel}>Amount</Text>
      <PriceInput
        value={amount}
        onChangeText={onAmountChange}
        placeholder="0.00"
        style={styles.feeAmountInput}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fixedAmountSection: {
    marginBottom: Spacing.md,
  },
  fixedAmountLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feeAmountInput: {
    marginBottom: 0,
  },
});

export default FixedAmountSection;
