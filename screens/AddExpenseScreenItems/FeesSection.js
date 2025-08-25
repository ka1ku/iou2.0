import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

/**
 * FeesSection Component
 * 
 * Displays the fees section with add button, empty state, and fee list.
 * Used in the AddExpenseScreen for managing fees and tips.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.fees - Array of expense fees
 * @param {Function} props.onAddFee - Callback when adding a fee
 * @param {Function} props.renderFee - Function to render individual fees
 * @param {boolean} props.isLastSection - Whether this is the last section
 * @returns {React.ReactElement} Fees section with add button and fee list
 */
const FeesSection = ({ fees, onAddFee, renderFee, isLastSection = false }) => {
  return (
    <View style={[styles.section, isLastSection && styles.lastSection]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fees & Tips</Text>
        <TouchableOpacity onPress={onAddFee} style={styles.addButton}>
          <Ionicons name="add-circle" size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>
      
      {fees.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="card-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyStateText}>No fees added yet</Text>
          <Text style={styles.emptyStateSubtext}>Add tips, taxes, or service fees</Text>
        </View>
      ) : (
        fees.map(renderFee)
      )}
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
  lastSection: {
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
  },
  addButton: {
    padding: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.md,
  },
  emptyStateText: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});

export default FeesSection;
