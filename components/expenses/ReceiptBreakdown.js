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
  Alert,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import PriceInput from './PriceInput'; 
import LoadingSpinner from '../LoadingSpinner';
import { Colors, Spacing, Radius, Shadows, Typography } from '../../design/tokens';
import { useTranslation } from '../../contexts/LanguageContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Helper function for relative time display
const getRelativeTime = (timestamp, t) => {
  if (!timestamp) return null;
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return t('components.expenses.receiptBreakdown.time.justNow');
  if (diffMins < 60) return t('components.expenses.receiptBreakdown.time.minutesAgo', { count: diffMins });

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('components.expenses.receiptBreakdown.time.hoursAgo', { count: diffHours });

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return t('components.expenses.receiptBreakdown.time.daysAgo', { count: diffDays });

  const diffWeeks = Math.floor(diffDays / 7);
  return t('components.expenses.receiptBreakdown.time.weeksAgo', { count: diffWeeks });
};

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

const ItemRow = memo(({
  item,
  index,
  isEditing,
  isLocked,
  participants,
  onToggleEdit,
  onSave,
  onCancel,
  onUpdate,
  onRemove,
  isSaving,
  validationErrors,
  onClearValidationError
}) => {
  const { t } = useTranslation();
  const itemErrors = validationErrors?.[item.id] || {};
  const [localValidationErrors, setLocalValidationErrors] = useState({});
  
  useEffect(() => {
    if (!isEditing) {
      setLocalValidationErrors({});
    }
  }, [isEditing]);
  
  const handleParticipantPress = useCallback((pIndex) => {
    const isSelected = item.selectedConsumers?.includes(pIndex);
    const current = item.selectedConsumers || [];
    const newConsumers = isSelected ? current.filter(i => i !== pIndex) : [...current, pIndex];
    onUpdate('item', index, 'selectedConsumers', newConsumers);
    
    if (onClearValidationError && newConsumers.length > 0) {
      onClearValidationError(item.id, 'consumers');
    }
  }, [item.selectedConsumers, item.id, index, onUpdate, onClearValidationError]);

  const handleSaveClick = useCallback(() => {
    const errors = {};
    const amount = parseFloat(item.amount);
    if (!amount || amount <= 0 || isNaN(amount)) {
      errors.amount = true;
    }
    
    if (Object.keys(errors).length > 0) {
      setLocalValidationErrors(errors);
      return;
    }
    
    setLocalValidationErrors({});
    onSave(index);
  }, [item.amount, index, onSave]);

  const editCardAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isEditing ? 1 : 0, { duration: 300 }),
      display: isEditing ? 'flex' : 'none',
      overflow: 'hidden',
    };
  }, [isEditing]);

  const viewModeAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isEditing ? 0 : 1, { duration: 300 }),
      display: isEditing ? 'none' : 'flex',
    };
  }, [isEditing]);

  const selectedParticipants = useMemo(() => {
    return (item.selectedConsumers || []).map(idx => participants[idx]).filter(Boolean);
  }, [item.selectedConsumers, participants]);

  return (
    <View style={styles.itemWrapper}>
      {/* Edit Mode */}
      {isEditing && (
        <Animated.View style={editCardAnimatedStyle}>
          <View style={styles.editCard}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>{t('components.expenses.receiptBreakdown.editItem')}</Text>
              <TouchableOpacity onPress={() => onRemove(index)} style={styles.deleteIconBtn}>
                 <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>

            <View style={styles.editFormRow}>
              <View style={styles.editFieldFlex}>
                <Text style={styles.editLabel}>{t('components.expenses.receiptBreakdown.itemName')}</Text>
                <TextInput
                  style={styles.editInput}
                  value={item.name || t('components.expenses.receiptBreakdown.itemDefault', { index: index + 1 })}
                  onChangeText={(value) => onUpdate('item', index, 'name', value)}
                  placeholder={t('components.expenses.receiptBreakdown.itemNamePlaceholder')}
                  keyboardType="default"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.editFieldFixed}>
                <Text style={[styles.editLabel, (itemErrors.amount || localValidationErrors.amount) && styles.errorLabel]}>
                  {t('components.expenses.receiptBreakdown.price')}
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

            <View style={styles.participantsSection}>
              <Text style={[styles.editLabel, itemErrors.consumers && styles.errorLabel]}>
                {t('components.expenses.receiptBreakdown.splitWith')}
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
                  {t('components.expenses.receiptBreakdown.selectPerson')}
                </Text>
              )}
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={() => onCancel(item.id)}
                style={[styles.editActionButton, styles.cancelActionButton]}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelActionText}>{t('components.expenses.receiptBreakdown.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveClick}
                style={[styles.editActionButton, styles.saveActionButton, isSaving && styles.disabledButton]}
                activeOpacity={0.8}
                disabled={isSaving}
              >
                {isSaving ? (
                   <LoadingSpinner size="small" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={Colors.white} style={{ marginRight: 4 }} />
                    <Text style={styles.editActionText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* View Mode */}
      {!isEditing && (
        <Animated.View style={viewModeAnimatedStyle}>
          <TouchableOpacity
            style={[styles.viewModeRow, isLocked && styles.viewModeRowLocked]}
            onPress={() => {
              if (isLocked) {
                Alert.alert(
                  t('components.expenses.receiptBreakdown.lockedTitle'),
                  t('components.expenses.receiptBreakdown.lockedMsg')
                );
                return;
              }
              onToggleEdit(item.id);
            }}
            activeOpacity={isLocked ? 0.8 : 0.6}
          >
            <View style={styles.itemIconContainer}>
               <Ionicons name={isLocked ? "lock-closed" : "receipt-outline"} size={20} color={isLocked ? Colors.textSecondary : Colors.textPrimary} />
            </View>

            <View style={styles.viewModeMain}>
              <View style={styles.viewModeNameRow}>
                <Text style={[styles.viewModeName, isLocked && styles.viewModeNameLocked]} numberOfLines={1}>
                  {item.name || t('components.expenses.receiptBreakdown.itemDefault', { index: index + 1 })}
                </Text>
                {isLocked && (
                  <View style={styles.settledBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                    <Text style={styles.settledBadgeText}>{t('components.expenses.receiptBreakdown.settled')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.viewModeSecondRow}>
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
                   <Text style={[styles.unassignedText, itemErrors.consumers && { color: Colors.danger }]}>
                     {itemErrors.consumers ? t('components.expenses.receiptBreakdown.assignSomeone') : t('components.expenses.receiptBreakdown.noOneAssigned')}
                   </Text>
                )}
                {selectedParticipants.length > 5 && (
                  <View style={[styles.miniAvatarContainer, { zIndex: 0, marginLeft: -8 }]}>
                    <View style={[styles.miniAvatar, styles.miniAvatarMore]}>
                      <Text style={styles.miniAvatarMoreText}>+{selectedParticipants.length - 5}</Text>
                    </View>
                  </View>
                )}
                </View>
                {item.createdAt && (
                  <Text style={styles.timestampText}>
                    {getRelativeTime(item.createdAt, t)}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.amountContainer}>
               <Text style={[styles.viewModeAmount, isLocked && styles.viewModeAmountLocked]}>
                ${(parseFloat(item.amount) || 0).toFixed(2)}
               </Text>
            </View>

            <Ionicons name={isLocked ? "lock-closed" : "chevron-forward"} size={16} color={Colors.textSecondary} style={{ marginLeft: Spacing.sm }} />
          </TouchableOpacity>
        </Animated.View>
      )}
      <View style={styles.separator} />
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
    prevProps.isLocked === nextProps.isLocked &&
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
  lockedItemIds,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSaveItem,
  isSavingItemId,
  scrollRef,
  isFocused,
  validationErrors = {},
  onClearValidationError,
  visibleHeaderHeight = 100, // Default fallback
}) => {
  const { t } = useTranslation();
  const [editingItemId, setEditingItemId] = useState(null); 
  const prevItemsLengthRef = useRef(items.length);
  const itemLayoutMapRef = useRef({});
  const userManualAddRef = useRef(false);
  const newlyAddedItemIdsRef = useRef(new Set()); 

  const scrollItemToTop = (itemId, delay = 0) => {
    setTimeout(() => {
      const itemY = itemLayoutMapRef.current[itemId];
      if (itemY != null && scrollRef?.current?.scrollTo) {
        // Calculate dynamic offset
        // receiptContainerY is stored in scrollRef.current by parent
        const containerY = scrollRef.current.receiptContainerY || 0;
        
        // Target Y is: Container Position + Item Position - Header/Tab Height
        // padding top in ScrollView contentContainerStyle is handled by the scroll view itself usually,
        // but we need to ensure the item ends up visible below the header.
        
        // If contentContainer has paddingTop, that pushes content down.
        // scrollTo(0) is the very top of content.
        // We want the item at 'visibleHeaderHeight' from the top of the SCREEN.
        // But scrollTo deals with content coordinates.
        // The ScrollView content starts at y=0.
        // The visible area matches the content coordinates if no inset.
        // But we have insets. 
        
        // Let's rely on relative calculation:
        // We want the item top to be at the top of the "safe" viewing area.
        // safe area top = visibleHeaderHeight (passed from parent).
        
        // Absolute Y of item in ScrollView content = containerY + itemY
        // We want to scroll s.t. (containerY + itemY) - scrollY = visibleHeaderHeight + margin
        // scrollY = (containerY + itemY) - (visibleHeaderHeight + margin)
        
        const margin = 20; // Increased margin for better visibility
        const targetScrollY = Math.max(0, containerY + itemY - visibleHeaderHeight - margin);
        
        scrollRef.current.scrollTo({ y: targetScrollY, animated: true });
      }
    }, delay);
  };

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

  useEffect(() => {
    const itemsAdded = items.length - prevItemsLengthRef.current;
    if (itemsAdded === 1 && userManualAddRef.current) {
      const newItem = items[items.length - 1];
      if (newItem?.id) {
        userManualAddRef.current = false;
        newlyAddedItemIdsRef.current.add(newItem.id);
        setEditingItemId(newItem.id);
        scrollItemToTop(newItem.id, 50);
      }
    }
    prevItemsLengthRef.current = items.length;
  }, [items]);

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

  const saveItemChanges = useCallback(async (index) => {
    const item = items[index];
    if (item) {
      if (onSaveItem) {
        await onSaveItem(index);
      }
      newlyAddedItemIdsRef.current.delete(item.id);
      setEditingItemId(null);
    }
  }, [items, onSaveItem]);

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

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.sectionHeaderText}>{t('components.expenses.receiptBreakdown.header')}</Text>
      </View>

      <View style={styles.cardContainer}>
          {items.map((item, index) => (
            <View
              key={item.id}
              onLayout={(e) => handleItemLayout(item.id, e)}
            >
              <ItemRow
                item={item}
                index={index}
                isEditing={editingItemId === item.id}
                isLocked={lockedItemIds?.has(item.id) || false}
                isSaving={isSavingItemId === item.id}
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
            activeOpacity={0.7}
          >
            <View style={styles.addItemIconContainer}>
                <Ionicons name="add" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.addItemText}>{t('components.expenses.receiptBreakdown.addItem')}</Text>
          </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  headerContainer: {
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionHeaderText: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.card,
    elevation: 2, 
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  
  // Item Row
  itemWrapper: {
    backgroundColor: Colors.surface,
  },
  viewModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    minHeight: 56,
  },
  viewModeRowLocked: {
    opacity: 0.6,
  },
  itemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  viewModeMain: {
    flex: 1,
    justifyContent: 'center',
  },
  viewModeName: {
    ...Typography.body1,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  unassignedText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  amountContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  viewModeAmount: {
    ...Typography.body2,
    color: Colors.textSecondary,
    fontFamily: Typography.familySemiBold,
  },
  viewModeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  viewModeSecondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timestampText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.familyRegular,
  },
  viewModeNameLocked: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
    opacity: 0.7,
  },
  viewModeAmountLocked: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    gap: 3,
  },
  settledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.success,
  },

  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 16 + 32 + 12, // Align with text
  },

  // Avatars in view mode
  assignedAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  miniAvatarContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    width: '100%',
    height: '100%',
  },
  miniAvatarText: {
    fontSize: 9,
    fontFamily: Typography.familyBold,
    color: Colors.textSecondary,
  },
  miniAvatarMore: {
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  miniAvatarMoreText: {
    fontSize: 8,
    fontFamily: Typography.familyBold,
    color: Colors.textSecondary,
  },

  // Add Item Button
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  addItemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent + '15', // Transparent accent
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  addItemText: {
    ...Typography.body1,
    color: Colors.accent,
    fontFamily: Typography.familyMedium,
  },

  // Edit Mode Styles (kept mostly similar but inside the card context)
  editCard: {
    padding: Spacing.md,
    backgroundColor: Colors.surface, // Matches container now
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  editTitle: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
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
    paddingVertical: Spacing.sm, 
    height: 40,
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
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  editActionText: {
    ...Typography.body2,
    color: Colors.white,
    fontWeight: '600',
  },
  cancelActionText: {
    ...Typography.body2,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  errorLabel: {
    color: Colors.danger,
  },
  errorHelperText: {
    ...Typography.caption,
    color: Colors.danger,
    marginTop: 4,
  },
  spinnerContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.white,
    borderTopColor: 'transparent',
  },
  disabledButton: {
    opacity: 0.7,
  },
});

export default ReceiptBreakdown;