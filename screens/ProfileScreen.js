import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import ProfilePicture from '../components/VenmoProfilePicture';
import BalanceSummary from '../components/profiles/BalanceSummary';
import RecentExpenses from '../components/profiles/RecentExpenses';
import { useExpenseData } from '../contexts/ExpenseDataContext';

const ProfileScreen = ({ navigation }) => {
  const [displayedExpensesCount, setDisplayedExpensesCount] = useState(3);
  
  // Use shared expense data
  const { expenses, balances, userProfile, loading } = useExpenseData();

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
          loading={loading}
        />

        <RecentExpenses
          expenses={expenses}
          loading={loading}
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