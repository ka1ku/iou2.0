import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

/**
 * Footer Component
 * 
 * Displays the footer section with save button.
 * Used in the AddExpenseScreen for saving the expense.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.loading - Whether the save operation is in progress
 * @param {boolean} props.isEditing - Whether the screen is in edit mode
 * @param {Function} props.onSave - Callback when save button is pressed
 * @returns {React.ReactElement} Footer with save button
 */
const Footer = ({ loading, isEditing, onSave }) => {
  return (
    <View style={styles.footer}>
      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.saveButtonText}>
          {loading ? 'Saving...' : (isEditing ? 'Update Expense' : 'Save Expense')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.card,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  saveButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
});

export default Footer;
