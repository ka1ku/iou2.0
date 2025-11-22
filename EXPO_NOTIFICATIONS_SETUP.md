# Expo Notifications Setup

This document describes the Expo push notifications implementation for the IOU app.

## Overview

The app now uses Expo Push Notifications instead of Firebase Cloud Messaging (FCM). This provides a simpler, more reliable notification system that works seamlessly with Expo.

## Architecture

### Frontend (React Native)

1. **ExpoNotificationService** (`services/expoNotificationService.js`)
   - Handles Expo push token registration
   - Manages notification permissions
   - Sets up notification listeners
   - Stores push tokens in Firestore

2. **NotificationContext** (`contexts/NotificationContext.js`)
   - Provides notification state and methods to components
   - Manages notification preferences
   - Handles notification received events

3. **App.js**
   - Sets up notification navigation handlers
   - Routes users to appropriate screens when notifications are tapped

### Backend (Firebase Cloud Functions)

1. **Expo Push Notification API**
   - Uses Expo's push notification service at `https://exp.host/--/api/v2/push/send`
   - Sends notifications to users based on their Expo push tokens

2. **Firestore Triggers**
   - `onExpenseCreated` - Notifies participants when a new expense is created
   - `onExpenseUpdated` - Notifies participants when an expense is updated
   - `onExpenseSettled` - Notifies participants when an expense is settled
   - `onExpenseJoin` - Notifies existing participants when someone joins an expense
   - `onFriendRequestSent` - Notifies users when they receive a friend request
   - `onPaymentRequestSent` - Notifies users when they receive a payment request

## User Document Schema

Users now have the following notification-related fields in Firestore:

```javascript
{
  expoPushToken: "ExponentPushToken[...]", // Expo push token
  lastTokenUpdate: "2024-01-01T00:00:00.000Z", // ISO timestamp
  notificationPreferences: {
    expenses: true,
    friends: true,
    payments: true,
    settlements: true,
    doNotDisturb: {
      enabled: false,
      start: "22:00",
      end: "08:00"
    }
  },
  preferencesUpdatedAt: "2024-01-01T00:00:00.000Z" // ISO timestamp
}
```

## Notification Types

### 1. Expense Notifications
- **New Expense**: Sent to all participants when an expense is created
- **Expense Updated**: Sent to participants when an expense is modified
- **Expense Joined**: Sent to existing participants when someone joins via join code
- **Expense Settled**: Sent to all participants when an expense is marked as settled

### 2. Friend Notifications
- **Friend Request**: Sent when a user receives a friend request

### 3. Payment Notifications
- **Payment Request**: Sent when a user receives a payment request

## Notification Data Structure

Notifications include the following data payload:

```javascript
{
  type: "expenses" | "friends" | "payments" | "settlements",
  route: "expense" | "friend" | "settle" | "profile" | "home",
  expenseId: "..." // If route is "expense"
  userId: "..." // If route is "friend"
  // ... other relevant data
}
```

## Deployment

### 1. Deploy Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

### 2. Update App

The app will automatically:
- Register for Expo push tokens on startup
- Store tokens in Firestore
- Listen for notifications
- Handle notification taps for navigation

## Testing

### Test Notifications

1. Navigate to **Settings > Developer Tools > Test Notifications**
2. The screen will show your Expo push token
3. Tap "Send Test Notification" to send a test notification

### Test Backend Functions

You can test the Cloud Functions using the Firebase Console or by calling them directly:

```javascript
// Test notification function
const functions = getFunctions();
const sendExpoTestNotification = httpsCallable(functions, 'sendExpoTestNotification');
await sendExpoTestNotification();
```

## Notification Preferences

Users can control notification preferences through the notification settings. Preferences include:

- **Expenses**: Enable/disable expense-related notifications
- **Friends**: Enable/disable friend request notifications
- **Payments**: Enable/disable payment request notifications
- **Settlements**: Enable/disable settlement notifications
- **Do Not Disturb**: Set quiet hours for notifications

## Troubleshooting

### Push Token Not Loading

- Ensure you're on a physical device (not simulator)
- Check that notification permissions are granted
- Verify EAS project ID is configured in `app.json`

### Notifications Not Received

- Check that the user's `expoPushToken` is stored in Firestore
- Verify notification preferences allow the notification type
- Check Do Not Disturb settings
- Review Cloud Functions logs for errors

### Navigation Not Working

- Ensure notification data includes `route` field
- Check that the navigation handler is set up in App.js
- Verify the target screen exists in the navigation stack

## Migration from FCM

The old FCM-based notification system has been replaced. The following changes were made:

1. **Removed**: Firebase Cloud Messaging dependencies
2. **Added**: Expo Notifications service
3. **Updated**: Cloud Functions to use Expo Push Notification API
4. **Updated**: User documents to store `expoPushToken` instead of `fcmToken`

Legacy FCM functions are kept for backwards compatibility but redirect to Expo functions.

## Future Enhancements

- Notification history/archive
- Rich notifications with images
- Notification grouping
- Custom notification sounds
- Notification actions (quick reply, etc.)



