/**
 * Build a map of participant name → { paidFor: Set<itemId>, consumed: Set<itemId> }
 * This tracks which items each participant paid for and consumed.
 */
export const buildItemAssociationMap = (expense, participants, items, fees = []) => {
  const map = new Map(); // name → { paidFor: Set, consumed: Set }
  participants.forEach(p => map.set(p.name, { paidFor: new Set(), consumed: new Set() }));

  items.forEach(item => {
    if (!item.id) return;
    const payers = (item.selectedPayers && item.selectedPayers.length > 0)
      ? item.selectedPayers
      : (expense.selectedPayers || [0]);
    payers.forEach(idx => {
      const name = participants[idx]?.name;
      if (name && map.has(name)) map.get(name).paidFor.add(item.id);
    });

    (item.selectedConsumers || []).forEach(idx => {
      const name = participants[idx]?.name;
      if (name && map.has(name)) map.get(name).consumed.add(item.id);
    });
  });

  fees.forEach(fee => {
    if (!fee.id) return;
    const payers = expense.selectedPayers || [0];
    payers.forEach(idx => {
      const name = participants[idx]?.name;
      if (name && map.has(name)) map.get(name).paidFor.add(fee.id);
    });

    (fee.splits || []).forEach(split => {
        const name = participants[split.participantIndex]?.name;
        if (name && map.has(name)) map.get(name).consumed.add(fee.id);
    });
  });

  return map;
};

/**
 * Given a settlement (from→to) and the association map + items array,
 * return the associated items: items the creditor paid for that the debtor consumed.
 * The amount field will be the debtor's split (how much they owe), not the full item price.
 */
const getAssociatedItems = (fromName, toName, assocMap, items, fees = [], participants) => {
  const creditorPaid = assocMap.get(toName)?.paidFor;
  const debtorConsumed = assocMap.get(fromName)?.consumed;
  if (!creditorPaid || !debtorConsumed) return [];

  // Find debtor's index
  const debtorIndex = participants.findIndex(p => p.name === fromName);
  if (debtorIndex === -1) return [];

  const result = [];
  items.forEach(item => {
    if (!item.id) return;
    if (creditorPaid.has(item.id) && debtorConsumed.has(item.id)) {
      // Calculate how much the debtor owes for this item (their split)
      const consumers = item.selectedConsumers || [];
      const consumerIndex = consumers.indexOf(debtorIndex);

      let debtorOwes = 0;
      if (consumerIndex !== -1) {
        const splits = item.splits || [];
        if (splits[consumerIndex] !== undefined && splits[consumerIndex] !== null) {
          // Custom split amount
          const splitAmount = typeof splits[consumerIndex] === 'object'
            ? parseFloat(splits[consumerIndex].amount) || 0
            : parseFloat(splits[consumerIndex]) || 0;
          debtorOwes = Math.round(splitAmount * 100) / 100;
        } else {
          // Equal split among consumers
          const itemAmount = parseFloat(item.amount) || 0;
          debtorOwes = Math.round((itemAmount / consumers.length) * 100) / 100;
        }
      }

      result.push({
        id: item.id,
        name: item.name || 'Item',
        amount: debtorOwes  // Debtor's split, not full item price
      });
    }
  });

  fees.forEach(fee => {
      if (!fee.id) return;
      if (creditorPaid.has(fee.id) && debtorConsumed.has(fee.id)) {
          const split = (fee.splits || []).find(s => s.participantIndex === debtorIndex);
          if (split) {
              result.push({
                  id: fee.id,
                  name: fee.name || 'Fee',
                  amount: parseFloat(split.amount) || 0
              });
          }
      }
  });

  return result;
};

