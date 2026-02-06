import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import expoNotificationService from '../services/expoNotificationService';
import { getCurrentUser } from '../services/authService';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState(null);
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
          await expoNotificationService.initialize(user.uid);
          setExpoPushToken(expoNotificationService.getToken());
          setIsInitialized(true);
          
          // Load user preferences
          const preferences = await expoNotificationService.getUserNotificationPreferences(user.uid);
          setNotificationPreferences(preferences);
        } else {
          setCurrentUser(null);
          setIsInitialized(false);
          setExpoPushToken(null);
          setNotificationPreferences(null);
          // Cleanup listeners when user logs out
          expoNotificationService.cleanupListeners();
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

  // Set up notification listeners
  useEffect(() => {
    if (!isInitialized || !currentUser) return;

    const cleanup = expoNotificationService.setupListeners(
      // Notification received handler
      (notification) => {
        // Increment unread count
        setUnreadCount(prev => prev + 1);
        
        // Show alert for foreground notifications (optional - Expo handles this automatically)
        // You can customize this behavior
      },
      // Notification response handler (when user taps notification)
      (response) => {
        const { notification } = response;
        const data = notification.request.content.data;
        
        // Navigation will be handled by the navigation handler set in App.js
        if (data) {
          expoNotificationService.handleNotificationResponse(data);
        }
      }
    );

    return cleanup;
  }, [isInitialized, currentUser]);

  const updateNotificationPreferences = useCallback(async (preferences) => {
    if (!currentUser) return;
    
    try {
      await expoNotificationService.updateUserNotificationPreferences(currentUser.uid, preferences);
      setNotificationPreferences(preferences);
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      Alert.alert('Error', 'Failed to update notification preferences');
    }
  }, [currentUser]);

  const sendTestNotification = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const result = await expoNotificationService.sendTestNotification(currentUser.uid);
      Alert.alert('Success', result.message || 'Test notification sent!');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  }, [currentUser]);

  const sendNotificationToUser = useCallback(async (targetUserId, title, body, data = {}) => {
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
  }, []);

  const shouldReceiveNotification = useCallback(async (type) => {
    if (!currentUser) return false;
    
    try {
      return await expoNotificationService.shouldReceiveNotification(currentUser.uid, type);
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
      await expoNotificationService.initialize(currentUser.uid);
      setExpoPushToken(expoNotificationService.getToken());
    } catch (error) {
      console.error('Failed to refresh Expo push token:', error);
    }
  }, [currentUser]);

  const checkNotificationPermissions = useCallback(async () => {
    try {
      return await expoNotificationService.areNotificationsEnabled();
    } catch (error) {
      console.error('Failed to check notification permissions:', error);
      return false;
    }
  }, []);

  const value = {
    // State
    isInitialized,
    expoPushToken,
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
    getDefaultPreferences: expoNotificationService.getDefaultPreferences
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
