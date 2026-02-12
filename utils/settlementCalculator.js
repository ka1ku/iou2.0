/**
 * Settlement Calculator - Clean refactor
 *
 * Single source of truth for settlement logic.
 * Data flow: expense (items + participants) → computeSettlements → mergeSettlements (with Firestore) → display
 *
 * Settlement model:
 * - One settlement per (debtor, creditor) pair with NET amount
 * - associatedItems: ALL items between the pair (bidirectional)
 *   - Positive amount = debtor owes creditor
 *   - Negative amount = creditor owes debtor (offset)
 * - Each item: { id, name, amount, settled?, settledAt? }
 */

const pairKey = (debtor, creditor) => `${debtor}|||${creditor}`;

// ─── Balance calculation (used by balanceCalculator) ───────────────────
export const calculateParticipantBalances = (expense, participants, items, total) => {
  const balances = participants.map((p, i) => ({ name: p.name, index: i, paid: 0, owed: 0, balance: 0 }));

  items.forEach((item) => {
    const itemAmount = parseFloat(item.amount) || 0;
    const payersToUse = (item.selectedPayers?.length ? item.selectedPayers : expense.selectedPayers || [0]);
    if (payersToUse.length > 0) {
      const amt = Math.round((itemAmount / payersToUse.length) * 100) / 100;
      payersToUse.forEach((idx) => {
        if (balances[idx]) {
          balances[idx].paid += amt;
          balances[idx].balance -= amt;
        }
      });
    }
  });

  items.forEach((item) => {
    const consumers = item.selectedConsumers || [];
    const splits = item.splits || [];
    consumers.forEach((idx, si) => {
      let amt = 0;
      if (splits[si] !== undefined && splits[si] !== null) {
        amt = typeof splits[si] === 'object' ? parseFloat(splits[si].amount) || 0 : parseFloat(splits[si]) || 0;
      } else {
        amt = consumers.length > 0 ? (parseFloat(item.amount) || 0) / consumers.length : 0;
      }
      amt = Math.round(amt * 100) / 100;
      if (balances[idx]) {
        balances[idx].owed += amt;
        balances[idx].balance += amt;
      }
    });
  });

  return balances.map((b) => ({
    ...b,
    paid: Math.round(b.paid * 100) / 100,
    owed: Math.round(b.owed * 100) / 100,
    balance: Math.round(b.balance * 100) / 100,
  }));
};

// ─── Item association helpers ───────────────────────────────────────────
const buildAssocMap = (expense, participants, items) => {
  const map = new Map();
  participants.forEach((p) => map.set(p.name, { paidFor: new Set(), consumed: new Set() }));

  items.forEach((item) => {
    if (!item.id) return;
    const payers = item.selectedPayers?.length ? item.selectedPayers : expense.selectedPayers || [0];
    payers.forEach((idx) => {
      const name = participants[idx]?.name;
      if (name && map.has(name)) map.get(name).paidFor.add(item.id);
    });
    (item.selectedConsumers || []).forEach((idx) => {
      const name = participants[idx]?.name;
      if (name && map.has(name)) map.get(name).consumed.add(item.id);
    });
  });
  return map;
};

const getItemAmount = (item, payerIdx, consumerIdx, participants, expense) => {
  const consumers = item.selectedConsumers || [];
  const ci = consumers.indexOf(consumerIdx);
  if (ci === -1) return 0;

  let consumerOwes = 0;
  const splits = item.splits || [];
  if (splits[ci] !== undefined && splits[ci] !== null) {
    consumerOwes = typeof splits[ci] === 'object' ? parseFloat(splits[ci].amount) || 0 : parseFloat(splits[ci]) || 0;
  } else {
    consumerOwes = consumers.length > 0 ? (parseFloat(item.amount) || 0) / consumers.length : 0;
  }

  const payersToUse = item.selectedPayers?.length ? item.selectedPayers : expense.selectedPayers || [0];
  if (!payersToUse.includes(payerIdx)) return 0;
  return Math.round((consumerOwes / payersToUse.length) * 100) / 100;
};

/** Get all items for debtor→creditor: positive = debtor owes, negative = creditor owes */
const getAssociatedItemsBidirectional = (debtorName, creditorName, assocMap, items, participants, expense) => {
  const result = [];
  const debtorIdx = participants.findIndex((p) => p.name === debtorName);
  const creditorIdx = participants.findIndex((p) => p.name === creditorName);
  if (debtorIdx === -1 || creditorIdx === -1) return result;

  const creditorPaid = assocMap.get(creditorName)?.paidFor;
  const debtorConsumed = assocMap.get(debtorName)?.consumed;
  if (creditorPaid && debtorConsumed) {
    items.forEach((item) => {
      if (!item.id || !creditorPaid.has(item.id) || !debtorConsumed.has(item.id)) return;
      const amt = getItemAmount(item, creditorIdx, debtorIdx, participants, expense);
      if (amt > 0) result.push({ id: item.id, name: item.name || 'Item', amount: amt, isExtraFee: item.isExtraFee || false });
    });
  }

  const debtorPaid = assocMap.get(debtorName)?.paidFor;
  const creditorConsumed = assocMap.get(creditorName)?.consumed;
  if (debtorPaid && creditorConsumed) {
    items.forEach((item) => {
      if (!item.id || !debtorPaid.has(item.id) || !creditorConsumed.has(item.id)) return;
      const amt = getItemAmount(item, debtorIdx, creditorIdx, participants, expense);
      if (amt > 0) result.push({ id: item.id, name: item.name || 'Item', amount: -amt, isOffset: true });
    });
  }

  return result;
};

