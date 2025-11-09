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
), (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
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

  // Animated styles for edit mode card - Slide down when opening, slide up when closing
  const editCardAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isEditing ? 1 : 0, { duration: 300 }),
      transform: [
        { 
          translateY: withTiming(isEditing ? 0 : -30, { duration: 300 })
        }
      ],
    };
  }, [isEditing]);

  // Animated styles for view mode - Fade in/out (stays in place)
  const viewModeAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isEditing ? 0 : 1, { duration: 300 }),
    };
  }, [isEditing]);

  // Render both modes and animate between them
  return (
    <View style={styles.itemContainer}>
      {/* Edit Mode - Animated */}
      <Animated.View 
        style={[
          editCardAnimatedStyle,
          { position: isEditing ? 'relative' : 'absolute', width: '100%' }
        ]}
        pointerEvents={isEditing ? 'auto' : 'none'}
      >
        <View style={styles.editCard}>
          {/* Item Name Input */}
          <View style={styles.editField}>
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
          <View style={styles.editField}>
            <Text style={[styles.editLabel, (itemErrors.amount || localValidationErrors.amount) && styles.errorLabel]}>
              Price{(itemErrors.amount || localValidationErrors.amount) && " *"}
            </Text>
            <PriceInput
              value={item.amount || 0}
              onChangeText={(value) => {
                onUpdate('item', index, 'amount', value);
                // Clear validation errors when user starts fixing
                if (onClearValidationError && parseFloat(value) > 0) {
                  onClearValidationError(item.id, 'amount');
                }
                if (parseFloat(value) > 0) {
                  setLocalValidationErrors(prev => ({ ...prev, amount: false }));
                }
              }}
              placeholder="0.00"
              error={!!(itemErrors.amount || localValidationErrors.amount)}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.editActions}>
            <TouchableOpacity
              onPress={handleSaveClick}
              style={[styles.editActionButton, styles.saveActionButton, styles.editActionButtonFirst]}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={18} color={Colors.white} />
              <Text style={styles.editActionText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onCancel(item.id)}
              style={[styles.editActionButton, styles.cancelActionButton]}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onRemove(index)}
              style={[styles.editActionButton, styles.deleteActionButton]}
              activeOpacity={0.8}
            >
              <Ionicons name="trash" size={16} color={Colors.white} />
              <Text style={styles.editActionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Participant Selection */}
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
            Please assign at least one person
          </Text>
        )}
      </Animated.View>

      {/* View Mode - Animated */}
      <Animated.View 
        style={[
          viewModeAnimatedStyle,
          { position: isEditing ? 'absolute' : 'relative', width: '100%' }
        ]}
        pointerEvents={isEditing ? 'none' : 'auto'}
      >
        <TouchableOpacity
          style={styles.viewModeRow}
          onPress={() => onToggleEdit(item.id)}
          activeOpacity={0.6}
        >
          <View style={styles.viewModeContent}>
            <Text style={styles.viewModeName} numberOfLines={1}>
              {item.name || `Item ${index + 1}`}
            </Text>
            <View style={styles.viewModeAmountContainer}>
              <Text style={styles.viewModeAmount}>
                ${(parseFloat(item.amount) || 0).toFixed(2)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} style={styles.chevronIcon} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Participant Selection */}
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
            Please assign at least one person
          </Text>
        )}
      </Animated.View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
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
  const [editingItemId, setEditingItemId] = useState(null); // Only one item in edit mode
  const prevItemsLengthRef = useRef(items.length);
  const itemLayoutMapRef = useRef({});
  const hasMountedRef = useRef(false);
  const skipNextAutoOpenRef = useRef(false);
  const newlyAddedItemIdsRef = useRef(new Set()); // Track items that were just added

  // Scroll item to just below header
  const scrollItemToTop = (itemId, delay = 0) => {
    setTimeout(() => {
      const y = itemLayoutMapRef.current[itemId];
      if (y != null && scrollRef?.current?.scrollTo) {
        const headerOffset = -340; // Space for header at top
        scrollRef.current.scrollTo({ y: Math.max(0, y - headerOffset), animated: true });
      }
    }, delay);
  };

  // Reset edit state and prevent auto-open on screen focus
  useEffect(() => {
    if (isFocused === true) {
      setEditingItemId(null);
      prevItemsLengthRef.current = items.length;
      skipNextAutoOpenRef.current = true;
    } else {
      // Clean up tracking when screen loses focus
      newlyAddedItemIdsRef.current.clear();
    }
  }, [isFocused]);

  // Clean up tracking for items that no longer exist
  useEffect(() => {
    const existingItemIds = new Set(items.map(item => item.id));
    newlyAddedItemIdsRef.current.forEach(itemId => {
      if (!existingItemIds.has(itemId)) {
        newlyAddedItemIdsRef.current.delete(itemId);
      }
    });
  }, [items]);

  // Auto-open newly added items in edit mode
  useEffect(() => {
    // Skip auto-open only if this is the initial focus (not a manual add)
    if (skipNextAutoOpenRef.current && items.length === prevItemsLengthRef.current) {
      skipNextAutoOpenRef.current = false;
      return;
    }
    
    const itemsAdded = items.length - prevItemsLengthRef.current;
    
    // Only auto-open if exactly ONE item was added (manual add)
    // Skip auto-open if multiple items were added at once (bulk load from scanning)
    if (itemsAdded === 1) {
      const newItem = items[items.length - 1];
      if (newItem?.id) {
        // Reset skip flag so future adds work
        skipNextAutoOpenRef.current = false;
        // Track this as a newly added item
        newlyAddedItemIdsRef.current.add(newItem.id);
        setEditingItemId(newItem.id);
        scrollItemToTop(newItem.id, 50);
      }
    } else if (itemsAdded > 1) {
      // Multiple items added (bulk load) - don't auto-open any
      skipNextAutoOpenRef.current = false;
    }
    
    prevItemsLengthRef.current = items.length;
  }, [items]);

  // Get the current date in a friendly format
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
    // For now, just exit edit mode since changes are saved in real-time
    const item = items[index];
    if (item) {
      // Remove from newly added tracking since it's been saved
      newlyAddedItemIdsRef.current.delete(item.id);
      setEditingItemId(null);
    }
  }, [items]);

  const cancelEdit = useCallback((itemId) => {
    // If this is a newly added item, delete it instead of just closing edit mode
    if (newlyAddedItemIdsRef.current.has(itemId)) {
      const itemIndex = items.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        newlyAddedItemIdsRef.current.delete(itemId);
        onRemoveItem(itemIndex);
      }
    } else {
      // Just close edit mode for existing items
      setEditingItemId(prev => (prev === itemId ? null : prev));
    }
  }, [items, onRemoveItem]);

  const handleItemLayout = useCallback((itemId, event) => {
    itemLayoutMapRef.current[itemId] = event.nativeEvent.layout.y;
  }, []);

  if (items.length === 0) {
    return null;
  }

  const circleSize = Spacing.lg; // diameter of each scallop
  const circleCount = 20; // Fixed number of circles for consistent performance

  return (
    <View style={styles.container}>
      <View style={styles.receiptContainer}>
        <View pointerEvents="none" style={[styles.tornEdgeContainer, { top: -(circleSize / 2) }]}>
          {Array.from({ length: circleCount }).map((_, i) => (
            <View key={`top-${i}`} style={[styles.tornCircle, { width: circleSize, height: circleSize }]} />
          ))}
        </View>
        
        <View style={styles.scrollViewContent}>
          <Text style={styles.headerTitle}>YOUR BREAKDOWN</Text>

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
          <TouchableOpacity style={styles.addItemButtonSmall} onPress={onAddItem} activeOpacity={0.8}>
            <View style={styles.addItemIconSmall}>
              <Ionicons name="add" size={16} color={Colors.accent} />
            </View>
            <Text style={styles.addItemTextSmall}>Add item</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you!</Text>
            <Text style={styles.footerText}>{currentDate}</Text>
          </View>
        </View>
        
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
  addItemButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  addItemIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    marginRight: Spacing.xs,
  },
  addItemTextSmall: {
    ...Typography.body,
    fontFamily: Typography.familySemiBold,
    color: Colors.accent,
  },
  // View Mode Styles
  viewModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: Spacing.sm,
  },
  viewModeContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewModeName: {
    ...Typography.body1,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    flex: 1,
    marginRight: Spacing.lg,
    fontSize: 16,
  },
  viewModeAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  viewModeAmount: {
    ...Typography.body1,
    color: Colors.accent,
    fontFamily: Typography.familyBold,
    fontSize: 16,
  },
  chevronIcon: {
    opacity: 0.3,
    marginLeft: Spacing.sm,
  },
  // Edit Mode Card Styles
  editCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accent,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  editField: {
    marginBottom: Spacing.lg,
  },
  editLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontFamily: Typography.familySemiBold,
    marginBottom: Spacing.sm,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editInput: {
    ...Typography.body1,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontFamily: Typography.familyMedium,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  editActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    marginLeft: Spacing.xs,
  },
  editActionButtonFirst: {
    marginLeft: 0,
  },
  saveActionButton: {
    backgroundColor: Colors.success,
  },
  cancelActionButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.divider,
  },
  deleteActionButton: {
    backgroundColor: Colors.danger,
  },
  editActionText: {
    ...Typography.label,
    color: Colors.white,
    fontFamily: Typography.familySemiBold,
    fontSize: 12,
  },
  cancelActionText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontFamily: Typography.familySemiBold,
    fontSize: 12,
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
  },
  errorLabel: {
    color: Colors.danger,
  },
  inputError: {
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  participantChipContainerError: {
    borderWidth: 2,
    borderColor: Colors.danger,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    backgroundColor: `${Colors.danger}10`,
  },
  errorHelperText: {
    ...Typography.caption,
    color: Colors.danger,
    marginTop: Spacing.xs,
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
});

export default ReceiptBreakdown;