
export const calculateSettlement = (expense) => {
  const { participants, items, fees } = expense;
  if (!participants || !items) {
    return { settlements: [], totalSettlements: 0 };
  }
  const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const feesTotal = (fees || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
  const total = itemsTotal + feesTotal;

  const balances = calculateParticipantBalances(expense, participants, items, fees, total);
  const settlements = generateSettlementProposal(balances);
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
        if (payerIndex < balances.length) {
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
        balances[consumerIndex].owed += roundedSplitAmount;
        balances[consumerIndex].balance += roundedSplitAmount; // Positive because they owe
      } else {
        const itemAmount = parseFloat(item.amount) || 0;
        const amountPerConsumer = Math.round((itemAmount / itemConsumers.length) * 100) / 100;
        balances[consumerIndex].owed += amountPerConsumer;
        balances[consumerIndex].balance += amountPerConsumer;
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
        if (payerIndex < balances.length) {
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
      if (participantIndex !== undefined && participantIndex < balances.length) {
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

  // Combine preserved transferred settlements with new settlements
  const allSettlements = [
    ...transferredSettlements.map(s => ({
      from: s.debtor || s.from,
      to: s.creditor || s.to,
      amount: s.amount, // Keep original amount - money already transferred
      status: s.status, // Preserve original status
      preserved: true
    })),
    ...newSettlements.map(s => ({
      ...s,
      status: 'noAction',
      preserved: false
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
