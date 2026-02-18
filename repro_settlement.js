
// Mocking the settlement logic from services/expenseService.js and utils/settlementCalculator.js

const pairKey = (debtor, creditor) => `${debtor}|||${creditor}`;

const calculateParticipantBalances = (expense, participants, items, total) => {
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

const computeSettlements = (expense) => {
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

const mergeSettlements = (computedSettlements, firestoreSettlements, participants) => {
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

const migrateOldSettlement = (settlement) => {
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

const recomputeSettlementsForSave = (expense, existingSettlements = []) => {
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

// --- DATA & TESTS ---

const participants = [
    { name: 'Alice', userId: 'userA' },
    { name: 'Bob', userId: 'userB' }
];

// Existing state: Alice owes Bob $10, fully settled
const existingItems = [
    { id: 'item1', name: 'Lunch', amount: 10, selectedPayers: [1], selectedConsumers: [0] } // Bob pays, Alice consumes
];

const existingSettlements = [
    {
        debtor: 'Alice',
        creditor: 'Bob',
        from: 'Alice',
        to: 'Bob',
        amount: 10,
        status: 'complete',
        settledAmount: 10,
        remainingAmount: 0,
        associatedItems: [
            { id: 'item1', name: 'Lunch', amount: 10, settled: true, settledAt: '2023-01-01T00:00:00Z' }
        ]
    }
];

// Scenario 1: Alice adds a new item ($5), Bob pays, Alice consumes.
// Alice debt increases to $15.
const newItems1 = [
    ...existingItems,
    { id: 'item2', name: 'Coffee', amount: 5, selectedPayers: [1], selectedConsumers: [0] }
];

const expense1 = {
    participants,
    items: newItems1,
    selectedPayers: [0]
};

console.log('--- Scenario 1: Add item to increase debt ---');
let result1;
try {
    result1 = recomputeSettlementsForSave(expense1, existingSettlements);
    const settlement1 = result1.find(s => s.debtor === 'Alice' && s.creditor === 'Bob');
    console.log('Settled Amount:', settlement1?.settledAmount);
    console.log('Total Amount:', settlement1?.amount);
} catch (e) {
    console.error(e);
}

// Scenario 2: Alice adds a new item ($20), Alice pays, Bob consumes.
// Net flips: Bob owes Alice $10.
const newItems2 = [
    ...existingItems,
    { id: 'item3', name: 'Dinner', amount: 20, selectedPayers: [0], selectedConsumers: [1] }
];

const expense2 = {
    participants,
    items: newItems2,
    selectedPayers: [0]
};

console.log('\n--- Scenario 2: Add item to reverse debt ---');
let result2;
try {
    result2 = recomputeSettlementsForSave(expense2, existingSettlements);
    const settlement2 = result2[0];
    console.log(`Direction: ${settlement2?.from} -> ${settlement2?.to}`);
    console.log('Settled Amount:', settlement2?.settledAmount);
    console.log('Total Amount:', settlement2?.amount);
} catch (e) {
    console.error(e);
}


console.log('\n--- Testing Fix Logic ---');

const checkLogLogic = (oldS, newS) => {
    const oldStatus = oldS?.status || 'noAction';
    const newStatus = newS.status || 'noAction';

    if (oldStatus !== newStatus) {
        const isSettled = ['markedAsPaid', 'confirmed', 'complete'].includes(newStatus);
        const wasSettled = ['markedAsPaid', 'confirmed', 'complete'].includes(oldStatus);

        if (isSettled && !wasSettled) {
            console.log('Log: settled');
        } else if (!isSettled && wasSettled) {
            // Proposed Fix:
            const oldSettledAmt = Math.abs(oldS.settledAmount || 0);
            const newSettledAmt = Math.abs(newS.settledAmount || 0);

            // Allow small float error
            // If new settlement has LESS settled amount (by > 0.01), then we unsettled.
            // If it has same or more, we didn't un-settle the payment, we just added new debt.
            if (newSettledAmt < oldSettledAmt - 0.01) {
                console.log('Log: unsettled');
            } else {
                console.log('Log: SUPPRESSED (settled amount did not decrease significantly)');
            }
        }
    } else {
        console.log('Log: no status change');
    }
};

console.log('Scenario 1 Check (Add debt):');
checkLogLogic(existingSettlements[0], result1.find(s => s.debtor === 'Alice' && s.creditor === 'Bob'));

console.log('Scenario 2 Check (Reverse debt):');
checkLogLogic(existingSettlements[0], result2[0]);
