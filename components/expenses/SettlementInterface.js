import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../../design/tokens';
import { getUserProfile } from '../../services/friendService';
import { useTranslation } from '../../contexts/LanguageContext';

const AVATAR_SIZE = 40;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const EmptySettlementState = ({ title, body }) => (
  <View style={styles.emptyWrap}>
    <View style={styles.emptyIconContainer}>
      <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
  </View>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Summary Header
   ───────────────────────────────────────────────────────────────────────── */
const SettlementSummary = ({ settlements, currentUserName, changeLog }) => {
  const { t } = useTranslation();
  const [activityExpanded, setActivityExpanded] = useState(false);

  const pending = settlements.filter(
    (s) => !['markedAsPaid', 'confirmed', 'complete'].includes(s.status || 'noAction'),
  ).length;
  const settled = settlements.length - pending;

  let youOwe = 0;
  let youreOwed = 0;
  settlements.forEach((s) => {
    if (['markedAsPaid', 'confirmed', 'complete'].includes(s.status || '')) return;

    // For partial settlements, use remaining amount instead of total amount
    const amount = s.status === 'partial' ? (s.remainingAmount || s.amount) : s.amount;

    if ((s.debtor || s.from) === currentUserName) youOwe += amount;
    if ((s.creditor || s.to) === currentUserName) youreOwed += amount;
  });

  const sorted = changeLog?.length ? [...changeLog]
    .filter(e => e.type !== 'priceChange')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
  const visible = activityExpanded ? sorted : sorted.slice(0, 3);

  const relative = (ts) => {
    const diffMs = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return t('components.expenses.receiptBreakdown.time.justNow');
    if (m < 60) return t('components.expenses.receiptBreakdown.time.minutesAgo', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('components.expenses.receiptBreakdown.time.hoursAgo', { count: h });
    const d = Math.floor(h / 24);
    if (d < 7) return t('components.expenses.receiptBreakdown.time.daysAgo', { count: d });
    const w = Math.floor(d / 7);
    return t('components.expenses.receiptBreakdown.time.weeksAgo', { count: w });
  };

  const describe = (e) => {
    const user = e.userName || 'Someone';
    switch (e.type) {
      case 'priceChange':
        return t('components.expenses.settlementInterface.activity.types.priceChange', { 
            user, 
            prev: e.details?.previousValue?.toFixed(2), 
            new: e.details?.newValue?.toFixed(2) 
        });
      case 'itemAdded':
        if (e.details?.itemAmount != null) {
          return t('components.expenses.settlementInterface.activity.types.itemAddedAmount', {
              user,
              item: e.details.itemName,
              amount: parseFloat(e.details.itemAmount).toFixed(2)
          });
        }
        return t('components.expenses.settlementInterface.activity.types.itemAdded', { user, item: e.details?.itemName });
      case 'itemRemoved':
        if (e.details?.itemAmount != null) {
            return t('components.expenses.settlementInterface.activity.types.itemRemovedAmount', {
                user,
                item: e.details.itemName,
                amount: parseFloat(e.details.itemAmount).toFixed(2)
            });
        }
        return t('components.expenses.settlementInterface.activity.types.itemRemoved', { user, item: e.details?.itemName });
      case 'participantAdded':
        return t('components.expenses.settlementInterface.activity.types.participantAdded', { user, participant: e.details?.participantName });
      case 'participantRemoved':
        return t('components.expenses.settlementInterface.activity.types.participantRemoved', { user, participant: e.details?.participantName });
      case 'itemModified':
        return t('components.expenses.settlementInterface.activity.types.itemModified', { 
            user, 
            item: e.details?.itemName,
            amount: parseFloat(e.details?.itemAmount || 0).toFixed(2)
        });
      case 'settlementAction':
        if (e.subtype === 'settled') {
             return t('components.expenses.settlementInterface.activity.types.settled', {
                user,
                peer: e.details?.peerName || 'someone',
                amount: parseFloat(e.details?.amount || 0).toFixed(2)
             });
        } else if (e.subtype === 'unsettled') {
             return t('components.expenses.settlementInterface.activity.types.unsettled', {
                user,
                peer: e.details?.peerName || 'someone',
                amount: parseFloat(e.details?.amount || 0).toFixed(2)
             });
        }
        return t('components.expenses.settlementInterface.activity.types.default', { user });
      default:
        return t('components.expenses.settlementInterface.activity.types.default', { user });
    }
  };

  return (
      <Animated.View style={styles.summaryCard}>
          {youOwe > 0 && (
            <View style={styles.summaryRow}>
              <View style={[styles.dot, { backgroundColor: Colors.error }]} />
              <Text style={styles.summaryLabel}>{t('components.expenses.settlementInterface.summary.youOwe')}</Text>
              <Text style={[styles.summaryAmount, { color: Colors.error }]}>
                ${youOwe.toFixed(2)}
              </Text>
            </View>
          )}
          {youreOwed > 0 && (
            <View style={styles.summaryRow}>
              <View style={[styles.dot, { backgroundColor: Colors.success }]} />
              <Text style={styles.summaryLabel}>{t('components.expenses.settlementInterface.summary.youreOwed')}</Text>
              <Text style={[styles.summaryAmount, { color: Colors.success }]}>
                ${youreOwed.toFixed(2)}
              </Text>
            </View>
          )}
          {youOwe === 0 && youreOwed === 0 && (
            <View style={styles.summaryRow}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={[styles.summaryLabel, { color: Colors.success, fontWeight: '600' }]}>
                 {t('components.expenses.settlementInterface.summary.allSettled')}
              </Text>
            </View>
          )}
      
      {pending > 0 && (
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: Colors.statusPending + '20' }]}>
            <Text style={[styles.pillText, { color: Colors.statusPending }]}>{t('components.expenses.settlementInterface.summary.pending', { count: pending })}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: Colors.success + '20' }]}>
            <Text style={[styles.pillText, { color: Colors.success }]}>{t('components.expenses.settlementInterface.summary.settled', { count: settled })}</Text>
          </View>
        </View>
      )}

      {/* Activity Log inside summary */}
      {sorted.length > 0 && (
        <>
          <View style={styles.activityDivider} />
          <TouchableOpacity
            style={styles.activityHeaderInline}
            onPress={() => sorted.length > 3 && setActivityExpanded(!activityExpanded)}
            disabled={sorted.length <= 3}
          >
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.activityTitleInline}>{t('components.expenses.settlementInterface.activity.title')}</Text>
            {sorted.length > 3 && (
              <Ionicons name={activityExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
            )}
          </TouchableOpacity>
          {visible.map((e, i) => (
            <View key={`${e.timestamp}-${i}`} style={styles.activityRowInline}>
              <View style={styles.activityDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activityBody} numberOfLines={2}>{describe(e)}</Text>
                <Text style={styles.activityTime}>{relative(e.timestamp)}</Text>
              </View>
            </View>
          ))}
          {!activityExpanded && sorted.length > 3 && (
            <TouchableOpacity style={styles.showMore} onPress={() => setActivityExpanded(true)}>
              <Text style={styles.showMoreText}>{t('components.expenses.settlementInterface.activity.showMore', { count: sorted.length - 3 })}</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </Animated.View>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Status Pill
   ───────────────────────────────────────────────────────────────────────── */
const STATUS_MAP = {
  complete: { label: 'Fully Settled', color: Colors.statusSettled },
  partial: { label: 'Partially Settled', color: Colors.statusPartial },
  markedAsPaid: { label: 'Settled', color: Colors.statusSettled },
  confirmed: { label: 'Settled', color: Colors.statusSettled },
  reminderSent: { label: 'Reminded', color: Colors.statusPending },
  noAction: { label: 'Awaiting Payment', color: Colors.statusPending },
};

const StatusPill = ({ status }) => {
  const { t } = useTranslation();
  
  const getStatusLabel = (s) => {
    switch (s) {
      case 'complete': return t('components.expenses.settlementInterface.status.fullySettled');
      case 'partial': return t('components.expenses.settlementInterface.status.partiallySettled');
      case 'markedAsPaid':
      case 'confirmed': return t('components.expenses.settlementInterface.status.settled');
      case 'reminderSent': return t('components.expenses.settlementInterface.status.reminded');
      default: return t('components.expenses.settlementInterface.status.awaitingPayment');
    }
  };

  const STATUS_COLORS = {
    complete: Colors.statusSettled,
    partial: Colors.statusPartial,
    markedAsPaid: Colors.statusSettled,
    confirmed: Colors.statusSettled,
    reminderSent: Colors.statusPending,
    noAction: Colors.statusPending,
  };

  const color = STATUS_COLORS[status] || STATUS_COLORS.noAction;
  const label = getStatusLabel(status);

  return (
    <View style={[styles.statusPill, { backgroundColor: color + '15' }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
};



/* ─────────────────────────────────────────────────────────────────────────────
   Associated Items List
   ───────────────────────────────────────────────────────────────────────── */
const AssociatedItemsList = ({ items, settlement, onToggleItem, readOnly, selectedItemIds, onToggleSelection }) => {
  const { t } = useTranslation();
  if (!items || items.length === 0) return null;

  const unsettledItems = items.filter(i => !i.settled);
  const allUnsettledSelected = unsettledItems.length > 0 && unsettledItems.every(i => selectedItemIds?.has(i.id));

  return (
    <View style={styles.assocContainer}>
      <View style={styles.assocHeader}>
        <Text style={styles.assocTitle}>
          {t('components.expenses.settlementInterface.items.title')} {!readOnly && !selectedItemIds && t('components.expenses.settlementInterface.items.tapToSettle')}
        </Text>
        {!readOnly && selectedItemIds && unsettledItems.length > 1 && (
          <TouchableOpacity
            onPress={() => {
              if (allUnsettledSelected) {
                unsettledItems.forEach(i => onToggleSelection(i.id));
              } else {
                unsettledItems.filter(i => !selectedItemIds.has(i.id)).forEach(i => onToggleSelection(i.id));
              }
            }}
            hitSlop={8}
          >
            <Text style={styles.selectAllText}>
              {allUnsettledSelected ? t('components.expenses.settlementInterface.items.deselectAll') : t('components.expenses.settlementInterface.items.selectAll')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {items.map((item, i) => {
        const isSettled = item.settled;
        const isSelected = !isSettled && selectedItemIds?.has(item.id);

        let iconName, iconColor;
        if (isSettled) {
          iconName = 'checkmark-circle';
          iconColor = Colors.success;
        } else if (isSelected) {
          iconName = 'checkbox';
          iconColor = Colors.accent;
        } else {
          iconName = 'square-outline';
          iconColor = Colors.textSecondary;
        }

        const handlePress = () => {
          if (readOnly) return;
          if (isSettled) {
            onToggleItem?.(settlement, item);
          } else if (onToggleSelection) {
            onToggleSelection(item.id);
          }
        };

        return (
          <TouchableOpacity
            key={item.id || i}
            style={styles.assocRow}
            onPress={handlePress}
            disabled={readOnly}
            activeOpacity={0.7}
          >
            <Ionicons
              name={iconName}
              size={18}
              color={iconColor}
              style={{ marginRight: 8 }}
            />
            <Text style={[
              styles.assocName,
              isSettled && styles.assocNameSettled,
              !isSettled && !isSelected && selectedItemIds && styles.assocNameDeselected,
            ]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[
              styles.assocAmount,
              isSettled && styles.assocAmountSettled,
              !isSettled && !isSelected && selectedItemIds && styles.assocAmountDeselected,
            ]}>
              ${item.amount.toFixed(2)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Settlement Card
   ───────────────────────────────────────────────────────────────────────── */
const SettlementCard = ({ settlement, index, participants, currentUserId, currentUserName, onAction, onToggleItem, onBulkSettle, onBulkAction, readOnly }) => {
  const { t } = useTranslation();
  const fromName = settlement.debtor || settlement.from;
  const toName = settlement.creditor || settlement.to;
  const fromP = participants.find((p) => p.name === fromName);
  const toP = participants.find((p) => p.name === toName);
  const isDebtor = fromName === currentUserName;
  const isCreditor = toName === currentUserName;
  const isSpectator = !isDebtor && !isCreditor;
  const status = settlement.status || 'noAction';
  const isSettled = status === 'markedAsPaid' || status === 'confirmed' || status === 'complete';

  const [busy, setBusy] = useState(false);
  const [venmoTag, setVenmoTag] = useState(null);

  // Selection state: all unsettled items start selected
  const unsettledItemIds = useMemo(() =>
    (settlement.associatedItems || []).filter(i => !i.settled).map(i => i.id),
    [settlement.associatedItems]
  );
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set(unsettledItemIds));

  // Sync selection when unsettled items change (e.g. after settling/unsettling)
  useEffect(() => {
    setSelectedItemIds(prev => {
      const unsettledSet = new Set(unsettledItemIds);
      const next = new Set();
      // Keep existing selections that are still unsettled
      prev.forEach(id => {
        if (unsettledSet.has(id)) next.add(id);
      });
      // Auto-select newly unsettled items (weren't in prev at all)
      unsettledItemIds.forEach(id => {
        if (!prev.has(id)) next.add(id);
      });
      return next;
    });
  }, [unsettledItemIds.join(',')]);

  const toggleSelection = useCallback((itemId) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  // Calculate selected amount for bulk actions
  const selectedAmount = useMemo(() => {
    return (settlement.associatedItems || [])
      .filter(i => !i.settled && selectedItemIds.has(i.id))
      .reduce((sum, i) => sum + i.amount, 0);
  }, [settlement.associatedItems, selectedItemIds]);

  // Fetch venmo username of the "other" participant
  useEffect(() => {
    const other = isDebtor ? toP : isCreditor ? fromP : null;
    if (!other?.userId) return;
    let cancelled = false;
    getUserProfile(other.userId).then((p) => {
      if (!cancelled && p?.venmoUsername) setVenmoTag(p.venmoUsername);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isDebtor, isCreditor, fromP?.userId, toP?.userId]);

  // Press spring
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const fire = async (type) => {
    setBusy(true);
    try {
      if (onBulkAction) {
        await onBulkAction(type, settlement, [...selectedItemIds]);
      } else {
        await onAction(type, settlement);
      }
    }
    finally { setBusy(false); }
  };

  // Accent color for left strip
  let accent = Colors.statusPending;
  if (isSettled) accent = Colors.statusSettled;
  else if (status === 'partial') accent = Colors.statusPartial;

  const avatar = (p, isCurrent) =>
    p?.profilePhoto ? (
      <Image source={{ uri: p.profilePhoto }} style={[styles.avatar, isCurrent && styles.avatarMe]} contentFit="cover" />
    ) : (
      <View style={[styles.avatarFallback, isCurrent && styles.avatarMeBg]}>
        <Text style={[styles.avatarLetter, isCurrent && { color: Colors.white }]}>
          {(p?.name?.[0] || 'U').toUpperCase()}
        </Text>
      </View>
    );

  /* ── action button ─────────────────────────────────────────────────── */
  const hasItems = (settlement.associatedItems || []).length > 0;
  const noSelection = hasItems && selectedItemIds.size === 0;

  const actionBtn = () => {
    if (readOnly) return null;

    if (status === 'complete') {
      return btn(t('components.expenses.settlementInterface.actions.allSettled'), 'checkmark-circle', 'disabled');
    }

    const confirmMarkSettled = () => {
      const amt = hasItems ? `$${selectedAmount.toFixed(2)}` : `$${settlement.amount.toFixed(2)}`;
      Alert.alert(
        t('components.expenses.settlementInterface.alerts.markSettled.title'),
        t('components.expenses.settlementInterface.alerts.markSettled.message', { amount: amt }),
        [
          { text: t('components.expenses.settlementInterface.alerts.markSettled.cancel'), style: 'cancel' },
          { text: t('components.expenses.settlementInterface.alerts.markSettled.confirm'), onPress: () => fire('markAsSettled') },
        ],
      );
    };

    if (isDebtor) {
      if (noSelection)
        return btn(t('components.expenses.settlementInterface.actions.selectToSettle'), 'checkbox-outline', 'disabled');
      const amt = hasItems ? `$${selectedAmount.toFixed(2)}` : `$${settlement.amount.toFixed(2)}`;
      return (
        <View style={styles.actionBtnGroup}>
          {btn(t('components.expenses.settlementInterface.actions.pay', { amount: amt }), 'logo-venmo', 'venmo', () => fire('makePayment'))}
          {onBulkSettle && btn(t('components.expenses.settlementInterface.actions.markSettled', { amount: amt }), 'checkmark-circle-outline', 'secondary', confirmMarkSettled)}
        </View>
      );
    }
    if (isCreditor) {
      if (noSelection)
        return btn(t('components.expenses.settlementInterface.actions.selectToSettle'), 'checkbox-outline', 'disabled');
      const amt = hasItems ? `$${selectedAmount.toFixed(2)}` : `$${settlement.amount.toFixed(2)}`;
      return (
        <View style={styles.actionBtnGroup}>
          {btn(t('components.expenses.settlementInterface.actions.request', { amount: amt }), 'logo-venmo', 'venmo', () => fire('requestPayment'))}
          {onBulkSettle && btn(t('components.expenses.settlementInterface.actions.markSettled', { amount: amt }), 'checkmark-circle-outline', 'secondary', confirmMarkSettled)}
        </View>
      );
    }
    if (isSpectator) {
      if (status === 'reminderSent')
        return btn(t('components.expenses.settlementInterface.actions.reminderSent'), 'checkmark', 'disabled');
      return btn(t('components.expenses.settlementInterface.actions.sendReminder'), 'notifications-outline', 'secondary', () => fire('sendReminder'));
    }
    return null;
  };

  const btn = (label, icon, variant, onPress) => {
    const disabled = variant === 'disabled';
    const variantStyle =
      variant === 'venmo' ? styles.btnVenmo :
      variant === 'primary' ? styles.btnPrimary :
      variant === 'success' ? styles.btnSuccess :
      variant === 'disabled' ? styles.btnDisabled :
      styles.btnSecondary;
    const textColor =
      variant === 'secondary' ? Colors.textPrimary :
      variant === 'disabled' ? Colors.textSecondary :
      Colors.white;

    return (
      <TouchableOpacity
        style={[styles.btn, variantStyle]}
        onPress={onPress}
        disabled={disabled || busy}
        activeOpacity={0.8}
      >
        {busy ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            <Ionicons name={icon} size={16} color={textColor} style={{ marginRight: 6 }} />
            <Text style={[styles.btnLabel, { color: textColor }]}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).springify().damping(14)}
      layout={Layout.springify()}
    >
      <AnimatedPressable
        style={animStyle}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      >
        <View style={[styles.card, isSettled && styles.cardSettled]}>
          {/* Accent strip */}
          <View style={[styles.strip, { backgroundColor: accent }]} />

          <View style={styles.cardInner}>
            {/* Badges */}
            <View style={styles.badgeRow}>
              <StatusPill status={status} />
            </View>

            {/* Participants */}
            <View style={styles.pRow}>
              <View style={styles.pSide}>
                {avatar(fromP, fromP?.userId === currentUserId)}
                <Text style={styles.pName} numberOfLines={1}>{isDebtor ? 'You' : fromName?.split(' ')[0]}</Text>
                {venmoTag && isDebtor && <Text style={styles.venmo} numberOfLines={1}>@{venmoTag}</Text>}
              </View>
              <View style={styles.connector}>
                <View style={styles.dash} />
                <View style={styles.arrowDot}>
                  <Ionicons name="arrow-forward" size={14} color={Colors.white} />
                </View>
                <View style={styles.dash} />
              </View>
              <View style={styles.pSide}>
                {avatar(toP, toP?.userId === currentUserId)}
                <Text style={styles.pName} numberOfLines={1}>{isCreditor ? 'You' : toName?.split(' ')[0]}</Text>
                {venmoTag && isCreditor && <Text style={styles.venmo} numberOfLines={1}>@{venmoTag}</Text>}
              </View>
            </View>

            {/* Who owes who label */}
            <View style={styles.oweLabel}>
              {isDebtor && (
                <Text style={styles.oweLabelText}>
                  {t('components.expenses.settlementInterface.relationships.youOwe', { name: toName?.split(' ')[0] })}
                </Text>
              )}
              {isCreditor && (
                <Text style={styles.oweLabelText}>
                  {t('components.expenses.settlementInterface.relationships.owesYou', { name: fromName?.split(' ')[0] })}
                </Text>
              )}
              {isSpectator && (
                <Text style={styles.oweLabelText}>
                    {t('components.expenses.settlementInterface.relationships.owes', { name: fromName?.split(' ')[0], name2: toName?.split(' ')[0] })}
                </Text>
              )}
            </View>

            {/* Amount */}
            <View style={styles.amtRow}>
              <Text style={[styles.dollar, isSettled && styles.faded]}>$</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.amt, isSettled && styles.amtStruck]}>
                  {(status === 'partial' ? (settlement.remainingAmount || settlement.amount) : settlement.amount).toFixed(2)}
                </Text>
                {status === 'partial' && (
                  <Text style={styles.totalText}>
                    {t('components.expenses.settlementInterface.total', { amount: settlement.amount.toFixed(2) })}
                  </Text>
                )}
              </View>
            </View>

            {/* Associated Items */}
            <AssociatedItemsList
              items={settlement.associatedItems}
              settlement={settlement}
              onToggleItem={onToggleItem}
              readOnly={readOnly}
              selectedItemIds={!readOnly ? selectedItemIds : undefined}
              onToggleSelection={!readOnly ? toggleSelection : undefined}
            />

            {/* Actions */}
            {actionBtn()}

            {/* Subtle links */}
            {!readOnly && (status === 'markedAsPaid' || status === 'confirmed') && (
              <TouchableOpacity style={styles.link} onPress={() => fire('undoMarkAsPaid')}>
                <Text style={styles.linkText}>{t('components.expenses.settlementInterface.actions.undoSettlement')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   SettlementInterface  (public API)
   ───────────────────────────────────────────────────────────────────────── */
const SettlementInterface = ({
  settlements = [],
  participants = [],
  currentUserId,
  onAction,
  onToggleItem,
  onBulkSettle,
  onBulkAction,
  changeLog = [],
  readOnly = false,
  recalculationInfo = null,
  onDismissRecalculation,
}) => {
  const { t } = useTranslation();
  const current = participants.find((p) => p.userId === currentUserId) || {};
  const name = current.name || '';

  // Filter settlements to only show those involving the current user
  const userSettlements = useMemo(() => {
    return settlements.filter(s => {
      const debtor = s.debtor || s.from;
      const creditor = s.creditor || s.to;
      return debtor === name || creditor === name;
    });
  }, [settlements, name]);

  if (!userSettlements.length && !readOnly) {
    return (
      <Animated.View>
          <EmptySettlementState 
             title={t('components.expenses.settlementInterface.empty.title')}
             body={t('components.expenses.settlementInterface.empty.body')}
          />
      </Animated.View>
    );
  }

  return (
    <View style={styles.root}>
      {recalculationInfo && (
        <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)} style={styles.banner}>
          <Ionicons name="information-circle" size={20} color={Colors.statusPaymentSent} />
          <View style={styles.bannerBody}>
            <Text style={styles.bannerTitle}>{t('components.expenses.settlementInterface.banner.title')}</Text>
            <Text style={styles.bannerSub}>
              {t('components.expenses.settlementInterface.banner.sub', { new: recalculationInfo.newSettlements, paid: recalculationInfo.paidSettlements })}
            </Text>
          </View>
          {onDismissRecalculation && (
            <TouchableOpacity onPress={onDismissRecalculation} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {userSettlements.length > 0 && <SettlementSummary settlements={userSettlements} currentUserName={name} changeLog={changeLog} />}

      {userSettlements.map((s, i) => (
        <SettlementCard
          key={`${s.debtor || s.from}|||${s.creditor || s.to}|||${i}`}
          settlement={s}
          index={i}
          participants={participants}
          currentUserId={currentUserId}
          currentUserName={name}
          onAction={onAction}
          onToggleItem={onToggleItem}
          onBulkSettle={onBulkSettle}
          onBulkAction={onBulkAction}
          readOnly={readOnly}
        />
      ))}
    </View>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Styles
   ───────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { paddingBottom: Spacing.xl },

  // Summary
  summaryCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginBottom: Spacing.lg, ...Shadows.card },
  summaryCardEmpty: { marginBottom: Spacing.lg },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  summaryLabel: { ...Typography.body, color: Colors.textSecondary, fontWeight: '500' },
  summaryAmount: { ...Typography.title, fontWeight: '700', marginLeft: 'auto' },
  summaryAllSettled: { ...Typography.title, color: Colors.success, fontWeight: '600' },
  pillRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  pill: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.pill },
  pillText: { fontSize: 11, fontWeight: '600' },

  // Card
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, marginBottom: Spacing.md, overflow: 'hidden', ...Shadows.card, borderWidth: 1, borderColor: Colors.divider },
  cardSettled: { opacity: 0.85, borderColor: Colors.success + '40' },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: Radius.lg, borderBottomLeftRadius: Radius.lg },
  cardInner: { padding: Spacing.lg, paddingLeft: Spacing.lg + 4 },

  // Badges
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },

  // Participants
  pRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  pSide: { alignItems: 'center', width: 70 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 2, borderColor: Colors.surface, ...Shadows.avatar, marginBottom: 4 },
  avatarMe: { borderColor: Colors.accent, borderWidth: 2.5 },
  avatarFallback: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: Colors.divider, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.surface, ...Shadows.avatar, marginBottom: 4 },
  avatarMeBg: { borderColor: Colors.accent, backgroundColor: Colors.accent, borderWidth: 2.5 },
  avatarLetter: { fontSize: Math.floor(AVATAR_SIZE / 2.5), fontWeight: '600', color: Colors.textSecondary },
  pName: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', maxWidth: 70 },
  venmo: { fontSize: 10, color: Colors.venmo, fontWeight: '500', textAlign: 'center', maxWidth: 70, marginTop: 1 },

  // Connector
  connector: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xs },
  dash: { flex: 1, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.divider },
  arrowDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },

  // Who owes who label
  oweLabel: { alignItems: 'center', marginBottom: Spacing.xs },
  oweLabelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.3 },

  // Amount
  amtRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginBottom: Spacing.md },
  dollar: { fontSize: 22, fontWeight: '600', color: Colors.textSecondary, marginRight: 2, marginTop: 4 },
  amt: { fontSize: 38, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -1 },
  amtStruck: { textDecorationLine: 'line-through', color: Colors.textSecondary, opacity: 0.6 },
  faded: { color: Colors.textSecondary, opacity: 0.6 },
  totalText: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },

  // Associated Items
  assocContainer: { backgroundColor: Colors.surfaceLight || Colors.background, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.md },
  assocHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  assocTitle: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectAllText: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  assocRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  assocName: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  assocNameSettled: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  assocAmount: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', marginLeft: Spacing.sm },
  assocAmountSettled: { textDecorationLine: 'line-through', opacity: 0.6 },
  assocNameDeselected: { opacity: 0.5 },
  assocAmountDeselected: { opacity: 0.5 },

  // Buttons
  actionBtnGroup: { gap: Spacing.xs },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: Spacing.lg, borderRadius: Radius.md },
  btnPrimary: { backgroundColor: Colors.accent },
  btnVenmo: { backgroundColor: Colors.venmo },
  btnSecondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.divider },
  btnSuccess: { backgroundColor: Colors.success },
  btnDisabled: { backgroundColor: Colors.surfaceLight, opacity: 0.7 },
  btnLabel: { fontSize: 14, fontWeight: '600' },

  // Links
  link: { alignSelf: 'center', marginTop: Spacing.sm, paddingVertical: 4 },
  linkText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary, textDecorationLine: 'underline' },

  // Empty
  emptyWrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },

  // Banner
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.statusPaymentSent, ...Shadows.card },
  bannerBody: { flex: 1, marginLeft: Spacing.sm },
  bannerTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  bannerSub: { fontSize: 12, color: Colors.textSecondary },

  // Activity (inline in summary card)
  activityDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  activityHeaderInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  activityTitleInline: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, flex: 1 },
  activityRowInline: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: Spacing.sm },
  activityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.divider, marginTop: 6 },
  activityBody: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  activityTime: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  showMore: { paddingVertical: 6, alignItems: 'center' },
  showMoreText: { fontSize: 12, fontWeight: '500', color: Colors.accent },
});

export default SettlementInterface;
