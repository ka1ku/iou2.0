import React from 'react';
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
import { signOutUser } from '../services/authService';

const SettingsScreen = ({ navigation }) => {
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
              onPress={() => navigation.navigate('Profile', {
                screen: 'VenmoTest'
              })}
            >
              <Ionicons name="card-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.settingText}>Venmo Test</Text>
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
