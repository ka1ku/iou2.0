import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PriceInput from './PriceInput'; 
import { Colors, Spacing, Radius, Shadows, Typography } from '../../design/tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A simple component for the dashed line, styled with your tokens
const DashedSeparator = () => <View style={styles.dashedSeparator} />;

const ReceiptBreakdown = ({
  items,
  fees,
  participants,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onAddFee,
  onUpdateFee,
  onRemoveFee,
}) => {
  const [editingItem, setEditingItem] = useState(null);
  const [editingFee, setEditingFee] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollViewRef = useRef(null);

  const itemsSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    [items]
  );

  const feesSubtotal = useMemo(
    () => fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0),
    [fees]
  );

  const total = itemsSubtotal + feesSubtotal;
  
  // Get the current date in a friendly format
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });


  const handleUpdate = (type, index, field, value) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (type === 'item') {
      onUpdateItem(index, field, value);
      setEditingItem(null);
    } else {
      onUpdateFee(index, field, value);
      setEditingFee(null);
    }
  };

  const handleQuickAddTip = (percentage) => {
    const tipAmount = (itemsSubtotal * percentage).toFixed(2);
    const newFee = {
      id: Date.now().toString(),
      name: `${(percentage * 100).toFixed(0)}% Tip`,
      amount: parseFloat(tipAmount),
      type: 'fixed',
      percentage: percentage,
      splitType: 'proportional',
      splits: []
    };
    onAddFee(newFee);
  };

  const handleClickOutside = () => {
    if (editingItem) {
      setEditingItem(null);
    }
    if (editingFee) {
      setEditingFee(null);
    }
  };
  
  if (items.length === 0 && fees.length === 0) {
    return null;
  }

  const circleSize = Spacing.lg; // diameter of each scallop
  const circleCount = Math.max(1, Math.ceil((containerWidth || 0) / circleSize));

  return (
    <View style={styles.container}>
      <View
        style={styles.receiptContainer}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <View pointerEvents="none" style={[styles.tornEdgeContainer, { top: -(circleSize / 2) }]}>
          {Array.from({ length: circleCount }).map((_, i) => (
            <View key={`top-${i}`} style={[styles.tornCircle, { width: circleSize, height: circleSize }]} />
          ))}
        </View>
        
        <TouchableWithoutFeedback onPress={handleClickOutside}>
          <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollViewContent}>
          <Text style={styles.headerTitle}>YOUR BREAKDOWN</Text>

          {items.map((item, index) => {
            const isEditingName = editingItem?.index === index && editingItem?.field === 'name';
            const isEditingAmount = editingItem?.index === index && editingItem?.field === 'amount';

            return (
              <View key={item.id} style={styles.itemContainer}>
                <View style={styles.lineItem}>
                  {isEditingName ? (
                    <TextInput style={[styles.itemName, styles.inputField]} defaultValue={item.name || `Item ${index + 1}`} onBlur={(e) => handleUpdate('item', index, 'name', e.nativeEvent.text)} autoFocus />
                  ) : (
                    <Text style={styles.itemName} onPress={() => setEditingItem({ index, field: 'name' })}>{item.name || `Item ${index + 1}`}</Text>
                  )}
                  <Text style={styles.fillerDots} numberOfLines={1}>..................................................................................................</Text>
                  {isEditingAmount ? (
                    <PriceInput style={[styles.itemAmount, styles.inputField, styles.amountInput]} defaultValue={(item.amount || 0).toString()} onBlur={(e) => handleUpdate('item', index, 'amount', e.nativeEvent.text)} autoFocus />
                  ) : (
                    <Text style={styles.itemAmount} onPress={() => setEditingItem({ index, field: 'amount' })}>${(parseFloat(item.amount) || 0).toFixed(2)}</Text>
                  )}
                  <TouchableOpacity 
                    onPress={() => onRemoveItem(index)} 
                    style={styles.removeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.participantChipContainer}>
                  {participants.map((participant, pIndex) => {
                    const isSelected = item.selectedConsumers?.includes(pIndex);
                    return (
                      <TouchableOpacity
                        key={participant.id}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => {
                          const current = item.selectedConsumers || [];
                          const newConsumers = isSelected ? current.filter(i => i !== pIndex) : [...current, pIndex];
                          handleUpdate('item', index, 'selectedConsumers', newConsumers);
                        }}
                      >
                        <View>
                          {participant.profilePhoto ? (
                            <Image source={{ uri: participant.profilePhoto }} style={styles.chipAvatar} />
                          ) : (
                            <View style={[styles.chipAvatar, styles.chipInitialsWrapper]}>
                              <Text style={styles.chipInitials}>{(participant.name?.[0] || 'U').toUpperCase()}</Text>
                            </View>
                          )}
                          {isSelected && (
                            <View style={styles.checkmarkOverlay}>
                               <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                            </View>
                          )}
                        </View>
                        <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                          {participant.name === 'Me' ? 'You' : participant.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <TouchableOpacity style={styles.addButton} onPress={onAddItem}>
            <Ionicons name="add" size={20} color={Colors.accent} />
            <Text style={styles.addButtonText}>Add another item</Text>
          </TouchableOpacity>

          <DashedSeparator />

          {fees.map((fee, index) => (
            <View key={fee.id} style={styles.lineItem}>
              <TextInput style={[styles.feeName]} placeholder="Fee/Tip Name" placeholderTextColor={Colors.textSecondary} defaultValue={fee.name} onBlur={(e) => handleUpdate('fee', index, 'name', e.nativeEvent.text)} />
              <Text style={styles.fillerDots} numberOfLines={1}>..................................................................................................</Text>
              <PriceInput style={[styles.feeAmount]} placeholder="$0.00" placeholderTextColor={Colors.textSecondary} defaultValue={(fee.amount || '').toString()} onBlur={(e) => handleUpdate('fee', index, 'amount', e.nativeEvent.text)} />
              <TouchableOpacity onPress={() => onRemoveFee(index)} style={{marginLeft: Spacing.sm}}>
                <Ionicons name="close-circle-outline" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}

          {/* --- Enhanced Quick Add Section --- */}
          {/* Tip Buttons */}
          <View style={styles.feeCategoryContainer}>
            <Text style={styles.feeCategoryLabel}>Quick Tips</Text>
            <View style={styles.feeButtonRow}>
              <TouchableOpacity style={[styles.feeButton, styles.tipButton]} onPress={() => handleQuickAddTip(0.15)}>
                <Text style={styles.feeButtonText}>15%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.feeButton, styles.tipButton]} onPress={() => handleQuickAddTip(0.18)}>
                <Text style={styles.feeButtonText}>18%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.feeButton, styles.tipButton]} onPress={() => handleQuickAddTip(0.20)}>
                <Text style={styles.feeButtonText}>20%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.feeButton, styles.customTipButton]} onPress={() => onAddFee({ name: 'Custom Tip', amount: '' })}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.accentDark} />
                <Text style={styles.feeButtonText}>Custom</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Other Fees */}
          <View style={styles.feeCategoryContainer}>
            <Text style={styles.feeCategoryLabel}>Other Fees</Text>
            <View style={styles.feeButtonRow}>
              <TouchableOpacity style={[styles.feeButton, styles.feeTypeButton]} onPress={() => onAddFee({ name: 'Tax', amount: '' })}>
                <Ionicons name="receipt-outline" size={16} color={Colors.accentDark} />
                <Text style={styles.feeButtonText}>Tax</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.feeButton, styles.feeTypeButton]} onPress={() => onAddFee({ name: 'Service Fee', amount: '' })}>
                <Ionicons name="card-outline" size={16} color={Colors.accentDark} />
                <Text style={styles.feeButtonText}>Service</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.feeButton, styles.customButton]} onPress={onAddFee}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.white} />
                <Text style={[styles.feeButtonText, styles.customButtonText]}>Custom</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.totalsContainer}>
            <View style={styles.lineItem}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.fillerDots} numberOfLines={1}>..................................................................................................</Text>
              <Text style={styles.totalValue}>${itemsSubtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.lineItem}>
              <Text style={styles.totalLabel}>Fees & Tip</Text>
              <Text style={styles.fillerDots} numberOfLines={1}>..................................................................................................</Text>
              <Text style={styles.totalValue}>${feesSubtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.grandTotalLine}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.fillerDots} numberOfLines={1}>..................................................................................................</Text>
              <Text style={styles.grandTotalValue}>${total.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you!</Text>
            <Text style={styles.footerText}>{currentDate}</Text>
          </View>
          </ScrollView>
        </TouchableWithoutFeedback>
        
        <View pointerEvents="none" style={[styles.tornEdgeContainer, { bottom: -(circleSize / 2) }]}>
          {Array.from({ length: circleCount }).map((_, i) => (
            <View key={`bottom-${i}`} style={[styles.tornCircle, { width: circleSize, height: circleSize }]} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  receiptContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    flex: 1,
  },
  scrollViewContent: {
      padding: Spacing.xl,
  },
  headerTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.xl,
      letterSpacing: 1.5,
  },
  itemContainer: {
    marginBottom: Spacing.lg,
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  itemName: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    flexShrink: 1,
    marginRight: Spacing.sm,
  },
  itemAmount: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.sm,
  },
  amountInput: {
    minWidth: 100,
    maxWidth: 120,
    textAlign: 'right',
  },
  fillerDots: {
    ...Typography.body1,
    color: Colors.divider,
    flex: 1,
    textAlign: 'right',
  },
  inputField: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  participantChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    padding: Spacing.xs,
    paddingRight: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: `${Colors.accent}33`,
    borderColor: Colors.accent,
  },
  chipAvatar: {
    width: 24, height: 24, borderRadius: 12,
    marginRight: Spacing.sm,
  },
  chipInitialsWrapper: {
    backgroundColor: Colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipInitials: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontFamily: Typography.familyBold,
  },
  chipLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  chipLabelSelected: {
    color: Colors.accentDark,
    fontFamily: Typography.familySemiBold,
  },
  checkmarkOverlay: {
    position: 'absolute',
    right: Spacing.xs,
    bottom: -Spacing.xs,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  addButtonText: {
    ...Typography.body,
    fontFamily: Typography.familySemiBold,
    color: Colors.accent,
    marginLeft: Spacing.sm,
  },
  dashedSeparator: {
    height: 1,
    borderBottomWidth: 2,
    borderBottomColor: Colors.divider,
    borderStyle: 'dashed',
    marginVertical: Spacing.md,
  },
  feeCategoryContainer: {
    marginBottom: Spacing.md,
  },
  feeCategoryLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontFamily: Typography.familyMedium,
  },
  feeButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  feeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    minWidth: 70,
    gap: Spacing.xs,
  },
  tipButton: {
    backgroundColor: `${Colors.accent}15`,
    borderWidth: 1,
    borderColor: `${Colors.accent}40`,
  },
  customTipButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  feeTypeButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  customButton: {
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  feeButtonText: {
    ...Typography.label,
    fontFamily: Typography.familySemiBold,
    color: Colors.accentDark,
  },
  customButtonText: {
    color: Colors.white,
  },
  feeName: {
    ...Typography.body1,
    color: Colors.textSecondary,
    flexShrink: 1,
    marginRight: Spacing.sm,
  },
  feeAmount: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
    minWidth: 70,
    textAlign: 'right',
  },
  removeButton: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
    flexShrink: 0,
  },
  totalsContainer: {
    paddingTop: Spacing.md,
  },
  totalLabel: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  totalValue: {
    ...Typography.body1,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
  },
  grandTotalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 2,
    borderColor: Colors.divider,
  },
  grandTotalLabel: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontFamily: Typography.familyBold,
  },
  grandTotalValue: {
    ...Typography.title,
    color: Colors.accent,
    fontFamily: Typography.familyBold,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  tornEdgeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  tornCircle: {
    backgroundColor: Colors.background,
    borderRadius: 999,
    // shadowColor: 'transparent',
    // elevation: 0,
  },
});

export default ReceiptBreakdown;