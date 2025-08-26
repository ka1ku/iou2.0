import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
    
    // Ensure at least one payer is selected
    if (newPayers.length > 0) {
      onPayersChange(newPayers);
    }
  };

  return (
    <View style={styles.paidByContainer}>
      <View style={styles.paidByButtons}>
        {participants.map((participant, pIndex) => (
          <TouchableOpacity
            key={pIndex}
            style={[
              styles.paidByButton,
              selectedPayers.includes(pIndex) && styles.paidByButtonActive
            ]}
            onPress={() => togglePayer(pIndex)}
          >
            <Text style={[
              styles.paidByText,
              selectedPayers.includes(pIndex) && styles.paidByTextActive
            ]}>
              {participant.name || `Person ${pIndex + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedPayers.length > 0 && (
        <Text style={styles.payerCount}>
          {selectedPayers.length} {selectedPayers.length === 1 ? 'person' : 'people'} selected
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  paidByContainer: {
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  paidByLabel: {
    ...Typography.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  paidByText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  paidByTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  payerCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PaidBySection;
