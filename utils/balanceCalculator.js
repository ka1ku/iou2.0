
export const calculateUserBalanceForExpense = (expense, userId) => {
  if (!expense || !userId) {
    return { youPaid: 0, youOwe: 0, netBalance: 0, status: 'even' };
  }

  const participants = Array.isArray(expense.participants) ? expense.participants : [];
  
  const currentUserIndex = participants.findIndex(p => p.userId === userId);
  if (currentUserIndex === -1) {
    return { youPaid: 0, youOwe: 0, netBalance: 0, status: 'even' };
  }

  let youPaid = 0;
  let youOwe = 0;
  
  expense.items?.forEach(item => {
    const itemAmount = parseFloat(item.amount) || 0;
    const itemPayers = item.selectedPayers || expense.selectedPayers || [0];
    const itemConsumers = item.selectedConsumers || [0];
    const itemSplits = item.splits || [];
    
    if (itemPayers.includes(currentUserIndex)) {
      const amountPerPayer = itemAmount / itemPayers.length;
      youPaid += amountPerPayer;
    }
    
    const yourConsumerIndex = itemConsumers.indexOf(currentUserIndex);
    if (yourConsumerIndex !== -1 && itemSplits[yourConsumerIndex]) {
      const yourAmount = parseFloat(itemSplits[yourConsumerIndex]) || 0;
      youOwe += yourAmount;
    }
  });
  
  expense.fees?.forEach(fee => {
    const feeAmount = parseFloat(fee.amount) || 0;
    const feeSplits = fee.splits || [];
    
    const yourFeeSplit = feeSplits.find(split => split.participantIndex === currentUserIndex);
    if (yourFeeSplit) {
      const yourFeeAmount = parseFloat(yourFeeSplit.amount) || 0;
      youOwe += yourFeeAmount;
    }
  });
  
  const netBalance = youOwe - youPaid;

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


  expenses.forEach(expense => {
    const balance = calculateUserBalanceForExpense(expense, userId);
    
    
    if (balance.netBalance > 0) {
      totalUserOwes += balance.netBalance;
    } else if (balance.netBalance < 0) {
      totalOwedToUser += Math.abs(balance.netBalance);
    }
  });

  const netBalance = totalOwedToUser - totalUserOwes;


  return {
    totalOwed: Math.round(totalOwedToUser * 100) / 100,
    totalOwes: Math.round(totalUserOwes * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100,
    debtBreakdown
  };
};

export const getFormattedBalanceString = (balance) => {
  if (balance.status === 'even') {
    return 'You are even';
  } else if (balance.status === 'owed') {
    return `You are owed $${Math.abs(balance.netBalance).toFixed(2)}`;
  } else {
    return `You owe $${balance.netBalance.toFixed(2)}`;
  }
};

export const getBalanceColor = (balance, colors) => {
  if (balance.status === 'even') {
    return colors.textSecondary;
  } else if (balance.status === 'owed') {
    return colors.green;
  } else {
    return colors.red;
  }
};

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
