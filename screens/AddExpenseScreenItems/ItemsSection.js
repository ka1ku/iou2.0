import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

/**
 * ItemsSection Component
 * 
 * Displays the items section with add button, empty state, and item list.
 * Used in the AddExpenseScreen for managing expense items.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.items - Array of expense items
 * @param {Function} props.onAddItem - Callback when adding an item
 * @param {Function} props.renderItem - Function to render individual items
 * @returns {React.ReactElement} Items section with add button and item list
 */
const ItemsSection = ({ items, onAddItem, renderItem }) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Items</Text>
        <TouchableOpacity onPress={onAddItem} style={styles.addButton}>
          <Ionicons name="add-circle" size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>
      
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyStateText}>No items added yet</Text>
          <Text style={styles.emptyStateSubtext}>Tap the + button to add your first item</Text>
        </View>
      ) : (
        <>
          {items.map(renderItem)}
          <TouchableOpacity
            style={styles.addMoreItemsButton}
            onPress={onAddItem}
            activeOpacity={0.8}
          >
            <Text style={styles.addMoreItemsButtonText}>Add More Items</Text>
          </TouchableOpacity>
        </>
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
  addMoreItemsButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  addMoreItemsButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
});

export default ItemsSection;
