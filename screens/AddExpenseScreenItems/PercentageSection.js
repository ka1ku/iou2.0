import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

/**
 * PercentageSection Component
 * 
 * Displays the percentage section for percentage-based fees, including
 * preset percentage buttons and custom percentage input.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {number} props.percentage - Current percentage value
 * @param {Function} props.onPercentageChange - Callback when percentage changes
 * @param {number} props.itemsTotal - Total amount of items to calculate percentage from
 * @returns {React.ReactElement} Percentage selection section with calculated amount
 */
const PercentageSection = ({ percentage, onPercentageChange, itemsTotal }) => {
  const presetPercentages = [10, 15, 18, 20, 25];
  const calculatedAmount = (itemsTotal * percentage) / 100;

  return (
    <View style={styles.percentageSection}>
      <Text style={styles.percentageLabel}>Percentage</Text>
      <View style={styles.percentageButtons}>
        {presetPercentages.map((percent) => (
          <TouchableOpacity
            key={percent}
            style={[
              styles.percentageButton,
              percentage === percent && styles.percentageButtonActive
            ]}
            onPress={() => onPercentageChange(percent)}
          >
            <Text style={[
              styles.percentageButtonText,
              percentage === percent && styles.percentageButtonTextActive
            ]}>
              {percent}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.customPercentageContainer}>
        <Text style={styles.customPercentageLabel}>Custom:</Text>
        <TextInput
          style={styles.customPercentageInput}
          placeholder="0"
          value={percentage?.toString() || ''}
          onChangeText={(text) => {
            const num = parseFloat(text);
            if (!isNaN(num) && num >= 0 && num <= 100) {
              onPercentageChange(num);
            }
          }}
          keyboardType="numeric"
        />
        <Text style={styles.percentageSymbol}>%</Text>
      </View>
      <Text style={styles.calculatedAmount}>
        Amount: ${calculatedAmount.toFixed(2)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  percentageSection: {
    marginBottom: Spacing.md,
  },
  percentageLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  percentageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  percentageButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
    elevation: 2,
  },
  percentageButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 3,
  },
  percentageButtonText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  percentageButtonTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  customPercentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  customPercentageLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  customPercentageInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    ...Typography.body,
    textAlign: 'center',
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    width: 60,
    marginRight: Spacing.xs,
  },
  percentageSymbol: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  calculatedAmount: {
    ...Typography.label,
    color: Colors.accent,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default PercentageSection;
