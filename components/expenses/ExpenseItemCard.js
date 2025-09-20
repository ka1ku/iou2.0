import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../../design/tokens';
import { useExpense } from '../../contexts/ExpenseContext';
import Card from '../Card';
import DeleteButton from '../DeleteButton';
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

const ExpenseItemCard = ({
  item,
  index,
  canDelete = true,
}) => {
  // Use context instead of props
  const { state, actions } = useExpense();
  const { participants, items } = state;
  // State for split management
  const [participantStates, setParticipantStates] = useState([]);
  const [error, setError] = useState(null);

  // Initialize participant states when component mounts or when participants/amount/selectedConsumers change
  useEffect(() => {
    if (participants.length > 0) {
      initializeParticipants();
    }
  }, [participants.length, item.amount, item.selectedConsumers]);

  // Initialize all participants with even split and unlocked
  const initializeParticipants = useCallback(() => {
    if (participants.length === 0) return;

    const total = parseFloat(item.amount) || 0;
    const activeParticipants = item.selectedConsumers || participants.map((_, index) => index);
    
    if (activeParticipants.length === 0) return;

    // Use smart rounding to handle infinite decimals, or default to 0 if total is 0
    const roundedAmounts = total > 0 ? smartRoundSplit(total, activeParticipants.length) : new Array(activeParticipants.length).fill(0);
    const newStates = participants.map((_, pIndex) => ({
      amount: activeParticipants.includes(pIndex) ? roundedAmounts[activeParticipants.indexOf(pIndex)] : 0,
      locked: false,
    }));

    setParticipantStates(newStates);
    setError(null);
    
    // Update the item with the new splits
    actions.updateItem(index, { splits: newStates.map(state => ({ amount: state.amount })) });
  }, [participants, item.amount, item.selectedConsumers, actions, index]);

  // Calculate remaining balance to distribute among unlocked users
  const calculateRemainingBalance = useCallback((states) => {
    const total = parseFloat(item.amount) || 0;
    const lockedTotal = states.reduce((sum, state, pIndex) => {
      return state.locked && item.selectedConsumers.includes(pIndex) ? sum + (state.amount || 0) : sum;
    }, 0);
    
    return Math.max(0, total - lockedTotal);
  }, [item.amount, item.selectedConsumers]);

  // Distribute remaining balance evenly among unlocked users
  const distributeRemainingBalance = useCallback((states) => {
    const unlockedIndices = states.map((state, pIndex) => 
      state.locked ? null : pIndex
    ).filter(i => i !== null && item.selectedConsumers.includes(i));
    
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
  }, [calculateRemainingBalance, item.selectedConsumers]);

  // Handle amount change for a specific participant
  const handleAmountChange = useCallback((pIndex, value) => {
    const total = parseFloat(item.amount) || 0;
    const numValue = value !== null ? value : 0;
    
    // Mark as locked when user types a value
    const newStates = [...participantStates];
    newStates[pIndex] = {
      ...newStates[pIndex],
      amount: numValue,
      locked: true,
    };
    
    // Check if total exceeds bill amount
    const lockedTotal = newStates.reduce((sum, state, index) => {
      return state.locked && item.selectedConsumers.includes(index) ? sum + (state.amount || 0) : sum;
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
      
      actions.updateItem(index, { splits: updatedStates.map(state => ({ amount: state.amount })) });
      return;
    }
    
    setParticipantStates(newStates);
    
    actions.updateItem(index, { splits: newStates.map(state => ({ amount: state.amount })) });
  }, [participantStates, item.amount, item.selectedConsumers, distributeRemainingBalance, actions, index]);

  // Toggle lock status for a participant
  const toggleLock = useCallback((pIndex) => {
    const newStates = [...participantStates];
    const currentState = newStates[pIndex];
    
    if (currentState.locked) {
      // Unlock: mark as unlocked and let distribution handle the amount
      newStates[pIndex] = {
        ...currentState,
        locked: false,
      };
      
      // Redistribute remaining balance among unlocked users
      const updatedStates = distributeRemainingBalance(newStates);
      
      setParticipantStates(updatedStates);
      setError(null);
      
      actions.updateItem(index, { splits: updatedStates.map(state => ({ amount: state.amount })) });
    } else {
      // Lock: keep current amount and mark as locked
      newStates[pIndex] = {
        ...currentState,
        locked: true,
      };
      
      // Redistribute remaining balance among other unlocked users
      const updatedStates = distributeRemainingBalance(newStates);
      setParticipantStates(updatedStates);
      setError(null);
      
      actions.updateItem(index, { splits: updatedStates.map(state => ({ amount: state.amount })) });
    }
  }, [participantStates, distributeRemainingBalance, actions, index]);

  // Handle blur to format amounts
  const handleBlur = useCallback((pIndex) => {
    const state = participantStates[pIndex];
    
    // If field is empty or 0 and unlocked, unlock it
    if ((state.amount === null || state.amount === undefined || state.amount === 0) && !state.locked) {
      const newStates = [...participantStates];
      newStates[pIndex] = { amount: 0, locked: false };
      
      const updatedStates = distributeRemainingBalance(newStates);
      setParticipantStates(updatedStates);
      
      actions.updateItem(index, { splits: updatedStates.map(state => ({ amount: state.amount })) });
      return;
    }
    
    // Format to 2 decimal places
    const formattedAmount = Math.round(state.amount * 100) / 100;
    if (formattedAmount !== state.amount) {
      const newStates = [...participantStates];
      newStates[pIndex].amount = formattedAmount;
      setParticipantStates(newStates);
      
      onUpdateItem({ 
        items: items.map((itm, i) => 
          i === index ? { ...itm, splits: newStates.map(state => ({ amount: state.amount })) } : itm
        )
      });
    }
  }, [participantStates, distributeRemainingBalance, actions, index]);

  const togglePayer = (participantIndex) => {
    const newPayers = item.selectedPayers.includes(participantIndex)
      ? item.selectedPayers.filter(i => i !== participantIndex)
      : [...item.selectedPayers, participantIndex];
    
    actions.updateItem(index, { selectedPayers: newPayers });
  };

  const toggleConsumer = (participantIndex) => {
    const newConsumers = item.selectedConsumers.includes(participantIndex)
      ? item.selectedConsumers.filter(i => i !== participantIndex)
      : [...item.selectedConsumers, participantIndex];
    
    if (newConsumers.length > 0) {
      actions.updateItem(index, { selectedConsumers: newConsumers });
      
      // Recalculate splits when consumers change
      const total = parseFloat(item.amount) || 0;
      const roundedAmounts = total > 0 ? smartRoundSplit(total, newConsumers.length) : new Array(newConsumers.length).fill(0);
      const newStates = participants.map((_, pIndex) => ({
        amount: newConsumers.includes(pIndex) ? roundedAmounts[newConsumers.indexOf(pIndex)] : 0,
        locked: false,
      }));
      
      setParticipantStates(newStates);
      setError(null);
    }
  };

  return (
    <Card 
      key={item.id} 
      variant="default" 
      padding="large" 
      margin="none"
      style={{ 
        marginBottom: 16,
        backgroundColor: Colors.surfaceLight
      }}
    >
      {/* Item Header with Delete Button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <View style={styles.itemHeader}>
            <View style={styles.itemNameContainer}>
              <Text style={styles.itemNameLabel}>Item Name</Text>
              <TextInput
                style={styles.itemNameInput}
                placeholder="Enter item name"
                placeholderTextColor={Colors.textSecondary}
                value={item.name}
                onChangeText={(text) => actions.updateItem(index, { name: text })}
              />
            </View>
          </View>
        </View>
        {canDelete && (
          <DeleteButton
            onPress={() => actions.removeItem(index)}
            size="small"
            variant="subtle"
            style={{ marginLeft: 8 }}
          />
        )}
      </View>

      {/* Price Section */}
      <View style={styles.priceSection}>
        <Text style={styles.priceLabel}>Price</Text>
        <View style={styles.priceInputContainer}>
          <PriceInput
            value={item.amount}
            onChangeText={(amount) => actions.updateItem(index, { amount })}
            placeholder="0.00"
            style={styles.amountInput}
            showCurrency={true}
          />
        </View>
        
        {/* Who Paid Section */}
        <View style={styles.whoPaidSection}>
          <Text style={styles.whoPaidLabel}>Payers</Text>        
          <View style={styles.payerChips}>
            {participants.map((participant, pIndex) => (
              <TouchableOpacity
                key={pIndex}
                style={[
                  styles.payerChip,
                  item.selectedPayers.includes(pIndex) && styles.payerChipActive
                ]}
                onPress={() => togglePayer(pIndex)}
                activeOpacity={0.7}
              >
                <View style={styles.payerChipContent}>
                  {item.selectedPayers.includes(pIndex) && (
                    <View style={styles.checkmarkContainer}>
                      <Ionicons name="checkmark" size={12} color={Colors.surface} />
                    </View>
                  )}
                  <Text style={[
                    styles.payerChipText,
                    item.selectedPayers.includes(pIndex) && styles.payerChipTextActive
                  ]}>
                    {participant.name || `Person ${pIndex + 1}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          {item.selectedPayers.length > 0 && (
            <View style={styles.payerSummary}>
              <Text style={styles.payerSummaryText}>
                {item.selectedPayers.length} {item.selectedPayers.length === 1 ? 'person' : 'people'} paying
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Split Section */}
      <View style={styles.splitContainer}>
        <Text style={styles.splitLabel}>Split</Text>
        
        <View style={styles.splitCard}>
          {/* Header with unallocated info */}
          {parseFloat(item.amount) > 0 && (
            <View style={styles.header}>
              <View style={styles.unallocatedContainer}>
                <Text style={styles.unallocatedText}>
                  {(() => {
                    const total = parseFloat(item.amount) || 0;
                    const allocatedAmount = participantStates.reduce((sum, state) => sum + (state.amount || 0), 0);
                    const unallocatedAmount = Math.max(0, total - allocatedAmount);
                    return unallocatedAmount > 0 ? `Unallocated: $${unallocatedAmount.toFixed(2)}` : 'Enter a price to see split breakdown';
                  })()}
                </Text>
              </View>
            </View>
          )}

          {/* Show message when total is 0 */}
          {parseFloat(item.amount) === 0 && (
            <View style={styles.header}>
              <View style={styles.unallocatedContainer}>
                <Text style={styles.unallocatedText}>
                  Enter a price to see split breakdown
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

          {item.selectedConsumers.length > 0 && (
            <View style={styles.consumerInfo}>
              <Text style={styles.consumerCount}>
                {item.selectedConsumers.length} {item.selectedConsumers.length === 1 ? 'person' : 'people'} selected
              </Text>
            </View>
          )}

          {/* Split rows */}
          {participants.map((participant, pIndex) => {
            const state = participantStates[pIndex] || { amount: 0, locked: false };
            const isSelected = item.selectedConsumers.includes(pIndex);
            
            return (
              <View key={pIndex} style={pIndex === 0 ? styles.splitRowFirst : styles.splitRow}>
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected
                  ]}
                  onPress={() => toggleConsumer(pIndex)}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </TouchableOpacity>

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
                      {participant.name || `Person ${pIndex + 1}`}
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

                <View style={styles.inputContainer}>
                  <PriceInput
                    value={isSelected ? state.amount : 0}
                    onChangeText={(value) => handleAmountChange(pIndex, value)}
                    onBlur={() => handleBlur(pIndex)}
                    placeholder="0.00"
                    style={[
                      styles.amountInput,
                      !isSelected && styles.disabledAmountInput,
                      !state.locked && isSelected && styles.autoAmountInput,
                      parseFloat(item.amount) === 0 && styles.placeholderAmountInput
                    ]}
                    editable={isSelected}
                    showCurrency={true}
                    selected={isSelected}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.lockButton,
                    state.locked && styles.lockButtonLocked,
                    isSelected ? styles.lockButtonSelected : styles.lockButtonUnselected
                  ]}
                  onPress={() => toggleLock(pIndex)}
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
          })}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  // Item styles
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  itemNameLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemNameInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    ...Typography.body,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    fontSize: 16,
    minHeight: 48,
  },

  // Price styles
  priceSection: {
    marginBottom: Spacing.sm,
  },
  priceLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceInputContainer: {
    flex: 1,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  amountInput: {
    marginBottom: Spacing.sm,
    minHeight: 48,
  },
  whoPaidSection: {
    marginBottom: Spacing.sm,
  },
  whoPaidLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  payerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  payerChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
    elevation: 1,
  },
  payerChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 2,
  },
  payerChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  payerChipText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontSize: 12,
  },
  payerChipTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  checkmarkContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payerSummary: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  payerSummaryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    fontSize: 11,
  },

  // Split styles
  splitContainer: {
    marginBottom: Spacing.sm,
  },
  splitLabel: {
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
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    fontSize: 15,
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
    width: 90,
    marginRight: Spacing.sm,
  },
  disabledAmountInput: {
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  lockButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Colors.border,
  },
  lockButtonSelected: {
    borderColor: Colors.accent,
  },
  lockButtonUnselected: {
    borderColor: Colors.border,
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
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  // Smart split styles
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
  autoAmountInput: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  placeholderAmountInput: {
    color: Colors.textSecondary,
    opacity: 0.6,
  },
});

export default ExpenseItemCard;
