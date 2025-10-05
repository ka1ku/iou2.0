import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { useFocusEffect } from '@react-navigation/native';
import { getCurrentUser, onAuthStateChange } from '../services/authService';
import { getUserExpenses, calculateUserBalances } from '../services/expenseService';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import ProfilePicture from '../components/VenmoProfilePicture';
import BalanceSummary from '../components/profiles/BalanceSummary';
import RecentExpenses from '../components/profiles/RecentExpenses';

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({
    totalOwed: 0,
    totalOwes: 0,
    netBalance: 0,
    debtBreakdown: {}
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [displayedExpensesCount, setDisplayedExpensesCount] = useState(3);

  useEffect(() => {
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

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadData();
      }
    }, [user])
  );

  const loadData = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        setExpensesLoading(true);
        
        await loadUserProfile(currentUser.uid);
        
        const userExpenses = await getUserExpenses(currentUser.uid);
        setExpenses(userExpenses);
        
        const calculatedBalances = calculateUserBalances(userExpenses, currentUser.uid);
        setBalances(calculatedBalances);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      Alert.alert('Error', 'Failed to load profile data: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setExpensesLoading(false);
    }
  }, []);

  const loadUserProfile = async (userId) => {
    try {
      const firestoreInstance = getFirestore(getApp());
      const userDoc = await getDoc(doc(firestoreInstance, 'users', userId));
      
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
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

  const loadMoreExpenses = useCallback(() => {
    if (displayedExpensesCount < expenses.length) {
      setDisplayedExpensesCount(prev => Math.min(prev + 5, expenses.length));
    }
  }, [displayedExpensesCount, expenses.length]);

  const handleExpensePress = useCallback((screenName, expense = null) => {
    if (expense) {
      navigation.navigate(screenName, { expense });
    } else {
      navigation.navigate(screenName);
    }
  }, [navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.container}>
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
          <TouchableOpacity 
            onPress={() => navigation.navigate('Settings')} 
            style={styles.settingsButton}
          >
            <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <BalanceSummary 
          balances={balances}
          loading={expensesLoading}
        />

        <RecentExpenses
          expenses={expenses}
          loading={expensesLoading}
          displayedExpensesCount={displayedExpensesCount}
          onLoadMore={loadMoreExpenses}
          onExpensePress={handleExpensePress}
          userProfile={userProfile}
        />
      </View>
    </ScrollView>
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
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: Colors.surface,
    paddingTop: 60,
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
  settingsButton: {
    padding: 8,
    position: 'absolute',
    top: 60,
    right: Spacing.xl,
  },
});

export default ProfileScreen;