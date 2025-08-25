import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

/**
 * FeeTypeSection Component
 * 
 * Displays the fee type selection section allowing users to choose between
 * percentage-based and fixed amount fees.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.feeType - Current fee type ('percentage' or 'fixed')
 * @param {Function} props.onTypeChange - Callback when fee type changes
 * @returns {React.ReactElement} Fee type selection section
 */
const FeeTypeSection = ({ feeType, onTypeChange }) => {
  return (
    <View style={styles.feeTypeSection}>
      <Text style={styles.feeTypeLabel}>Fee Type</Text>
      <View style={styles.feeTypeContainer}>
        <TouchableOpacity
          style={[
            styles.feeTypeButton,
            feeType === 'percentage' && styles.feeTypeButtonActive
          ]}
          onPress={() => onTypeChange('percentage')}
        >
          <Text style={[
            styles.feeTypeText,
            feeType === 'percentage' && styles.feeTypeTextActive
          ]}>
            Percentage
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.feeTypeButton,
            feeType === 'fixed' && styles.feeTypeButtonActive
          ]}
          onPress={() => onTypeChange('fixed')}
        >
          <Text style={[
            styles.feeTypeText,
            feeType === 'fixed' && styles.feeTypeTextActive
          ]}>
            Fixed Amount
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  feeTypeSection: {
    marginBottom: Spacing.md,
  },
  feeTypeLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feeTypeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  feeTypeButton: {
    flex: 1,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    minHeight: 48,
    justifyContent: 'center',
    ...Shadows.button,
    elevation: 2,
  },
  feeTypeButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 3,
  },
  feeTypeText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  feeTypeTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
});

export default FeeTypeSection;
