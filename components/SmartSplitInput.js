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
  // Internal state for smart split logic
  const [splits, setSplits] = useState([]);
  const [lockedRows, setLockedRows] = useState(new Set());
  const [error, setError] = useState(null);

  // Initialize splits when component mounts or participants/total change
  useEffect(() => {
    if (participants.length > 0 && total > 0) {
      initializeSplits();
    }
  }, [participants.length, total]);

  // Initialize splits evenly across all participants
  const initializeSplits = useCallback(() => {
    if (participants.length === 0 || total <= 0) return;

    const evenAmount = total / participants.length;
    const newSplits = participants.map((_, index) => ({
      participantIndex: index,
      amount: evenAmount,
    }));

    setSplits(newSplits);
    setLockedRows(new Set());
    setError(null);
    
    if (onSplitsChange) {
      onSplitsChange(newSplits);
    }
  }, [participants, total, onSplitsChange]);

  // Calculate remaining pool (total - sum of locked amounts)
  const calculateRemainingPool = useCallback(() => {
    const lockedTotal = splits.reduce((sum, split, index) => {
      return lockedRows.has(index) ? sum + (split.amount || 0) : sum;
    }, 0);
    
    return Math.max(0, total - lockedTotal);
  }, [splits, lockedRows, total]);

  // Distribute remaining pool among auto rows
  const distributeRemainingPool = useCallback((remainingPool) => {
    const autoRows = splits.map((_, index) => index).filter(index => !lockedRows.has(index));
    
    if (autoRows.length === 0) return;
    
    if (autoRows.length === 1) {
      // Single auto row gets all remaining
      const newSplits = [...splits];
      newSplits[autoRows[0]].amount = remainingPool;
      setSplits(newSplits);
      return;
    }

    // Distribute evenly among auto rows
    const baseAmount = Math.floor(remainingPool * 100 / autoRows.length) / 100; // Round down to cents
    const remainder = Math.round((remainingPool - (baseAmount * autoRows.length)) * 100) / 100;
    
    const newSplits = [...splits];
    autoRows.forEach((rowIndex, arrayIndex) => {
      let amount = baseAmount;
      // Distribute remainder cents to first few rows
      if (arrayIndex < Math.floor(remainder * 100)) {
        amount += 0.01;
      }
      newSplits[rowIndex].amount = amount;
    });
    
    setSplits(newSplits);
  }, [splits, lockedRows, total]);

  // Handle input change for a specific row
  const handleAmountChange = useCallback((rowIndex, value) => {
    const numValue = value !== null ? value : 0;
    
    // Mark row as locked
    const newLockedRows = new Set(lockedRows);
    newLockedRows.add(rowIndex);
    setLockedRows(newLockedRows);
    
    // Update the specific row
    const newSplits = [...splits];
    newSplits[rowIndex].amount = numValue;
    
    // Check for over-allocation
    const lockedTotal = newSplits.reduce((sum, split, index) => {
      return newLockedRows.has(index) ? sum + (split.amount || 0) : sum;
    }, 0);
    
    if (lockedTotal > total) {
      setError(`Total exceeds bill amount by $${(lockedTotal - total).toFixed(2)}`);
      // Set all auto rows to 0
      newSplits.forEach((split, index) => {
        if (!newLockedRows.has(index)) {
          split.amount = 0;
        }
      });
    } else {
      setError(null);
      // Distribute remaining pool among auto rows
      const remainingPool = total - lockedTotal;
      distributeRemainingPool(remainingPool);
    }
    
    setSplits(newSplits);
    
    if (onSplitsChange) {
      onSplitsChange(newSplits);
    }
  }, [splits, lockedRows, total, distributeRemainingPool, onSplitsChange]);

  // Handle blur (formatting and validation)
  const handleBlur = useCallback((rowIndex) => {
    const split = splits[rowIndex];
    
    // If field is empty or 0, unlock it and return to auto-fill
    if (split.amount === null || split.amount === undefined || split.amount === 0) {
      unlockRow(rowIndex);
      return;
    }
    
    // Format to 2 decimal places
    const formattedAmount = Math.round(split.amount * 100) / 100;
    if (formattedAmount !== split.amount) {
      const newSplits = [...splits];
      newSplits[rowIndex].amount = formattedAmount;
      setSplits(newSplits);
      
      if (onSplitsChange) {
        onSplitsChange(newSplits);
      }
    }
  }, [splits, onSplitsChange]);

  // Unlock a row (return to auto-fill)
  const unlockRow = useCallback((rowIndex) => {
    const newLockedRows = new Set(lockedRows);
    newLockedRows.delete(rowIndex);
    setLockedRows(newLockedRows);
    
    // Clear the row amount (PriceInput expects null for empty)
    const newSplits = [...splits];
    newSplits[rowIndex].amount = null;
    
    // Redistribute remaining pool
    const remainingPool = calculateRemainingPool();
    distributeRemainingPool(remainingPool);
    
    setSplits(newSplits);
    setError(null);
    
    if (onSplitsChange) {
      onSplitsChange(newSplits);
    }
  }, [splits, lockedRows, calculateRemainingPool, distributeRemainingPool, onSplitsChange]);

  // Calculate unallocated amount
  const unallocatedAmount = Math.max(0, total - splits.reduce((sum, split) => sum + (split.amount || 0), 0));

  if (participants.length === 0 || total <= 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Header with total and unallocated info */}
      <View style={styles.header}>
        <Text style={styles.totalText}>Total: ${total.toFixed(2)}</Text>
        {unallocatedAmount > 0 && (
          <View style={styles.unallocatedContainer}>
            <Text style={styles.unallocatedText}>
              Unallocated: ${unallocatedAmount.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Split rows */}
      {participants.map((participant, index) => {
        const split = splits[index] || { amount: 0 };
        const isLocked = lockedRows.has(index);
        const isAuto = !isLocked;
        
        return (
          <View key={index} style={styles.splitRow}>
            {/* Participant name */}
            <View style={styles.participantInfo}>
              <Text style={styles.participantName}>
                {participant.name || `Person ${index + 1}`}
              </Text>
              {isAuto && (
                <View style={styles.autoBadge}>
                  <Text style={styles.autoBadgeText}>Auto</Text>
                </View>
              )}
            </View>

            {/* Amount input */}
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <PriceInput
                value={split.amount}
                onChangeText={(value) => handleAmountChange(index, value)}
                onBlur={() => handleBlur(index)}
                placeholder="0.00"
                style={[
                  styles.amountInput,
                  isLocked && styles.lockedInput,
                  isAuto && styles.autoInput
                ]}
                editable={true}
              />
            </View>

            {/* Unlock button for locked rows */}
            {isLocked && (
              <TouchableOpacity
                onPress={() => unlockRow(index)}
                style={styles.unlockButton}
              >
                <Ionicons name="lock-open" size={16} color={Colors.accent} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Split {participants.length} ways • Smart distribution enabled
        </Text>
      </View>
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
  totalText: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontWeight: '600',
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  participantName: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  autoBadge: {
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  autoBadgeText: {
    ...Typography.caption,
    color: Colors.accent,
    fontSize: 10,
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
  lockedInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
  },
  autoInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
  },
  unlockButton: {
    padding: Spacing.xs,
  },
  summary: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

export default SmartSplitInput;
