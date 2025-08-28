import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

/**
 * PaidBySection Component
 * 
 * Displays the "Paid by" section allowing users to select which participants
 * paid for the expense. Multiple selection is allowed.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.participants - Array of participant objects with names
 * @param {Array} props.selectedPayers - Array of indices of currently selected payers
 * @param {Function} props.onPayersChange - Callback when payer selection changes
 * @returns {React.ReactElement} Paid by section with participant selection buttons
 */
const PaidBySection = ({ participants, selectedPayers, onPayersChange }) => {
  const togglePayer = (participantIndex) => {
    const newPayers = selectedPayers.includes(participantIndex)
      ? selectedPayers.filter(i => i !== participantIndex)
      : [...selectedPayers, participantIndex];
    
    onPayersChange(newPayers);
  };

  return (
    <View style={styles.paidByContainer}>
      <View style={styles.whoPaidHeader}>
        <Ionicons name="card-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.whoPaidLabel}>Who Paid for This Expense?</Text>
      </View>
      
      <View style={styles.paidByButtons}>
        {participants.map((participant, pIndex) => (
          <TouchableOpacity
            key={pIndex}
            style={[
              styles.paidByButton,
              selectedPayers.includes(pIndex) && styles.paidByButtonActive
            ]}
            onPress={() => togglePayer(pIndex)}
            activeOpacity={0.7}
          >
            <View style={styles.paidByButtonContent}>
              {selectedPayers.includes(pIndex) && (
                <View style={styles.checkmarkContainer}>
                  <Ionicons name="checkmark" size={12} color={Colors.surface} />
                </View>
              )}
              <Text style={[
                styles.paidByText,
                selectedPayers.includes(pIndex) && styles.paidByTextActive
              ]}>
                {participant.name || `Person ${pIndex + 1}`}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      
      {selectedPayers.length > 0 && (
        <View style={styles.payerSummary}>
          <Text style={styles.payerSummaryText}>
            {selectedPayers.length} {selectedPayers.length === 1 ? 'person' : 'people'} paying
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  paidByContainer: {
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  whoPaidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  whoPaidLabel: {
    ...Typography.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontSize: 13,
  },
  paidByButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  paidByButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
    elevation: 2,
  },
  paidByButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 3,
  },
  paidByButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  checkmarkContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidByText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontSize: 12,
  },
  paidByTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  payerSummary: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  payerSummaryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    fontSize: 11,
  },
});

export default PaidBySection;