// ─── Net settlement generation ──────────────────────────────────────────
const generateNetSettlements = (balances) => {
  const copy = balances.map((b) => ({ ...b }));
  const debtors = copy.filter((b) => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
  const creditors = copy.filter((b) => b.balance < -0.01).sort((a, b) => a.balance - b.balance);

  const out = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di];
    const c = creditors[ci];
    const amt = Math.min(d.balance, Math.abs(c.balance));
    if (amt > 0.01) {
      out.push({ from: d.name, to: c.name, amount: Math.round(amt * 100) / 100 });
    }
    d.balance -= amt;
    c.balance += amt;
    if (Math.abs(d.balance) < 0.01) di++;
    if (Math.abs(c.balance) < 0.01) ci++;
  }
  return out;
};

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Compute settlements from expense data only.
 * Returns one settlement per (debtor, creditor) pair with net amount and all associated items (bidirectional).
 */
export const computeSettlements = (expense) => {
  const { participants, items } = expense;
  if (!participants?.length || !items?.length) return { settlements: [] };

  const total = items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const balances = calculateParticipantBalances(expense, participants, items, total);
  const raw = generateNetSettlements(balances);
  const assocMap = buildAssocMap(expense, participants, items);

  const settlements = raw.map((s) => {
    const associatedItems = getAssociatedItemsBidirectional(s.from, s.to, assocMap, items, participants, expense);
    return {
      debtor: s.from,
      creditor: s.to,
      from: s.from,
      to: s.to,
      amount: s.amount,
      status: 'noAction',
      associatedItems,
      settledAmount: 0,
      remainingAmount: s.amount,
    };
  });

  return { settlements, balances };
};

/**
 * Merge computed settlements with Firestore settled state.
 * Uses computed items as source of truth; Firestore only provides settled/settledAt per item.
 * When direction flips (e.g. A→B becomes B→A), looks up reverse pair for settled state.
 */
export const mergeSettlements = (computedSettlements, firestoreSettlements, participants) => {
  const firestoreByPair = new Map();
  (firestoreSettlements || []).forEach((s) => {
    const key = pairKey(s.debtor || s.from, s.creditor || s.to);
    firestoreByPair.set(key, s);
  });

  const PAYMENT_STATUSES = ['markedAsPaid', 'confirmed', 'complete', 'reminderSent'];

  return computedSettlements.map((computed) => {
    const debtor = computed.debtor || computed.from;
    const creditor = computed.creditor || computed.to;
    const key = pairKey(debtor, creditor);
    // Match direct pair (A,B) or reverse pair (B,A) when direction flipped
    let fs = firestoreByPair.get(key) || firestoreByPair.get(pairKey(creditor, debtor));

    const fsItemMap = new Map();
    (fs?.associatedItems || []).forEach((i) => fsItemMap.set(i.id, i));

    const mergedItems = (computed.associatedItems || []).map((item) => {
      const fi = fsItemMap.get(item.id);
      return {
        ...item,
        settled: fi?.settled === true,
        settledAt: fi?.settled ? fi.settledAt || null : null,
      };
    });

    const settledAmount = mergedItems.filter((i) => i.settled).reduce((sum, i) => sum + i.amount, 0);
    const totalAmount = mergedItems.reduce((sum, i) => sum + i.amount, 0);
    const allSettled = totalAmount !== 0 && Math.abs(settledAmount - totalAmount) < 0.01;

    let status = 'noAction';
    if (allSettled && PAYMENT_STATUSES.includes(fs?.status)) {
      status = fs.status;
    } else if (Math.abs(settledAmount) > 0.01) {
      status = Math.abs(settledAmount - totalAmount) < 0.01 ? 'complete' : 'partial';
    }

    const debtorP = participants.find((p) => (p.name || '').trim() === (debtor || '').trim());
    const creditorP = participants.find((p) => (p.name || '').trim() === (creditor || '').trim());
    // When fs is reverse pair (B,A), its debtor/creditor map to our creditor/debtor
    const isReversePair = fs && pairKey(fs.debtor || fs.from, fs.creditor || fs.to) === pairKey(creditor, debtor);

    return {
      ...computed,
      associatedItems: mergedItems,
      status,
      settledAmount: Math.round(settledAmount * 100) / 100,
      remainingAmount: Math.round((totalAmount - settledAmount) * 100) / 100,
      debtorUserId: debtorP?.userId || (isReversePair ? fs?.creditorUserId : fs?.debtorUserId),
      creditorUserId: creditorP?.userId || (isReversePair ? fs?.debtorUserId : fs?.creditorUserId),
    };
  });
};

