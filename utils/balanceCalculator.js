/**
 * Universal Balance Calculator
 * 
 * This utility provides consistent balance calculations across all screens.
 * It calculates what a user paid vs what they owe for expenses.
 */

/**
 * Calculate user's balance for a single expense
 * @param {Object} expense - The expense object with participants, items, and fees
 * @param {string} userId - The user ID to calculate balance for
 * @returns {Object} Balance object with { youPaid, youOwe, netBalance, status }
 */
export const calculateUserBalanceForExpense = (expense, userId) => {
  if (!expense || !userId) {
    return { youPaid: 0, youOwe: 0, netBalance: 0, status: 'even' };
  }

  const participants = Array.isArray(expense.participants) ? expense.participants : [];
  
  // Find current user by userId
  const currentUserIndex = participants.findIndex(p => p.userId === userId);
  if (currentUserIndex === -1) {
    return { youPaid: 0, youOwe: 0, netBalance: 0, status: 'even' };
  }

  let youPaid = 0;
  let youOwe = 0;
  
  // Calculate from items
  expense.items?.forEach(item => {
    const itemAmount = parseFloat(item.amount) || 0;
    const itemPayers = item.selectedPayers || expense.selectedPayers || [0];
    const itemConsumers = item.selectedConsumers || [0];
    const itemSplits = item.splits || [];
    
    // Calculate how much you paid for this item
    if (itemPayers.includes(currentUserIndex)) {
      const amountPerPayer = itemAmount / itemPayers.length;
      youPaid += amountPerPayer;
    }
    
    // Calculate how much you owe for this item
    const yourConsumerIndex = itemConsumers.indexOf(currentUserIndex);
    if (yourConsumerIndex !== -1 && itemSplits[yourConsumerIndex]) {
      const yourAmount = parseFloat(itemSplits[yourConsumerIndex]) || 0;
      youOwe += yourAmount;
    }
  });
  
  // Calculate fees
  expense.fees?.forEach(fee => {
    const feeAmount = parseFloat(fee.amount) || 0;
    const feeSplits = fee.splits || [];
    
    // Find your split for this fee
    const yourFeeSplit = feeSplits.find(split => split.participantIndex === currentUserIndex);
    if (yourFeeSplit) {
      const yourFeeAmount = parseFloat(yourFeeSplit.amount) || 0;
      youOwe += yourFeeAmount;
    }
  });
  
  // Calculate net balance: positive means you owe, negative means you're owed
  const netBalance = youOwe - youPaid;

  // Determine status
  let status = 'even';
  if (Math.abs(netBalance) >= 0.01) {
    status = netBalance > 0 ? 'owes' : 'owed';
  }

  return {
    youPaid: Math.round(youPaid * 100) / 100,
    youOwe: Math.round(youOwe * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100,
    status
  };
};

/**
 * Calculate user's total balance across multiple expenses
 * @param {Array} expenses - Array of expense objects
 * @param {string} userId - The user ID to calculate balance for
 * @returns {Object} Total balance object with { totalOwed, totalOwes, netBalance, debtBreakdown }
 */
export const calculateUserTotalBalance = (expenses, userId) => {
  if (!expenses || !Array.isArray(expenses) || !userId) {
    return {
      totalOwed: 0,
      totalOwes: 0,
      netBalance: 0,
      debtBreakdown: {}
    };
  }

  let totalOwedToUser = 0;
  let totalUserOwes = 0;
  const debtBreakdown = {};

  console.log('Calculating total user balance for', expenses.length, 'expenses');

  expenses.forEach(expense => {
    const balance = calculateUserBalanceForExpense(expense, userId);
    
    console.log(`Expense "${expense.title}": Paid $${balance.youPaid.toFixed(2)}, Owe $${balance.youOwe.toFixed(2)}, Net: $${balance.netBalance.toFixed(2)}`);
    
    if (balance.netBalance > 0) {
      // You owe money (positive balance)
      totalUserOwes += balance.netBalance;
    } else if (balance.netBalance < 0) {
      // You are owed money (negative balance)
      totalOwedToUser += Math.abs(balance.netBalance);
    }
  });

  const netBalance = totalOwedToUser - totalUserOwes;

  console.log('Total balance calculation:');
  console.log(`- Total owed to user: $${totalOwedToUser.toFixed(2)}`);
  console.log(`- Total user owes: $${totalUserOwes.toFixed(2)}`);
  console.log(`- Net balance: $${netBalance.toFixed(2)}`);

  return {
    totalOwed: Math.round(totalOwedToUser * 100) / 100,
    totalOwes: Math.round(totalUserOwes * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100,
    debtBreakdown
  };
};

/**
 * Get a formatted balance string for display
 * @param {Object} balance - Balance object from calculateUserBalanceForExpense
 * @returns {string} Formatted balance string
 */
export const getFormattedBalanceString = (balance) => {
  if (balance.status === 'even') {
    return 'You are even';
  } else if (balance.status === 'owed') {
    return `You are owed $${Math.abs(balance.netBalance).toFixed(2)}`;
  } else {
    return `You owe $${balance.netBalance.toFixed(2)}`;
  }
};

/**
 * Get balance color for UI display
 * @param {Object} balance - Balance object from calculateUserBalanceForExpense
 * @param {Object} colors - Colors object from design tokens
 * @returns {string} Color string for the balance
 */
export const getBalanceColor = (balance, colors) => {
  if (balance.status === 'even') {
    return colors.textSecondary;
  } else if (balance.status === 'owed') {
    return colors.green;
  } else {
    return colors.red;
  }
};

/**
 * Calculate the total amount for an expense from items and fees
 * @param {Object} expense - The expense object with items and fees
 * @returns {number} Total amount for the expense
 */
export const calculateExpenseTotal = (expense) => {
  if (!expense) return 0;
  
  const itemsTotal = (expense.items || []).reduce((sum, item) => {
    return sum + (parseFloat(item.amount) || 0);
  }, 0);
  
  const feesTotal = (expense.fees || []).reduce((sum, fee) => {
    return sum + (parseFloat(fee.amount) || 0);
  }, 0);
  
  return Math.round((itemsTotal + feesTotal) * 100) / 100;
};
