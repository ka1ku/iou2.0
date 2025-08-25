import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../../design/tokens';

/**
 * ExpenseDetailsSection Component
 * 
 * Displays the expense details section with title input and total amount display.
 * Used in the AddExpenseScreen for entering the expense title and showing the total.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.title - Current expense title
 * @param {Function} props.onTitleChange - Callback when title changes
 * @param {number} props.total - Total expense amount
 * @returns {React.ReactElement} Expense details section with title input and total
 */
const ExpenseDetailsSection = ({ title, onTitleChange, total }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Expense Details</Text>
      <TextInput
        style={styles.titleInput}
        placeholder="What's this expense for?"
        placeholderTextColor={Colors.textSecondary}
        value={title}
        onChangeText={onTitleChange}
      />
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalText}>
          ${total.toFixed(2)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: Colors.card,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    ...Typography.body,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  totalLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  totalText: {
    ...Typography.h2,
    color: Colors.accent,
    fontWeight: '600',
  },
});

export default ExpenseDetailsSection;
