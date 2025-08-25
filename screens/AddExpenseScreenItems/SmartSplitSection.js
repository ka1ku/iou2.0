import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography, Radius } from '../../design/tokens';
import SmartSplitInput from '../../components/SmartSplitInput';

/**
 * SmartSplitSection Component
 * 
 * Displays the smart split section for an expense item, allowing users to
 * customize how the item amount is split among selected consumers.
 * Only shows when multiple consumers are selected.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.participants - Array of all participant objects
 * @param {Array} props.selectedConsumers - Array of indices of participants who consumed this item
 * @param {number} props.total - Total amount to split
 * @param {Array} props.initialSplits - Initial split configuration
 * @param {Function} props.onSplitsChange - Callback when splits change
 * @returns {React.ReactElement} Smart split section with split input for selected consumers, or null if only one consumer
 */
const SmartSplitSection = ({ participants, selectedConsumers, total, initialSplits, onSplitsChange }) => {
  // Filter participants to only show those who consumed the item
  const consumers = selectedConsumers.map(index => participants[index]).filter(Boolean);
  
  // If no consumers selected, don't render the section
  if (consumers.length === 0) {
    return null;
  }

  // If only one consumer, show a message instead of the split interface
  if (consumers.length === 1) {
    return (
      <View style={styles.singleConsumerSection}>
        <Text style={styles.singleConsumerText}>
          {consumers[0].name} will pay the full amount (${total.toFixed(2)})
        </Text>
      </View>
    );
  }

  // Create a mapping from consumer array index back to original participant index
  const consumerToParticipantMap = selectedConsumers.filter(index => participants[index]);

  // Transform initialSplits to work with filtered consumers
  const transformedInitialSplits = initialSplits
    .filter(split => selectedConsumers.includes(split.participantIndex))
    .map(split => ({
      ...split,
      participantIndex: selectedConsumers.indexOf(split.participantIndex)
    }));

  const handleSplitsChange = (newSplits) => {
    // Transform splits back to original participant indices
    const transformedSplits = newSplits.map(split => ({
      ...split,
      participantIndex: consumerToParticipantMap[split.participantIndex]
    }));
    onSplitsChange(transformedSplits);
  };

  return (
    <View style={styles.smartSplitSection}>
      <Text style={styles.smartSplitLabel}>Split Amount Among Consumers</Text>
      <Text style={styles.smartSplitSubtext}>
        {consumers.length} {consumers.length === 1 ? 'person' : 'people'} selected
      </Text>
      <SmartSplitInput
        participants={consumers}
        total={total}
        initialSplits={transformedInitialSplits}
        onSplitsChange={handleSplitsChange}
        style={styles.smartSplitContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  smartSplitSection: {
    marginTop: Spacing.md,
  },
  smartSplitLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  smartSplitSubtext: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  smartSplitContainer: {
    marginTop: Spacing.sm,
  },
  singleConsumerSection: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  singleConsumerText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default SmartSplitSection;
