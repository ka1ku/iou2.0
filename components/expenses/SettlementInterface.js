import React, { useState, useEffect, useCallback } from 'react';
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

const AVATAR_SIZE = 40;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ─────────────────────────────────────────────────────────────────────────────
   Summary Header
   ───────────────────────────────────────────────────────────────────────── */
const SettlementSummary = ({ settlements, currentUserName }) => {
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

  return (
    <Animated.View entering={FadeInUp.duration(350).springify()} style={styles.summaryCard}>
      {pending === 0 && settlements.length > 0 ? (
        <View style={styles.summaryRow}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
          <Text style={styles.summaryAllSettled}>All settled up!</Text>
        </View>
      ) : (
        <>
          {youOwe > 0 && (
            <View style={styles.summaryRow}>
              <View style={[styles.dot, { backgroundColor: Colors.error }]} />
              <Text style={styles.summaryLabel}>You owe</Text>
              <Text style={[styles.summaryAmount, { color: Colors.error }]}>
                ${youOwe.toFixed(2)}
              </Text>
            </View>
          )}
          {youreOwed > 0 && (
            <View style={styles.summaryRow}>
              <View style={[styles.dot, { backgroundColor: Colors.success }]} />
              <Text style={styles.summaryLabel}>You're owed</Text>
              <Text style={[styles.summaryAmount, { color: Colors.success }]}>
                ${youreOwed.toFixed(2)}
              </Text>
            </View>
          )}
          {youOwe === 0 && youreOwed === 0 && (
            <View style={styles.summaryRow}>
              <Ionicons name="swap-horizontal" size={18} color={Colors.textSecondary} />
              <Text style={styles.summaryLabel}>
                {pending} pending · {settled} settled
              </Text>
            </View>
          )}
        </>
      )}
      <View style={styles.pillRow}>
        <View style={[styles.pill, { backgroundColor: Colors.statusPending + '20' }]}>
          <Text style={[styles.pillText, { color: Colors.statusPending }]}>{pending} pending</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: Colors.success + '20' }]}>
          <Text style={[styles.pillText, { color: Colors.success }]}>{settled} settled</Text>
        </View>
      </View>
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
  paymentMade: { label: 'Payment Sent', color: Colors.statusPaymentSent },
  paymentRequested: { label: 'Request Sent', color: Colors.statusPaymentSent },
  reminderSent: { label: 'Reminded', color: Colors.statusPending },
  noAction: { label: 'Awaiting Payment', color: Colors.statusPending },
};

