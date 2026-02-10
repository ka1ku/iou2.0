import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Linking, Platform, AppState, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import {
  updateExpense,
  getExpenseById,
  createPaymentRequest,
} from '../services/expenseService';
import { calculateSettlement, calculateSettlementWithItemStates, migrateOldSettlement } from '../utils/settlementCalculator';

// Build the canonical key for a settlement (with amount - for status overrides)
const makeKey = (settlement) => {
  const from = settlement.debtor || settlement.from;
  const to = settlement.creditor || settlement.to;
  const amt = Math.round(settlement.amount * 100) / 100;
  return `${from}|||${to}|||${amt}`;
};

// Build pair key without amount (for item overrides - survives amount changes)
const makePairKey = (settlement) => {
  const from = settlement.debtor || settlement.from;
  const to = settlement.creditor || settlement.to;
  return `${from}|||${to}`;
};

/**
 * Consolidated hook that owns settlement calculation, interaction state, and item locking.
 *
 * Merges the responsibilities of the former `useSplitLogic` (settlement calculation,
 * recalculation info) and `useSettlementActions` (optimistic status updates, Venmo flows).
 *
 * @param {object}  opts
 * @param {object}  opts.expense           – the Firestore expense document (may be null)
 * @param {Array}   opts.participants      – current participant list
 * @param {Array}   opts.items             – current items list
 * @param {Array}   opts.fees              – current fees list
 * @param {number}  opts.total             – calculated total
 * @param {string}  opts.title             – expense display title
 * @param {string}  opts.currentUserId     – current user's UID
 * @param {Array}   opts.selectedPayers    – indices of who paid
 * @returns {{ settlements, handleAction, lockedItemIds, recalculationInfo, setRecalculationInfo }}
 */
