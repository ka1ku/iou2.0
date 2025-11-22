import React, { useState, useEffect } from 'react';
import { Text, View, Platform, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function sendPushNotification(expoPushToken) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: 'Original Title',
    body: 'And here is the body!',
    data: { someData: 'goes here' },
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      const errorMsg = 'Permission not granted to get push token for push notification!';
      console.error(errorMsg);
      return errorMsg;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      const errorMsg = 'Project ID not found';
      console.error(errorMsg);
      return errorMsg;
    }
    try {
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log('Expo Push Token:', pushTokenString);
      return pushTokenString;
    } catch (e) {
      const errorMsg = `Failed to get push token: ${e}`;
      console.error(errorMsg);
      return errorMsg;
    }
  } else {
    const errorMsg = 'Must use physical device for push notifications';
    console.error(errorMsg);
    return errorMsg;
  }
}

export default function NotificationTestScreen({ navigation }) {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(undefined);

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then(token => {
        if (token && token.startsWith('ExponentPushToken')) {
          setExpoPushToken(token);
        } else {
          setExpoPushToken(token || 'Error: Could not register for notifications');
        }
      })
      .catch((error) => {
        console.error('Registration error:', error);
        setExpoPushToken(`Error: ${error.message || error}`);
      });

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      setNotification(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      const content = response.notification.request.content;
      Alert.alert(
        'Notification Tapped',
        `Title: ${content.title || 'N/A'}\nBody: ${content.body || 'N/A'}\nData: ${JSON.stringify(content.data || {}, null, 2)}`
      );
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Test</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.label}>Expo Push Token:</Text>
          <Text style={[
            styles.tokenText, 
            expoPushToken && expoPushToken.startsWith('ExponentPushToken') 
              ? styles.tokenValid 
              : expoPushToken && expoPushToken.startsWith('Error') 
              ? styles.tokenError 
              : styles.tokenLoading
          ]} selectable>
            {expoPushToken || 'Loading...'}
          </Text>
          {expoPushToken && expoPushToken.startsWith('Error') && (
            <Text style={styles.errorHint}>
              Make sure you're on a physical device and have granted notification permissions.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Last Notification Received</Text>
          <View style={styles.notificationInfo}>
            <Text style={styles.label}>Title:</Text>
            <Text style={styles.value}>{notification?.request?.content?.title || 'None'}</Text>
          </View>
          <View style={styles.notificationInfo}>
            <Text style={styles.label}>Body:</Text>
            <Text style={styles.value}>{notification?.request?.content?.body || 'None'}</Text>
          </View>
          <View style={styles.notificationInfo}>
            <Text style={styles.label}>Data:</Text>
            <Text style={styles.value}>
              {notification?.request?.content?.data 
                ? JSON.stringify(notification.request.content.data, null, 2)
                : 'None'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) && styles.buttonDisabled
          ]}
          onPress={async () => {
            if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
              Alert.alert(
                'Error', 
                'Push token not available. Please wait for it to load or check if you\'re on a physical device with permissions granted.'
              );
              return;
            }
            try {
              await sendPushNotification(expoPushToken);
              Alert.alert('Success', 'Notification sent! You should receive it shortly.');
            } catch (error) {
              Alert.alert('Error', `Failed to send notification: ${error.message}`);
            }
          }}
          disabled={!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')}
        >
          <Ionicons name="notifications" size={24} color={Colors.white} />
          <Text style={styles.buttonText}>Send Test Notification</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            Make sure you're using a physical device. Push notifications don't work on simulators.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
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
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  label: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontFamily: Typography.familyMedium,
  },
  tokenText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  notificationInfo: {
    marginBottom: Spacing.md,
  },
  value: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.white,
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.sm,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...Shadows.card,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  tokenValid: {
    color: Colors.accent,
  },
  tokenError: {
    color: Colors.danger,
  },
  tokenLoading: {
    color: Colors.textSecondary,
  },
  errorHint: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