const StatusPill = ({ status }) => {
  const { label, color } = STATUS_MAP[status] || STATUS_MAP.noAction;
  return (
    <View style={[styles.statusPill, { backgroundColor: color + '15' }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Progress Indicator
   ───────────────────────────────────────────────────────────────────────── */
const ProgressIndicator = ({ settlement }) => {
  if (settlement.status !== 'partial') return null;

  const progress = (settlement.settledAmount / settlement.amount) * 100;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>
        ${settlement.settledAmount.toFixed(2)} of ${settlement.amount.toFixed(2)} settled
      </Text>
    </View>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Price Changed Badge
   ───────────────────────────────────────────────────────────────────────── */
const PriceChangedBadge = ({ changeLog, settlement }) => {
  if (!changeLog?.length) return null;
  const from = settlement.debtor || settlement.from;
  const to = settlement.creditor || settlement.to;

  const change = [...changeLog].reverse().find((e) => {
    if (e.type !== 'priceChange') return false;
    return (e.details?.affectedSettlements || []).some((k) => {
      const [f, t] = k.split('|||');
      return f === from && t === to;
    });
  });
  if (!change) return null;

  return (
    <TouchableOpacity
      style={styles.changedBadge}
      activeOpacity={0.7}
      onPress={() =>
        Alert.alert(
          'Price Changed',
          `Total: $${change.details.previousValue?.toFixed(2)} → $${change.details.newValue?.toFixed(2)}\nBy ${change.userName || 'someone'}`,
        )
      }
    >
      <Ionicons name="alert-circle" size={14} color={Colors.statusChanged} />
      <Text style={styles.changedText}>Price Changed</Text>
    </TouchableOpacity>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Activity Log
   ───────────────────────────────────────────────────────────────────────── */
const ActivityLog = ({ changeLog }) => {
  const [expanded, setExpanded] = useState(false);
  if (!changeLog?.length) return null;

  const sorted = [...changeLog]
    .filter(e => e.type !== 'priceChange') // Hide price change events
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const visible = expanded ? sorted : sorted.slice(0, 3);

  const relative = (ts) => {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const describe = (e) => {
    const n = e.userName || 'Someone';
    switch (e.type) {
      case 'priceChange':
        return `${n} updated the total from $${e.details?.previousValue?.toFixed(2)} to $${e.details?.newValue?.toFixed(2)}`;
      case 'itemAdded':
        if (e.details?.itemAmount != null) {
          return `${n} added ${e.details.itemName} for $${parseFloat(e.details.itemAmount).toFixed(2)}`;
        }
        return `${n} added "${e.details?.itemName}"`;
      case 'itemRemoved':
        if (e.details?.itemAmount != null) {
          return `${n} removed ${e.details.itemName} ($${parseFloat(e.details.itemAmount).toFixed(2)})`;
        }
        return `${n} removed "${e.details?.itemName}"`;
      case 'participantAdded':
        return `${n} added ${e.details?.participantName}`;
      case 'participantRemoved':
        return `${n} removed ${e.details?.participantName}`;
      default:
        return `${n} made a change`;
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(250).duration(300)} style={styles.activityCard}>
      <TouchableOpacity style={styles.activityHeader} onPress={() => setExpanded(!expanded)}>
        <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.activityTitle}>Activity</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
      {visible.map((e, i) => (
        <View key={`${e.timestamp}-${i}`} style={styles.activityRow}>
          <View style={styles.activityDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activityBody} numberOfLines={2}>{describe(e)}</Text>
            <Text style={styles.activityTime}>{relative(e.timestamp)}</Text>
          </View>
        </View>
      ))}
      {!expanded && sorted.length > 3 && (
        <TouchableOpacity style={styles.showMore} onPress={() => setExpanded(true)}>
          <Text style={styles.showMoreText}>Show {sorted.length - 3} more...</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Associated Items List
   ───────────────────────────────────────────────────────────────────────── */
const AssociatedItemsList = ({ items, settlement, onToggleItem, readOnly }) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.assocContainer}>
      <Text style={styles.assocTitle}>
        Items {!readOnly && '(tap to settle)'}
      </Text>
      {items.map((item, i) => (
        <TouchableOpacity
          key={item.id || i}
          style={styles.assocRow}
          onPress={() => !readOnly && onToggleItem && onToggleItem(settlement, item)}
          disabled={readOnly || !onToggleItem}
          activeOpacity={0.7}
        >
          <Ionicons
            name={item.settled ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={item.settled ? Colors.success : Colors.textSecondary}
            style={{ marginRight: 8 }}
          />
          <Text style={[
            styles.assocName,
            item.settled && styles.assocNameSettled
          ]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[
            styles.assocAmount,
            item.settled && styles.assocAmountSettled
          ]}>
            ${item.amount.toFixed(2)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Settlement Card
   ───────────────────────────────────────────────────────────────────────── */
const SettlementCard = ({ settlement, index, participants, currentUserId, currentUserName, onAction, onToggleItem, changeLog, readOnly }) => {
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
    try { await onAction(type, settlement); }
    finally { setBusy(false); }
  };

  // Accent color for left strip
  let accent = Colors.statusPending;
  if (isSettled) accent = Colors.statusSettled;
  else if (status === 'paymentMade' || status === 'paymentRequested') accent = Colors.statusPaymentSent;

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
  const actionBtn = () => {
    if (readOnly) return null;

    const remaining = settlement.remainingAmount || settlement.amount;

    if (status === 'complete') {
      return btn('All Settled', 'checkmark-circle', 'disabled');
    }

    if (isDebtor) {
      if (status === 'paymentMade')
        return btn('Undo Payment', 'arrow-undo', 'secondary', () => fire('undoPaymentMade'));
      if (status === 'partial')
        return btn(`Pay Remaining $${remaining.toFixed(2)}`, 'logo-venmo', 'venmo', () => fire('makePayment'));
      return btn('Pay Now', 'logo-venmo', 'venmo', () => fire('makePayment'));
    }
    if (isCreditor) {
      if (status === 'paymentRequested')
        return btn('Request Sent', 'checkmark', 'disabled');
      if (status === 'paymentMade')
        return btn('Confirm Received', 'checkmark-circle', 'success', () => fire('confirmPaymentReceived'));
      if (status === 'partial')
        return btn(`Request $${remaining.toFixed(2)}`, 'paper-plane', 'primary', () => fire('requestPayment'));
      return btn(`Request $${settlement.amount.toFixed(2)}`, 'paper-plane', 'primary', () => fire('requestPayment'));
    }
    if (isSpectator) {
      if (status === 'reminderSent')
        return btn('Reminder Sent', 'checkmark', 'disabled');
      return btn('Send Reminder', 'notifications-outline', 'secondary', () => fire('sendReminder'));
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
              <PriceChangedBadge changeLog={changeLog} settlement={settlement} />
            </View>

            {/* Progress Indicator */}
            <ProgressIndicator settlement={settlement} />

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
                  You owe {toName?.split(' ')[0]}
                </Text>
              )}
              {isCreditor && (
                <Text style={styles.oweLabelText}>
                  {fromName?.split(' ')[0]} owes you
                </Text>
              )}
              {isSpectator && (
                <Text style={styles.oweLabelText}>
                  {fromName?.split(' ')[0]} owes {toName?.split(' ')[0]}
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
                    (${settlement.amount.toFixed(2)} total)
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
            />

            {/* Actions */}
            {actionBtn()}

            {/* Subtle links */}
            {!readOnly && (status === 'markedAsPaid' || status === 'confirmed') && (
              <TouchableOpacity style={styles.link} onPress={() => fire('undoMarkAsPaid')}>
                <Text style={styles.linkText}>Undo settlement</Text>
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
  changeLog = [],
  readOnly = false,
  recalculationInfo = null,
  onDismissRecalculation,
}) => {
  const current = participants.find((p) => p.userId === currentUserId) || {};
  const name = current.name || '';

  if (!settlements.length && !readOnly) {
    return (
      <Animated.View entering={FadeInUp.duration(400).springify()} style={styles.emptyWrap}>
        <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
        <Text style={styles.emptyTitle}>All Settled Up!</Text>
        <Text style={styles.emptyBody}>Everyone is square. No payments needed.</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.root}>
      {recalculationInfo && (
        <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)} style={styles.banner}>
          <Ionicons name="information-circle" size={20} color={Colors.statusPaymentSent} />
          <View style={styles.bannerBody}>
            <Text style={styles.bannerTitle}>Settlements updated due to changes.</Text>
            <Text style={styles.bannerSub}>
              {recalculationInfo.newSettlements} new, {recalculationInfo.paidSettlements} paid preserved.
            </Text>
          </View>
          {onDismissRecalculation && (
            <TouchableOpacity onPress={onDismissRecalculation} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {settlements.length > 0 && <SettlementSummary settlements={settlements} currentUserName={name} />}

      {settlements.map((s, i) => (
        <SettlementCard
          key={`${s.debtor || s.from}|||${s.creditor || s.to}|||${i}`}
          settlement={s}
          index={i}
          participants={participants}
          currentUserId={currentUserId}
          currentUserName={name}
          onAction={onAction}
          onToggleItem={onToggleItem}
          changeLog={changeLog}
          readOnly={readOnly}
        />
      ))}

      <ActivityLog changeLog={changeLog} />
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
  changedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.statusChanged + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, gap: 4 },
  changedText: { fontSize: 11, fontWeight: '600', color: Colors.statusChanged },

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

  // Progress Indicator
  progressContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border + '40',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.success,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontRegular,
  },

  // Associated Items
  assocContainer: { backgroundColor: Colors.surfaceLight || Colors.background, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.md },
  assocTitle: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  assocRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  assocName: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  assocNameSettled: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  assocAmount: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', marginLeft: Spacing.sm },
  assocAmountSettled: { textDecorationLine: 'line-through', opacity: 0.6 },

  // Buttons
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
  emptyWrap: { alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.lg, ...Shadows.card },
  emptyTitle: { marginTop: Spacing.md, fontSize: 20, fontWeight: '600', color: Colors.success },
  emptyBody: { marginTop: Spacing.xs, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  // Banner
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.statusPaymentSent, ...Shadows.card },
  bannerBody: { flex: 1, marginLeft: Spacing.sm },
  bannerTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  bannerSub: { fontSize: 12, color: Colors.textSecondary },

  // Activity
  activityCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.sm, ...Shadows.card },
  activityHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  activityTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, flex: 1 },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: Spacing.sm },
  activityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.divider, marginTop: 6 },
  activityBody: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  activityTime: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  showMore: { paddingVertical: 6, alignItems: 'center' },
  showMoreText: { fontSize: 12, fontWeight: '500', color: Colors.accent },
});

export default SettlementInterface;
