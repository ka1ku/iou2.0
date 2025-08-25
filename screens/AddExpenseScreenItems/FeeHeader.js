import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import DeleteButton from '../../components/DeleteButton';

/**
 * FeeHeader Component
 * 
 * Displays the header section for a fee with name input and delete button.
 * Used in the AddExpenseScreen for managing individual fees and tips.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.feeName - Current name of the fee
 * @param {Function} props.onNameChange - Callback when fee name changes
 * @param {Function} props.onDelete - Callback when delete button is pressed
 * @returns {React.ReactElement} Fee header with name input and delete button
 */
const FeeHeader = ({ feeName, onNameChange, onDelete }) => {
  return (
    <View style={styles.feeHeader}>
      <View style={styles.feeNameContainer}>
        <Text style={styles.feeNameLabel}>Fee Name</Text>
        <TextInput
          style={styles.feeNameInput}
          placeholder="e.g., Tip, Tax, Service"
          placeholderTextColor={Colors.textSecondary}
          value={feeName}
          onChangeText={onNameChange}
        />
      </View>
      <DeleteButton
        onPress={onDelete}
        size="medium"
        variant="subtle"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  feeNameContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  feeNameLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feeNameInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    ...Typography.body,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    fontSize: 16,
    minHeight: 48,
  },
});

export default FeeHeader;
