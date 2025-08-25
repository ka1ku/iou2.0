import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import DeleteButton from '../../components/DeleteButton';

/**
 * ItemHeader Component
 * 
 * Displays the header section for an expense item with name input and delete button.
 * Used in the AddExpenseScreen for managing individual expense items.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.itemName - Current name of the item
 * @param {Function} props.onNameChange - Callback when item name changes
 * @param {Function} props.onDelete - Callback when delete button is pressed
 * @returns {React.ReactElement} Item header with name input and delete button
 */
const ItemHeader = ({ itemName, onNameChange, onDelete }) => {
  return (
    <View style={styles.itemHeader}>
      <View style={styles.itemNameContainer}>
        <Text style={styles.itemNameLabel}>Item Name</Text>
        <TextInput
          style={styles.itemNameInput}
          placeholder="Enter item name"
          placeholderTextColor={Colors.textSecondary}
          value={itemName}
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
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  itemNameLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemNameInput: {
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

export default ItemHeader;
