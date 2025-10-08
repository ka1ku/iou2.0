import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import { useExpenseData } from '../../contexts/ExpenseDataContext';

const ConnectedAccountsScreen = ({ navigation }) => {
  const { userProfile } = useExpenseData();
  
  const [connectedAccounts, setConnectedAccounts] = useState([]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (userProfile) {
      const accounts = [];
      
      // Venmo account
      if (userProfile.venmoUsername) {
        accounts.push({
          id: 'venmo',
          name: 'Venmo',
          username: userProfile.venmoUsername,
          connected: true,
          icon: 'card-outline',
          description: 'For payments and settlements'
        });
      } else {
        accounts.push({
          id: 'venmo',
          name: 'Venmo',
          username: null,
          connected: false,
          icon: 'card-outline',
          description: 'For payments and settlements'
        });
      }

      // Placeholder for future integrations
      accounts.push({
        id: 'paypal',
        name: 'PayPal',
        username: null,
        connected: false,
        icon: 'wallet-outline',
        description: 'Coming soon'
      });

      accounts.push({
        id: 'zelle',
        name: 'Zelle',
        username: null,
        connected: false,
        icon: 'flash-outline',
        description: 'Coming soon'
      });

      setConnectedAccounts(accounts);
    }
  }, [userProfile]);

  const handleConnectAccount = (accountId) => {
    if (accountId === 'venmo') {
      Alert.alert(
        'Connect Venmo',
        'To connect your Venmo account, please sign up or sign in again with your Venmo information.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Sign Up',
            onPress: () => {
              // TODO: Navigate to sign up with Venmo
              Alert.alert('Coming Soon', 'Venmo reconnection will be available soon.');
            }
          }
        ]
      );
    } else {
      Alert.alert('Coming Soon', `${accountId} integration will be available soon.`);
    }
  };

  const handleDisconnectAccount = (accountId) => {
    Alert.alert(
      'Disconnect Account',
      'Are you sure you want to disconnect this account? You may lose access to some features.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement disconnect functionality
            Alert.alert('Coming Soon', 'Account disconnection will be available soon.');
          }
        }
      ]
    );
  };

  const getAccountStatusColor = (connected) => {
    return connected ? Colors.success : Colors.textSecondary;
  };

  const getAccountStatusText = (connected) => {
    return connected ? 'Connected' : 'Not Connected';
  };

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading accounts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connected Accounts</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Payment Accounts</Text>
          <View style={styles.settingsList}>
            {connectedAccounts.map((account, index) => (
              <View key={account.id} style={styles.accountItem}>
                <View style={styles.accountInfo}>
                  <View style={styles.accountIconContainer}>
                    <Ionicons 
                      name={account.icon} 
                      size={24} 
                      color={getAccountStatusColor(account.connected)} 
                    />
                  </View>
                  <View style={styles.accountDetails}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountDescription}>
                      {account.description}
                    </Text>
                    {account.username && (
                      <Text style={styles.accountUsername}>
                        @{account.username}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.accountActions}>
                  <View style={styles.statusContainer}>
                    <View 
                      style={[
                        styles.statusDot, 
                        { backgroundColor: getAccountStatusColor(account.connected) }
                      ]} 
                    />
                    <Text style={[
                      styles.statusText, 
                      { color: getAccountStatusColor(account.connected) }
                    ]}>
                      {getAccountStatusText(account.connected)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      account.connected ? styles.disconnectButton : styles.connectButton
                    ]}
                    onPress={() => 
                      account.connected 
                        ? handleDisconnectAccount(account.id)
                        : handleConnectAccount(account.id)
                    }
                  >
                    <Text style={[
                      styles.actionButtonText,
                      account.connected ? styles.disconnectButtonText : styles.connectButtonText
                    ]}>
                      {account.connected ? 'Disconnect' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Information Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>About Connected Accounts</Text>
          <View style={styles.settingsList}>
            <View style={styles.infoItem}>
              <Ionicons name="information-circle-outline" size={24} color={Colors.accent} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Secure & Private</Text>
                <Text style={styles.infoDescription}>
                  Your payment information is securely stored and never shared with other users.
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark-outline" size={24} color={Colors.accent} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Easy Settlements</Text>
                <Text style={styles.infoDescription}>
                  Connected accounts make it easy to send and receive payments for shared expenses.
                </Text>
              </View>
            </View>
          </View>
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
    paddingBottom: 100,
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
    width: 40,
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
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    marginBottom: Spacing.xs,
  },
  accountDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  accountUsername: {
    ...Typography.caption,
    color: Colors.accent,
    fontFamily: Typography.familySemiBold,
  },
  accountActions: {
    alignItems: 'flex-end',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  statusText: {
    ...Typography.caption,
    fontFamily: Typography.familySemiBold,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  connectButton: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  disconnectButton: {
    backgroundColor: Colors.surface,
    borderColor: Colors.danger,
  },
  actionButtonText: {
    ...Typography.caption,
    fontFamily: Typography.familySemiBold,
  },
  connectButtonText: {
    color: Colors.surface,
  },
  disconnectButtonText: {
    color: Colors.danger,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  infoContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  infoTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    marginBottom: Spacing.xs,
  },
  infoDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});

export default ConnectedAccountsScreen;
