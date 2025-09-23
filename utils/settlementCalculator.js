/**
 * Settlement Calculator
 * 
 * This utility calculates optimal settlement proposals for expense splits.
 * It determines who owes whom and proposes the most efficient way to settle up.
 */

/**
 * Calculate settlement proposal for an expense
 * @param {Object} expense - The expense object with participants, items (each with selectedPayers), and fees
 * @returns {Object} Settlement proposal with payers, receivers, and amounts
 */
export const calculateSettlement = (expense) => {
  const { participants, items, fees } = expense;
  if (!participants || !items) {
    return { settlements: [], totalSettlements: 0 };
  }
  // Calculate total by summing items and fees
  const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const feesTotal = (fees || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
  const total = itemsTotal + feesTotal;

  // Calculate net balance for each participant
  const balances = calculateParticipantBalances(expense, participants, items, fees, total);
  console.log('Calculated balances:', balances);
  const settlements = generateSettlementProposal(balances);
  return {
    settlements,
    balances,
    totalSettlements: settlements.length,
    totalAmount: settlements.reduce((sum, s) => sum + s.amount, 0)
  };
};

/**
 * Calculate the net balance for each participant
 * @param {Object} expense - The expense object with selectedPayers
 * @param {Array} participants - Array of participant objects
 * @param {Array} items - Array of item objects with splits and selectedPayers
 * @param {Array} fees - Array of fee objects with splits
 * @param {number} total - Total expense amount
 * @returns {Array} Array of balance objects { name, balance, index }
 */
const calculateParticipantBalances = (expense, participants, items, fees, total) => {
  const balances = participants.map((participant, index) => ({
    name: participant.name,
    index,
    balance: 0 // Positive = owes money, Negative = is owed money
  }));
  
  console.log('=== PROCESSING ITEMS ===');
  console.log('Total items:', items.length);
  
  // Calculate how much each participant paid for each item
  items.forEach((item, itemIndex) => {
    const itemAmount = parseFloat(item.amount) || 0;
    const itemPayers = item.selectedPayers || [];
    
    console.log(`Item ${itemIndex + 1}: "${item.name}" ($${itemAmount})`);
    console.log(`  - Item-specific payers:`, itemPayers);
    console.log(`  - Expense-level payers:`, expense.selectedPayers);
    
    // If no item-specific payers, fall back to expense-level selectedPayers
    const payersToUse = itemPayers.length > 0 ? itemPayers : (expense.selectedPayers || [0]);
    
    console.log(`  - Using payers:`, payersToUse);
    
    if (payersToUse.length > 0) {
      const amountPerPayer = Math.round((itemAmount / payersToUse.length) * 100) / 100;
      console.log(`  - Item "${item.name}" ($${itemAmount}) split among ${payersToUse.length} payer(s): $${amountPerPayer} each`);
      payersToUse.forEach(payerIndex => {
        if (payerIndex < balances.length) {
          balances[payerIndex].balance -= amountPerPayer; // Negative because they paid
          console.log(`  - Payer ${balances[payerIndex].name} paid: $${amountPerPayer}`);
        }
      });
    }
  });
  
  console.log('=== PROCESSING ITEM CONSUMPTION ===');
  
  // Calculate how much each participant owes based on item splits
  items.forEach((item, itemIndex) => {
    const itemConsumers = item.selectedConsumers || [];
    const itemSplits = item.splits || [];
    
    console.log(`Item ${itemIndex + 1}: "${item.name}"`);
    console.log(`  - Consumers:`, itemConsumers);
    console.log(`  - Splits:`, itemSplits);
    
    itemConsumers.forEach((consumerIndex, splitIndex) => {
      if (itemSplits[splitIndex] !== undefined && itemSplits[splitIndex] !== null) {
        // Handle both array of numbers and array of objects with amount property
        const splitAmount = typeof itemSplits[splitIndex] === 'object' 
          ? parseFloat(itemSplits[splitIndex].amount) || 0
          : parseFloat(itemSplits[splitIndex]) || 0;
        const roundedSplitAmount = Math.round(splitAmount * 100) / 100;
        balances[consumerIndex].balance += roundedSplitAmount; // Positive because they owe
        console.log(`  - Consumer ${consumerIndex} (${balances[consumerIndex].name}) owes: $${roundedSplitAmount}`);
      } else {
        console.log(`  - Consumer ${consumerIndex} (${balances[consumerIndex].name}) - no split amount, dividing evenly`);
        // If no specific split, divide evenly among consumers
        const itemAmount = parseFloat(item.amount) || 0;
        const amountPerConsumer = Math.round((itemAmount / itemConsumers.length) * 100) / 100;
        balances[consumerIndex].balance += amountPerConsumer;
        console.log(`  - Consumer ${consumerIndex} (${balances[consumerIndex].name}) owes: $${amountPerConsumer} (even split)`);
      }
    });
  });

  // Calculate how much each participant owes based on fee splits
  (fees || []).forEach(fee => {
    const feeSplits = fee.splits || [];
    const totalFeeAmount = parseFloat(fee.amount) || 0;
    console.log(`Processing fee "${fee.name}" ($${totalFeeAmount}) with splits:`, feeSplits);
    
    // First, give credit to the payer(s) who paid for this fee
    const feePayers = expense.selectedPayers || [0];
    if (feePayers.length > 0) {
      const amountPerPayer = Math.round((totalFeeAmount / feePayers.length) * 100) / 100;
      console.log(`  - Fee split among ${feePayers.length} payer(s): $${amountPerPayer} each`);
      feePayers.forEach(payerIndex => {
        if (payerIndex < balances.length) {
          balances[payerIndex].balance -= amountPerPayer; // Negative because they paid
          console.log(`  - Payer ${balances[payerIndex].name} paid: $${amountPerPayer}`);
        }
      });
    }
    
    // Then, add the fee amounts to participants who owe them
    feeSplits.forEach(split => {
      const participantIndex = split.participantIndex;
      const splitAmount = parseFloat(split.amount) || 0;
      const roundedSplitAmount = Math.round(splitAmount * 100) / 100;
      console.log(`  - Participant ${participantIndex} owes: $${roundedSplitAmount}`);
      if (participantIndex !== undefined && participantIndex < balances.length) {
        balances[participantIndex].balance += roundedSplitAmount; // Positive because they owe
        console.log(`  - Updated balance for ${balances[participantIndex].name}: $${balances[participantIndex].balance}`);
      }
    });
  });

  // Round all balances to 2 decimal places to avoid floating point precision issues
  const roundedBalances = balances.map(balance => ({
    ...balance,
    balance: Math.round(balance.balance * 100) / 100
  }));
  
  console.log('Final participant balances (rounded):');
  roundedBalances.forEach((balance, index) => {
    console.log(`  - ${balance.name}: $${balance.balance.toFixed(2)}`);
  });
  
  // Show summary of who paid what
  const payers = expense.selectedPayers || [0];
  console.log('=== PAYMENT SUMMARY ===');
  payers.forEach(payerIndex => {
    if (payerIndex < roundedBalances.length) {
      const payer = roundedBalances[payerIndex];
      const totalPaid = Math.abs(payer.balance); // Convert negative balance to positive amount paid
      console.log(`${payer.name} paid: $${totalPaid.toFixed(2)}`);
    }
  });
  console.log('========================');
  
  return roundedBalances;
};

/**
 * Generate the most efficient settlement proposal
 * Uses a greedy algorithm to minimize the number of transactions
 * @param {Array} balances - Array of participant balances
 * @returns {Array} Array of settlement objects { from, to, amount }
 */
const generateSettlementProposal = (balances) => {
  // Create a deep copy of balances to avoid modifying the original array
  const balancesCopy = balances.map(b => ({ ...b }));
  
  // Separate debtors (positive balance) and creditors (negative balance)
  const debtors = balancesCopy.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
  const creditors = balancesCopy.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
  
  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    
    // Calculate the settlement amount (minimum of what debtor owes and what creditor is owed)
    const settlementAmount = Math.min(debtor.balance, Math.abs(creditor.balance));
    
    if (settlementAmount > 0.01) { // Only create settlements for amounts > 1 cent
      settlements.push({
        from: debtor.name,
        fromIndex: debtor.index,
        to: creditor.name,
        toIndex: creditor.index,
        amount: Math.round(settlementAmount * 100) / 100 // Round to 2 decimal places
      });
    }
    
    // Update balances
    debtor.balance -= settlementAmount;
    creditor.balance += settlementAmount;
    
    // Move to next debtor/creditor if current one is settled
    if (Math.abs(debtor.balance) < 0.01) {
      debtorIndex++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      creditorIndex++;
    }
  }

  return settlements;
};


