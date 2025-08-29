import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadows } from '../../design/tokens';
import PriceInput from '../../components/PriceInput';

/**
 * PriceInputSection Component
 * 
 * Displays the price input section for an expense item with an internal dollar sign
 * and a "Who Paid" selector below it.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {number} props.amount - Current price amount
 * @param {Function} props.onAmountChange - Callback when amount changes
 * @param {Array} props.participants - Array of participant objects
 * @param {Array} props.selectedPayers - Array of indices of currently selected payers
 * @param {Function} props.onPayersChange - Callback when payer selection changes
 * @returns {React.ReactElement} Price input section with internal dollar sign and paid by selector
 */
const PriceInputSection = ({ 
  amount, 
  onAmountChange, 
  participants, 
  selectedPayers, 
  onPayersChange 
}) => {
  const togglePayer = (participantIndex) => {
    const newPayers = selectedPayers.includes(participantIndex)
      ? selectedPayers.filter(i => i !== participantIndex)
      : [...selectedPayers, participantIndex];
    
    onPayersChange(newPayers);
  };

  return (
    <View style={styles.priceSection}>
      <Text style={styles.priceLabel}>Price</Text>
      <View style={styles.priceInputContainer}>
        <PriceInput
          value={amount}
          onChangeText={onAmountChange}
          placeholder="0.00"
          style={styles.amountInput}
          showCurrency={true}
        />
      </View>
      
      {/* Who Paid Section - Only show if selectedPayers and onPayersChange are provided */}
      {selectedPayers && onPayersChange && (
        <View style={styles.whoPaidSection}>
          <Text style={styles.whoPaidLabel}>Payers</Text>        
          <View style={styles.payerChips}>
            {participants.map((participant, pIndex) => (
              <TouchableOpacity
                key={pIndex}
                style={[
                  styles.payerChip,
                  selectedPayers.includes(pIndex) && styles.payerChipActive
                ]}
                onPress={() => togglePayer(pIndex)}
                activeOpacity={0.7}
              >
                <View style={styles.payerChipContent}>
                  {selectedPayers.includes(pIndex) && (
                    <View style={styles.checkmarkContainer}>
                      <Ionicons name="checkmark" size={12} color={Colors.surface} />
                    </View>
                  )}
                  <Text style={[
                    styles.payerChipText,
                    selectedPayers.includes(pIndex) && styles.payerChipTextActive
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  },
  payerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,

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
  checkmarkContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
  payerSummary: {
    alignItems: 'center',
    paddingTop: Spacing.xs,

  },
  payerSummaryText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default PriceInputSection;
