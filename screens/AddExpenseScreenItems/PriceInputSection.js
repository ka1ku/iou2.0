import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../../design/tokens';
import PriceInput from '../../components/PriceInput';

/**
 * PriceInputSection Component
 * 
 * Displays the price input section for an expense item with an internal dollar sign.
 * The dollar sign is positioned inside the input field for consistent styling.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {number} props.amount - Current price amount
 * @param {Function} props.onAmountChange - Callback when amount changes
 * @returns {React.ReactElement} Price input section with internal dollar sign
 */
const PriceInputSection = ({ amount, onAmountChange }) => {
  return (
    <View style={styles.priceSection}>
      <Text style={styles.priceLabel}>Price</Text>
      <View style={styles.priceInputContainer}>
        <PriceInput
          value={amount}
          onChangeText={onAmountChange}
          placeholder="0.00"
          style={styles.amountInput}
          showCurrency={true}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  priceSection: {
    marginBottom: Spacing.md,
  },
  priceLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceInputContainer: {
    flex: 1,
    marginRight: Spacing.sm
  },
  amountInput: {
    marginBottom: Spacing.sm,
    minHeight: 48,
  },
});

export default PriceInputSection;
