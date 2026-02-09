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
import LoadingSpinner from '../../components/LoadingSpinner';

import { useTranslation } from '../../contexts/LanguageContext';

const ConnectedAccountsScreen = ({ navigation }) => {
  const { t } = useTranslation();
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
          description: t('settings.connectedAccounts.venmo.description')
        });
      } else {
        accounts.push({
          id: 'venmo',
          name: t('settings.connectedAccounts.venmo.name'),
          username: null,
          connected: false,
          icon: 'card-outline',
          description: t('settings.connectedAccounts.venmo.description')
        });
      }

      // Placeholder for future integrations
      accounts.push({
        id: 'paypal',
        name: t('settings.connectedAccounts.paypal.name'),
        username: null,
        connected: false,
        icon: 'wallet-outline',
        description: t('settings.connectedAccounts.paypal.description')
      });

      accounts.push({
        id: 'zelle',
        name: t('settings.connectedAccounts.zelle.name'),
        username: null,
        connected: false,
        icon: 'flash-outline',
        description: t('settings.connectedAccounts.zelle.description')
      });

      setConnectedAccounts(accounts);
    }
  }, [userProfile]);

  const handleConnectAccount = (accountId) => {
    if (accountId === 'venmo') {
      Alert.alert(
        t('settings.connectedAccounts.venmo.connectTitle'),
        t('settings.connectedAccounts.venmo.connectMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.connectedAccounts.venmo.goToSignUp'),
            onPress: () => {
              // TODO: Navigate to sign up with Venmo
              Alert.alert(t('settings.connectedAccounts.soon'), t('settings.connectedAccounts.venmo.reconnectionSoon'));
            }
          }
        ]
      );
    } else {
      Alert.alert(t('settings.connectedAccounts.soon'), t('settings.connectedAccounts.integrationSoon', { name: accountId }));
    }
  };

  const handleDisconnectAccount = (accountId) => {
    Alert.alert(
      t('settings.connectedAccounts.disconnectAlert.title'),
      t('settings.connectedAccounts.disconnectAlert.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.connectedAccounts.disconnectAlert.confirm'),
          style: 'destructive',
          onPress: () => {
            // TODO: Implement disconnect functionality
            Alert.alert(t('settings.connectedAccounts.soon'), t('settings.connectedAccounts.disconnectAlert.soon'));
          }
        }
      ]
    );
  };

  const getAccountStatusColor = (connected) => {
    return connected ? Colors.success : Colors.textSecondary;
  };

  const getAccountStatusText = (connected) => {
    return connected ? t('settings.connectedAccounts.connected') : t('settings.connectedAccounts.notConnected');
  };

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>{t('settings.connectedAccounts.loading')}</Text>
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
        <Text style={styles.headerTitle}>{t('settings.connectedAccounts.title')}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>{t('settings.connectedAccounts.sectionTitle')}</Text>
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
                      {account.connected ? t('settings.connectedAccounts.disconnect') : t('settings.connectedAccounts.connect')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>{t('settings.connectedAccounts.aboutTitle')}</Text>
          <View style={styles.settingsList}>
            <View style={styles.infoItem}>
              <Ionicons name="information-circle-outline" size={24} color={Colors.accent} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>{t('settings.connectedAccounts.info.secureTitle')}</Text>
                <Text style={styles.infoDescription}>
                  {t('settings.connectedAccounts.info.secureDesc')}
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark-outline" size={24} color={Colors.accent} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>{t('settings.connectedAccounts.info.easyTitle')}</Text>
                <Text style={styles.infoDescription}>
                  {t('settings.connectedAccounts.info.easyDesc')}
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