export const calculateSettlement = (expense) => {
  const { participants, items, fees } = expense;
  if (!participants || !items) {
    return { settlements: [], totalSettlements: 0 };
  }
  const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const feesTotal = (fees || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
  const total = itemsTotal + feesTotal;

  const balances = calculateParticipantBalances(expense, participants, items, fees, total);
  const assocMap = buildItemAssociationMap(expense, participants, items, fees);
  const rawSettlements = generateSettlementProposal(balances);
  const settlements = rawSettlements.map(s => ({
    ...s,
    associatedItems: getAssociatedItems(s.from, s.to, assocMap, items, fees, participants),
  }));
  return {
    settlements,
    balances,
    totalSettlements: settlements.length,
    totalAmount: settlements.reduce((sum, s) => sum + s.amount, 0)
  };
};

export const calculateParticipantBalances = (expense, participants, items, fees, total) => {
  const balances = participants.map((participant, index) => ({
    name: participant.name,
    index,
    paid: 0,
    owed: 0,
    balance: 0
  }));
  
  
  items.forEach((item, itemIndex) => {
    const itemAmount = parseFloat(item.amount) || 0;
    const itemPayers = item.selectedPayers || [];
    
    
    const payersToUse = itemPayers.length > 0 ? itemPayers : (expense.selectedPayers || [0]);
    
    
      if (payersToUse.length > 0) {
        const amountPerPayer = Math.round((itemAmount / payersToUse.length) * 100) / 100;
        payersToUse.forEach(payerIndex => {
          if (payerIndex < balances.length && balances[payerIndex]) {
            balances[payerIndex].paid += amountPerPayer;
            balances[payerIndex].balance -= amountPerPayer; // Negative because they paid
          }
        });
      }
  });
  
  
  items.forEach((item, itemIndex) => {
    const itemConsumers = item.selectedConsumers || [];
    const itemSplits = item.splits || [];


    itemConsumers.forEach((consumerIndex, splitIndex) => {
      if (itemSplits[splitIndex] !== undefined && itemSplits[splitIndex] !== null) {
        const splitAmount = typeof itemSplits[splitIndex] === 'object'
          ? parseFloat(itemSplits[splitIndex].amount) || 0
          : parseFloat(itemSplits[splitIndex]) || 0;
        const roundedSplitAmount = Math.round(splitAmount * 100) / 100;
        if (balances[consumerIndex]) {
          balances[consumerIndex].owed += roundedSplitAmount;
          balances[consumerIndex].balance += roundedSplitAmount; // Positive because they owe
        }
      } else {
        const itemAmount = parseFloat(item.amount) || 0;
        // Guard against division by zero
        if (itemConsumers.length > 0) {
          const amountPerConsumer = Math.round((itemAmount / itemConsumers.length) * 100) / 100;
          if (balances[consumerIndex]) {
            balances[consumerIndex].owed += amountPerConsumer;
            balances[consumerIndex].balance += amountPerConsumer;
          }
        }
      }
    });
  });

  (fees || []).forEach(fee => {
    const feeSplits = fee.splits || [];
    const totalFeeAmount = parseFloat(fee.amount) || 0;
    
    const feePayers = expense.selectedPayers || [0];
    if (feePayers.length > 0) {
      const amountPerPayer = Math.round((totalFeeAmount / feePayers.length) * 100) / 100;
      feePayers.forEach(payerIndex => {
        if (payerIndex < balances.length && balances[payerIndex]) {
          balances[payerIndex].paid += amountPerPayer;
          balances[payerIndex].balance -= amountPerPayer; // Negative because they paid
        }
      });
    }
    
    // Then, add the fee amounts to participants who owe them
    feeSplits.forEach(split => {
      const participantIndex = split.participantIndex;
      const splitAmount = parseFloat(split.amount) || 0;
      const roundedSplitAmount = Math.round(splitAmount * 100) / 100;
      if (participantIndex !== undefined && participantIndex < balances.length && balances[participantIndex]) {
        balances[participantIndex].owed += roundedSplitAmount;
        balances[participantIndex].balance += roundedSplitAmount; // Positive because they owe
      }
    });
  });

  const roundedBalances = balances.map(balance => ({
    ...balance,
    paid: Math.round(balance.paid * 100) / 100,
    owed: Math.round(balance.owed * 100) / 100,
    balance: Math.round(balance.balance * 100) / 100
  }));
  
  
  const payers = expense.selectedPayers || [0];
  
  return roundedBalances;
};

const generateSettlementProposal = (balances) => {
  const balancesCopy = balances.map(b => ({ ...b }));
  
  const debtors = balancesCopy.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
  const creditors = balancesCopy.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
  
  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    
    const settlementAmount = Math.min(debtor.balance, Math.abs(creditor.balance));
    
    if (settlementAmount > 0.01) {
      settlements.push({
        from: debtor.name,
        fromIndex: debtor.index,
        to: creditor.name,
        toIndex: creditor.index,
        amount: Math.round(settlementAmount * 100) / 100
      });
    }
    
    debtor.balance -= settlementAmount;
    creditor.balance += settlementAmount;
    
    if (Math.abs(debtor.balance) < 0.01) {
      debtorIndex++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      creditorIndex++;
    }
  }

  return settlements;
};


