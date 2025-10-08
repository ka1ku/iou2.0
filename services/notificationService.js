import { getApp } from '@react-native-firebase/app';
import messaging, { 
  getMessaging, 
  requestPermission, 
  hasPermission, 
  getToken, 
  onMessage, 
  setBackgroundMessageHandler, 
  onNotificationOpenedApp, 
  getInitialNotification,
  onTokenRefresh,
  registerDeviceForRemoteMessages
} from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { getFirestore, doc, updateDoc, getDoc } from '@react-native-firebase/firestore';

class NotificationService {
  constructor() {
    this.fcmToken = null;
    this.isInitialized = false;
    this.messageHandlers = [];
    this.messaging = null;
  }

  // Initialize messaging instance
  getMessaging() {
    if (!this.messaging) {
      const app = getApp();
      this.messaging = getMessaging(app);
    }
    return this.messaging;
  }

  /**
   * Initialize the notification service
   * @param {string} userId - Current user ID
   */
  async initialize(userId) {
    if (this.isInitialized) return;

    try {
      // Request permissions (this may fail on simulator - that's okay)
      const permissionsGranted = await this.requestPermissions();
      
      if (permissionsGranted) {
        // Get FCM token - this may fail on simulator or without proper iOS configuration
        try {
          await this.getFCMToken(userId);
        } catch (tokenError) {
          console.warn('Could not get FCM token. This is normal on iOS simulator or if push notifications are not configured in Xcode');
          // Continue initialization even without token for development
        }
      } else {
        console.warn('Notification permissions not granted - notifications will be disabled');
      }
      
      // Set up message handlers (these work even without permissions)
      this.setupMessageHandlers();
      
      this.isInitialized = true;
      console.log('NotificationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error);
      // Don't throw - allow app to continue without notifications
      console.warn('App will continue without push notifications');
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions() {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('Android notification permission denied');
          return false;
        }
      }

      const messagingInstance = this.getMessaging();
      const authStatus = await requestPermission(messagingInstance);
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('iOS notification permission denied');
        return false;
      }

      return enabled;
    } catch (error) {
      console.warn('Failed to request notification permissions:', error.message);
      return false;
    }
  }

  /**
   * Get and store FCM token
   * @param {string} userId - Current user ID
   */
  async getFCMToken(userId) {
    try {
      // Register device for remote messages (required for iOS)
      const messaging = this.getMessaging();
      try {
        await registerDeviceForRemoteMessages(messaging);
      } catch (registerError) {
        // This might fail if already registered, which is fine
        console.log('Device registration note:', registerError.message);
      }
      
      this.fcmToken = await getToken(messaging);
      
      if (this.fcmToken && userId) {
        await this.updateUserFCMToken(userId, this.fcmToken);
      }

      // Listen for token refresh
      onTokenRefresh(messaging, async (newToken) => {
        this.fcmToken = newToken;
        if (userId) {
          await this.updateUserFCMToken(userId, newToken);
        }
      });

      return this.fcmToken;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      throw error;
    }
  }

  /**
   * Update user's FCM token in Firestore
   * @param {string} userId - User ID
   * @param {string} token - FCM token
   */
  async updateUserFCMToken(userId, token) {
    try {
      const firestoreInstance = getFirestore(getApp());
      const userRef = doc(firestoreInstance, 'users', userId);
      
      await updateDoc(userRef, {
        fcmToken: token,
        lastTokenUpdate: new Date().toISOString()
      });
      
      console.log('FCM token updated for user:', userId);
    } catch (error) {
      console.error('Failed to update FCM token:', error);
    }
  }

  /**
   * Set up message handlers for foreground and background
   */
  setupMessageHandlers() {
    try {
      const messaging = this.getMessaging();
      
      // Handle foreground messages
      const unsubscribeForeground = onMessage(messaging, async (remoteMessage) => {
        console.log('Foreground message received:', remoteMessage);
        
        // Notify all registered handlers
        this.messageHandlers.forEach(handler => {
          try {
            handler(remoteMessage);
          } catch (error) {
            console.error('Error in message handler:', error);
          }
        });
      });

      // Handle background messages
      setBackgroundMessageHandler(messaging, async (remoteMessage) => {
        console.log('Background message received:', remoteMessage);
        // Background messages are handled automatically by the system
      });

      // Handle notification tap when app is in background/quit
      onNotificationOpenedApp(messaging, remoteMessage => {
        console.log('Notification opened app:', remoteMessage);
        this.handleNotificationTap(remoteMessage);
      });

      // Handle notification tap when app is quit
      getInitialNotification(messaging)
        .then(remoteMessage => {
          if (remoteMessage) {
            console.log('Notification opened app from quit state:', remoteMessage);
            this.handleNotificationTap(remoteMessage);
          }
        });

      return unsubscribeForeground;
    } catch (error) {
      console.warn('Failed to setup message handlers:', error.message);
      return () => {}; // Return empty function
    }
  }

  /**
   * Handle notification tap
   * @param {Object} remoteMessage - The notification message
   */
  handleNotificationTap(remoteMessage) {
    const { data } = remoteMessage;
    
    if (data && data.route) {
      // Notify handlers about navigation
      this.messageHandlers.forEach(handler => {
        try {
          handler({ ...remoteMessage, type: 'navigation' });
        } catch (error) {
          console.error('Error in navigation handler:', error);
        }
      });
    }
  }

  /**
   * Register a message handler
   * @param {Function} handler - Function to handle messages
   * @returns {Function} Unsubscribe function
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
    
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Get current FCM token
   */
  getToken() {
    return this.fcmToken;
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled() {
    const messagingInstance = this.getMessaging();
    const authStatus = await hasPermission(messagingInstance);
    return authStatus === messaging.AuthorizationStatus.AUTHORIZED;
  }

  /**
   * Send a test notification (calls Cloud Function)
   * @param {string} userId - Current user ID
   */
  async sendTestNotification(userId) {
    try {
      const { getFunctions, httpsCallable } = require('@react-native-firebase/functions');
      const functions = getFunctions();
      const sendTestNotification = httpsCallable(functions, 'sendTestNotification');
      
      const result = await sendTestNotification();
      return result.data;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to specific user (calls Cloud Function)
   * @param {string} targetUserId - Target user ID
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {Object} data - Additional data
   */
  async sendNotificationToUser(targetUserId, title, body, data = {}) {
    try {
      const { getFunctions, httpsCallable } = require('@react-native-firebase/functions');
      const functions = getFunctions();
      const sendNotificationToUser = httpsCallable(functions, 'sendNotificationToUser');
      
      const result = await sendNotificationToUser({
        targetUserId,
        title,
        body,
        data
      });
      
      return result.data;
    } catch (error) {
      console.error('Failed to send notification to user:', error);
      throw error;
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
}

// Export singleton instance
export default new NotificationService();
