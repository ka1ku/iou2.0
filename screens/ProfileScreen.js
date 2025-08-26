import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { useFocusEffect } from '@react-navigation/native';
import { getCurrentUser, onAuthStateChange, signOutUser } from '../services/authService';
import { getUserExpenses, calculateUserBalances } from '../services/expenseService';
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

  useEffect(() => {
    // Listen for auth state changes and load data when user is available
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      if (user) {
        loadData();
      } else {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Refresh profile data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        // Load user profile from Firestore
        await loadUserProfile(currentUser.uid);
        
        // Load expenses
        const userExpenses = await getUserExpenses(currentUser.uid);
        setExpenses(userExpenses);
        console.log('userExpenses', userExpenses);
        // Calculate balances
        const calculatedBalances = calculateUserBalances(userExpenses, currentUser.uid);
        // console.log('calculatedBalances', calculatedBalances)
        setBalances(calculatedBalances);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      Alert.alert('Error', 'Failed to load profile data: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  const handleSignOut = () => {
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

  const renderExpenseSummary = (expense) => {
    // Calculate user's share of this expense
    let userTotal = 0;
    expense.items?.forEach(item => {
      if (item.splitType === 'even') {
        userTotal += item.amount / expense.participants.length;
      } else if (item.splitType === 'custom') {
        const userSplit = item.splits?.find(split => split.participantIndex === 0);
        userTotal += userSplit?.amount || 0;
      }
    });

    // Determine if this is a receipt or individual expense
    const isReceipt = expense.expenseType === 'receipt';
    const screenName = isReceipt ? 'AddReceipt' : 'AddExpense';
    const iconName = isReceipt ? 'receipt-outline' : 'card-outline';
    const typeLabel = isReceipt ? 'Receipt' : 'Expense';

    return (
      <TouchableOpacity
        key={expense.id}
        style={styles.expenseSummaryCard}
        onPress={() => navigation.navigate('Home', {
            screen: screenName,
            params: { expense }
          })}
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
            <Text style={styles.expenseTypeLabel}>{typeLabel}</Text>
            <Text style={styles.expenseSummaryInfo}>
              Your share: ${userTotal.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.expenseSummaryInfo}>
            {expense.participants?.length || 0} participants
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.sectionTitle}>Your Balance Summary</Text>
        
        <View style={styles.netBalanceCard}>
          <Text style={styles.netBalanceLabel}>Net Balance</Text>
          <Text style={[
            styles.netBalanceAmount,
            { color: balances.netBalance >= 0 ? '#4CAF50' : '#ff4444' }
          ]}>
            {balances.netBalance >= 0 ? '+' : ''}${balances.netBalance.toFixed(2)}
          </Text>
          <Text style={styles.netBalanceSubtext}>
            {balances.netBalance >= 0 
              ? 'You are owed money overall' 
              : 'You owe money overall'
            }
          </Text>
        </View>

        <View style={styles.balanceCardsContainer}>
          {renderBalanceCard(
            'Total Owed to You',
            balances.totalOwed,
            '#4CAF50',
            'arrow-down-circle'
          )}
          {renderBalanceCard(
            'Total You Owe',
            balances.totalOwes,
            '#ff4444',
            'arrow-up-circle'
          )}
        </View>
      </View>

      {/* Debt Breakdown Section */}
      {balances.debtBreakdown && Object.keys(balances.debtBreakdown).length > 0 && (
        <View style={styles.debtSection}>
          <Text style={styles.sectionTitle}>Debt Breakdown</Text>
          <View style={styles.debtList}>
            {Object.entries(balances.debtBreakdown).map(([participantName, amount]) => {
              if (Math.abs(amount) < 0.01) return null; // Skip negligible amounts
              
              return (
                <View key={participantName} style={styles.debtItem}>
                  <View style={styles.debtHeader}>
                    <Ionicons 
                      name={amount > 0 ? "arrow-down-circle" : "arrow-up-circle"} 
                      size={20} 
                      color={amount > 0 ? "#4CAF50" : "#ff4444"} 
                    />
                    <Text style={styles.debtParticipant}>{participantName}</Text>
                  </View>
                  <Text style={[
                    styles.debtAmount,
                    { color: amount > 0 ? "#4CAF50" : "#ff4444" }
                  ]}>
                    {amount > 0 ? 'owes you' : 'you owe'} ${Math.abs(amount).toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.expensesSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
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
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.viewAllButton}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>
        {expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No expenses yet</Text>
            <TouchableOpacity
              style={styles.createExpenseButton}
              onPress={() => navigation.navigate('Home', {
                screen: 'AddExpense'
              })}
            >
              <Text style={styles.createExpenseButtonText}>Create Your First Expense</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.expensesList}>
            {expenses.slice(0, 3).map(renderExpenseSummary)}
          </View>
        )}
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{expenses.length}</Text>
            <Text style={styles.statLabel}>Total Expenses</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {expenses.reduce((sum, exp) => sum + (exp.items?.length || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              ${expenses.reduce((sum, exp) => sum + (exp.total || 0), 0).toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>Total Amount</Text>
          </View>
        </View>
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
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="language-outline" size={24} color={Colors.textSecondary} />
            <Text style={styles.settingText}>Language</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('ComponentDemo')}
          >
            <Ionicons name="cube-outline" size={24} color={Colors.textSecondary} />
            <Text style={styles.settingText}>Component Demo</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

        </View>
      </View>
        </ScrollView>
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
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  netBalanceLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  netBalanceAmount: {
    fontSize: 32,
    fontFamily: Typography.familyBold,
    marginBottom: 4,
  },
  netBalanceSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  balanceCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flex: 1,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    ...Shadows.card,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceTitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  balanceAmount: {
    fontSize: 18,
    fontFamily: Typography.familySemiBold,
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
  },
  debtAmount: {
    ...Typography.body,
    fontFamily: Typography.familySemiBold,
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
});

export default ProfileScreen;
