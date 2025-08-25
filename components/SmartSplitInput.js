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

const SmartSplitInput = ({
  participants,
  total,
  initialSplits = [],
  onSplitsChange,
  style,
}) => {
  // State for each participant: amount and locked status
  const [participantStates, setParticipantStates] = useState([]);
  const [error, setError] = useState(null);

  // Initialize when component mounts or participants/total change
  useEffect(() => {
    if (participants.length > 0 && total > 0) {
      initializeParticipants();
    }
  }, [participants.length, total]);

  // Initialize all participants with even split and unlocked
  const initializeParticipants = useCallback(() => {
    if (participants.length === 0 || total <= 0) return;

    const evenAmount = total / participants.length;
    const newStates = participants.map((_, index) => ({
      amount: evenAmount,
      locked: false,
    }));

    setParticipantStates(newStates);
    setError(null);
    
    if (onSplitsChange) {
      onSplitsChange(newStates.map(state => ({ amount: state.amount })));
    }
  }, [participants, total, onSplitsChange]);

  // Calculate remaining balance to distribute among unlocked users
  const calculateRemainingBalance = useCallback((states) => {
    const lockedTotal = states.reduce((sum, state, index) => {
      return state.locked ? sum + (state.amount || 0) : sum;
    }, 0);
    
    return Math.max(0, total - lockedTotal);
  }, [total]);

  // Distribute remaining balance evenly among unlocked users
  const distributeRemainingBalance = useCallback((states) => {
    const unlockedIndices = states.map((state, index) => state.locked ? null : index).filter(i => i !== null);
    
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
  }, [calculateRemainingBalance]);

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
              <Text style={styles.currencySymbol}>$</Text>
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
                showCurrency={false}
              />
            </View>

            {/* Lock/Unlock button */}
            <TouchableOpacity
              onPress={() => toggleLock(index)}
              style={[
                styles.lockButton,
                state.locked && styles.lockedButton
              ]}
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
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
    marginRight: Spacing.sm,
  },
  currencySymbol: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginRight: 4,
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
  lockButton: {
    padding: Spacing.xs,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockedButton: {
    backgroundColor: Colors.accent + '20',
    borderColor: Colors.accent,
  },
  summary: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,

  },
  summaryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

export default SmartSplitInput;
