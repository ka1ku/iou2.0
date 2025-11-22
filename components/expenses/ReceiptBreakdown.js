import React, { useState, useMemo, memo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import PriceInput from './PriceInput'; 
import { Colors, Spacing, Radius, Shadows, Typography } from '../../design/tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A simple component for the dashed line, styled with your tokens
const DashedSeparator = () => <View style={styles.dashedSeparator} />;

// Memoized participant chip component for better performance
const ParticipantChip = memo(({ participant, isSelected, onPress }) => (
  <TouchableOpacity
    style={[styles.chip, isSelected && styles.chipSelected]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.chipAvatarContainer}>
      {participant.profilePhoto ? (
        <Image source={{ uri: participant.profilePhoto }} style={styles.chipAvatar} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.chipAvatar, styles.chipInitialsWrapper]}>
          <Text style={styles.chipInitials}>{(participant.name?.[0] || 'U').toUpperCase()}</Text>
        </View>
      )}
      {isSelected && (
        <View style={styles.checkmarkOverlay}>
           <Ionicons name="checkmark" size={10} color={Colors.white} />
        </View>
      )}
    </View>
    <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]} numberOfLines={1}>
      {participant.name === 'Me' ? 'You' : participant.name.split(' ')[0]}
    </Text>
  </TouchableOpacity>
), (prevProps, nextProps) => {
  return (
    prevProps.participant.id === nextProps.participant.id &&
    prevProps.participant.name === nextProps.participant.name &&
    prevProps.participant.profilePhoto === nextProps.participant.profilePhoto &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.onPress === nextProps.onPress
  );
});

