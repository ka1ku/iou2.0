import { calculateParticipantBalances } from './settlementCalculator';

export const calculateUserBalanceForExpense = (expense, userId) => {
  if (!expense || !userId) {
    return { youPaid: 0, youOwe: 0, netBalance: 0, status: 'even' };
  }

  const participants = Array.isArray(expense.participants) ? expense.participants : [];
  
  const currentUserIndex = participants.findIndex(p => p.userId === userId);
  if (currentUserIndex === -1) {
    return { youPaid: 0, youOwe: 0, netBalance: 0, status: 'even' };
  }

  const items = expense.items || [];
  const total = items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const allBalances = calculateParticipantBalances(expense, participants, items, total);
  
  const userBalance = allBalances[currentUserIndex];
  
  if (!userBalance) {
    return { youPaid: 0, youOwe: 0, netBalance: 0, status: 'even' };
  }

  const netBalance = userBalance.balance;

  let status = 'even';
  if (Math.abs(netBalance) >= 0.01) {
    status = netBalance > 0 ? 'owes' : 'owed';
  }

  return {
    youPaid: userBalance.paid,
    youOwe: userBalance.owed,
    netBalance: netBalance,
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
  const items = expense.items || [];
  return Math.round(items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) * 100) / 100;
};
