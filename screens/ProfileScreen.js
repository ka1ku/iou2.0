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
import LoadingSpinner from '../components/LoadingSpinner';
import { useTranslation } from '../contexts/LanguageContext';

const ProfileScreen = ({ navigation }) => {
  const { t } = useTranslation();
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
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>{t('profile.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <ProfilePicture
              source={userProfile?.profilePhoto}
              size={52}
              username={userProfile?.username || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`}
              showFallback
            />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'User'}
            </Text>
            <Text style={styles.userEmail}>
              {userProfile?.username ? `@${userProfile.username}` : t('profile.noUsername')}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Settings')} 
          style={styles.settingsButton}
        >
          <Ionicons name="menu-outline" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
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
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.avatar,
  },
  profileInfo: {
    marginLeft: Spacing.md,
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    ...Typography.h3,
    fontSize: 19,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  settingsButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
});

export default ProfileScreen;