// Memoized item row component for better performance
const ItemRow = memo(({
  item,
  index,
  isEditing,
  participants,
  onToggleEdit,
  onSave,
  onCancel,
  onUpdate,
  onRemove,
  validationErrors,
  onClearValidationError
}) => {
  const itemErrors = validationErrors?.[item.id] || {};
  const [localValidationErrors, setLocalValidationErrors] = useState({});
  
  // Clear local errors when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      setLocalValidationErrors({});
    }
  }, [isEditing]);
  
  // Stable callback for participant selection
  const handleParticipantPress = useCallback((pIndex) => {
    const isSelected = item.selectedConsumers?.includes(pIndex);
    const current = item.selectedConsumers || [];
    const newConsumers = isSelected ? current.filter(i => i !== pIndex) : [...current, pIndex];
    onUpdate('item', index, 'selectedConsumers', newConsumers);
    
    // Clear validation error when user starts fixing
    if (onClearValidationError && newConsumers.length > 0) {
      onClearValidationError(item.id, 'consumers');
    }
  }, [item.selectedConsumers, item.id, index, onUpdate, onClearValidationError]);

  // Handle save with local validation
  const handleSaveClick = useCallback(() => {
    const errors = {};
    
    // Check if price is zero or invalid
    const amount = parseFloat(item.amount);
    if (!amount || amount <= 0 || isNaN(amount)) {
      errors.amount = true;
    }
    
    // If there are validation errors, show them and don't save
    if (Object.keys(errors).length > 0) {
      setLocalValidationErrors(errors);
      return;
    }
    
    // Clear local errors and proceed with save
    setLocalValidationErrors({});
    onSave(index);
  }, [item.amount, index, onSave]);

  // Animated styles for edit mode card
  const editCardAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isEditing ? 1 : 0, { duration: 300 }),
      transform: [
        { 
          translateY: withTiming(isEditing ? 0 : -10, { duration: 300 })
        }
      ],
    };
  }, [isEditing]);

  // Animated styles for view mode
  const viewModeAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isEditing ? 0 : 1, { duration: 300 }),
    };
  }, [isEditing]);

  // Get selected participants for view mode
  const selectedParticipants = useMemo(() => {
    return (item.selectedConsumers || []).map(idx => participants[idx]).filter(Boolean);
  }, [item.selectedConsumers, participants]);

  // Render both modes and animate between them
  return (
    <View style={styles.itemContainer}>
      {/* Edit Mode - Animated */}
      <Animated.View 
        style={[
          editCardAnimatedStyle,
          { position: isEditing ? 'relative' : 'absolute', width: '100%', zIndex: isEditing ? 10 : 0 }
        ]}
        pointerEvents={isEditing ? 'auto' : 'none'}
      >
        <View style={styles.editCard}>
          <View style={styles.editHeader}>
            <Text style={styles.editTitle}>Edit Item</Text>
            <TouchableOpacity onPress={() => onRemove(index)} style={styles.deleteIconBtn}>
               <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>

          <View style={styles.editFormRow}>
            {/* Item Name Input */}
            <View style={styles.editFieldFlex}>
              <Text style={styles.editLabel}>Item Name</Text>
              <TextInput
                style={styles.editInput}
                value={item.name || `Item ${index + 1}`}
                onChangeText={(value) => onUpdate('item', index, 'name', value)}
                placeholder="Enter item name"
                keyboardType="default"
                autoCorrect={false}
              />
            </View>

            {/* Price Input */}
            <View style={styles.editFieldFixed}>
              <Text style={[styles.editLabel, (itemErrors.amount || localValidationErrors.amount) && styles.errorLabel]}>
                Price
              </Text>
              <PriceInput
                value={item.amount || 0}
                onChangeText={(value) => {
                  onUpdate('item', index, 'amount', value);
                  if (onClearValidationError && parseFloat(value) > 0) {
                    onClearValidationError(item.id, 'amount');
                  }
                  if (parseFloat(value) > 0) {
                    setLocalValidationErrors(prev => ({ ...prev, amount: false }));
                  }
                }}
                placeholder="0.00"
                error={!!(itemErrors.amount || localValidationErrors.amount)}
                style={styles.priceInputStyle}
              />
            </View>
          </View>

          {/* Participant Selection */}
          <View style={styles.participantsSection}>
            <Text style={[styles.editLabel, itemErrors.consumers && styles.errorLabel]}>
              Split with
            </Text>
            <View style={[
              styles.participantChipContainer,
              itemErrors.consumers && styles.participantChipContainerError
            ]}>
              {participants.map((participant, pIndex) => {
                const isSelected = item.selectedConsumers?.includes(pIndex);
                return (
                  <ParticipantChip
                    key={participant.id}
                    participant={participant}
                    isSelected={isSelected}
                    onPress={() => handleParticipantPress(pIndex)}
                  />
                );
              })}
            </View>
            {itemErrors.consumers && (
              <Text style={styles.errorHelperText}>
                Select at least one person
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.editActions}>
            <TouchableOpacity
              onPress={() => onCancel(item.id)}
              style={[styles.editActionButton, styles.cancelActionButton]}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveClick}
              style={[styles.editActionButton, styles.saveActionButton]}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={18} color={Colors.white} style={{ marginRight: 4 }} />
              <Text style={styles.editActionText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* View Mode - Animated */}
      <Animated.View 
        style={[
          viewModeAnimatedStyle,
          { position: isEditing ? 'absolute' : 'relative', width: '100%', zIndex: isEditing ? 0 : 10 }
        ]}
        pointerEvents={isEditing ? 'none' : 'auto'}
      >
        <TouchableOpacity
          style={styles.viewModeRow}
          onPress={() => onToggleEdit(item.id)}
          activeOpacity={0.6}
        >
          <View style={styles.viewModeMain}>
            <View style={styles.viewModeHeader}>
              <Text style={styles.viewModeName} numberOfLines={1}>
                {item.name || `Item ${index + 1}`}
              </Text>
              <Text style={styles.viewModeAmount}>
                ${(parseFloat(item.amount) || 0).toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.viewModeFooter}>
              <View style={styles.assignedAvatars}>
                {selectedParticipants.length > 0 ? (
                  selectedParticipants.slice(0, 5).map((p, i) => (
                    <View key={p.id} style={[styles.miniAvatarContainer, { zIndex: 5 - i, marginLeft: i > 0 ? -8 : 0 }]}>
                      {p.profilePhoto ? (
                        <Image source={{ uri: p.profilePhoto }} style={styles.miniAvatar} />
                      ) : (
                        <View style={[styles.miniAvatar, styles.miniAvatarInitials]}>
                          <Text style={styles.miniAvatarText}>{(p.name?.[0] || 'U').toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.unassignedText}>No one assigned</Text>
                )}
                {selectedParticipants.length > 5 && (
                  <View style={[styles.miniAvatarContainer, { zIndex: 0, marginLeft: -8 }]}>
                    <View style={[styles.miniAvatar, styles.miniAvatarMore]}>
                      <Text style={styles.miniAvatarMoreText}>+{selectedParticipants.length - 5}</Text>
                    </View>
                  </View>
                )}
              </View>
              
              {itemErrors.consumers && (
                <View style={styles.errorBadge}>
                   <Ionicons name="alert-circle" size={12} color={Colors.danger} />
                   <Text style={styles.errorBadgeText}>Assign</Text>
                </View>
              )}
            </View>
          </View>
          
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} style={styles.chevronIcon} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}, (prevProps, nextProps) => {
  const prevErrors = prevProps.validationErrors?.[prevProps.item.id] || {};
  const nextErrors = nextProps.validationErrors?.[nextProps.item.id] || {};
  
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.amount === nextProps.item.amount &&
    prevProps.item.selectedConsumers === nextProps.item.selectedConsumers &&
    prevProps.index === nextProps.index &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.participants === nextProps.participants &&
    prevProps.onToggleEdit === nextProps.onToggleEdit &&
    prevProps.onSave === nextProps.onSave &&
    prevProps.onCancel === nextProps.onCancel &&
    prevProps.onUpdate === nextProps.onUpdate &&
    prevProps.onRemove === nextProps.onRemove &&
    JSON.stringify(prevErrors) === JSON.stringify(nextErrors)
  );
});

const ReceiptBreakdown = ({
  items,
  participants,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  scrollRef,
  isFocused,
  validationErrors = {},
  onClearValidationError,
}) => {
  const [editingItemId, setEditingItemId] = useState(null); 
  const prevItemsLengthRef = useRef(items.length);
  const itemLayoutMapRef = useRef({});
  const userManualAddRef = useRef(false); // Track if user explicitly clicked add button
  const newlyAddedItemIdsRef = useRef(new Set()); 

  const scrollItemToTop = (itemId, delay = 0) => {
    setTimeout(() => {
      const y = itemLayoutMapRef.current[itemId];
      if (y != null && scrollRef?.current?.scrollTo) {
        const headerOffset = -340; 
        scrollRef.current.scrollTo({ y: Math.max(0, y - headerOffset), animated: true });
      }
    }, delay);
  };

  // Reset edit state on screen focus
  useEffect(() => {
    if (isFocused === true) {
      setEditingItemId(null);
      prevItemsLengthRef.current = items.length;
      userManualAddRef.current = false;
    } else {
      newlyAddedItemIdsRef.current.clear();
    }
  }, [isFocused]);

  useEffect(() => {
    const existingItemIds = new Set(items.map(item => item.id));
    newlyAddedItemIdsRef.current.forEach(itemId => {
      if (!existingItemIds.has(itemId)) {
        newlyAddedItemIdsRef.current.delete(itemId);
      }
    });
  }, [items]);

  // Auto-open newly added items in edit mode ONLY if user manually added them
  useEffect(() => {
    const itemsAdded = items.length - prevItemsLengthRef.current;
    
    if (itemsAdded === 1 && userManualAddRef.current) {
      const newItem = items[items.length - 1];
      if (newItem?.id) {
        userManualAddRef.current = false; // Reset flag
        newlyAddedItemIdsRef.current.add(newItem.id);
        setEditingItemId(newItem.id);
        scrollItemToTop(newItem.id, 50);
      }
    }
    
    prevItemsLengthRef.current = items.length;
  }, [items]);

  const currentDate = useMemo(() => new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }), []);


  const handleUpdate = useCallback((type, index, field, value) => {
    if (type === 'item') {
      onUpdateItem(index, field, value);
    }
  }, [onUpdateItem]);

  const toggleEditMode = useCallback((itemId) => {
    setEditingItemId(prev => {
      const next = prev === itemId ? null : itemId;
      if (next) {
        scrollItemToTop(itemId, 0);
      }
      return next;
    });
  }, []);

  const saveItemChanges = useCallback((index) => {
    const item = items[index];
    if (item) {
      newlyAddedItemIdsRef.current.delete(item.id);
      setEditingItemId(null);
    }
  }, [items]);

  const cancelEdit = useCallback((itemId) => {
    if (newlyAddedItemIdsRef.current.has(itemId)) {
      const itemIndex = items.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        newlyAddedItemIdsRef.current.delete(itemId);
        onRemoveItem(itemIndex);
      }
    } else {
      setEditingItemId(prev => (prev === itemId ? null : prev));
    }
  }, [items, onRemoveItem]);

  const handleItemLayout = useCallback((itemId, event) => {
    itemLayoutMapRef.current[itemId] = event.nativeEvent.layout.y;
  }, []);

  if (items.length === 0) {
    return null;
  }

  const circleSize = 12; 
  const circleCount = 25; 

  return (
    <View style={styles.container}>
      <View style={styles.receiptContainer}>
        {/* Top Torn Edge */}
        <View pointerEvents="none" style={[styles.tornEdgeContainer, { top: -(circleSize / 2) }]}>
          {Array.from({ length: circleCount }).map((_, i) => (
            <View key={`top-${i}`} style={[styles.tornCircle, { width: circleSize, height: circleSize }]} />
          ))}
        </View>
        
        <View style={styles.scrollViewContent}>
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>RECEIPT BREAKDOWN</Text>
            <View style={styles.headerDivider} />
          </View>

          {items.map((item, index) => (
            <View
              key={item.id}
              onLayout={(e) => handleItemLayout(item.id, e)}
            >
              <ItemRow
                item={item}
                index={index}
                isEditing={editingItemId === item.id}
                participants={participants}
                onToggleEdit={toggleEditMode}
                onSave={saveItemChanges}
                onCancel={cancelEdit}
                onUpdate={handleUpdate}
                onRemove={onRemoveItem}
                validationErrors={validationErrors}
                onClearValidationError={onClearValidationError}
              />
            </View>
          ))}
          
          <TouchableOpacity 
            style={styles.addItemButton} 
            onPress={() => {
              userManualAddRef.current = true;
              onAddItem();
            }} 
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={20} color={Colors.accent} />
            <Text style={styles.addItemText}>Add another item</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you!</Text>
            <Text style={styles.footerDate}>{currentDate}</Text>
          </View>
        </View>
        
        {/* Bottom Torn Edge */}
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
    borderRadius: 0, // Sharp edges for receipt feel, but maybe slight radius
    flex: 1,
    marginVertical: Spacing.xs,
  },
  scrollViewContent: {
      padding: Spacing.xl,
      paddingTop: Spacing.xxl,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerTitle: {
      ...Typography.label,
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: 'center',
      letterSpacing: 2,
      fontWeight: '600',
  },
  headerDivider: {
    height: 2,
    width: 40,
    backgroundColor: Colors.accent,
    marginTop: Spacing.sm,
    borderRadius: Radius.pill,
  },
  itemContainer: {
    marginBottom: 0,
  },
  
  // View Mode Styles
  viewModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  viewModeMain: {
    flex: 1,
    marginRight: Spacing.md,
  },
  viewModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  viewModeName: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontFamily: Typography.familyMedium,
    flex: 1,
    marginRight: Spacing.md,
    fontSize: 16,
  },
  viewModeAmount: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    fontSize: 16,
  },
  viewModeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignedAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  miniAvatarContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.surface,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  miniAvatar: {
    width: '100%',
    height: '100%',
  },
  miniAvatarInitials: {
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    fontSize: 10,
    fontFamily: Typography.familyBold,
    color: Colors.textSecondary,
  },
  miniAvatarMore: {
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarMoreText: {
    fontSize: 9,
    fontFamily: Typography.familyBold,
    color: Colors.textSecondary,
  },
  unassignedText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  chevronIcon: {
    opacity: 0.3,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  errorBadgeText: {
    ...Typography.caption,
    color: Colors.danger,
    marginLeft: 4,
    fontWeight: '600',
  },

  // Edit Mode Styles
  editCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    marginVertical: Spacing.md,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  editTitle: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
  },
  deleteIconBtn: {
    padding: Spacing.xs,
  },
  editFormRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  editFieldFlex: {
    flex: 1,
  },
  editFieldFixed: {
    width: 100,
  },
  editLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '500',
  },
  editInput: {
    ...Typography.body1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm, // Reduced padding
    height: 40, // Fixed height to match PriceInput
    color: Colors.textPrimary,
    fontFamily: Typography.familyMedium,
    fontSize: 15,
  },
  priceInputStyle: {
    backgroundColor: Colors.surfaceLight,
    height: 40,
  },
  participantsSection: {
    marginBottom: Spacing.lg,
  },
  participantChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  participantChipContainerError: {
    borderColor: Colors.danger,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  
  // Chip Styles
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    padding: 4,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  chipSelected: {
    backgroundColor: Colors.brandLight,
    borderColor: Colors.accent,
  },
  chipAvatarContainer: {
    position: 'relative',
    marginRight: 8,
  },
  chipAvatar: {
    width: 28, 
    height: 28, 
    borderRadius: 14,
  },
  chipInitialsWrapper: {
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  chipInitials: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  checkmarkOverlay: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  chipLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
    maxWidth: 80,
  },
  chipLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // Action Buttons
  editActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  editActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  saveActionButton: {
    backgroundColor: Colors.accent,
  },
  cancelActionButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  editActionText: {
    ...Typography.label,
    color: Colors.white,
    fontWeight: '600',
  },
  cancelActionText: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  
  // Footer & Misc
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },
  addItemText: {
    ...Typography.body2,
    color: Colors.accent,
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.xs,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    borderStyle: 'dashed',
    paddingTop: Spacing.lg,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: Typography.familyMedium,
    fontSize: 12,
    marginBottom: 4,
  },
  footerDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
    opacity: 0.7,
  },
  tornEdgeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  tornCircle: {
    backgroundColor: Colors.background,
    borderRadius: 999,
  },
  errorLabel: {
    color: Colors.danger,
  },
  errorHelperText: {
    ...Typography.caption,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
});

export default ReceiptBreakdown;