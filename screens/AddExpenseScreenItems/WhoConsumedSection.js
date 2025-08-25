import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

/**
 * WhoConsumedSection Component
 * 
 * Displays the "Who Consumed This Item?" section allowing users to select
 * which participants consumed a specific expense item. Multiple selection is allowed.
 * This selection determines which participants the item amount is split among.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.participants - Array of participant objects with names
 * @param {Array} props.selectedConsumers - Array of indices of currently selected consumers
 * @param {Function} props.onConsumersChange - Callback when consumer selection changes
 * @returns {React.ReactElement} Who consumed section with participant selection buttons
 */
const WhoConsumedSection = ({ participants, selectedConsumers, onConsumersChange }) => {
  const toggleConsumer = (participantIndex) => {
    const newConsumers = selectedConsumers.includes(participantIndex)
      ? selectedConsumers.filter(i => i !== participantIndex)
      : [...selectedConsumers, participantIndex];
    
    // Ensure at least one consumer is selected
    if (newConsumers.length > 0) {
      onConsumersChange(newConsumers);
    }
  };

  return (
    <View style={styles.whoConsumedContainer}>
      <Text style={styles.whoConsumedLabel}>Who consumed this item?</Text>
      <Text style={styles.whoConsumedSubtext}>
        Select participants to split this item amount among
      </Text>
      <View style={styles.whoConsumedButtons}>
        {participants.map((participant, pIndex) => (
          <TouchableOpacity
            key={pIndex}
            style={[
              styles.whoConsumedButton,
              selectedConsumers.includes(pIndex) && styles.whoConsumedButtonActive
            ]}
            onPress={() => toggleConsumer(pIndex)}
          >
            <Text style={[
              styles.whoConsumedText,
              selectedConsumers.includes(pIndex) && styles.whoConsumedTextActive
            ]}>
              {participant.name || `Person ${pIndex + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedConsumers.length > 0 && (
        <View style={styles.consumerInfo}>
          <Text style={styles.consumerCount}>
            {selectedConsumers.length} {selectedConsumers.length === 1 ? 'person' : 'people'} selected
          </Text>
          {selectedConsumers.length === 1 && (
            <Text style={styles.singleConsumerNote}>
              No split needed - {participants[selectedConsumers[0]]?.name} will pay the full amount
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  whoConsumedContainer: {
    marginBottom: Spacing.md,
  },
  whoConsumedLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  whoConsumedSubtext: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  whoConsumedButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  whoConsumedButton: {
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
  whoConsumedButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 3,
  },
  whoConsumedText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  whoConsumedTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  consumerInfo: {
    alignItems: 'center',
  },
  consumerCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: Spacing.xs,
  },
  singleConsumerNote: {
    ...Typography.caption,
    color: Colors.accent,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '500',
  },
});

export default WhoConsumedSection;
