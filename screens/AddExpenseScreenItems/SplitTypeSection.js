import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

/**
 * SplitTypeSection Component
 * 
 * Displays the split type selection section for fees, allowing users to choose
 * between even splits or proportional splits based on who paid what.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.splitType - Current split type ('equal' or 'proportional')
 * @param {Function} props.onSplitTypeChange - Callback when split type changes
 * @param {number} props.feeAmount - Fee amount to calculate splits
 * @param {number} props.participantCount - Number of participants
 * @returns {React.ReactElement} Split type selection section with split information
 */
const SplitTypeSection = ({ splitType, onSplitTypeChange, feeAmount, participantCount }) => {
  const perPersonAmount = (feeAmount || 0) / participantCount;

  return (
    <View style={styles.feeSplitSection}>
      <Text style={styles.feeSplitLabel}>Split Type</Text>
      <View style={styles.feeSplitContainer}>
        <TouchableOpacity
          style={[
            styles.feeSplitButton,
            splitType === 'equal' && styles.feeSplitButtonActive
          ]}
          onPress={() => onSplitTypeChange('equal')}
        >
          <Text style={[
            styles.feeSplitText,
            splitType === 'equal' && styles.feeSplitTextActive
          ]}>
            Split Even
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.feeSplitButton,
            splitType === 'proportional' && styles.feeSplitButtonActive
          ]}
          onPress={() => onSplitTypeChange('proportional')}
        >
          <Text style={[
            styles.feeSplitText,
            splitType === 'proportional' && styles.feeSplitTextActive
          ]}>
            Proportional
          </Text>
        </TouchableOpacity>
      </View>

      {splitType === 'equal' && (
        <Text style={styles.feeSplitInfo}>
          ${perPersonAmount.toFixed(2)} per person
        </Text>
      )}
      {splitType === 'proportional' && (
        <Text style={styles.feeSplitInfo}>
          Split proportionally based on who paid what
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  feeSplitSection: {
    marginBottom: Spacing.md,
  },
  feeSplitLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feeSplitContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  feeSplitButton: {
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
  feeSplitButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 3,
  },
  feeSplitText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  feeSplitTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  feeSplitInfo: {
    ...Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SplitTypeSection;
