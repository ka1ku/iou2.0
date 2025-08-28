import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';
import PriceInput from './PriceInput';

/**
 * Smart rounding utility to handle infinite decimal splits
 * 
 * When splitting amounts that result in infinite decimals (e.g., $5 ÷ 3 = 1.6666...),
 * this function distributes the rounding error to the first few participants.
 * 
 * Example: $5 split among 3 people = [$1.67, $1.67, $1.66]
 * The first two participants get $1.67, the last gets $1.66
 * Total: $1.67 + $1.67 + $1.66 = $5.00
 */
const smartRoundSplit = (total, count) => {
  if (count <= 0) return [];
  
  // Calculate base amount and remainder
  const baseAmount = Math.floor((total * 100) / count) / 100;
  const remainder = Math.round((total - (baseAmount * count)) * 100) / 100;
  
  // Create array with base amounts
  const amounts = new Array(count).fill(baseAmount);
  
  // Distribute remainder cents to first few participants
  const remainderCents = Math.round(remainder * 100);
  for (let i = 0; i < remainderCents; i++) {
    amounts[i] = Math.round((amounts[i] + 0.01) * 100) / 100;
  }
  
  // Validate that the sum equals the total (should always be true, but good to verify)
  const calculatedTotal = amounts.reduce((sum, amount) => sum + amount, 0);
  if (Math.abs(calculatedTotal - total) > 0.01) {
    // If there's a discrepancy, adjust the last amount to make it exact
    const difference = total - calculatedTotal;
    amounts[count - 1] = Math.round((amounts[count - 1] + difference) * 100) / 100;
  }
  
  return amounts;
};

const SmartSplitInput = ({
  participants,
  total,
  initialSplits = [],
  onSplitsChange,
  style,
  renderRow, // Custom render function for each row
  selectedConsumers = null, // Optional: only include selected consumers in split logic
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

    // Determine which participants to include in the split
    const activeParticipants = selectedConsumers || participants.map((_, index) => index);
    
    if (activeParticipants.length === 0) return;

    // Use smart rounding to handle infinite decimals
    const roundedAmounts = smartRoundSplit(total, activeParticipants.length);
    const newStates = participants.map((_, index) => ({
      amount: activeParticipants.includes(index) ? roundedAmounts[activeParticipants.indexOf(index)] : 0,
      locked: false,
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
    ).filter(i => i !== null && (!selectedConsumers || selectedConsumers.includes(i)));
    
    if (unlockedIndices.length === 0) return states;
    
    const remainingBalance = calculateRemainingBalance(states);
    
    if (unlockedIndices.length === 1) {
      // Single unlocked user gets all remaining balance
      const newStates = [...states];
      newStates[unlockedIndices[0]].amount = Math.round(remainingBalance * 100) / 100;
      return newStates;
    }

    // Use smart rounding to distribute remaining balance
    const roundedAmounts = smartRoundSplit(remainingBalance, unlockedIndices.length);
    
    const newStates = [...states];
    unlockedIndices.forEach((arrayIndex, index) => {
      newStates[arrayIndex].amount = roundedAmounts[index];
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

  // Calculate allocated and unallocated amounts
  const allocatedAmount = participantStates.reduce((sum, state) => sum + (state.amount || 0), 0);
  const unallocatedAmount = Math.max(0, total - allocatedAmount);

  if (participants.length === 0 || total <= 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Header with unallocated info */}
      {unallocatedAmount > 0 && (
        <View style={styles.header}>
          <View style={styles.unallocatedContainer}>
            <Text style={styles.unallocatedText}>
              Unallocated: ${unallocatedAmount.toFixed(2)}
            </Text>
          </View>
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
        
        // Use custom render function if provided, otherwise use default
        if (renderRow) {
          return renderRow(participant, index, state, {
            onAmountChange: (value) => handleAmountChange(index, value),
            onBlur: () => handleBlur(index),
            onToggleLock: () => toggleLock(index),
          });
        }
        
        return (
          <View key={index} style={styles.splitRow}>
            {/* Participant name */}
            <View style={styles.participantInfo}>
              <View style={styles.participantTextContainer}>
                <Text style={styles.participantName}>
                  {participant.name || `Person ${index + 1}`}
                </Text>
                {participant.username && (
                  <Text style={styles.participantUsername}>
                    @{participant.username}
                  </Text>
                )}
              </View>
            </View>

            {/* Amount input */}
            <View style={styles.inputContainer}>
              <PriceInput
                value={state.amount}
                onChangeText={(value) => handleAmountChange(index, value)}
                onBlur={() => handleBlur(index)}
                placeholder="0.00"
                style={[
                  styles.amountInput,
                  !state.locked && styles.autoAmountInput
                ]}
                editable={true}
                showCurrency={true}
              />
            </View>
          </View>
        );
      })}

   
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  unallocatedContainer: {
    alignItems: 'center',
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
  participantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
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
});

export default SmartSplitInput;
