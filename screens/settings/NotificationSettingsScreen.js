import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import Button from '../../components/Button';
import { useNotifications } from '../../contexts/NotificationContext';

const NotificationSettingsScreen = ({ navigation }) => {
  const {
    notificationPreferences,
    updateNotificationPreferences,
    sendTestNotification,
    isInitialized,
    fcmToken,
    checkNotificationPermissions
  } = useNotifications();

  const [localPreferences, setLocalPreferences] = useState(null);
  const [permissionsEnabled, setPermissionsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (notificationPreferences) {
      setLocalPreferences({ ...notificationPreferences });
    }
  }, [notificationPreferences]);

  useEffect(() => {
    const checkPermissions = async () => {
      const enabled = await checkNotificationPermissions();
      setPermissionsEnabled(enabled);
    };
    checkPermissions();
  }, [checkNotificationPermissions]);

  const handlePreferenceChange = (key, value) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleDoNotDisturbChange = (key, value) => {
    setLocalPreferences(prev => ({
      ...prev,
      doNotDisturb: {
        ...prev.doNotDisturb,
        [key]: value
      }
    }));
  };

  const savePreferences = async () => {
    if (!localPreferences) return;
    
    setIsLoading(true);
    try {
      await updateNotificationPreferences(localPreferences);
      Alert.alert('Success', 'Notification preferences updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await sendTestNotification();
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const getStatusText = () => {
    if (!isInitialized) return 'Initializing...';
    if (!fcmToken) return 'No FCM token available';
    if (!permissionsEnabled) return 'Permissions not granted';
    return 'Notifications enabled';
  };

  const getStatusColor = () => {
    if (!isInitialized || !fcmToken || !permissionsEnabled) return Colors.danger;
    return Colors.success;
  };

  if (!localPreferences) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading preferences...</Text>
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
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Status Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.settingsList}>
            <View style={styles.statusItem}>
              <Ionicons 
                name={permissionsEnabled && fcmToken ? "notifications" : "notifications-off"} 
                size={24} 
                color={getStatusColor()} 
              />
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>Notification Status</Text>
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {getStatusText()}
                </Text>
                {fcmToken && (
                  <Text style={styles.tokenText}>
                    Token: {fcmToken.substring(0, 20)}...
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Notification Types */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <Ionicons name="receipt-outline" size={24} color={Colors.textSecondary} />
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Expenses</Text>
                <Text style={styles.settingDescription}>
                  New expenses, updates, and settlements
                </Text>
              </View>
              <Switch
                value={localPreferences.expenses}
                onValueChange={(value) => handlePreferenceChange('expenses', value)}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={localPreferences.expenses ? Colors.surface : Colors.textSecondary}
              />
            </View>

            <View style={styles.settingItem}>
              <Ionicons name="people-outline" size={24} color={Colors.textSecondary} />
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Friends</Text>
                <Text style={styles.settingDescription}>
                  Friend requests and friend activity
                </Text>
              </View>
              <Switch
                value={localPreferences.friends}
                onValueChange={(value) => handlePreferenceChange('friends', value)}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={localPreferences.friends ? Colors.surface : Colors.textSecondary}
              />
            </View>

            <View style={styles.settingItem}>
              <Ionicons name="card-outline" size={24} color={Colors.textSecondary} />
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Payments</Text>
                <Text style={styles.settingDescription}>
                  Payment requests and reminders
                </Text>
              </View>
              <Switch
                value={localPreferences.payments}
                onValueChange={(value) => handlePreferenceChange('payments', value)}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={localPreferences.payments ? Colors.surface : Colors.textSecondary}
              />
            </View>

            <View style={styles.settingItem}>
              <Ionicons name="checkmark-circle-outline" size={24} color={Colors.textSecondary} />
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Settlements</Text>
                <Text style={styles.settingDescription}>
                  When expenses are settled or paid
                </Text>
              </View>
              <Switch
                value={localPreferences.settlements}
                onValueChange={(value) => handlePreferenceChange('settlements', value)}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={localPreferences.settlements ? Colors.surface : Colors.textSecondary}
              />
            </View>
          </View>
        </View>

        {/* Do Not Disturb */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Do Not Disturb</Text>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <Ionicons name="moon-outline" size={24} color={Colors.textSecondary} />
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Enable Do Not Disturb</Text>
                <Text style={styles.settingDescription}>
                  Silence notifications during specified hours
                </Text>
              </View>
              <Switch
                value={localPreferences.doNotDisturb.enabled}
                onValueChange={(value) => handleDoNotDisturbChange('enabled', value)}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={localPreferences.doNotDisturb.enabled ? Colors.surface : Colors.textSecondary}
              />
            </View>

            {localPreferences.doNotDisturb.enabled && (
              <>
                <View style={styles.settingItem}>
                  <Ionicons name="time-outline" size={24} color={Colors.textSecondary} />
                  <View style={styles.settingContent}>
                    <Text style={styles.settingText}>Start Time</Text>
                    <Text style={styles.settingDescription}>
                      {localPreferences.doNotDisturb.start}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.timeButton}>
                    <Text style={styles.timeText}>{localPreferences.doNotDisturb.start}</Text>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.settingItem}>
                  <Ionicons name="time-outline" size={24} color={Colors.textSecondary} />
                  <View style={styles.settingContent}>
                    <Text style={styles.settingText}>End Time</Text>
                    <Text style={styles.settingDescription}>
                      {localPreferences.doNotDisturb.end}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.timeButton}>
                    <Text style={styles.timeText}>{localPreferences.doNotDisturb.end}</Text>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Test Notification */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Test Notifications</Text>
          <View style={styles.settingsList}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleTestNotification}
              disabled={!permissionsEnabled || !fcmToken}
            >
              <Ionicons name="send-outline" size={24} color={Colors.textSecondary} />
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Send Test Notification</Text>
                <Text style={styles.settingDescription}>
                  Verify your settings are working correctly
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveSection}>
          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={savePreferences}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.saveButtonText}>Saving...</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color={Colors.accent} />
                <Text style={styles.saveButtonText}>Save Preferences</Text>
              </>
            )}
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
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  settingDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  settingContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  statusInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  statusTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  tokenText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeText: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginRight: Spacing.xs,
  },
  saveSection: {
    margin: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  saveButton: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    ...Shadows.card,
  },
  saveButtonText: {
    ...Typography.body,
    color: Colors.accent,
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.sm,
  },
});

export default NotificationSettingsScreen;