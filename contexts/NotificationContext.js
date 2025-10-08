import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import notificationService from '../services/notificationService';
import { getCurrentUser } from '../services/authService';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [notificationPreferences, setNotificationPreferences] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  // Initialize notification service when user changes
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        const user = getCurrentUser();
        if (user) {
          setCurrentUser(user);
          await notificationService.initialize(user.uid);
          setFcmToken(notificationService.getToken());
          setIsInitialized(true);
          
          // Load user preferences
          const preferences = await notificationService.getUserNotificationPreferences(user.uid);
          setNotificationPreferences(preferences);
        } else {
          setCurrentUser(null);
          setIsInitialized(false);
          setFcmToken(null);
          setNotificationPreferences(null);
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
        // Don't show alert - just log and continue
        // Notifications will be disabled but app continues to work
        console.warn('App will continue without push notifications enabled');
      }
    };

    initializeNotifications();
  }, []);

  // Set up message handlers
  useEffect(() => {
    if (!isInitialized) return;

    const unsubscribe = notificationService.onMessage((message) => {
      if (message.type === 'navigation') {
        // Handle navigation from notification tap
        handleNotificationNavigation(message);
      } else {
        // Handle foreground message
        handleForegroundMessage(message);
      }
    });

    return unsubscribe;
  }, [isInitialized]);

  const handleNotificationNavigation = useCallback((message) => {
    const { data } = message;
    
    if (data && data.route) {
      // This will be handled by the navigation system
      // The actual navigation logic will be implemented in App.js
      console.log('Navigation requested:', data.route, data);
    }
  }, []);

  const handleForegroundMessage = useCallback((message) => {
    const { notification, data } = message;
    
    // Show alert for foreground messages
    if (notification) {
      Alert.alert(
        notification.title || 'New Notification',
        notification.body || 'You have a new notification',
        [
          { text: 'Dismiss', style: 'cancel' },
          { 
            text: 'View', 
            onPress: () => handleNotificationNavigation(message)
          }
        ]
      );
    }
    
    // Increment unread count
    setUnreadCount(prev => prev + 1);
  }, []);

  const updateNotificationPreferences = useCallback(async (preferences) => {
    if (!currentUser) return;
    
    try {
      await notificationService.updateUserNotificationPreferences(currentUser.uid, preferences);
      setNotificationPreferences(preferences);
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      Alert.alert('Error', 'Failed to update notification preferences');
    }
  }, [currentUser]);

  const sendTestNotification = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const result = await notificationService.sendTestNotification(currentUser.uid);
      Alert.alert('Success', result.message || 'Test notification sent!');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  }, [currentUser]);

  const sendNotificationToUser = useCallback(async (targetUserId, title, body, data = {}) => {
    try {
      const result = await notificationService.sendNotificationToUser(targetUserId, title, body, data);
      return result;
    } catch (error) {
      console.error('Failed to send notification to user:', error);
      throw error;
    }
  }, []);

  const shouldReceiveNotification = useCallback(async (type) => {
    if (!currentUser) return false;
    
    try {
      return await notificationService.shouldReceiveNotification(currentUser.uid, type);
    } catch (error) {
      console.error('Failed to check notification preferences:', error);
      return true; // Default to allowing notifications on error
    }
  }, [currentUser]);

  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const refreshToken = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const newToken = await notificationService.getFCMToken(currentUser.uid);
      setFcmToken(newToken);
    } catch (error) {
      console.error('Failed to refresh FCM token:', error);
    }
  }, [currentUser]);

  const checkNotificationPermissions = useCallback(async () => {
    try {
      return await notificationService.areNotificationsEnabled();
    } catch (error) {
      console.error('Failed to check notification permissions:', error);
      return false;
    }
  }, []);

  const value = {
    // State
    isInitialized,
    fcmToken,
    notificationPreferences,
    unreadCount,
    currentUser,
    
    // Actions
    updateNotificationPreferences,
    sendTestNotification,
    sendNotificationToUser,
    shouldReceiveNotification,
    clearUnreadCount,
    refreshToken,
    checkNotificationPermissions,
    
    // Default preferences
    getDefaultPreferences: notificationService.getDefaultPreferences
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
