const {
  buildItemAssociationMap,
  calculateSettlement
} = require('../utils/settlementCalculator');

// Mock function from AddReceiptScreen (Logic we implemented)
const calculateParticipantProportionsFromConsumption = (items, participants) => {
    const participantConsumption = participants.map((participant, participantIndex) => {
      let totalConsumed = 0;
      items.forEach(item => {
        const itemAmount = parseFloat(item.amount) || 0;
        const itemConsumers = item.selectedConsumers || [];
        if (itemConsumers.includes(participantIndex)) {
          const amountConsumedByThisPerson = itemConsumers.length > 0 ? itemAmount / itemConsumers.length : 0;
          totalConsumed += amountConsumedByThisPerson;
        }
      });
      return { index: participantIndex, amount: totalConsumed };
    });
    const totalItemAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    return participantConsumption.map(({ index, amount }) => ({
      index,
      amount,
      proportion: totalItemAmount > 0 ? amount / totalItemAmount : 0
    }));
  };

const applyProportionalFeeSplits = (expenseData, participantProportions) => {
    const totalFees = expenseData.fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
    if (totalFees === 0) return expenseData;

    const updatedFees = expenseData.fees.map(fee => {
      const feeAmount = parseFloat(fee.amount) || 0;
      const proportionalSplits = participantProportions.map(({ index, proportion }) => {
        const splitAmount = Math.round(feeAmount * proportion * 100) / 100;
        return { participantIndex: index, amount: splitAmount };
      });
      const totalSplits = proportionalSplits.reduce((sum, s) => sum + s.amount, 0);
      const roundingError = Math.round((feeAmount - totalSplits) * 100) / 100;

      if (roundingError !== 0 && proportionalSplits.length > 0) {
        const firstNonZero = proportionalSplits.find(s => s.amount > 0);
        if (firstNonZero) {
          firstNonZero.amount = Math.round((firstNonZero.amount + roundingError) * 100) / 100;
        }
      }
      return { ...fee, splits: proportionalSplits };
    });
    return { ...expenseData, fees: updatedFees };
  };

// Test Data
const participants = [
    { name: 'Alice', id: 'p1' }, // Index 0 (Payer)
    { name: 'Bob', id: 'p2' }    // Index 1
];

// Items
const items = [
    { id: 'i1', name: 'Item 1', amount: 100, selectedPayers: [0], selectedConsumers: [0] }, // Alice consumes
    { id: 'i2', name: 'Item 2', amount: 100, selectedPayers: [0], selectedConsumers: [1] }  // Bob consumes
];

// Fees - One Tax, One Tip
const fees = [
    { id: 'f1', name: 'Tax', amount: 20, type: 'percentage', percentage: 0.1, splits: [] }, // 10%
    { id: 'f2', name: 'Tip', amount: 20, type: 'percentage', percentage: 0.1, splits: [] }  // 10%
];

// Initial Data (before split calculation)
let expenseData = {
    participants,
    items,
    fees,
    selectedPayers: [0] // Alice paid for fees
};

const props = calculateParticipantProportionsFromConsumption(items, participants);
expenseData = applyProportionalFeeSplits(expenseData, props);

// Calculating Settlement
// Bob owes Alice for Item 2 + His share of Tax + His share of Tip
const result = calculateSettlement(expenseData);
const settlement = result.settlements.find(s => s.from === 'Bob' && s.to === 'Alice');

if (settlement) {
    const hasTax = settlement.associatedItems.some(i => i.name === 'Tax');
    const hasTip = settlement.associatedItems.some(i => i.name === 'Tip');
    // Validation: hasTax && hasTip
} else {
    // No settlement found
}
