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
  const balances = calculateParticipantBalances(participants, items, fees, total);
  console.log('balances', balances);
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
 * @param {Array} participants - Array of participant objects
 * @param {Array} items - Array of item objects with splits and selectedPayers
 * @param {Array} fees - Array of fee objects with splits
 * @param {number} total - Total expense amount
 * @returns {Array} Array of balance objects { name, balance, index }
 */
const calculateParticipantBalances = (participants, items, fees, total) => {
  const balances = participants.map((participant, index) => ({
    name: participant.name,
    index,
    balance: 0 // Positive = owes money, Negative = is owed money
  }));
  console.log('total', total);
  
  // Calculate how much each participant paid for each item
  items.forEach(item => {
    const itemAmount = parseFloat(item.amount) || 0;
    const itemPayers = item.selectedPayers || [];
    
    if (itemPayers.length > 0) {
      const amountPerPayer = itemAmount / itemPayers.length;
      itemPayers.forEach(payerIndex => {
        if (payerIndex < balances.length) {
          balances[payerIndex].balance -= amountPerPayer; // Negative because they paid
        }
      });
    }
  });
  console.log('balances after payers', balances);
  
  // Calculate how much each participant owes based on item splits
  items.forEach(item => {
    const itemConsumers = item.selectedConsumers || [];
    const itemSplits = item.splits || [];
    
    itemConsumers.forEach((consumerIndex, splitIndex) => {
      if (itemSplits[splitIndex]) {
        const splitAmount = parseFloat(itemSplits[splitIndex].amount) || 0;
        balances[consumerIndex].balance += splitAmount; // Positive because they owe
      }
    });
  });

  // Calculate how much each participant owes based on fee splits
  (fees || []).forEach(fee => {
    const feeSplits = fee.splits || [];
    
    feeSplits.forEach(split => {
      const participantIndex = split.participantIndex;
      const splitAmount = parseFloat(split.amount) || 0;
      if (participantIndex !== undefined && participantIndex < balances.length) {
        balances[participantIndex].balance += splitAmount; // Positive because they owe
      }
    });
  });

  return balances;
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
 * Alternative settlement algorithm that tries to minimize the number of people involved
 * This creates a "hub" approach where one person acts as the central payer
 * @param {Array} balances - Array of participant balances
 * @returns {Array} Array of settlement objects { from, to, amount }
 */
export const calculateHubSettlement = (balances) => {
  // Create a deep copy of balances to avoid modifying the original array
  const balancesCopy = balances.map(b => ({ ...b }));
  
  const debtors = balancesCopy.filter(b => b.balance > 0.01);
  const creditors = balancesCopy.filter(b => b.balance < -0.01);
  if (debtors.length === 0 || creditors.length === 0) {
    return [];
  }

  // Choose the person who is owed the most as the hub
  const hub = creditors.reduce((max, creditor) => 
    Math.abs(creditor.balance) > Math.abs(max.balance) ? creditor : max
  );
  const settlements = [];
  
  // All debtors pay the hub
  debtors.forEach(debtor => {
    if (debtor.balance > 0.01) {
      settlements.push({
        from: debtor.name,
        fromIndex: debtor.index,
        to: hub.name,
        toIndex: hub.index,
        amount: Math.round(debtor.balance * 100) / 100
      });
    }
  });
  
  // Hub pays other creditors
  creditors.forEach(creditor => {
    if (creditor.index !== hub.index && Math.abs(creditor.balance) > 0.01) {
      settlements.push({
        from: hub.name,
        fromIndex: hub.index,
        to: creditor.name,
        toIndex: creditor.index,
        amount: Math.round(Math.abs(creditor.balance) * 100) / 100
      });
    }
  });

  return settlements;
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
