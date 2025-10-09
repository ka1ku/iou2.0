import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Image } from 'expo-image';
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
  const [newlyAddedFee, setNewlyAddedFee] = useState(null);
  const [customFeeInput, setCustomFeeInput] = useState('');
  const [customFeeMode, setCustomFeeMode] = useState('percentage'); // 'percentage' or 'fixed'
  const [selectedFeeType, setSelectedFeeType] = useState('Tip'); // 'Tip', 'Tax', 'Service', 'Delivery', 'Custom'
  const [customFeeName, setCustomFeeName] = useState('');
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


  const handleCustomFeeAdd = () => {
    const value = parseFloat(customFeeInput);
    if (!value || value <= 0) return;

    let feeName = selectedFeeType;
    if (selectedFeeType === 'Custom') {
      feeName = customFeeName.trim() || 'Fee';
    }

    let newFee;
    if (customFeeMode === 'percentage') {
      const feeAmount = (itemsSubtotal * (value / 100)).toFixed(2);
      newFee = {
        name: selectedFeeType === 'Tip' ? `${value}% Tip` : `${feeName} (${value}%)`,
        amount: parseFloat(feeAmount),
        type: 'percentage',
        percentage: value / 100,
        splitType: 'proportional',
        splits: []
      };
    } else {
      newFee = {
        name: feeName,
        amount: value,
        type: 'fixed',
        splitType: 'proportional',
        splits: []
      };
    }

    // Add animation feedback
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onAddFee(newFee);
    
    // Clear input and highlight
    setCustomFeeInput('');
    setCustomFeeName('');
    setNewlyAddedFee(newFee.id);
    setTimeout(() => setNewlyAddedFee(null), 2000);
    
    // Scroll to fees
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
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
                    <TextInput 
                      style={[styles.itemName, styles.inputField]} 
                      defaultValue={item.name || `Item ${index + 1}`} 
                      onBlur={(e) => handleUpdate('item', index, 'name', e.nativeEvent.text)} 
                      autoFocus
                      keyboardType="default"
                      autoCorrect={false}
                    />
                  ) : (
                    <Text style={styles.itemName} onPress={() => setEditingItem({ index, field: 'name' })}>{item.name || `Item ${index + 1}`}</Text>
                  )}
                  <Text style={styles.fillerDots} numberOfLines={1}>..................................................................................................</Text>
                  {isEditingAmount ? (
                    <PriceInput style={[styles.itemAmount, styles.inputField, styles.amountInput]} value={item.amount || 0} onChangeText={(value) => handleUpdate('item', index, 'amount', value)} autoFocus />
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
                            <Image source={{ uri: participant.profilePhoto }} style={styles.chipAvatar} contentFit="cover" transition={200} />
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

          {/* Unified Tips & Fees Section */}
          <View style={styles.addFeesSection}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="cash-outline" size={20} color={Colors.accent} />
              <Text style={styles.addFeesTitle}>Add Tips & Fees</Text>
            </View>
            

            {/* Unified Custom Fee/Tip Input */}
            <View style={styles.customFeeContainer}>
              <Text style={styles.sectionLabel}>Add Custom Fee or Tip</Text>
              
              {/* Fee Type Selector */}
              <View style={styles.feeTypeSelector}>
                {['Tip', 'Tax', 'Service', 'Custom'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.feeTypeChip,
                      selectedFeeType === type && styles.feeTypeChipSelected
                    ]}
                    onPress={() => setSelectedFeeType(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.feeTypeChipText,
                      selectedFeeType === type && styles.feeTypeChipTextSelected
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Name Input (only for Custom type) */}
              {selectedFeeType === 'Custom' && (
                <TextInput
                  style={styles.customNameInput}
                  placeholder="Fee name (e.g., Corkage)"
                  placeholderTextColor="#B8B8B8"
                  value={customFeeName}
                  onChangeText={setCustomFeeName}
                  returnKeyType="next"
                  keyboardType="default"
                  autoCorrect={false}
                />
              )}

              {/* Amount Input Row */}
              <View style={styles.customFeeRow}>
                <View style={styles.customFeeInputWrapper}>
                  <Text style={styles.customFeePrefix}>
                    {customFeeMode === 'percentage' ? '' : '$'}
                  </Text>
                  <TextInput
                    style={styles.customFeeInput}
                    placeholder={customFeeMode === 'percentage' ? '10' : '5.00'}
                    placeholderTextColor="#B8B8B8"
                    keyboardType="decimal-pad"
                    value={customFeeInput}
                    onChangeText={setCustomFeeInput}
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                  <Text style={styles.customFeeSuffix}>
                    {customFeeMode === 'percentage' ? '%' : ''}
                  </Text>
                </View>
                
                <View style={styles.modeSwitchContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.modeSwitchOption,
                      customFeeMode === 'percentage' && styles.modeSwitchOptionActive
                    ]}
                    onPress={() => {
                      setCustomFeeMode('percentage');
                      setCustomFeeInput('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modeSwitchLabel,
                      customFeeMode === 'percentage' && styles.modeSwitchLabelActive
                    ]}>
                      %
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.modeSwitchOption,
                      customFeeMode === 'fixed' && styles.modeSwitchOptionActive
                    ]}
                    onPress={() => {
                      setCustomFeeMode('fixed');
                      setCustomFeeInput('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modeSwitchLabel,
                      customFeeMode === 'fixed' && styles.modeSwitchLabelActive
                    ]}>
                      $
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity 
                  style={[
                    styles.addCustomButton,
                    (!customFeeInput || parseFloat(customFeeInput) <= 0 || 
                    (selectedFeeType === 'Custom' && !customFeeName.trim())) && styles.addCustomButtonDisabled
                  ]}
                  onPress={handleCustomFeeAdd}
                  disabled={!customFeeInput || parseFloat(customFeeInput) <= 0 || 
                    (selectedFeeType === 'Custom' && !customFeeName.trim())}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Added Fees List - Inside the same section */}
            {fees.length > 0 && (
              <>
                <DashedSeparator />
                <View style={styles.addedFeesContainer}>
                  <Text style={styles.sectionLabel}>Current Fees & Tips</Text>
                  {fees.map((fee, index) => (
                    <View key={fee.id} style={[
                      styles.compactFeeItem,
                      newlyAddedFee === fee.id && styles.compactFeeItemHighlighted
                    ]}>
                      <View style={styles.compactFeeLeft}>
                        <Ionicons 
                          name={fee.type === 'percentage' ? 'cash-outline' : 'receipt-outline'} 
                          size={16} 
                          color={fee.type === 'percentage' ? Colors.accent : Colors.textSecondary} 
                        />
                        <Text style={styles.compactFeeName}>
                          {fee.name}
                        </Text>
                      </View>
                      <View style={styles.compactFeeRight}>
                        <Text style={styles.compactFeeAmount}>
                          ${(parseFloat(fee.amount) || 0).toFixed(2)}
                        </Text>
                        <TouchableOpacity 
                          onPress={() => onRemoveFee(index)} 
                          style={styles.compactFeeRemove}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close-circle-outline" size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
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
    minWidth: 120,
    maxWidth: 180,
    textAlign: 'right',
    flexShrink: 0,
  },
  fillerDots: {
    ...Typography.body1,
    color: Colors.divider,
    flex: 1,
    textAlign: 'right',
    marginHorizontal: Spacing.sm,
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
  
  // Added Fees Container (inside unified section)
  addedFeesContainer: {
    marginTop: Spacing.sm,
  },
  
  // Compact Fee Item Styles
  compactFeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  compactFeeItemHighlighted: {
    borderColor: Colors.accent,
    backgroundColor: `${Colors.accent}15`,
    borderWidth: 1.5,
  },
  compactFeeLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactFeeName: {
    ...Typography.body1,
    color: Colors.textPrimary,
    flex: 1,
    fontFamily: Typography.familySemiBold,
  },
  compactFeeAmount: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    minWidth: 80,
    textAlign: 'right',
  },
  compactFeeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactFeeAmount: {
    minWidth: 80,
    maxWidth: 120,
  },
  compactFeeRemove: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
    flexShrink: 0,
  },
  
  // Add Fees Section Styles
  addFeesSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addFeesTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontFamily: Typography.familyBold,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontFamily: Typography.familySemiBold,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  
  // Custom Fee Input Styles
  customFeeContainer: {
    marginBottom: Spacing.sm,
  },
  feeTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  feeTypeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.divider,
  },
  feeTypeChipSelected: {
    backgroundColor: `${Colors.accent}20`,
    borderColor: Colors.accent,
  },
  feeTypeChipText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontFamily: Typography.familySemiBold,
  },
  feeTypeChipTextSelected: {
    color: Colors.accent,
    fontFamily: Typography.familyBold,
  },
  customNameInput: {
    ...Typography.body1,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontFamily: Typography.familyMedium,
    marginBottom: Spacing.md,
  },
  customFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customFeeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  customFeePrefix: {
    ...Typography.body1,
    color: '#B8B8B8',
    fontFamily: Typography.familySemiBold,
    marginRight: Spacing.xs,
  },
  customFeeInput: {
    ...Typography.body1,
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    padding: 0,
    minHeight: 24,
  },
  customFeeSuffix: {
    ...Typography.body1,
    color: '#B8B8B8',
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.xs,
  },
  modeSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    padding: 2,
  },
  modeSwitchOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  modeSwitchOptionActive: {
    backgroundColor: Colors.accent,
  },
  modeSwitchLabel: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: Typography.familyBold,
  },
  modeSwitchLabelActive: {
    color: Colors.white,
  },
  addCustomButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
    ...Shadows.button,
  },
  addCustomButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    opacity: 0.4,
    ...Shadows.button,
  },
});

export default ReceiptBreakdown;