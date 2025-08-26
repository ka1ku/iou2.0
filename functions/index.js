const functions = require('firebase-functions');
const admin = require('firebase-admin');
const algoliasearch = require('algoliasearch');

admin.initializeApp();

// Initialize Algolia
const algoliaClient = algoliasearch('I0T07P5NB6', 'fb4e3327d2030d4c281cdc6fa64f7984');
const usersIndex = algoliaClient.initIndex('users');

// Firestore trigger to sync users to Algolia
exports.syncUserToAlgolia = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const userData = change.after.exists ? change.after.data() : null;
    
    try {
      if (change.after.exists && userData) {
        // User created or updated - add/update in Algolia (without phone numbers)
        const searchableUser = {
          objectID: userId,
          profilePhoto: userData.profilePhoto || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          username: userData.username || '',
          venmoUsername: userData.venmoUsername || '',
          fullName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
          // Remove phone numbers from index and searchable text
          searchableText: [
            userData.username || '',
            userData.venmoUsername || '',
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
          ].filter(Boolean).join(' ').toLowerCase()
        };
        
        await usersIndex.saveObject(searchableUser);
        console.log(`User ${userId} synced to Algolia (without phone numbers)`);
      } else {
        // User deleted - remove from Algolia
        await usersIndex.deleteObject(userId);
        console.log(`User ${userId} removed from Algolia`);
      }
    } catch (error) {
      console.error(`Error syncing user ${userId} to Algolia:`, error);
      throw error;
    }
  });

// Cloud Function to send test push notification
exports.sendTestNotification = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const userId = context.auth.uid;
    
    // Get user's FCM token from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User profile not found');
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      throw new functions.https.HttpsError('failed-precondition', 'FCM token not found');
    }

    // Send test notification
    const message = {
      notification: {
        title: 'Test Push Notification',
        body: 'This is a test push notification from IOU App! 🎉',
      },
      data: {
        type: 'test_notification',
        timestamp: Date.now().toString(),
        route: 'Profile',
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('Test notification sent successfully:', response);

    return {
      success: true,
      messageId: response,
      message: 'Test push notification sent successfully!'
    };

  } catch (error) {
    console.error('Error sending test notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send test notification');
  }
});

// Cloud Function to send notification to specific user
exports.sendNotificationToUser = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const { targetUserId, title, body, data: notificationData } = data;
    
    if (!targetUserId || !title || !body) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    // Get target user's FCM token
    const userDoc = await admin.firestore().collection('users').doc(targetUserId).get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      throw new functions.https.HttpsError('failed-precondition', 'Target user has no FCM token');
    }

    // Send notification
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...notificationData,
        timestamp: Date.now().toString(),
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('Notification sent successfully:', response);

    return {
      success: true,
      messageId: response,
      message: 'Notification sent successfully!'
    };

  } catch (error) {
    console.error('Error sending notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});
