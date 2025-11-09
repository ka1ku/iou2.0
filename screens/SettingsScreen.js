import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { signOutUser, getCurrentUser } from '../services/authService';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { useExpenseData } from '../contexts/ExpenseDataContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ChangeVenmoBottomSheet from '../components/ChangeVenmoBottomSheet';

const SettingsScreen = ({ navigation }) => {
  const { userProfile } = useExpenseData();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFunction, setLoadingFunction] = useState(null);
  const changeVenmoBottomSheetRef = useRef(null);

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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and will delete all your expenses and data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement delete account functionality
            Alert.alert('Coming Soon', 'Account deletion feature will be available soon.');
          }
        }
      ]
    );
  };

  const handleTermsOfService = () => {
    navigation.navigate('Profile', {
      screen: 'TermsOfService'
    });
  };

  const handleHelpSupport = () => {
    Linking.openURL('mailto:support@your-app.com?subject=IOU App Support');
  };

  const handleRateApp = () => {
    const url = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/id123456789' 
      : 'https://play.google.com/store/apps/details?id=com.yourapp.iou';
    Linking.openURL(url);
  };

  // Firebase Functions handlers
  const handleSendTestNotification = async () => {
    setIsLoading(true);
    setLoadingFunction('testNotification');
    try {
      const functions = getFunctions();
      const sendTestNotification = httpsCallable(functions, 'sendTestNotification');
      const result = await sendTestNotification();
      Alert.alert('Success', result.data.message || 'Test notification sent successfully!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      const errorMessage = error.message || error.details || 'Failed to send test notification';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingFunction(null);
    }
  };

  const createSyntheticDataWithCount = async (userCount) => {
    setIsLoading(true);
    setLoadingFunction('createSynthetic');
    try {
      const functions = getFunctions();
      const createSyntheticData = httpsCallable(functions, 'createSyntheticData');
      const result = await createSyntheticData({ numUsers: userCount });
      Alert.alert(
        'Success',
        `Successfully created ${result.data.usersCreated} users and ${result.data.expensesCreated} expenses!`
      );
    } catch (error) {
      console.error('Error creating synthetic data:', error);
      const errorMessage = error.message || error.details || 'Failed to create synthetic data';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingFunction(null);
    }
  };

  const handleCreateSyntheticData = () => {
    Alert.alert(
      'Create Synthetic Data',
      'Select the number of synthetic users to create:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '10 users',
          onPress: () => createSyntheticDataWithCount(10)
        },
        {
          text: '25 users',
          onPress: () => createSyntheticDataWithCount(25)
        },
        {
          text: '50 users',
          onPress: () => createSyntheticDataWithCount(50)
        },
        {
          text: '100 users',
          onPress: () => createSyntheticDataWithCount(100)
        }
      ]
    );
  };

  const handleDeleteSyntheticData = () => {
    Alert.alert(
      'Delete Synthetic Data',
      'Are you sure you want to delete all synthetic users and expenses? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            setLoadingFunction('deleteSynthetic');
            try {
              const functions = getFunctions();
              const deleteSyntheticData = httpsCallable(functions, 'deleteSyntheticData');
              const result = await deleteSyntheticData();
              Alert.alert(
                'Success',
                `Successfully deleted ${result.data.usersDeleted} users and ${result.data.expensesDeleted} expenses!`
              );
            } catch (error) {
              console.error('Error deleting synthetic data:', error);
              const errorMessage = error.message || error.details || 'Failed to delete synthetic data';
              Alert.alert('Error', errorMessage);
            } finally {
              setIsLoading(false);
              setLoadingFunction(null);
            }
          }
        }
      ]
    );
  };

  const handleUpdateUserInExpenses = async () => {
    const user = getCurrentUser();
    if (!user || !userProfile) {
      Alert.alert('Error', 'User profile not found');
      return;
    }

    Alert.alert(
      'Update User in Expenses',
      'This will update your name and profile information across all your expenses. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setIsLoading(true);
            setLoadingFunction('updateUser');
            try {
              const functions = getFunctions();
              const updateUserInExpenses = httpsCallable(functions, 'updateUserInExpenses');
              const result = await updateUserInExpenses({
                userId: user.uid,
                firstName: userProfile.firstName,
                lastName: userProfile.lastName,
                username: userProfile.username,
                profilePhoto: userProfile.profilePhoto
              });
              Alert.alert('Success', result.data.message || 'User information updated in all expenses!');
            } catch (error) {
              console.error('Error updating user in expenses:', error);
              const errorMessage = error.message || error.details || 'Failed to update user in expenses';
              Alert.alert('Error', errorMessage);
            } finally {
              setIsLoading(false);
              setLoadingFunction(null);
            }
          }
        }
      ]
    );
  };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsList}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => navigation.navigate('Profile', {
                screen: 'ProfileSettings'
              })}
            >
              <Ionicons name="person-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Profile Settings</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => navigation.navigate('Profile', {
                screen: 'ConnectedAccounts'
              })}
            >
              <Ionicons name="link-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Connected Accounts</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
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
              onPress={() => changeVenmoBottomSheetRef.current?.open()}
            >
              <Ionicons name="card-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Change Venmo</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>


        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.settingsList}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleTermsOfService}
            >
              <Ionicons name="document-text-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleHelpSupport}
            >
              <Ionicons name="help-circle-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleRateApp}
            >
              <Ionicons name="star-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Rate the App</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Developer Tools</Text>
          <View style={styles.settingsList}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleSendTestNotification}
              disabled={isLoading}
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Send Test Notification</Text>
              {isLoading && loadingFunction === 'testNotification' ? (
                <LoadingSpinner size="small" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleUpdateUserInExpenses}
              disabled={isLoading}
            >
              <Ionicons name="sync-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Update User in Expenses</Text>
              {isLoading && loadingFunction === 'updateUser' ? (
                <LoadingSpinner size="small" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleCreateSyntheticData}
              disabled={isLoading}
            >
              <Ionicons name="add-circle-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Create Synthetic Data</Text>
              {isLoading && loadingFunction === 'createSynthetic' ? (
                <LoadingSpinner size="small" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleDeleteSyntheticData}
              disabled={isLoading}
            >
              <Ionicons name="trash-outline" size={24} color={Colors.danger} />
              <Text style={[styles.settingText, { color: Colors.danger }]}>Delete Synthetic Data</Text>
              {isLoading && loadingFunction === 'deleteSynthetic' ? (
                <LoadingSpinner size="small" color={Colors.danger} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color={Colors.danger} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={24} color={Colors.danger} />
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <ChangeVenmoBottomSheet ref={changeVenmoBottomSheetRef} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for home bar area
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  placeholder: {
    width: 40, // Same width as back button to center the title
  },
  settingsSection: {
    margin: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
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
  logoutSection: {
    margin: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  logoutButton: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.danger,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  logoutText: {
    ...Typography.body,
    color: Colors.danger,
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.sm,
  },
  deleteButton: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.danger,
    ...Shadows.card,
  },
  deleteText: {
    ...Typography.body,
    color: Colors.danger,
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.sm,
  },
});

export default SettingsScreen;
