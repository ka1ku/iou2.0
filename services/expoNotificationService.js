import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getFirestore, doc, updateDoc, getDoc } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

// Configure how notifications are handled
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class ExpoNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.isInitialized = false;
    this.notificationListeners = [];
    this.responseListeners = [];
    this.navigationHandler = null;
  }

  /**
   * Initialize the Expo notification service
   * @param {string} userId - Current user ID
   */
  async initialize(userId) {
    if (this.isInitialized) return;

    try {
      // Request permissions
      const permissionsGranted = await this.requestPermissions();
      
      if (!permissionsGranted) {
        console.warn('Notification permissions not granted');
        return;
      }

      // Get Expo push token
      if (Device.isDevice) {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
        if (!projectId) {
          throw new Error('Project ID not found');
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        
        this.expoPushToken = tokenData.data;
        
        if (this.expoPushToken && userId) {
          await this.updateUserPushToken(userId, this.expoPushToken);
        }

        // Set up Android notification channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        this.isInitialized = true;
        console.log('ExpoNotificationService initialized successfully');
      } else {
        console.warn('Must use physical device for push notifications');
      }
    } catch (error) {
      console.error('Failed to initialize ExpoNotificationService:', error);
      throw error;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * Update user's Expo push token in Firestore
   * @param {string} userId - User ID
   * @param {string} token - Expo push token
   */
  async updateUserPushToken(userId, token) {
    try {
      const firestoreInstance = getFirestore(getApp());
      const userRef = doc(firestoreInstance, 'users', userId);
      
      await updateDoc(userRef, {
        expoPushToken: token,
        lastTokenUpdate: new Date().toISOString()
      });
      
      console.log('Expo push token updated for user:', userId);
    } catch (error) {
      console.error('Failed to update Expo push token:', error);
      throw error;
    }
  }

  /**
   * Get current Expo push token
   */
  getToken() {
    return this.expoPushToken;
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to check notification permissions:', error);
      return false;
    }
  }

  /**
   * Set up notification listeners
   * @param {Function} onNotificationReceived - Callback for received notifications
   * @param {Function} onNotificationResponse - Callback for notification taps
   * @returns {Function} Cleanup function
   */
  setupListeners(onNotificationReceived, onNotificationResponse) {
    // Remove existing listeners
    this.cleanupListeners();

    // Add notification received listener
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      }
    );

    // Add notification response listener (when user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        if (onNotificationResponse) {
          onNotificationResponse(response);
        }
      }
    );

    this.notificationListeners.push(receivedSubscription);
    this.responseListeners.push(responseSubscription);

    // Return cleanup function
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }

  /**
   * Cleanup all listeners
   */
  cleanupListeners() {
    this.notificationListeners.forEach(listener => listener.remove());
    this.responseListeners.forEach(listener => listener.remove());
    this.notificationListeners = [];
    this.responseListeners = [];
  }

  /**
   * Set navigation handler for notification taps
   * @param {Function} handler - Navigation handler function
   */
  setNavigationHandler(handler) {
    this.navigationHandler = handler;
  }

  /**
   * Handle notification response (called when user taps notification)
   * @param {Object} data - Notification data
   */
  handleNotificationResponse(data) {
    if (this.navigationHandler && data) {
      this.navigationHandler(data);
    }
  }

  /**
   * Get user notification preferences
   * @param {string} userId - User ID
   */
  async getUserNotificationPreferences(userId) {
    try {
      const firestoreInstance = getFirestore(getApp());
      const userDoc = await getDoc(doc(firestoreInstance, 'users', userId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.notificationPreferences || this.getDefaultPreferences();
      }
      
      return this.getDefaultPreferences();
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Update user notification preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Notification preferences
   */
  async updateUserNotificationPreferences(userId, preferences) {
    try {
      const firestoreInstance = getFirestore(getApp());
      const userRef = doc(firestoreInstance, 'users', userId);
      
      await updateDoc(userRef, {
        notificationPreferences: preferences,
        preferencesUpdatedAt: new Date().toISOString()
      });
      
      console.log('Notification preferences updated for user:', userId);
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  /**
   * Get default notification preferences
   */
  getDefaultPreferences() {
    return {
      expenses: true,
      friends: true,
      payments: true,
      settlements: true,
      doNotDisturb: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
  }

  /**
   * Check if user should receive notification based on preferences
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   */
  async shouldReceiveNotification(userId, type) {
    try {
      const preferences = await this.getUserNotificationPreferences(userId);
      
      // Check if notification type is enabled
      if (!preferences[type]) {
        return false;
      }
      
      // Check do not disturb
      if (preferences.doNotDisturb.enabled) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startHour, startMin] = preferences.doNotDisturb.start.split(':').map(Number);
        const [endHour, endMin] = preferences.doNotDisturb.end.split(':').map(Number);
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        if (startTime > endTime) {
          // Overnight DND (e.g., 22:00 to 08:00)
          if (currentTime >= startTime || currentTime <= endTime) {
            return false;
          }
        } else {
          // Same day DND
          if (currentTime >= startTime && currentTime <= endTime) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to check notification preferences:', error);
      return true; // Default to allowing notifications on error
    }
  }

  /**
   * Send a test notification (calls Cloud Function)
   * @param {string} userId - Current user ID
   */
  async sendTestNotification(userId) {
    try {
      const { getFunctions, httpsCallable } = require('@react-native-firebase/functions');
      const functions = getFunctions();
      const sendTestNotification = httpsCallable(functions, 'sendExpoTestNotification');
      
      const result = await sendTestNotification();
      return result.data;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new ExpoNotificationService();

