import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../../design/tokens';
import PaidBySection from './PaidBySection';

/**
 * WhoPaidSection Component
 * 
 * Displays the "Who Paid for This Expense?" section with the PaidBySection component.
 * Used in the AddExpenseScreen for managing who fronted money for the expense.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.participants - Array of participants
 * @param {Array} props.selectedPayers - Array of selected payers
 * @param {Function} props.onPayersChange - Callback when payers selection changes
 * @returns {React.ReactElement} Who paid section with payer selection
 */
const WhoPaidSection = ({ participants, selectedPayers, onPayersChange }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Who Paid for This Expense?</Text>
      <PaidBySection
        participants={participants}
        selectedPayers={selectedPayers}
        onPayersChange={onPayersChange}
      />
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
});

export default WhoPaidSection;
