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
import { getCurrentUser, reportUser, blockUser } from '../services/authService';
import { useExpenseData } from '../contexts/ExpenseDataContext';
import { calculateSettlement } from '../utils/settlementCalculator';
import { useTranslation } from '../contexts/LanguageContext';

const FriendProfileScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { friend: initialFriend, userId, friendId } = route.params || {};
  const [friendProfile, setFriendProfile] = useState(initialFriend || null);
  const [friendBalances, setFriendBalances] = useState({
    totalOwed: 0,
    totalOwes: 0,
    netBalance: 0,
    debtBreakdown: {}
  });
  const [loading, setLoading] = useState(true);
  
  const { expenses } = useExpenseData();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const currentUser = getCurrentUser();
        if (!currentUser) return;

        // Determine the target friend ID
        const targetFriendId = initialFriend?.friendId || initialFriend?.userId || userId || friendId;
        
        if (!targetFriendId) {
          Alert.alert(t('common.error'), 'No friend information found');
          navigation.goBack();
          return;
        }

        // If we only have an ID but no profile, try to find it in participants
        if (!friendProfile) {
          let foundFriend = null;
          for (const expense of expenses) {
            const participant = expense.participants?.find(p => p.userId === targetFriendId || p.friendId === targetFriendId);
            if (participant) {
              foundFriend = {
                firstName: participant.firstName,
                lastName: participant.lastName,
                name: participant.name,
                username: participant.username,
                profilePhoto: participant.profilePhoto,
                friendId: targetFriendId,
                userId: targetFriendId
              };
              break;
            }
          }
          
          if (foundFriend) {
            setFriendProfile(foundFriend);
          } else {
             // Basic fallback if we can't find them
             setFriendProfile({ friendId: targetFriendId, name: 'Friend' });
          }
        }

        const calculatedBalances = calculateFriendBalances(expenses, currentUser.uid, targetFriendId);
        setFriendBalances(calculatedBalances);
      } catch (error) {
        Alert.alert(t('common.error'), 'Failed to load friend data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [initialFriend, userId, friendId, expenses]);

  const calculateFriendBalances = (userExpenses, currentUserId, friendId) => {
    let totalOwed = 0;
    let totalOwes = 0;
    const debtBreakdown = {};

    userExpenses.forEach(expense => {
      // Skip expenses that don't involve this friend
      const friendParticipant = expense.participants?.find(p =>
        p.userId === friendId || p.id === friendId || p.friendId === friendId
      );
      const currentUserParticipant = expense.participants?.find(p =>
        p.userId === currentUserId || p.id === currentUserId
      );

      if (!friendParticipant || !currentUserParticipant) return;

      // Use existing settlements if available, otherwise calculate
      let settlements = [];
      if (expense.settlements && expense.settlements.length > 0) {
        settlements = expense.settlements;
      } else {
        // Use shared calculator
        try {
          const result = calculateSettlement(expense);
          settlements = result.settlements || [];
        } catch (error) {
          return;
        }
      }

      // Find settlement between current user and friend
      const currentUserName = currentUserParticipant.name;
      const friendName = friendParticipant.name;

      let netAmount = 0;

      settlements.forEach(settlement => {
        const debtor = settlement.debtor || settlement.from;
        const creditor = settlement.creditor || settlement.to;
        const status = settlement.status || 'noAction';

        // Skip already paid settlements
        if (status === 'markedAsPaid' || status === 'confirmed') return;

        // Current user owes friend
        if (debtor === currentUserName && creditor === friendName) {
          netAmount -= settlement.amount;
        }
        // Friend owes current user
        else if (debtor === friendName && creditor === currentUserName) {
          netAmount += settlement.amount;
        }
      });

      // Aggregate totals
      if (netAmount > 0) {
        totalOwed += netAmount;
      } else if (netAmount < 0) {
        totalOwes += Math.abs(netAmount);
      }

      // Record breakdown for this expense
      if (netAmount !== 0) {
        debtBreakdown[expense.id] = {
          title: expense.title,
          amount: netAmount,
          date: expense.createdAt,
          type: netAmount > 0 ? 'owes_you' : 'you_owe'
        };
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
    if (friendProfile.username) {
      const venmoUrl = `https://venmo.com/${friendProfile.username}`;
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
            {expenseData.type === 'owes_you' ? t('friendProfile.owesYou') : t('friendProfile.youOwe')} ${Math.abs(expenseData.amount).toFixed(2)}
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
          <Text style={styles.loadingText}>{t('friendProfile.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleReportUser = () => {
    Alert.prompt(
      'Report User',
      'Please tell us why you are reporting this user.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: async (reason) => {
            if (!reason || reason.trim().length === 0) {
              Alert.alert('Error', 'Please provide a reason for reporting.');
              return;
            }
            try {
              await reportUser(friendProfile.friendId || friendProfile.userId, 'user_report', reason);
              Alert.alert(t('friendProfile.reportSuccess'), t('friendProfile.reportSuccessDesc'));
            } catch (error) {
              Alert.alert(t('common.error'), 'Failed to send report. Please try again.');
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const handleBlockUser = () => {
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? You will no longer see their content or be able to interact with them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(friendProfile.friendId || friendProfile.userId);
              Alert.alert(t('friendProfile.blockSuccess'), t('friendProfile.blockSuccessDesc'), [
                { text: "OK", onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              Alert.alert(t('common.error'), 'Failed to block user. Please try again.');
            }
          }
        }
      ]
    );
  };

  const showOptions = () => {
    Alert.alert(
      t('friendProfile.options'),
      'Choose an action',
      [
        { text: t('friendProfile.report'), onPress: handleReportUser },
        { text: t('friendProfile.block'), onPress: handleBlockUser, style: 'destructive' },
        { text: t('common.cancel'), style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('friendProfile.title')}</Text>
        <TouchableOpacity style={styles.optionsButton} onPress={showOptions}>
          <Ionicons name="ellipsis-horizontal" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.friendInfo}>
            <ProfilePicture
              source={friendProfile.profilePhoto}
              size={80}
              username={friendProfile.username || friendProfile.name}
            />
            <View style={styles.friendDetails}>
              <Text style={styles.friendName}>
                {friendProfile.firstName && friendProfile.lastName 
                  ? `${friendProfile.firstName} ${friendProfile.lastName}`
                  : friendProfile.name
                }
              </Text>
              {friendProfile.username && (
                <Text style={styles.venmoUsername}>@{friendProfile.username}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('friendProfile.balanceSummary')}</Text>
          
          <View style={styles.netBalanceCard}>
            <Text style={styles.netBalanceLabel}>{t('friendProfile.netBalance')}</Text>
            <Text style={[
              styles.netBalanceAmount,
              { color: friendBalances.netBalance >= 0 ? Colors.success : Colors.danger }
            ]}>
              {friendBalances.netBalance >= 0 ? '+' : '-'}${Math.abs(friendBalances.netBalance).toFixed(2)}
            </Text>
            <Text style={styles.netBalanceSubtext}>
              {friendBalances.netBalance >= 0 
                ? t('friendProfile.theyOweYouOverall') 
                : t('friendProfile.youOweThemOverall')
              }
            </Text>
          </View>

          <View style={styles.balanceCardsContainer}>
            {renderBalanceCard(
              t('friendProfile.theyOweYou'),
              friendBalances.totalOwed,
              Colors.success,
              'arrow-down-circle'
            )}
            {renderBalanceCard(
              t('friendProfile.youOweThem'),
              friendBalances.totalOwes,
              Colors.danger,
              'arrow-up-circle'
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('friendProfile.paymentMethods')}</Text>
          
          <View style={styles.paymentMethods}>
            {friendProfile.username && (
              <TouchableOpacity style={styles.paymentMethod} onPress={handleVenmoPayment}>
                <View style={styles.paymentMethodIcon}>
                  <Ionicons name="card-outline" size={24} color={Colors.accent} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Venmo</Text>
                  <Text style={styles.paymentMethodDetail}>@{friendProfile.username}</Text>
                </View>
                <Ionicons name="open-outline" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            
            {!friendProfile.username && (
              <View style={styles.noPaymentMethod}>
                <Ionicons name="information-circle-outline" size={24} color={Colors.textSecondary} />
                <Text style={styles.noPaymentMethodText}>{t('friendProfile.noPaymentMethod')}</Text>
              </View>
            )}
          </View>
        </View>



        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('friendProfile.sharedExpenses')}</Text>
          
          {Object.keys(friendBalances.debtBreakdown).length === 0 ? (
            <View style={styles.noExpensesContainer}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.noExpensesText}>{t('friendProfile.noSharedExpenses')}</Text>
              <TouchableOpacity 
                style={styles.addExpenseButton}
                onPress={() => navigation.navigate('AddExpense', { 
                  selectedFriends: [friendProfile],
                  fromFriendProfile: true 
                })}
              >
                <Text style={styles.addExpenseButtonText}>{t('friendProfile.addFirstExpense')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.expenseList}>
              {Object.entries(friendBalances.debtBreakdown)
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
  optionsButton: {
    padding: Spacing.sm,
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