export const calculateSettlementWithPartialSettlements = (expense, existingSettlements = []) => {
  const { participants, items, fees } = expense;
  if (!participants || !items) {
    return { settlements: [], totalSettlements: 0, transferredSettlements: 0, newSettlements: 0 };
  }

  // Preserve ALL settlements where money has been transferred (status !== 'noAction')
  // This includes: markedAsPaid, paymentMade, paymentRequested
  // Only settlements with status === 'noAction' represent money that hasn't been transferred yet
  const transferredSettlements = existingSettlements.filter(s => {
    const status = s.status || 'noAction';
    return status !== 'noAction';
  });
  const untransferredSettlements = existingSettlements.filter(s => {
    const status = s.status || 'noAction';
    return status === 'noAction';
  });

  const currentBalances = calculateParticipantBalances(expense, participants, items, fees, 
    items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) + 
    (fees || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0)
  );

  // Adjust balances to account for all transferred settlements
  // These settlements represent money that has already been transferred, so we need to
  // factor them into the balance calculations
  const adjustedBalances = [...currentBalances];
  transferredSettlements.forEach(settlement => {
    const debtor = settlement.debtor || settlement.from;
    const creditor = settlement.creditor || settlement.to;
    
    const debtorIndex = adjustedBalances.findIndex(b => b.name === debtor);
    const creditorIndex = adjustedBalances.findIndex(b => b.name === creditor);
    
    if (debtorIndex !== -1 && creditorIndex !== -1) {
        adjustedBalances[debtorIndex].balance -= settlement.amount;
        adjustedBalances[creditorIndex].balance += settlement.amount;
    }
  });

  // Generate new settlements based on adjusted balances
  // This will create settlements for the remaining balance after accounting for transferred amounts
  const newSettlements = generateSettlementProposal(adjustedBalances);

  const assocMap = buildItemAssociationMap(expense, participants, items, fees);

  // Combine preserved transferred settlements with new settlements
  const allSettlements = [
    ...transferredSettlements.map(s => ({
      from: s.debtor || s.from,
      to: s.creditor || s.to,
      amount: s.amount, // Keep original amount - money already transferred
      status: s.status, // Preserve original status
      preserved: true,
      associatedItems: s.associatedItems || getAssociatedItems(s.debtor || s.from, s.creditor || s.to, assocMap, items, fees, participants),
    })),
    ...newSettlements.map(s => ({
      ...s,
      status: 'noAction',
      preserved: false,
      associatedItems: getAssociatedItems(s.from, s.to, assocMap, items, fees, participants),
    }))
  ];

  return {
    settlements: allSettlements,
    balances: currentBalances,
    totalSettlements: allSettlements.length,
    totalAmount: allSettlements.reduce((sum, s) => sum + s.amount, 0),
    transferredSettlements: transferredSettlements.length,
    newSettlements: newSettlements.length
  };
};

