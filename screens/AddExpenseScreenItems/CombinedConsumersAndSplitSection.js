import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import PriceInput from '../../components/PriceInput';

const CombinedConsumersAndSplitSection = ({
  participants,
  selectedConsumers,
  onConsumersChange,
  total,
  initialSplits = [],
  onSplitsChange,
  style,
}) => {
  // State for each participant: amount and locked status
  const [participantStates, setParticipantStates] = useState([]);
  const [error, setError] = useState(null);

  // Initialize when component mounts or participants/total/selectedConsumers change
  useEffect(() => {
    if (participants.length > 0 && total > 0) {
      initializeParticipants();
    }
  }, [participants.length, total, selectedConsumers]);

  // Initialize all participants with even split and unlocked
  const initializeParticipants = useCallback(() => {
    if (participants.length === 0 || total <= 0) return;

    const evenAmount = selectedConsumers.length > 0 ? total / selectedConsumers.length : 0;
    const newStates = participants.map((_, index) => ({
      amount: selectedConsumers.includes(index) ? evenAmount : 0,
      locked: false, // All participants start unlocked
    }));

    setParticipantStates(newStates);
    setError(null);
    
    if (onSplitsChange) {
      onSplitsChange(newStates.map(state => ({ amount: state.amount })));
    }
  }, [participants, total, selectedConsumers, onSplitsChange]);

  // Calculate remaining balance to distribute among unlocked users
  const calculateRemainingBalance = useCallback((states) => {
    const lockedTotal = states.reduce((sum, state, index) => {
      return state.locked ? sum + (state.amount || 0) : sum;
    }, 0);
    
    return Math.max(0, total - lockedTotal);
  }, [total]);

  // Distribute remaining balance evenly among unlocked users
  const distributeRemainingBalance = useCallback((states) => {
    const unlockedIndices = states.map((state, index) => 
      state.locked ? null : index
    ).filter(i => i !== null && selectedConsumers.includes(i));
    
    if (unlockedIndices.length === 0) return states;
    
    const remainingBalance = calculateRemainingBalance(states);
    
    if (unlockedIndices.length === 1) {
      // Single unlocked user gets all remaining balance
      const newStates = [...states];
      newStates[unlockedIndices[0]].amount = Math.round(remainingBalance * 100) / 100;
      return newStates;
    }

    // Distribute evenly among unlocked users
    const baseAmount = Math.floor(remainingBalance * 100 / unlockedIndices.length) / 100;
    const remainder = Math.round((remainingBalance - (baseAmount * unlockedIndices.length)) * 100) / 100;
    
    const newStates = [...states];
    unlockedIndices.forEach((rowIndex, arrayIndex) => {
      let amount = baseAmount;
      // Distribute remainder cents to first few rows
      if (arrayIndex < Math.floor(remainder * 100)) {
        amount += 0.01;
      }
      newStates[rowIndex].amount = Math.round(amount * 100) / 100;
    });
    
    return newStates;
  }, [calculateRemainingBalance, selectedConsumers]);

  // Handle amount change for a specific participant
  const handleAmountChange = useCallback((index, value) => {
    const numValue = value !== null ? value : 0;
    
    // Mark as locked when user types a value
    const newStates = [...participantStates];
    newStates[index] = {
      ...newStates[index],
      amount: numValue,
      locked: true,
    };
    
    // Check if total exceeds bill amount
    const lockedTotal = newStates.reduce((sum, state) => {
      return state.locked ? sum + (state.amount || 0) : sum;
    }, 0);
    
    if (lockedTotal > total) {
      setError(`Total exceeds bill amount by $${(lockedTotal - total).toFixed(2)}`);
      // Set all unlocked amounts to 0
      newStates.forEach((state, i) => {
        if (!state.locked) {
          state.amount = 0;
        }
      });
    } else {
      setError(null);
      // Redistribute remaining balance among unlocked users
      const updatedStates = distributeRemainingBalance(newStates);
      setParticipantStates(updatedStates);
      
      if (onSplitsChange) {
        onSplitsChange(updatedStates.map(state => ({ amount: state.amount })));
      }
      return;
    }
    
    setParticipantStates(newStates);
    
    if (onSplitsChange) {
      onSplitsChange(newStates.map(state => ({ amount: state.amount })));
    }
  }, [participantStates, total, distributeRemainingBalance, onSplitsChange]);

  // Toggle lock status for a participant
  const toggleLock = useCallback((index) => {
    const newStates = [...participantStates];
    const currentState = newStates[index];
    
    if (currentState.locked) {
      // Unlock: mark as unlocked and let distribution handle the amount
      newStates[index] = {
        ...currentState,
        locked: false,
      };
      
      // Redistribute remaining balance among unlocked users
      const updatedStates = distributeRemainingBalance(newStates);
      
      setParticipantStates(updatedStates);
      setError(null);
      
      if (onSplitsChange) {
        onSplitsChange(updatedStates.map(state => ({ amount: state.amount })));
      }
    } else {
      // Lock: keep current amount and mark as locked
      newStates[index] = {
        ...currentState,
        locked: true,
      };
      
      // Redistribute remaining balance among other unlocked users
      const updatedStates = distributeRemainingBalance(newStates);
      setParticipantStates(updatedStates);
      setError(null);
      
      if (onSplitsChange) {
        onSplitsChange(updatedStates.map(state => ({ amount: state.amount })));
      }
    }
  }, [participantStates, distributeRemainingBalance, onSplitsChange]);

  // Handle blur to format amounts
  const handleBlur = useCallback((index) => {
    const state = participantStates[index];
    
    // If field is empty or 0 and unlocked, unlock it
    if ((state.amount === null || state.amount === undefined || state.amount === 0) && !state.locked) {
      const newStates = [...participantStates];
      newStates[index] = { amount: 0, locked: false };
      
      const updatedStates = distributeRemainingBalance(newStates);
      setParticipantStates(updatedStates);
      
      if (onSplitsChange) {
        onSplitsChange(updatedStates.map(state => ({ amount: state.amount })));
      }
      return;
    }
    
    // Format to 2 decimal places
    const formattedAmount = Math.round(state.amount * 100) / 100;
    if (formattedAmount !== state.amount) {
      const newStates = [...participantStates];
      newStates[index].amount = formattedAmount;
      setParticipantStates(newStates);
      
      if (onSplitsChange) {
        onSplitsChange(newStates.map(state => ({ amount: state.amount })));
      }
    }
  }, [participantStates, distributeRemainingBalance, onSplitsChange]);

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

  // Calculate allocated and unallocated amounts
  const allocatedAmount = participantStates.reduce((sum, state) => sum + (state.amount || 0), 0);
  const unallocatedAmount = Math.max(0, total - allocatedAmount);

  if (participants.length === 0 || total <= 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.label}>Split</Text>
        <View style={styles.splitMethod}>
          <Text style={styles.splitMethodText}>As Amounts</Text>
          <Ionicons name="swap-vertical" size={16} color={Colors.textSecondary} />
        </View>
      </View>

      {/* Unallocated info */}
      {unallocatedAmount > 0 && (
        <View style={styles.unallocatedContainer}>
          <Text style={styles.unallocatedText}>
            Unallocated: ${unallocatedAmount.toFixed(2)}
          </Text>
        </View>
      )}

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Split rows */}
      {participants.map((participant, index) => {
        const state = participantStates[index] || { amount: 0, locked: false };
        const isSelected = selectedConsumers.includes(index);
        
        return (
          <View key={index} style={styles.splitRow}>
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
                <Text style={[
                  styles.participantName,
                  !isSelected && styles.participantNameDisabled
                ]}>
                  {participant.name || `Person ${index + 1}`}
                </Text>
                {participant.username && (
                  <Text style={[
                    styles.participantUsername,
                    !isSelected && styles.participantUsernameDisabled
                  ]}>
                    @{participant.username}
                  </Text>
                )}
              </View>
            </View>

            {/* Amount input - always show for all participants */}
            <View style={styles.inputContainer}>
              <PriceInput
                value={isSelected ? state.amount : 0}
                onChangeText={(value) => handleAmountChange(index, value)}
                onBlur={() => handleBlur(index)}
                placeholder="0.00"
                style={[
                  styles.amountInput,
                  !isSelected && styles.disabledAmountInput,
                  !state.locked && isSelected && styles.autoAmountInput
                ]}
                editable={isSelected}
                showCurrency={true}
              />
            </View>

            {/* Lock/unlock button - always show for all participants */}
            <TouchableOpacity
              style={[
                styles.lockButton,
                state.locked && styles.lockButtonLocked,
                isSelected ? styles.lockButtonSelected : styles.lockButtonUnselected
              ]}
              onPress={() => toggleLock(index)}
              disabled={!isSelected}
            >
              <Ionicons 
                name={state.locked ? "lock-closed" : "lock-open"} 
                size={16} 
                color={state.locked ? Colors.accent : Colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Consumer info */}
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
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  splitMethodText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  unallocatedContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  unallocatedText: {
    ...Typography.body2,
    color: Colors.warning,
  },
  errorContainer: {
    backgroundColor: Colors.danger + '20',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.body2,
    color: Colors.danger,
    textAlign: 'center',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
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
    ...Typography.body1,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  participantNameDisabled: {
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  participantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  participantUsernameDisabled: {
    opacity: 0.6,
  },
  inputContainer: {
    width: 120,
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    textAlign: 'right',
    ...Typography.body1,
    color: Colors.textPrimary,
  },
  autoAmountInput: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  disabledAmountInput: {
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  lockButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockButtonSelected: {
    borderColor: Colors.textPrimary, // Darker border for selected participants
  },
  lockButtonUnselected: {
    borderColor: Colors.divider, // Lighter border for unselected participants
    opacity: 0.6,
  },
  lockButtonLocked: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '20',
  },
  consumerInfo: {
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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

export default CombinedConsumersAndSplitSection; 
