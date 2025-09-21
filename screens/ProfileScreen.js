import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { useFocusEffect } from '@react-navigation/native';
import { getCurrentUser, onAuthStateChange, signOutUser } from '../services/authService';
import { getUserExpenses, calculateUserBalances, updateExpense } from '../services/expenseService';
import { getUserProfile } from '../services/friendService';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import ProfilePicture from '../components/VenmoProfilePicture';

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({
    totalOwed: 0,
    totalOwes: 0,
    netBalance: 0
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [displayedExpensesCount, setDisplayedExpensesCount] = useState(3);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [settlementModalVisible, setSettlementModalVisible] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [settlementStates, setSettlementStates] = useState({});

  useEffect(() => {
    // Listen for auth state changes and load data when user is available
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      if (user) {
        loadCriticalData();
      } else {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Refresh profile data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadCriticalData();
      }
    }, [user])
  );

  // Load only critical data first (profile info)
  const loadCriticalData = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        setProfileLoading(true);
        // Load user profile from Firestore first
        await loadUserProfile(currentUser.uid);
        
        // Load expenses and balances in background after profile is loaded
        setTimeout(() => {
          loadExpensesData(currentUser.uid);
        }, 100);
      }
    } catch (error) {
      console.error('Error loading critical data:', error);
      Alert.alert('Error', 'Failed to load profile data: ' + error.message);
    } finally {
      setLoading(false);
      setProfileLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load expenses and calculate balances separately
  const loadExpensesData = useCallback(async (userId) => {
    try {
      setExpensesLoading(true);
      const userExpenses = await getUserExpenses(userId);
      setExpenses(userExpenses);
      console.log('userExpenses', userExpenses);
      
      // Calculate balances with a slight delay to not block UI
      setTimeout(() => {
        const calculatedBalances = calculateUserBalances(userExpenses, userId);
        setBalances(calculatedBalances);
        setStatsLoading(false);
      }, 50);
    } catch (error) {
      console.error('Error loading expenses data:', error);
    } finally {
      setExpensesLoading(false);
    }
  }, []);

  // Full data refresh (for pull-to-refresh)
  const loadData = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        setStatsLoading(true);
        // Load user profile from Firestore
        await loadUserProfile(currentUser.uid);
        
        // Load expenses
        const userExpenses = await getUserExpenses(currentUser.uid);
        setExpenses(userExpenses);
        console.log('userExpenses', userExpenses);
        // Calculate balances
        const calculatedBalances = calculateUserBalances(userExpenses, currentUser.uid);
        setBalances(calculatedBalances);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      Alert.alert('Error', 'Failed to load profile data: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setStatsLoading(false);
    }
  }, []);

  const loadUserProfile = async (userId) => {
    try {
      const firestoreInstance = getFirestore(getApp());
      const userDoc = await getDoc(doc(firestoreInstance, 'users', userId));
      
      if (userDoc.exists()) {
        const profileData = userDoc.data();
        console.log('Loaded user profile data:', {
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          username: profileData.username,
          venmoUsername: profileData.venmoUsername,
          profilePhoto: profileData.profilePhoto,
          hasProfilePhoto: !!profileData.profilePhoto,
          profilePhotoType: profileData.profilePhoto ? (profileData.profilePhoto.includes('ui-avatars.com') ? 'fallback' : 'real') : 'none'
        });
        setUserProfile(profileData);
      } else {
        console.log('No user profile found for:', userId);
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOutUser();
              // Navigation will be handled by auth state change
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  }, []);

  // Memoize expensive calculations
  const memoizedBalances = useMemo(() => balances, [balances]);
  
  const memoizedExpenseStats = useMemo(() => {
    return {
      totalExpenses: expenses.length,
      totalItems: expenses.reduce((sum, exp) => sum + (exp.items?.length || 0), 0),
      totalAmount: expenses.reduce((sum, exp) => sum + (exp.total || 0), 0)
    };
  }, [expenses]);

  const recentExpenses = useMemo(() => {
    return showAllExpenses ? expenses : expenses.slice(0, displayedExpensesCount);
  }, [expenses, displayedExpensesCount, showAllExpenses]);

  const loadMoreExpenses = useCallback(() => {
    if (displayedExpensesCount < expenses.length) {
      setDisplayedExpensesCount(prev => Math.min(prev + 5, expenses.length));
    }
  }, [displayedExpensesCount, expenses.length]);

  const toggleShowAllExpenses = useCallback(() => {
    setShowAllExpenses(prev => !prev);
    setDisplayedExpensesCount(showAllExpenses ? 3 : expenses.length);
  }, [showAllExpenses, expenses.length]);

  // Get settlements between current user and another participant
  const getSettlementsBetweenUsers = useCallback((participantName) => {
    const currentUserName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}`.trim() : 'Me';
    const pendingSettlements = [];
    const pastSettlements = [];

    expenses.forEach(expense => {
      const expenseSettlements = Array.isArray(expense.settlements) ? expense.settlements : [];
      
      expenseSettlements.forEach(settlement => {
        // Check if this settlement involves the current user and the participant
        const isUserDebtor = settlement.debtor === currentUserName && settlement.creditor === participantName;
        const isUserCreditor = settlement.creditor === currentUserName && settlement.debtor === participantName;
        
        if (isUserDebtor || isUserCreditor) {
          const settlementData = {
            ...settlement,
            expenseTitle: expense.title,
            expenseId: expense.id,
            isUserDebtor,
            isUserCreditor
          };

          // Categorize as pending or past based on status
          if (settlement.status === 'markedAsPaid') {
            pastSettlements.push(settlementData);
          } else {
            pendingSettlements.push(settlementData);
          }
        }
      });
    });

    return {
      pending: pendingSettlements,
      past: pastSettlements
    };
  }, [expenses, userProfile]);

  // Modal functions
  const openSettlementModal = useCallback((participantName) => {
    setSelectedParticipant(participantName);
    setSettlementModalVisible(true);
  }, []);

  const closeSettlementModal = useCallback(() => {
    setSettlementModalVisible(false);
    setSelectedParticipant(null);
  }, []);

  // Handle bulk settlement actions
  const handleMarkAllAsPaid = useCallback(async (settlements) => {
    try {
      // Update all settlements to marked as paid
      for (const settlement of settlements) {
        await updateSettlementStatus(settlement, 'markedAsPaid');
      }
      
      // Refresh data to reflect changes
      loadData();
      
      Alert.alert('Success', `Marked ${settlements.length} settlement${settlements.length !== 1 ? 's' : ''} as paid`);
    } catch (error) {
      console.error('Error marking settlements as paid:', error);
      Alert.alert('Error', 'Failed to update settlement status');
    }
  }, []);

  const handleRequestAllPayments = useCallback(async (settlements) => {
    try {
      // Group settlements by debtor to create consolidated payment requests
      const settlementsByDebtor = {};
      settlements.forEach(settlement => {
        if (!settlementsByDebtor[settlement.debtor]) {
          settlementsByDebtor[settlement.debtor] = [];
        }
        settlementsByDebtor[settlement.debtor].push(settlement);
      });

      // For each debtor, create a single payment request for the total amount
      for (const [debtor, debtorSettlements] of Object.entries(settlementsByDebtor)) {
        const totalAmount = debtorSettlements.reduce((sum, s) => sum + s.amount, 0);
        const firstSettlement = debtorSettlements[0];
        
        // Find the debtor participant
        const debtorParticipant = expenses
          .flatMap(exp => exp.participants || [])
          .find(p => p.name === debtor);
        
        if (!debtorParticipant?.userId) {
          Alert.alert('Error', `Unable to find information for ${debtor}`);
          continue;
        }

        // Get the debtor's profile
        const debtorProfile = await getUserProfile(debtorParticipant.userId);
        
        if (!debtorProfile?.username) {
          Alert.alert('Error', `${debtor} does not have a Venmo username set up`);
          continue;
        }

        // Create consolidated Venmo deeplink
        const amount = totalAmount.toFixed(2);
        const note = `IOU Payment Request - ${debtorSettlements.length} settlement${debtorSettlements.length !== 1 ? 's' : ''}`;
        const deeplink = `venmo://paycharge?txn=charge&recipients=${debtorProfile.username}&amount=${amount}&note=${encodeURIComponent(note)}`;

        // Open the deeplink
        const supported = await Linking.canOpenURL(deeplink);
        if (supported) {
          await Linking.openURL(deeplink);
          
          // Update all settlements to payment requested
          for (const settlement of debtorSettlements) {
            await updateSettlementStatus(settlement, 'paymentRequested');
          }
        } else {
          Alert.alert('Error', 'Venmo is not installed on this device');
          return;
        }
      }
      
      // Refresh data to reflect changes
      loadData();
      
      Alert.alert('Success', `Payment requests sent for ${settlements.length} settlement${settlements.length !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error requesting payments:', error);
      Alert.alert('Error', 'Failed to send payment requests');
    }
  }, [expenses]);

  const handleMakeAllPayments = useCallback(async (settlements) => {
    try {
      // Group settlements by creditor to create consolidated payments
      const settlementsByCreditor = {};
      settlements.forEach(settlement => {
        if (!settlementsByCreditor[settlement.creditor]) {
          settlementsByCreditor[settlement.creditor] = [];
        }
        settlementsByCreditor[settlement.creditor].push(settlement);
      });

      // For each creditor, create a single payment for the total amount
      for (const [creditor, creditorSettlements] of Object.entries(settlementsByCreditor)) {
        const totalAmount = creditorSettlements.reduce((sum, s) => sum + s.amount, 0);
        
        // Find the creditor participant
        const creditorParticipant = expenses
          .flatMap(exp => exp.participants || [])
          .find(p => p.name === creditor);
        
        if (!creditorParticipant?.userId) {
          Alert.alert('Error', `Unable to find information for ${creditor}`);
          continue;
        }

        // Get the creditor's profile
        const creditorProfile = await getUserProfile(creditorParticipant.userId);
        
        if (!creditorProfile?.venmoUsername) {
          Alert.alert('Error', `${creditor} does not have a Venmo username set up`);
          continue;
        }

        // Create consolidated Venmo deeplink
        const amount = totalAmount.toFixed(2);
        const note = `IOU Payment - ${creditorSettlements.length} settlement${creditorSettlements.length !== 1 ? 's' : ''}`;
        const deeplink = `venmo://paycharge?txn=pay&recipients=${creditorProfile.venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;

        // Open the deeplink
        const supported = await Linking.canOpenURL(deeplink);
        if (supported) {
          await Linking.openURL(deeplink);
          
          // Update all settlements to payment made
          for (const settlement of creditorSettlements) {
            await updateSettlementStatus(settlement, 'paymentMade');
          }
        } else {
          Alert.alert('Error', 'Venmo is not installed on this device');
          return;
        }
      }
      
      // Refresh data to reflect changes
      loadData();
      
      Alert.alert('Success', `Payments made for ${settlements.length} settlement${settlements.length !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error making payments:', error);
      Alert.alert('Error', 'Failed to make payments');
    }
  }, [expenses]);


  // Update settlement status in the expense
  const updateSettlementStatus = useCallback(async (settlement, status) => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) throw new Error('No user signed in');

      // Find the expense containing this settlement
      const expense = expenses.find(exp => exp.id === settlement.expenseId);
      if (!expense) throw new Error('Expense not found');

      // Update the settlement status in the expense's settlements array
      const updatedSettlements = expense.settlements.map(s => {
        if (s.debtor === settlement.debtor && s.creditor === settlement.creditor && s.amount === settlement.amount) {
          return {
            ...s,
            status: status,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      });

      // Update the expense
      await updateExpense(expense.id, { settlements: updatedSettlements }, currentUser.uid);
      
      console.log(`Updated settlement status to ${status} for ${settlement.debtor} -> ${settlement.creditor}`);
    } catch (error) {
      console.error('Error updating settlement status:', error);
      throw error;
    }
  }, [expenses]);

  const renderBalanceCard = useCallback((title, amount, color, icon) => (
    <View style={[styles.balanceCard, { borderLeftColor: color }]}>
      <View style={styles.balanceHeader}>
        {/* <Ionicons name={icon} size={24} color={color} /> */}
        <Text style={styles.balanceTitle}>{title}</Text>
      </View>
      <Text style={[styles.balanceAmount, { color }]}>
        ${Math.abs(amount).toFixed(2)}
      </Text>
    </View>
  ), []);

  // Skeleton loading component
  const SkeletonLoader = memo(() => (
    <View style={styles.skeletonLoader}>
      <ActivityIndicator size="small" color={Colors.accent} />
      <Text style={styles.skeletonText}>Loading...</Text>
    </View>
  ));

  // Helper function to calculate user's balance for a specific expense
  const calculateUserBalanceForExpense = useCallback((expense) => {
    if (!expense.settlements || !Array.isArray(expense.settlements)) {
      return { amount: 0, status: 'even' };
    }

    const currentUserName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}`.trim() : 'Me';
    let userBalance = 0;

    // Calculate balance from settlements (excluding marked as paid)
    expense.settlements.forEach(settlement => {
      if (settlement.status === 'markedAsPaid') {
        return; // Skip paid settlements
      }

      const amount = parseFloat(settlement.amount) || 0;
      
      // If user is the creditor (someone owes them)
      if (settlement.creditor === currentUserName) {
        userBalance += amount;
      }
      // If user is the debtor (they owe someone)
      else if (settlement.debtor === currentUserName) {
        userBalance -= amount;
      }
    });

    // Determine status
    if (Math.abs(userBalance) < 0.01) {
      return { amount: 0, status: 'even' };
    } else if (userBalance > 0) {
      return { amount: userBalance, status: 'owed' };
    } else {
      return { amount: Math.abs(userBalance), status: 'owes' };
    }
  }, [userProfile]);

  const renderExpenseSummary = useCallback((expense) => {
    // Calculate user's balance for this expense
    const userBalance = calculateUserBalanceForExpense(expense);

    // Determine if this is a receipt or individual expense
    const isReceipt = expense.expenseType === 'receipt';
    const screenName = isReceipt ? 'AddReceipt' : 'AddExpense';
    const iconName = isReceipt ? 'receipt-outline' : 'card-outline';

    return (
      <TouchableOpacity
        key={expense.id}
        style={styles.expenseSummaryCard}
        onPress={() => navigation.navigate(screenName, { expense })}
      >
        <View style={styles.expenseSummaryHeader}>
          <View style={styles.expenseSummaryLeft}>
            <Ionicons name={iconName} size={20} color={Colors.accent} style={styles.expenseTypeIcon} />
            <Text style={styles.expenseSummaryTitle}>{expense.title}</Text>
          </View>
          <Text style={styles.expenseSummaryTotal}>
            ${expense.total?.toFixed(2) || '0.00'}
          </Text>
        </View>
        <View style={styles.expenseSummaryDetails}>
          <View style={styles.expenseSummaryLeft}>
            <Text style={[
              styles.expenseSummaryInfo,
              { 
                color: userBalance.status === 'even' 
                  ? Colors.textSecondary 
                  : userBalance.status === 'owed' 
                    ? Colors.green 
                    : Colors.red
              }
            ]}>
              {userBalance.status === 'even' 
                ? 'You are even' 
                : userBalance.status === 'owed' 
                  ? `You are owed $${userBalance.amount.toFixed(2)}`
                  : `You owe $${userBalance.amount.toFixed(2)}`
              }
            </Text>
          </View>
          <Text style={styles.expenseSummaryInfo}>
            {expense.participants?.length || 0} participants
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, calculateUserBalanceForExpense]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <ProfilePicture
              source={userProfile?.profilePhoto}
              size={80}
              username={userProfile?.username || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`}
              showFallback
            />
          </View>

          <Text style={styles.userName}>
            {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'User'}
          </Text>
          <Text style={styles.userEmail}>
            {userProfile?.username ? `@${userProfile.username}` : 'No username'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={24} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.balancesSection}>
        <Text style={styles.sectionTitle}>Balance Summary</Text>
        
        {expensesLoading ? (
          <SkeletonLoader />
        ) : (
          <>
            <View style={styles.netBalanceCard}>
              <Text style={styles.netBalanceLabel}>Net Balance</Text>
              <Text style={[
                styles.netBalanceAmount,
                { 
                  color: memoizedBalances.netBalance === 0 
                    ? Colors.textSecondary 
                    : memoizedBalances.netBalance > 0 
                      ? Colors.green 
                      : Colors.red
                }
              ]}>
                {memoizedBalances.netBalance === 0 
                  ? '$0.00' 
                  : `$${memoizedBalances.netBalance >= 0 ? '+' : ''}${memoizedBalances.netBalance.toFixed(2)}`
                }
              </Text>
              <Text style={styles.netBalanceSubtext}>
                {memoizedBalances.netBalance === 0 
                  ? 'You are all even' 
                  : memoizedBalances.netBalance > 0 
                    ? 'You are owed money overall' 
                    : 'You owe money overall'
                }
              </Text>
            </View>

            <View style={styles.balanceCardsContainer}>
              {renderBalanceCard(
                'Total Owed to You',
                memoizedBalances.totalOwed,
                Colors.green,
                'arrow-down-circle'
              )}
              {renderBalanceCard(
                'Total You Owe',
                memoizedBalances.totalOwes,
                Colors.red,
                'arrow-up-circle'
              )}
            </View>
          </>
        )}
      </View>

      {/* Debt Breakdown Section */}
      {memoizedBalances.debtBreakdown && Object.keys(memoizedBalances.debtBreakdown).length > 0 && (
        <View style={styles.debtSection}>
          <Text style={styles.sectionTitle}>Balance Breakdown</Text>
          {expensesLoading ? (
            <SkeletonLoader />
          ) : (
            <View style={styles.debtList}>
              {Object.entries(memoizedBalances.debtBreakdown).map(([participantName, amount]) => {
                if (Math.abs(amount) < 0.01) return null; // Skip negligible amounts
                
                return (
                  <TouchableOpacity 
                    key={participantName}
                    style={styles.debtItem}
                    onPress={() => openSettlementModal(participantName)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.debtHeader}>
                      <Ionicons 
                        name={amount > 0 ? "arrow-down-circle" : "arrow-up-circle"} 
                        size={20} 
                        color={amount > 0 ? Colors.green : Colors.red} 
                      />
                      <Text style={styles.debtParticipant}>{participantName}</Text>
                    </View>
                    <Text style={[
                      styles.debtAmount,
                      { color: amount > 0 ? Colors.green : Colors.red }
                    ]}>
                      {amount > 0 ? 'owes you' : 'you owe'} ${Math.abs(amount).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      <View style={styles.expensesSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            {!expensesLoading && (
              <View style={styles.expenseTypeCounts}>
                <View style={styles.typeCount}>
                  <Ionicons name="card-outline" size={16} color={Colors.accent} />
                  <Text style={styles.typeCountText}>
                    {expenses.filter(exp => exp.expenseType !== 'receipt').length}
                  </Text>
                </View>
                <View style={styles.typeCount}>
                  <Ionicons name="receipt-outline" size={16} color={Colors.accent} />
                  <Text style={styles.typeCountText}>
                    {expenses.filter(exp => exp.expenseType === 'receipt').length}
                  </Text>
                </View>
              </View>
            )}
          </View>
          {/* {expenses.length > 3 && (
            <TouchableOpacity onPress={toggleShowAllExpenses} style={styles.viewAllButton}>
              <Text style={styles.viewAllLink}>
                {showAllExpenses ? 'Show Less' : 'View All'}
              </Text>
            </TouchableOpacity>
          )} */}
        </View>
        {expensesLoading ? (
          <SkeletonLoader />
        ) : expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No expenses yet</Text>
            <TouchableOpacity
              style={styles.createExpenseButton}
              onPress={() => navigation.navigate('AddExpense')}
            >
              <Text style={styles.createExpenseButtonText}>Create Your First Expense</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.expensesList}>
              {recentExpenses.map(renderExpenseSummary)}
            </View>
            {!showAllExpenses && displayedExpensesCount < expenses.length && (
              <TouchableOpacity onPress={loadMoreExpenses} style={styles.loadMoreButton}>
                <Text style={styles.loadMoreText}>
                  Load More ({expenses.length - displayedExpensesCount} remaining)
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.accent} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        {statsLoading ? (
          <SkeletonLoader />
        ) : (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{memoizedExpenseStats.totalExpenses}</Text>
              <Text style={styles.statLabel}>Total Expenses</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {memoizedExpenseStats.totalItems}
              </Text>
              <Text style={styles.statLabel}>Total Items</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                ${memoizedExpenseStats.totalAmount.toFixed(0)}
              </Text>
              <Text style={styles.statLabel}>Total Amount</Text>
            </View>
          </View>
        )}
      </View>

      {/* Settings Section */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.settingsList}>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('Profile', {
              screen: 'NotificationSettings'
            })}
          >
            <Ionicons name="notifications-outline" size={24} color={Colors.textSecondary} />
            <Text style={styles.settingText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('Profile', {
              screen: 'VenmoTest'
            })}
          >
            <Ionicons name="card-outline" size={24} color={Colors.textSecondary} />
            <Text style={styles.settingText}>Venmo Test</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="language-outline" size={24} color={Colors.textSecondary} />
            <Text style={styles.settingText}>Language</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
        </ScrollView>

        {/* Settlement Modal */}
        <Modal
          visible={settlementModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeSettlementModal}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Settlements with {selectedParticipant}
              </Text>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedParticipant && (() => {
                const settlements = getSettlementsBetweenUsers(selectedParticipant);
                const { pending, past } = settlements;
                const currentUserName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}`.trim() : 'Me';
                const participantAmount = memoizedBalances.debtBreakdown[selectedParticipant] || 0;

                return (
                  <>
                     {/* Pending Settlements */}
                     {pending.length > 0 && (
                       <View style={styles.modalSection}>
                         <Text style={styles.modalSectionTitle}>
                           Pending Settlements ({pending.length})
                         </Text>
                         <View style={styles.modalSettlementsList}>
                           {pending.map((settlement, index) => (
                             <View key={index}>
                               <View style={styles.modalSettlementItem}>
                                 <View style={styles.modalSettlementInfo}>
                                   <Text style={styles.modalSettlementExpense}>{settlement.expenseTitle}</Text>
                                   <Text style={styles.modalSettlementAmount}>
                                     ${settlement.amount.toFixed(2)}
                                   </Text>
                                 </View>
                                 <View style={styles.modalSettlementStatus}>
                                   <Text style={styles.modalSettlementStatusText}>
                                     {settlement.isUserCreditor ? 'You are owed' : 'You owe'}
                                   </Text>
                                 </View>
                               </View>
                               {index < pending.length - 1 && (
                                 <View style={styles.modalSettlementDivider} />
                               )}
                             </View>
                           ))}
                         </View>
                        
                        {/* Settlement Actions */}
                        <View style={styles.modalActionsContainer}>
                          {participantAmount > 0 ? (
                            // User is owed money - can mark as paid or request payment
                            <>
                              <TouchableOpacity
                                style={[styles.modalActionButton, styles.markPaidButton]}
                                onPress={() => {
                                  handleMarkAllAsPaid(pending);
                                  closeSettlementModal();
                                }}
                              >
                                <Text style={styles.modalActionButtonText}>Mark All as Paid</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.modalActionButton, styles.requestButton]}
                                onPress={() => {
                                  handleRequestAllPayments(pending);
                                  closeSettlementModal();
                                }}
                              >
                                <Text style={styles.modalActionButtonText}>Request All</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            // User owes money - can make payment or mark as paid
                            <>
                              <TouchableOpacity
                                style={[styles.modalActionButton, styles.makePaymentButton]}
                                onPress={() => {
                                  handleMakeAllPayments(pending);
                                  closeSettlementModal();
                                }}
                              >
                                <Text style={styles.modalActionButtonText}>Pay All</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.modalActionButton, styles.markPaidButton]}
                                onPress={() => {
                                  handleMarkAllAsPaid(pending);
                                  closeSettlementModal();
                                }}
                              >
                                <Text style={styles.modalActionButtonText}>Mark All as Paid</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    )}

                     {/* Past Settlements */}
                     {past.length > 0 && (
                       <View style={styles.modalSection}>
                         <Text style={styles.modalSectionTitle}>
                           Past Settlements ({past.length})
                         </Text>
                         <View style={styles.modalSettlementsList}>
                           {past.map((settlement, index) => (
                             <View key={index}>
                               <View style={styles.modalSettlementItem}>
                                 <View style={styles.modalSettlementInfo}>
                                   <Text style={styles.modalSettlementExpense}>{settlement.expenseTitle}</Text>
                                   <Text style={styles.modalSettlementAmount}>
                                     ${settlement.amount.toFixed(2)}
                                   </Text>
                                 </View>
                                 <View style={styles.modalSettlementStatus}>
                                   <Ionicons name="checkmark-circle" size={16} color={Colors.green} />
                                   <Text style={[styles.modalSettlementStatusText, { color: Colors.green }]}>
                                     Paid
                                   </Text>
                                 </View>
                               </View>
                               {index < past.length - 1 && (
                                 <View style={styles.modalSettlementDivider} />
                               )}
                             </View>
                           ))}
                         </View>
                       </View>
                     )}

                    {pending.length === 0 && past.length === 0 && (
                      <View style={styles.modalEmptyState}>
                        <Ionicons name="receipt-outline" size={48} color={Colors.textSecondary} />
                        <Text style={styles.modalEmptyStateText}>No settlements found</Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </SafeAreaView>
        </Modal>
     </View>
    );
  };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 20, // Small padding above tab bar
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: Colors.surface,
    paddingTop: 60, // Account for status bar manually
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    alignSelf: 'center',
    ...Shadows.card,
  },
  userName: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  userEmail: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  signOutButton: {
    padding: 8,
    position: 'absolute',
    top: 60,
    right: Spacing.xl,
  },
  balancesSection: {
    margin: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  netBalanceCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  netBalanceLabel: {
    ...Typography.h2,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  netBalanceAmount: {
    fontSize: 32,
    fontFamily: Typography.familyBold,
    marginBottom: Spacing.xs,

  },
  netBalanceSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  balanceCardsContainer: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  balanceCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flex: 1,
    borderLeftWidth: 4,
    alignItems: 'center',
    ...Shadows.card,
  },
  balanceHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceTitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  balanceAmount: {
    fontSize: 20,
    fontFamily: Typography.familySemiBold,
    textAlign: 'center',
  },
  debtSection: {
    margin: Spacing.lg,
  },
  debtList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  debtItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  debtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  debtParticipant: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
    flex: 1,
  },
  debtAmount: {
    ...Typography.body,
    fontFamily: Typography.familySemiBold,
  },
  settlementButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  markPaidButton: {
    backgroundColor: Colors.green,
  },
  requestButton: {
    backgroundColor: Colors.accent,
  },
  makePaymentButton: {
    backgroundColor: '#FF9800',
  },
  settlementButtonText: {
    ...Typography.label,
    color: 'white',
    fontSize: 12,
    fontFamily: Typography.familyMedium,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  modalSection: {
    marginBottom: Spacing.xl,
  },
  modalSectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  modalSettlementsList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  modalSettlementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  modalSettlementDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.md,
  },
  modalSettlementInfo: {
    flex: 1,
  },
  modalSettlementExpense: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  modalSettlementAmount: {
    ...Typography.body,
    color: Colors.accent,
    fontFamily: Typography.familySemiBold,
    fontSize: 16,
    marginTop: 2,
  },
  modalSettlementStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modalSettlementStatusText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  modalActionsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  modalActionButtonText: {
    ...Typography.body,
    color: 'white',
    fontFamily: Typography.familySemiBold,
    fontSize: 16,
  },
  modalEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  modalEmptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  expensesSection: {
    margin: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  expenseTypeCounts: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  typeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  typeCountText: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
    fontSize: 12,
  },
  viewAllButton: {
    alignSelf: 'flex-end',
  },
  viewAllLink: {
    fontSize: 16,
    color: Colors.accent,
  },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.card,
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginVertical: Spacing.md,
  },
  createExpenseButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
  },
  createExpenseButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: Typography.familySemiBold,
  },
  expensesList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  expenseSummaryCard: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  expenseSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseTypeIcon: {
    marginRight: Spacing.sm,
  },
  expenseSummaryTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    flex: 1,
  },
  expenseSummaryTotal: {
    fontSize: 16,
    fontFamily: Typography.familySemiBold,
    color: Colors.accent,
  },
  expenseSummaryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseTypeLabel: {
    ...Typography.label,
    color: Colors.accent,
    fontSize: 12,
    fontFamily: Typography.familyMedium,
    marginRight: Spacing.sm,
  },
  expenseSummaryInfo: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  statsSection: {
    margin: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  statsContainer: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    ...Shadows.card,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: Typography.familyBold,
    color: Colors.accent,
    marginBottom: 4,
  },
  statLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  settingsSection: {
    margin: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  settingsList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  settingText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: Spacing.md,
  },
  skeletonLoader: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
    ...Shadows.card,
  },
  skeletonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  loadMoreButton: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    ...Shadows.card,
  },
  loadMoreText: {
    ...Typography.body,
    color: Colors.accent,
    marginRight: Spacing.sm,
    fontFamily: Typography.familyMedium,
  },
});

export default ProfileScreen;
