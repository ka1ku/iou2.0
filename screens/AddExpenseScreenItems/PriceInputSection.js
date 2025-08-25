import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../../design/tokens';
import PriceInput from '../../components/PriceInput';

/**
 * PriceInputSection Component
 * 
 * Displays the price input section for an expense item with an external dollar sign.
 * The dollar sign is positioned outside the input field for consistent styling.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {number} props.amount - Current price amount
 * @param {Function} props.onAmountChange - Callback when amount changes
 * @returns {React.ReactElement} Price input section with external dollar sign
 */
const PriceInputSection = ({ amount, onAmountChange }) => {
  return (
    <View style={styles.priceSection}>
      <Text style={styles.priceLabel}>Price</Text>
      <View style={styles.priceInputContainer}>
        <Text style={styles.currencySymbol}>$</Text>
        <PriceInput
          value={amount}
          onChangeText={onAmountChange}
          placeholder="0.00"
          style={styles.amountInput}
          showCurrency={false}
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
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencySymbol: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  amountInput: {
    marginBottom: Spacing.sm,
    minHeight: 48,
  },
});

export default PriceInputSection;
