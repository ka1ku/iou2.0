import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import SmartSplitInput from '../../components/SmartSplitInput';
import PriceInput from '../../components/PriceInput';

const CombinedConsumersAndSplitSection = ({
  participants,
  selectedConsumers,
  onConsumersChange,
  total,
  initialSplits = [],
  onSplitsChange,
  style,
  isReceipt = false,
}) => {

  // Toggle consumer selection
  const toggleConsumer = (participantIndex) => {
    const newConsumers = selectedConsumers.includes(participantIndex)
      ? selectedConsumers.filter(i => i !== participantIndex)
      : [...selectedConsumers, participantIndex];
    
    // Ensure at least one consumer is selected
    if (newConsumers.length > 0) {
      onConsumersChange(newConsumers);
    }
  };

  if (participants.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Header - moved outside the card */}
      <Text style={styles.label}>Split</Text>
      
      {/* Split card content */}
      <View style={[
        styles.splitCard,
        isReceipt && styles.splitCardReceipt
      ]}>
        {/* Consumer info - moved to top */}
        {selectedConsumers.length > 0 && (
          <View style={styles.consumerInfo}>
            <Text style={styles.consumerCount}>
              {selectedConsumers.length} {selectedConsumers.length === 1 ? 'person' : 'people'} selected
            </Text>
          </View>
        )}

        {/* SmartSplitInput handles all the split logic */}
        <SmartSplitInput
          participants={participants}
          total={total}
          initialSplits={initialSplits}
          onSplitsChange={onSplitsChange}
          selectedConsumers={selectedConsumers}
          renderRow={(participant, index, state, handlers) => {
            const isSelected = selectedConsumers.includes(index);
            
            return (
              <View key={index} style={index === 0 ? styles.splitRowFirst : styles.splitRow}>
                {/* Checkbox for consumer selection */}
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected
                  ]}
                  onPress={() => toggleConsumer(index)}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </TouchableOpacity>

                {/* Participant name */}
                <View style={styles.participantInfo}>
                  <View style={styles.participantTextContainer}>
                    <Text 
                      style={[
                        styles.participantName,
                        !isSelected && styles.participantNameDisabled
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {participant.name || `Person ${index + 1}`}
                    </Text>
                    {participant.username && (
                      <Text 
                        style={[
                          styles.participantUsername,
                          !isSelected && styles.participantUsernameDisabled
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        @{participant.username}
                      </Text>
                    )}
                  </View>
                </View>

                  {/* Amount input - always show for all participants */}
                  <View style={styles.inputContainer}>
                    <PriceInput
                      value={isSelected ? state.amount : 0}
                      onChangeText={handlers.onAmountChange}
                      onBlur={handlers.onBlur}
                      placeholder="0.00"
                      style={[
                        styles.amountInput,
                        !isSelected && styles.disabledAmountInput,
                        total === 0 && styles.placeholderAmountInput
                      ]}
                      editable={isSelected}
                      showCurrency={true}
                      selected={isSelected}
                    />
                  </View>

                {/* Lock/unlock button - always show for all participants */}
                <TouchableOpacity
                  style={[
                    styles.lockButton,
                    state.locked && styles.lockButtonLocked,
                    isSelected ? styles.lockButtonSelected : styles.lockButtonUnselected
                  ]}
                  onPress={handlers.onToggleLock}
                  disabled={!isSelected}
                >
                  <Ionicons 
                    name={state.locked ? "lock-closed" : "lock-open"} 
                    size={18} 
                    color={state.locked ? Colors.accent : Colors.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  splitCardReceipt: {
    paddingHorizontal: 0, // Remove horizontal padding for receipts
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  splitRowFirst: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderBottomColor: Colors.border,
    borderTopColor: Colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  checkboxSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  participantTextContainer: {
    flexDirection: 'column',
  },
  participantName: {
    ...Typography.body2,
    color: Colors.textPrimary,
    fontWeight: '500',
    fontSize: '15',
    numberOfLines: 1,
    ellipsizeMode: 'tail'
  },
  participantNameDisabled: {
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  participantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    numberOfLines: 1,
    ellipsizeMode: 'tail'
  },
  participantUsernameDisabled: {
    opacity: 0.6,
  },
  inputContainer: {
    width: 90,
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    textAlign: 'right',
    ...Typography.body1,
    color: Colors.textPrimary,
  },

  disabledAmountInput: {
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  placeholderAmountInput: {
    color: Colors.textSecondary,
    opacity: 0.4,
  },
  lockButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Colors.border, // Default border color
  },
  lockButtonSelected: {
    borderColor: Colors.accent, // Accent border for selected participants
  },
  lockButtonUnselected: {
    borderColor: Colors.border, // Default border for unselected participants
    opacity: 0.6,
  },
  lockButtonLocked: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '20',
  },
  consumerInfo: {
    alignItems: 'center',
  },
  consumerCount: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,

  },
});

export default CombinedConsumersAndSplitSection; 
