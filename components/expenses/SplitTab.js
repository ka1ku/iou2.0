import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import SettlementInterface from './SettlementInterface';

const SplitTab = ({
  settlements,
  participants,
  currentUserId,
  handleAction,
  handleItemToggle,
  handleBulkSettle,
  handleBulkAction,
  changeLog,
  recalculationInfo,
  onDismissRecalculation,
  onAddPeople,
  containerStyle,
  expenseType = 'expense', // 'receipt' | 'expense'
}) => {
  if (participants.length < 2) {
    return (
      <View style={[styles.emptyContainer, containerStyle]}>
        <View style={styles.iconCircle}>
          <Ionicons name="people" size={48} color={Colors.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>Split the cost</Text>
        <Text style={styles.emptyText}>
          Add friends to split this expense with them.
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={onAddPeople}>
          <View style={styles.addButtonIconContainer}>
            <Ionicons name="add" size={20} color={Colors.white} />
          </View>
          <Text style={styles.addButtonText}>Add people</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <SettlementInterface
        settlements={settlements}
        participants={participants}
        currentUserId={currentUserId}
        onAction={handleAction}
        onToggleItem={handleItemToggle}
        onBulkSettle={handleBulkSettle}
        onBulkAction={handleBulkAction}
        changeLog={changeLog}
        readOnly={false}
        recalculationInfo={recalculationInfo}
        onDismissRecalculation={onDismissRecalculation}
        expenseType={expenseType}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent + '10',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignSelf: "stretch",
    marginHorizontal: Spacing.md,
  },
  addButtonIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  addButtonText: {
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default SplitTab;
