import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import ProfilePicture from '../components/VenmoProfilePicture';
import { getCurrentUser } from '../services/authService';
import { getUserExpenses, calculateUserBalances } from '../services/expenseService';

const FriendProfileScreen = ({ route, navigation }) => {
  const { friend } = route.params;
  const [friendProfile, setFriendProfile] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({
    totalOwed: 0,
    totalOwes: 0,
    netBalance: 0,
    debtBreakdown: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (friend) {
      loadFriendData();
    }
  }, [friend]);

  const loadFriendData = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      if (currentUser) {
        // Load user expenses to calculate balances
        const userExpenses = await getUserExpenses(currentUser.uid);
        setExpenses(userExpenses);
        
        // Calculate balances specifically for this friend
        const calculatedBalances = calculateFriendBalances(userExpenses, currentUser.uid, friend.friendId);
        setBalances(calculatedBalances);
        
        // Set friend profile data
        setFriendProfile({
          ...friend,
          // Add any additional profile data here
        });
      }
    } catch (error) {
      console.error('Error loading friend data:', error);
      Alert.alert('Error', 'Failed to load friend data');
    } finally {
      setLoading(false);
    }
  };

  const calculateFriendBalances = (userExpenses, currentUserId, friendId) => {
    let totalOwed = 0;
    let totalOwes = 0;
    const debtBreakdown = {};

    userExpenses.forEach(expense => {
      if (expense.participants && expense.participants.some(p => p.id === friendId)) {
        // Find the friend's participation in this expense
        const friendParticipant = expense.participants.find(p => p.id === friendId);
        const currentUserParticipant = expense.participants.find(p => p.id === currentUserId);
        
        if (friendParticipant && currentUserParticipant) {
          // Calculate what each person owes
          let friendOwes = 0;
          let currentUserOwes = 0;

          expense.items?.forEach(item => {
            if (item.paidBy === friendParticipant.participantIndex) {
              // Friend paid for this item
              if (item.splitType === 'even') {
                const splitAmount = item.amount / expense.participants.length;
                currentUserOwes += splitAmount;
                friendOwes -= splitAmount;
              } else if (item.splitType === 'custom') {
                const currentUserSplit = item.splits?.find(s => s.participantIndex === currentUserParticipant.participantIndex);
                const friendSplit = item.splits?.find(s => s.participantIndex === friendParticipant.participantIndex);
                
                if (currentUserSplit && friendSplit) {
                  currentUserOwes += currentUserSplit.amount;
                  friendOwes -= friendSplit.amount;
                }
              }
            } else if (item.paidBy === currentUserParticipant.participantIndex) {
              // Current user paid for this item
              if (item.splitType === 'even') {
                const splitAmount = item.amount / expense.participants.length;
                friendOwes += splitAmount;
                currentUserOwes -= splitAmount;
              } else if (item.splitType === 'custom') {
                const currentUserSplit = item.splits?.find(s => s.participantIndex === currentUserParticipant.participantIndex);
                const friendSplit = item.splits?.find(s => s.participantIndex === friendParticipant.participantIndex);
                
                if (currentUserSplit && friendSplit) {
                  friendOwes += friendSplit.amount;
                  currentUserOwes -= currentUserSplit.amount;
                }
              }
            }
          });

          // Add fees
          expense.fees?.forEach(fee => {
            if (fee.splitType === 'equal') {
              const splitAmount = fee.amount / expense.participants.length;
              if (fee.paidBy === friendParticipant.participantIndex) {
                currentUserOwes += splitAmount;
                friendOwes -= splitAmount;
              } else if (fee.paidBy === currentUserParticipant.participantIndex) {
                friendOwes += splitAmount;
                currentUserOwes -= splitAmount;
              }
            }
          });

          // Update totals
          if (friendOwes > 0) {
            totalOwed += friendOwes;
          } else {
            totalOwes += Math.abs(friendOwes);
          }

          // Store breakdown by expense
          debtBreakdown[expense.id] = {
            title: expense.title,
            amount: friendOwes,
            date: expense.createdAt,
            type: friendOwes > 0 ? 'owes_you' : 'you_owe'
          };
        }
      }
    });

    return {
      totalOwed,
      totalOwes,
      netBalance: totalOwed - totalOwes,
      debtBreakdown
    };
  };

  const handleVenmoPayment = () => {
    if (friend.username) {
      const venmoUrl = `https://venmo.com/${friend.username}`;
      Linking.openURL(venmoUrl);
    } else {
      Alert.alert('No Username', 'This friend doesn\'t have a username');
    }
  };



  const renderBalanceCard = (title, amount, color, icon) => (
    <View style={[styles.balanceCard, { borderLeftColor: color }]}>
      <View style={styles.balanceHeader}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.balanceTitle}>{title}</Text>
      </View>
      <Text style={[styles.balanceAmount, { color }]}>
        ${Math.abs(amount).toFixed(2)}
      </Text>
    </View>
  );

  const renderExpenseItem = (expenseId, expenseData) => (
    <View key={expenseId} style={styles.expenseItem}>
      <View style={styles.expenseHeader}>
        <Text style={styles.expenseTitle}>{expenseData.title}</Text>
        <View style={[
          styles.expenseAmount,
          { color: expenseData.type === 'owes_you' ? Colors.success : Colors.danger }
        ]}>
          <Ionicons 
            name={expenseData.type === 'owes_you' ? 'arrow-down-circle' : 'arrow-up-circle'} 
            size={16} 
            color={expenseData.type === 'owes_you' ? Colors.success : Colors.danger} 
          />
          <Text style={styles.expenseAmountText}>
            {expenseData.type === 'owes_you' ? 'Owes you' : 'You owe'} ${Math.abs(expenseData.amount).toFixed(2)}
          </Text>
        </View>
      </View>
      <Text style={styles.expenseDate}>
        {expenseData.date ? new Date(expenseData.date).toLocaleDateString() : 'Unknown date'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading friend profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Friend Info Section */}
        <View style={styles.section}>
          <View style={styles.friendInfo}>
            <ProfilePicture
              source={friend.profilePhoto}
              size={80}
              username={friend.username || friend.name}
            />
            <View style={styles.friendDetails}>
              <Text style={styles.friendName}>
                {friend.firstName && friend.lastName 
                  ? `${friend.firstName} ${friend.lastName}`
                  : friend.name
                }
              </Text>
              {friend.username && (
                <Text style={styles.venmoUsername}>@{friend.username}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Balance Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Balance Summary</Text>
          
          <View style={styles.netBalanceCard}>
            <Text style={styles.netBalanceLabel}>Net Balance</Text>
            <Text style={[
              styles.netBalanceAmount,
              { color: balances.netBalance >= 0 ? Colors.success : Colors.danger }
            ]}>
              {balances.netBalance >= 0 ? '+' : ''}${balances.netBalance.toFixed(2)}
            </Text>
            <Text style={styles.netBalanceSubtext}>
              {balances.netBalance >= 0 
                ? 'They owe you money overall' 
                : 'You owe them money overall'
              }
            </Text>
          </View>

          <View style={styles.balanceCardsContainer}>
            {renderBalanceCard(
              'They Owe You',
              balances.totalOwed,
              Colors.success,
              'arrow-down-circle'
            )}
            {renderBalanceCard(
              'You Owe Them',
              balances.totalOwes,
              Colors.danger,
              'arrow-up-circle'
            )}
          </View>
        </View>

        {/* Payment Methods Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          
          <View style={styles.paymentMethods}>
            {friend.username && (
              <TouchableOpacity style={styles.paymentMethod} onPress={handleVenmoPayment}>
                <View style={styles.paymentMethodIcon}>
                  <Ionicons name="card-outline" size={24} color={Colors.accent} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Venmo</Text>
                  <Text style={styles.paymentMethodDetail}>@{friend.username}</Text>
                </View>
                <Ionicons name="open-outline" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            
            {!friend.username && (
              <View style={styles.noPaymentMethod}>
                <Ionicons name="information-circle-outline" size={24} color={Colors.textSecondary} />
                <Text style={styles.noPaymentMethodText}>No payment method available</Text>
              </View>
            )}
          </View>
        </View>



        {/* Shared Expenses Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared Expenses</Text>
          
          {Object.keys(balances.debtBreakdown).length === 0 ? (
            <View style={styles.noExpensesContainer}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.noExpensesText}>No shared expenses yet</Text>
              <TouchableOpacity 
                style={styles.addExpenseButton}
                onPress={() => navigation.navigate('AddExpense', { 
                  selectedFriends: [friend],
                  fromFriendProfile: true 
                })}
              >
                <Text style={styles.addExpenseButtonText}>Add First Expense</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.expenseList}>
              {Object.entries(balances.debtBreakdown)
                .sort(([,a], [,b]) => (b.date || 0) - (a.date || 0))
                .map(([expenseId, expenseData]) => renderExpenseItem(expenseId, expenseData))
              }
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  section: {
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    ...Shadows.card,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  friendInfo: {
    alignItems: 'center',
  },
  friendDetails: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  friendName: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  venmoUsername: {
    ...Typography.body,
    color: Colors.accent,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },

  netBalanceCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  netBalanceLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  netBalanceAmount: {
    ...Typography.h1,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  netBalanceSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  balanceCardsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 4,
    ...Shadows.card,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  balanceTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  balanceAmount: {
    ...Typography.h3,
    fontWeight: '600',
  },
  paymentMethods: {
    gap: Spacing.sm,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  paymentMethodDetail: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  noPaymentMethods: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: Spacing.md,
  },
  expenseList: {
    gap: Spacing.sm,
  },
  expenseItem: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  expenseTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  expenseAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  expenseAmountText: {
    ...Typography.body,
    fontWeight: '600',
  },
  expenseDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  noExpensesContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  noExpensesText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
  addExpenseButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
  },
  addExpenseButtonText: {
    ...Typography.body,
    color: Colors.surface,
    fontWeight: '600',
  },
  noPaymentMethod: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  noPaymentMethodText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});

export default FriendProfileScreen;
