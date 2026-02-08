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
}) => {
  if (participants.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="people" size={32} color={Colors.accent} />
        </View>
        <Text style={styles.emptyTitle}>Split the cost</Text>
        <Text style={styles.emptyText}>
          Add friends to split this expense with them.
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={onAddPeople}>
          <Ionicons name="add" size={20} color={Colors.accent} />
          <Text style={styles.addButtonText}>Add people</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
    maxWidth: 240,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.accent,
    gap: 6,
  },
  addButtonText: {
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default SplitTab;