/**
 * Migrate old settlements that don't have item-level settled flags.
 * Old statuses: markedAsPaid/confirmed = all items settled
 */
export const migrateOldSettlement = (settlement) => {
  const needsMigration = settlement.associatedItems?.some(item =>
    item.settled === undefined
  );

  if (!needsMigration) return settlement;

  // Old statuses: markedAsPaid/confirmed = all items settled
  const isFullySettled = ['markedAsPaid', 'confirmed'].includes(settlement.status);

  return {
    ...settlement,
    associatedItems: settlement.associatedItems.map(item => ({
      ...item,
      settled: isFullySettled,
      settledAt: isFullySettled ? settlement.updatedAt : null
    })),
    settledAmount: isFullySettled ? settlement.amount : 0,
    remainingAmount: isFullySettled ? 0 : settlement.amount,
    status: isFullySettled ? 'complete' : 'noAction'
  };
};

/**
 * Calculate settlements while preserving item-level settlement states from existing settlements.
 * This allows partial settlement tracking - users can settle individual items within a settlement.
 */
export const calculateSettlementWithItemStates = (expense, existingSettlements = []) => {
  // 1. Calculate fresh settlements (gets updated associatedItems)
  const freshResult = calculateSettlement(expense);

  // 2. Build map of settled items by pair key (no amount, so item states survive when amounts change)
  const PAYMENT_FLOW_STATUSES = ['markedAsPaid', 'paymentMade', 'paymentRequested', 'reminderSent', 'confirmed'];
  const settledItemsMap = new Map();
  existingSettlements.forEach(s => {
    const pairKey = `${s.debtor || s.from}|||${s.creditor || s.to}`;
    const settledIds = (s.associatedItems || [])
      .filter(item => item.settled === true)
      .map(item => item.id);
    settledItemsMap.set(pairKey, new Set(settledIds));
  });

  // 3. Merge settled state into fresh settlements
  const merged = freshResult.settlements.map(fresh => {
    const pairKey = `${fresh.from}|||${fresh.to}`;
    const settledIds = settledItemsMap.get(pairKey) || new Set();

    const associatedItems = (fresh.associatedItems || []).map(item => ({
      ...item,
      settled: settledIds.has(item.id) ? true : (item.settled || false),
      settledAt: settledIds.has(item.id) ? item.settledAt : null
    }));

    // Calculate amounts
    const settledAmount = associatedItems
      .filter(i => i.settled)
      .reduce((sum, i) => sum + i.amount, 0);
    const totalAmount = associatedItems.reduce((sum, i) => sum + i.amount, 0);

    // Derive status from item flags
    let status = 'noAction';
    if (settledAmount > 0.01) {
      status = Math.abs(settledAmount - totalAmount) < 0.01 ? 'complete' : 'partial';
    }

    // Preserve payment-flow statuses from Firestore (they take priority over item-derived status)
    const existingSettlement = existingSettlements.find(s =>
      `${s.debtor || s.from}|||${s.creditor || s.to}` === pairKey
    );
    if (PAYMENT_FLOW_STATUSES.includes(existingSettlement?.status)) {
      status = existingSettlement.status;
    }

    return {
      ...fresh,
      associatedItems,
      settledAmount: Math.round(settledAmount * 100) / 100,
      remainingAmount: Math.round((totalAmount - settledAmount) * 100) / 100,
      status
    };
  });

  return { ...freshResult, settlements: merged };
};

export const getSettlementSummary = (settlements) => {
  const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
  const uniquePayers = new Set(settlements.map(s => s.from)).size;
  const uniqueReceivers = new Set(settlements.map(s => s.to)).size;
  const uniquePeople = new Set(settlements.map(s => s.from).concat(settlements.map(s => s.to))).size;

  return {
    totalTransactions: settlements.length,
    totalAmount,
    uniquePayers,
    uniqueReceivers,
    uniquePeople,
    averageTransaction: settlements.length > 0 ? totalAmount / settlements.length : 0
  };
};