/**
 * Migrate old settlements that lack item-level settled flags.
 */
export const migrateOldSettlement = (settlement) => {
  const items = settlement.associatedItems || [];
  const needsMigration = items.some((i) => i.settled === undefined);
  if (!needsMigration) return settlement;

  const isFullySettled = ['markedAsPaid', 'confirmed'].includes(settlement.status);
  return {
    ...settlement,
    associatedItems: items.map((i) => ({
      ...i,
      settled: isFullySettled,
      settledAt: isFullySettled ? settlement.updatedAt : null,
    })),
    settledAmount: isFullySettled ? settlement.amount : 0,
    remainingAmount: isFullySettled ? 0 : settlement.amount,
  };
};

/**
 * Add persistent settlements: Firestore settlements with settled items that the greedy
 * algorithm dropped (e.g. A owed B, settled; new expense nets B to A so (A,B) disappears).
 * These must persist so users don't lose their settlement history.
 */
const addPersistentSettlements = (mergedSettlements, firestoreSettlements, expense, participants) => {
  const mergedKeys = new Set(
    mergedSettlements.map((s) => pairKey(s.debtor || s.from, s.creditor || s.to))
  );

  const PAYMENT_STATUSES = ['markedAsPaid', 'confirmed', 'complete', 'reminderSent'];
  const hasSettledItems = (s) => {
    const settled = (s.associatedItems || []).filter((i) => i.settled === true).length;
    const settledAmt = (s.settledAmount || 0);
    return settled > 0 || settledAmt > 0.01 || PAYMENT_STATUSES.includes(s.status);
  };

  const assocMap = buildAssocMap(expense, participants, expense.items || []);
  const items = expense.items || [];

  const persistent = [];
  (firestoreSettlements || []).forEach((fs) => {
    const debtor = fs.debtor || fs.from;
    const creditor = fs.creditor || fs.to;
    const key = pairKey(debtor, creditor);
    const reverseKey = pairKey(creditor, debtor);
    if (mergedKeys.has(key) || mergedKeys.has(reverseKey)) return;

    if (!hasSettledItems(fs)) return;

    const associatedItems = getAssociatedItemsBidirectional(
      debtor, creditor, assocMap, items, participants, expense
    );
    if (associatedItems.length === 0) return;

    const fsItemMap = new Map((fs.associatedItems || []).map((i) => [i.id, i]));
    const mergedItems = associatedItems.map((item) => {
      const fi = fsItemMap.get(item.id);
      return {
        ...item,
        settled: fi?.settled === true,
        settledAt: fi?.settled ? fi.settledAt || null : null,
      };
    });

    const settledAmount = mergedItems.filter((i) => i.settled).reduce((sum, i) => sum + i.amount, 0);
    const totalAmount = mergedItems.reduce((sum, i) => sum + i.amount, 0);

    const debtorP = participants.find((p) => (p.name || '').trim() === (debtor || '').trim());
    const creditorP = participants.find((p) => (p.name || '').trim() === (creditor || '').trim());

    persistent.push({
      debtor,
      creditor,
      from: debtor,
      to: creditor,
      amount: Math.round(totalAmount * 100) / 100,
      status: fs.status || (Math.abs(settledAmount) > 0.01 ? 'partial' : 'noAction'),
      associatedItems: mergedItems,
      settledAmount: Math.round(settledAmount * 100) / 100,
      remainingAmount: Math.round((totalAmount - settledAmount) * 100) / 100,
      debtorUserId: debtorP?.userId || fs.debtorUserId,
      creditorUserId: creditorP?.userId || fs.creditorUserId,
    });
  });

  return [...mergedSettlements, ...persistent];
};

/**
 * Recompute settlements when expense items/participants change, preserving Firestore settled state.
 * Used by expenseService when saving.
 * Persists old settlements that have settled items even when the greedy algorithm drops them.
 */
export const recomputeSettlementsForSave = (expense, existingSettlements = []) => {
  const { settlements } = computeSettlements(expense);
  const migrated = (existingSettlements || []).map(migrateOldSettlement);
  const merged = mergeSettlements(settlements, migrated, expense.participants || []);
  return addPersistentSettlements(
    merged,
    migrated,
    expense,
    expense.participants || []
  );
};

// Legacy exports for backward compatibility
export const calculateSettlement = (expense) => {
  const { settlements } = computeSettlements(expense);
  return {
    settlements,
    totalSettlements: settlements.length,
    totalAmount: settlements.reduce((sum, s) => sum + s.amount, 0),
  };
};

export const getSettlementSummary = (settlements) => {
  const totalAmount = (settlements || []).reduce((sum, s) => sum + s.amount, 0);
  const fromSet = new Set((settlements || []).map((s) => s.debtor || s.from));
  const toSet = new Set((settlements || []).map((s) => s.creditor || s.to));
  return {
    totalTransactions: (settlements || []).length,
    totalAmount,
    uniquePayers: fromSet.size,
    uniqueReceivers: toSet.size,
    uniquePeople: new Set([...fromSet, ...toSet]).size,
    averageTransaction: (settlements || []).length > 0 ? totalAmount / settlements.length : 0,
  };
};