export default function useSettlementActions({
  expense,
  participants = [],
  items = [],
  fees = [],
  total = 0,
  title = '',
  currentUserId,
  selectedPayers,
}) {
  // ─── separate override maps ─────────────────────────────────────────
  const [statusOverrides, setStatusOverrides] = useState({});   // key → status string
  const [itemOverrides, setItemOverrides] = useState({});        // key → { [itemId]: { settled, settledAt } }
  const [venmoReturnKey, setVenmoReturnKey] = useState(null);
  const [venmoReturnItemIds, setVenmoReturnItemIds] = useState(null); // itemIds to settle on Venmo return
  const [venmoActionType, setVenmoActionType] = useState(null); // 'pay' or 'charge'
  const [recalculationInfo, setRecalculationInfo] = useState(null);

  // ─── settlement calculation ───────────────────────────────────────────
  const calculatedSettlements = useMemo(() => {
    try {
      // Build expense data for calculation
      const expenseData = {
        title: title || 'Expense',
        total,
        participants,
        items,
        fees,
        selectedPayers: selectedPayers || [0],
      };

      // Migrate old settlements if needed
      const migratedSettlements = (expense?.settlements || []).map(migrateOldSettlement);

      // Use new calculator that preserves item-level settlement states
      const result = calculateSettlementWithItemStates(expenseData, migratedSettlements);

      // Map to consistent format with both debtor/creditor and from/to fields
      return (result.settlements || []).map(s => ({
        from: s.from,
        to: s.to,
        amount: s.amount,
        status: s.status || 'noAction',
        debtor: s.from,
        creditor: s.to,
        associatedItems: s.associatedItems || [],
        settledAmount: s.settledAmount || 0,
        remainingAmount: s.remainingAmount || s.amount,
      }));
    } catch (error) {
      console.error('[useSettlementActions] Error calculating settlements:', error);
      return [];
    }
  }, [expense?.settlements, title, total, participants, items, fees, selectedPayers]);

  // Seed payment-flow status overrides on expense load (once per expense)
  useEffect(() => {
    if (!expense?.settlements?.length) return;
    const PAYMENT_FLOW_STATUSES = ['markedAsPaid', 'reminderSent', 'confirmed'];
    const initial = {};
    expense.settlements.forEach((s) => {
      const key = makeKey(s);
      const status = s.status || 'noAction';
      if (PAYMENT_FLOW_STATUSES.includes(status)) {
        initial[key] = status;
      }
    });
    setStatusOverrides(initial);
    setItemOverrides({});
  }, [expense?.id]);

  // ─── derived settlements with overrides applied ───────────────────────
  const settlements = useMemo(() => {
    return calculatedSettlements.map((s) => {
      const key = makeKey(s);
      const pairKey = makePairKey(s);
      let result = s;

      // 1. Apply item-level overrides (optimistic item toggles) - use pair key
      const itemOv = itemOverrides[pairKey];
      if (itemOv) {
        const updatedItems = (s.associatedItems || []).map(item => {
          const ov = itemOv[item.id];
          return ov ? { ...item, settled: ov.settled, settledAt: ov.settledAt } : item;
        });
        const settledAmount = updatedItems.filter(i => i.settled).reduce((sum, i) => sum + i.amount, 0);
        const totalAmount = updatedItems.reduce((sum, i) => sum + i.amount, 0);
        let status = 'noAction';
        if (settledAmount > 0.01) {
          status = Math.abs(settledAmount - totalAmount) < 0.01 ? 'complete' : 'partial';
        }
        result = {
          ...s,
          associatedItems: updatedItems,
          status,
          settledAmount: Math.round(settledAmount * 100) / 100,
          remainingAmount: Math.round((totalAmount - settledAmount) * 100) / 100,
        };
      }

      // 2. Apply status overrides (payment flow takes priority)
      const statusOv = statusOverrides[key];
      if (statusOv) result = { ...result, status: statusOv };

      return result;
    });
  }, [calculatedSettlements, statusOverrides, itemOverrides]);

  // ─── locked item IDs ──────────────────────────────────────────────────
  // Items are locked if they have been settled in ANY settlement (item.settled === true)
  const lockedItemIds = useMemo(() => {
    const locked = new Set();
    settlements.forEach(s => {
      (s.associatedItems || []).forEach(item => {
        if (item.id && item.settled === true) {
          locked.add(item.id);
        }
      });
    });
    return locked;
  }, [settlements]);

  // ─── helpers ──────────────────────────────────────────────────────────
  const setStatus = useCallback((settlement, status) => {
    setStatusOverrides((prev) => ({ ...prev, [makeKey(settlement)]: status }));
  }, []);

  const expenseTitle = title || 'Expense';

  const persistStatus = useCallback(
    async (settlement, newStatus) => {
      if (!expense?.id) throw new Error('Expense ID is missing');

      const latest = await getExpenseById(expense.id);
      if (!latest) throw new Error('Expense not found');

      let rows = latest.settlements || [];
      const previousStatus = rows.find(s => makePairKey(s) === makePairKey(settlement))?.status || 'noAction';

      // Bootstrap: if Firestore has no settlements yet, seed from local calc
      if (rows.length === 0 && calculatedSettlements.length > 0) {
        rows = calculatedSettlements.map((s) => ({
          debtor: s.debtor || s.from,
          creditor: s.creditor || s.to,
          amount: s.amount,
          status: s.status || 'noAction',
          updatedAt: new Date().toISOString(),
          associatedItems: s.associatedItems || [],
        }));
      }

      let found = false;
      const pairKey = makePairKey(settlement);

      const updated = rows.map((s) => {
        // Use pairKey (debtor/creditor) to match, ignoring amount changes
        if (makePairKey(s) === pairKey) {
          found = true;
          return {
            ...s,
            status: newStatus,
            updatedAt: new Date().toISOString(),
            // Ensure associatedItems from the local settlement are saved
            associatedItems: settlement.associatedItems || s.associatedItems || [],
            // Update amount to match current proposed amount
            amount: settlement.amount,
          };
        }
        return s;
      });

      if (!found) {
        updated.push({
          debtor: settlement.debtor || settlement.from,
          creditor: settlement.creditor || settlement.to,
          amount: settlement.amount,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          associatedItems: settlement.associatedItems || [],
        });
      }

      // Update items with settled flags (only on manual mark-as-paid, not Venmo payment statuses)
      const MANUAL_SETTLE = ['markedAsPaid', 'confirmed'];
      const isSettling = previousStatus === 'noAction' && MANUAL_SETTLE.includes(newStatus);
      const isUnsettling = MANUAL_SETTLE.includes(previousStatus) && newStatus === 'noAction';

      let updatedItems = latest.items || [];

      if (isSettling || isUnsettling) {
        const associatedItemIds = (settlement.associatedItems || []).map(item => item.id);
        const settlementKey = makeKey(settlement);
        const now = new Date().toISOString();

        updatedItems = updatedItems.map(item => {
          if (associatedItemIds.includes(item.id)) {
            if (isSettling) {
              // Mark item as settled
              return {
                ...item,
                settledAt: now,
                settledBy: settlementKey,
              };
            } else if (isUnsettling) {
              // Remove settled flags
              const { settledAt, settledBy, ...rest } = item;
              return rest;
            }
          }
          return item;
        });
      }

      const uid = getCurrentUser()?.uid;
      await updateExpense(expense.id, {
        settlements: updated,
        items: updatedItems,
      }, uid);
    },
    [expense?.id, calculatedSettlements],
  );

  // Optimistic update + persist, with automatic rollback on failure
  const optimistic = useCallback(
    async (settlement, newStatus, rollbackStatus) => {
      setStatus(settlement, newStatus);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await persistStatus(settlement, newStatus);
      } catch (err) {
        console.error('[useSettlementActions] persist failed:', err);
        setStatus(settlement, rollbackStatus);
        Alert.alert('Error', 'Failed to save status. Please try again.');
      }
    },
    [setStatus, persistStatus],
  );

  // ─── Venmo helpers ────────────────────────────────────────────────────
  const openVenmoOrFallback = useCallback(
    async ({ txn, recipientUsername, amount, note }) => {
      const deeplink = `venmo://paycharge?txn=${txn}&recipients=${recipientUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;
      const supported = await Linking.canOpenURL('venmo://');

      if (supported) {
        await Linking.openURL(deeplink);
        return true;
      }

      // Fallback
      const action = txn === 'charge' ? 'Request' : 'Pay';
      const text = `${action} @${recipientUsername} $${amount} for ${expenseTitle}`;
      Alert.alert('Venmo Not Installed', 'Copy payment details or open the App Store?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy Details',
          onPress: () => {
            Clipboard.setStringAsync(text);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
        {
          text: 'App Store',
          onPress: () =>
            Linking.openURL(
              Platform.OS === 'ios'
                ? 'https://apps.apple.com/app/venmo/id351727428'
                : 'https://play.google.com/store/apps/details?id=com.venmo',
            ),
        },
      ]);
      return false;
    },
    [expenseTitle],
  );

  // ─── AppState listener – Venmo return confirmation ────────────────────
  useEffect(() => {
    if (!venmoReturnKey) return;

    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const key = venmoReturnKey;
      const itemIds = venmoReturnItemIds;
      const actionType = venmoActionType; // Capture current action type

      setVenmoReturnKey(null);
      setVenmoReturnItemIds(null);
      setVenmoActionType(null);

      setTimeout(() => {
        const isCharge = actionType === 'charge';
        const title = isCharge ? 'Request Status' : 'Payment Status';
        const message = isCharge
          ? 'Did you send the request in Venmo?'
          : 'Did you complete the payment in Venmo?';
        const successText = isCharge ? 'Yes, request sent' : 'Yes, mark as paid';

        Alert.alert(title, message, [
          { text: "No, I'll pay later", style: 'cancel' },
          {
            text: successText,
            onPress: async () => {
              const match = settlements.find((s) => makeKey(s) === key);
              if (match) {
                // If we have specific items to settle, bulk settle them
                if (itemIds && itemIds.length > 0) {
                  await handleBulkSettle(match, itemIds);
                } else {
                  // Otherwise just mark the status (legacy behavior)
                  // For requests, we still 'mark as paid' (or confirmed) effectively acting as "pending request sent"
                  // But the status logic uses 'markedAsPaid' or 'reminderSent' usually.
                  // If it's a request, maybe valid status is 'reminderSent'? 
                  // But current logic is 'markedAsPaid'. User just wants the alert to make sense.
                  await optimistic(match, 'markedAsPaid', match.status);
                }
              }
            },
          },
        ]);
      }, 500);
    });

    return () => sub.remove();
  }, [venmoReturnKey, venmoReturnItemIds, venmoActionType, settlements, optimistic, handleBulkSettle]);

  // ─── item-level toggle handler ────────────────────────────────────────
  const persistItemToggle = useCallback(
    async (settlement, itemId, settled) => {
      if (!expense?.id) throw new Error('Expense ID missing');

      const latest = await getExpenseById(expense.id);
      if (!latest) throw new Error('Expense not found');

      let existingSettlements = latest.settlements || [];

      // Bootstrap: if Firestore has no settlements yet, seed from local calc
      if (existingSettlements.length === 0 && calculatedSettlements.length > 0) {
        existingSettlements = calculatedSettlements.map((s) => ({
          debtor: s.debtor || s.from,
          creditor: s.creditor || s.to,
          amount: s.amount,
          status: s.status || 'noAction',
          updatedAt: new Date().toISOString(),
          associatedItems: s.associatedItems || [],
        }));
      }

      const pairKey = makePairKey(settlement);
      let found = false;

      const updated = existingSettlements.map(s => {
        if (makePairKey(s) === pairKey) {
          found = true;
          const updatedItems = (s.associatedItems || []).map(item =>
            item.id === itemId
              ? { ...item, settled, settledAt: settled ? new Date().toISOString() : null }
              : item
          );

          const settledAmount = updatedItems.filter(i => i.settled).reduce((sum, i) => sum + i.amount, 0);
          const totalAmount = updatedItems.reduce((sum, i) => sum + i.amount, 0);

          let status = 'noAction';
          if (settledAmount > 0.01) {
            status = Math.abs(settledAmount - totalAmount) < 0.01 ? 'complete' : 'partial';
          }

          return {
            ...s,
            associatedItems: updatedItems,
            status,
            settledAmount: Math.round(settledAmount * 100) / 100,
            remainingAmount: Math.round((totalAmount - settledAmount) * 100) / 100,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      });

      // If settlement not found (edge case), add it
      if (!found) {
        updated.push({
          debtor: settlement.debtor || settlement.from,
          creditor: settlement.creditor || settlement.to,
          amount: settlement.amount,
          status: settled ? 'partial' : 'noAction',
          updatedAt: new Date().toISOString(),
          associatedItems: (settlement.associatedItems || []).map(item =>
            item.id === itemId
              ? { ...item, settled, settledAt: settled ? new Date().toISOString() : null }
              : item
          ),
          settledAmount: settled ? settlement.associatedItems.find(i => i.id === itemId)?.amount || 0 : 0,
          remainingAmount: settlement.amount - (settled ? settlement.associatedItems.find(i => i.id === itemId)?.amount || 0 : 0),
        });
      }

      const uid = getCurrentUser()?.uid;
      await updateExpense(expense.id, { settlements: updated }, uid);

      // Don't clear itemOverrides here - clearing causes flicker before Firestore listener updates.
      // The override becomes redundant once Firestore data arrives, but harmless.
      // It will be cleared when expense changes (seeding useEffect) or component unmounts.
    },
    [expense?.id, calculatedSettlements]
  );

  const doItemToggle = useCallback(
    async (settlement, item, newSettled) => {
      const pairKey = makePairKey(settlement);

      // Optimistic update - use pair key so overrides survive amount changes
      setItemOverrides(prev => ({
        ...prev,
        [pairKey]: {
          ...(prev[pairKey] || {}),
          [item.id]: { settled: newSettled, settledAt: newSettled ? new Date().toISOString() : null },
        },
      }));

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        await persistItemToggle(settlement, item.id, newSettled);
      } catch (err) {
        console.error('[handleItemToggle] failed:', err);
        // Rollback: remove this item's override
        setItemOverrides(prev => {
          const keyOv = { ...(prev[pairKey] || {}) };
          delete keyOv[item.id];
          return Object.keys(keyOv).length === 0
            ? (({ [pairKey]: _, ...rest }) => rest)(prev)
            : { ...prev, [pairKey]: keyOv };
        });
        Alert.alert('Error', 'Failed to update settlement. Please try again.');
      }
    },
    [persistItemToggle]
  );

  const handleItemToggle = useCallback(
    async (settlement, item) => {
      const newSettled = !item.settled;

      if (item.settled) {
        // Confirm before unsettling
        Alert.alert('Unsettle Item', `Are you sure you want to unsettle "${item.name}"?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unsettle', style: 'destructive', onPress: () => doItemToggle(settlement, item, false) },
        ]);
        return;
      }

      await doItemToggle(settlement, item, newSettled);
    },
    [doItemToggle]
  );

  // ─── bulk settle: settle multiple items at once ────────────────────
  const persistBulkItemToggle = useCallback(
    async (settlement, itemIds, settled) => {
      if (!expense?.id) throw new Error('Expense ID missing');

      const latest = await getExpenseById(expense.id);
      if (!latest) throw new Error('Expense not found');

      let existingSettlements = latest.settlements || [];

      if (existingSettlements.length === 0 && calculatedSettlements.length > 0) {
        existingSettlements = calculatedSettlements.map((s) => ({
          debtor: s.debtor || s.from,
          creditor: s.creditor || s.to,
          amount: s.amount,
          status: s.status || 'noAction',
          updatedAt: new Date().toISOString(),
          associatedItems: s.associatedItems || [],
        }));
      }

      const pairKey = makePairKey(settlement);
      const itemIdSet = new Set(itemIds);
      let found = false;

      const updated = existingSettlements.map(s => {
        if (makePairKey(s) === pairKey) {
          found = true;
          const updatedItems = (s.associatedItems || []).map(item =>
            itemIdSet.has(item.id)
              ? { ...item, settled, settledAt: settled ? new Date().toISOString() : null }
              : item
          );

          const settledAmount = updatedItems.filter(i => i.settled).reduce((sum, i) => sum + i.amount, 0);
          const totalAmount = updatedItems.reduce((sum, i) => sum + i.amount, 0);

          let status = 'noAction';
          if (settledAmount > 0.01) {
            status = Math.abs(settledAmount - totalAmount) < 0.01 ? 'complete' : 'partial';
          }

          return {
            ...s,
            associatedItems: updatedItems,
            status,
            settledAmount: Math.round(settledAmount * 100) / 100,
            remainingAmount: Math.round((totalAmount - settledAmount) * 100) / 100,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });

      if (!found) {
        const updatedItems = (settlement.associatedItems || []).map(item =>
          itemIdSet.has(item.id)
            ? { ...item, settled, settledAt: settled ? new Date().toISOString() : null }
            : item
        );
        const settledAmount = updatedItems.filter(i => i.settled).reduce((sum, i) => sum + i.amount, 0);
        const totalAmount = updatedItems.reduce((sum, i) => sum + i.amount, 0);
        updated.push({
          debtor: settlement.debtor || settlement.from,
          creditor: settlement.creditor || settlement.to,
          amount: settlement.amount,
          status: settledAmount > 0.01 ? (Math.abs(settledAmount - totalAmount) < 0.01 ? 'complete' : 'partial') : 'noAction',
          updatedAt: new Date().toISOString(),
          associatedItems: updatedItems,
          settledAmount: Math.round(settledAmount * 100) / 100,
          remainingAmount: Math.round((totalAmount - settledAmount) * 100) / 100,
        });
      }

      const uid = getCurrentUser()?.uid;
      await updateExpense(expense.id, { settlements: updated }, uid);
    },
    [expense?.id, calculatedSettlements]
  );

  const handleBulkSettle = useCallback(
    async (settlement, itemIds) => {
      if (!itemIds || itemIds.length === 0) return;

      const pairKey = makePairKey(settlement);

      // Optimistic update for all items at once
      setItemOverrides(prev => {
        const existing = prev[pairKey] || {};
        const newOverrides = { ...existing };
        itemIds.forEach(id => {
          newOverrides[id] = { settled: true, settledAt: new Date().toISOString() };
        });
        return { ...prev, [pairKey]: newOverrides };
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        await persistBulkItemToggle(settlement, itemIds, true);
      } catch (err) {
        console.error('[handleBulkSettle] failed:', err);
        // Rollback
        setItemOverrides(prev => {
          const keyOv = { ...(prev[pairKey] || {}) };
          itemIds.forEach(id => delete keyOv[id]);
          return Object.keys(keyOv).length === 0
            ? (({ [pairKey]: _, ...rest }) => rest)(prev)
            : { ...prev, [pairKey]: keyOv };
        });
        Alert.alert('Error', 'Failed to settle items. Please try again.');
      }
    },
    [persistBulkItemToggle]
  );

  const handleBulkAction = useCallback(
    async (type, settlement, selectedItemIds) => {
      if (type === 'markAsSettled') {
        await handleBulkSettle(settlement, selectedItemIds);
        return;
      }

      // For Venmo flows, store selected items to settle on return confirmation
      if (type === 'makePayment' || type === 'requestPayment') {
        setVenmoReturnItemIds(selectedItemIds && selectedItemIds.length > 0 ? selectedItemIds : null);

        // Calculate the amount from selected items
        const selectedAmount = selectedItemIds && selectedItemIds.length > 0
          ? (settlement.associatedItems || [])
            .filter(i => !i.settled && selectedItemIds.includes(i.id))
            .reduce((sum, i) => sum + i.amount, 0)
          : null;

        // Run the action with the selected amount
        await handleAction(type, settlement, selectedAmount);
        return;
      }

      // Run the existing action (which will set venmoReturnKey)
      await handleAction(type, settlement);
    },
    [handleBulkSettle, handleAction]
  );

  // ─── public action dispatcher ─────────────────────────────────────────
  const handleAction = useCallback(
    async (type, settlement, customAmount = null) => {
      const prev = settlement.status || 'noAction';

      switch (type) {
        // ── mark as paid ───────────────────────────────────────────
        case 'markAsPaid':
          await optimistic(settlement, 'markedAsPaid', prev);
          break;

        // ── undo mark as paid ──────────────────────────────────────
        case 'undoMarkAsPaid':
          await optimistic(settlement, 'noAction', prev);
          break;

        // ── pay via Venmo ──────────────────────────────────────────
        case 'makePayment': {
          const recipient = participants.find((p) => p.name === (settlement.creditor || settlement.to));
          if (!recipient?.userId) return Alert.alert('Error', 'Recipient not found');
          const profile = await getUserProfile(recipient.userId);
          if (!profile?.venmoUsername) return Alert.alert('Error', 'Recipient has no Venmo username');

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          // Use custom amount if provided (from selected items), otherwise use remaining or full amount
          const paymentAmount = customAmount !== null
            ? customAmount
            : settlement.status === 'partial'
              ? (settlement.remainingAmount || settlement.amount)
              : settlement.amount;

          const opened = await openVenmoOrFallback({
            txn: 'pay',
            recipientUsername: profile.venmoUsername,
            amount: paymentAmount.toFixed(2),
            note: `IOU Payment - ${expenseTitle}`,
          });
          if (opened) {
            setVenmoReturnKey(makeKey(settlement));
            setVenmoActionType('pay');
          }
          break;
        }

        // ── request payment (charge) ───────────────────────────────
        case 'requestPayment': {
          const payer = participants.find((p) => p.name === (settlement.debtor || settlement.from));
          if (!payer?.userId) return Alert.alert('Error', 'Payer not found');
          const payerProfile = await getUserProfile(payer.userId);
          if (!payerProfile?.venmoUsername) return Alert.alert('Error', 'Payer has no Venmo username');

          const me = getCurrentUser();
          if (!me) return Alert.alert('Error', 'You must be logged in');

          // Use custom amount if provided (from selected items), otherwise use remaining or full amount
          const requestAmount = customAmount !== null
            ? customAmount
            : settlement.status === 'partial'
              ? (settlement.remainingAmount || settlement.amount)
              : settlement.amount;

          // Fire-and-forget payment request doc
          createPaymentRequest({
            fromUserId: me.uid,
            toUserId: payer.userId,
            amount: requestAmount,
            expenseId: expense?.id,
            expenseTitle,
          }).catch(() => { });

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          const chargeOpened = await openVenmoOrFallback({
            txn: 'charge',
            recipientUsername: payerProfile.venmoUsername,
            amount: requestAmount.toFixed(2),
            note: `IOU Payment Request - ${expenseTitle}`,
          });
          if (chargeOpened) {
            setVenmoReturnKey(makeKey(settlement));
            setVenmoActionType('charge');
          }
          break;
        }

        // ── send reminder ──────────────────────────────────────────
        case 'sendReminder': {
          const debtorName = settlement.debtor || settlement.from;
          const creditorName = settlement.creditor || settlement.to;
          const creditorP = participants.find((p) => p.name === creditorName);
          if (!creditorP?.userId) return Alert.alert('Error', 'Participant not found');

          const credProfile = await getUserProfile(creditorP.userId);
          if (!credProfile?.venmoUsername) return Alert.alert('Error', 'No Venmo username');

          const amt = settlement.amount.toFixed(2);
          const venmoLink = `venmo://paycharge?txn=pay&recipients=${credProfile.venmoUsername}&amount=${amt}&note=${encodeURIComponent(`IOU Payment - ${expenseTitle}`)}`;
          const message = `${debtorName} you owe ${creditorName} $${amt} for ${expenseTitle}.\n${venmoLink}`;

          const result = await Share.share({ title: 'Send Reminder', message, url: venmoLink });
          if (result?.action === Share.dismissedAction) return;

          await optimistic(settlement, 'reminderSent', prev);
          break;
        }

        // ── undo reminder ──────────────────────────────────────────
        case 'undoReminderSent':
          await optimistic(settlement, 'noAction', prev);
          break;

        default:
          console.warn('[useSettlementActions] Unknown action:', type);
      }
    },
    [participants, expense, expenseTitle, optimistic, setStatus, persistStatus, openVenmoOrFallback],
  );

  return {
    settlements,
    handleAction,
    handleItemToggle,
    handleBulkSettle,
    handleBulkAction,
    lockedItemIds,
    recalculationInfo,
    setRecalculationInfo
  };
}