/**
 * Calculate settlement with partial settlements preserved
 * This function recalculates settlements while preserving any that have been marked as paid
 * @param {Object} expense - The expense object with participants, items, and fees
 * @param {Array} existingSettlements - Array of existing settlement objects with status
 * @returns {Object} Settlement result with preserved and new settlements
 */
export const calculateSettlementWithPartialSettlements = (expense, existingSettlements = []) => {
  const { participants, items, fees } = expense;
  if (!participants || !items) {
    return { settlements: [], totalSettlements: 0, paidSettlements: 0, newSettlements: 0 };
  }

  // Separate paid settlements from unpaid ones
  const paidSettlements = existingSettlements.filter(s => s.status === 'markedAsPaid');
  const unpaidSettlements = existingSettlements.filter(s => s.status !== 'markedAsPaid');

  // Calculate current balances
  const currentBalances = calculateParticipantBalances(expense, participants, items, fees, 
    items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) + 
    (fees || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0)
  );

  // Adjust balances for paid settlements
  const adjustedBalances = [...currentBalances];
  paidSettlements.forEach(settlement => {
    const debtorIndex = adjustedBalances.findIndex(b => b.name === settlement.debtor);
    const creditorIndex = adjustedBalances.findIndex(b => b.name === settlement.creditor);
    
    if (debtorIndex !== -1 && creditorIndex !== -1) {
      // Remove the paid settlement from the balance calculation
      adjustedBalances[debtorIndex].balance -= settlement.amount; // Reduce what debtor owes
      adjustedBalances[creditorIndex].balance += settlement.amount; // Reduce what creditor is owed
    }
  });

  // Generate new settlements based on adjusted balances
  const newSettlements = generateSettlementProposal(adjustedBalances);

  // Combine paid settlements with new settlements
  const allSettlements = [
    ...paidSettlements.map(s => ({
      from: s.debtor,
      to: s.creditor,
      amount: s.amount,
      status: s.status,
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
    paidSettlements: paidSettlements.length,
    newSettlements: newSettlements.length
  };
};

/**
 * Get settlement summary statistics
 * @param {Array} settlements - Array of settlement objects
 * @returns {Object} Summary statistics
 */
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
