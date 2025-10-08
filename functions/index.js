const functions = require('firebase-functions');
const admin = require('firebase-admin');
const algoliasearch = require('algoliasearch');

admin.initializeApp();

const algoliaClient = algoliasearch('I0T07P5NB6', 'fb4e3327d2030d4c281cdc6fa64f7984');
const usersIndex = algoliaClient.initIndex('users');

exports.syncUserToAlgolia = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const userData = change.after.exists ? change.after.data() : null;
    
    try {
      if (change.after.exists && userData) {
        const searchableUser = {
          objectID: userId,
          profilePhoto: userData.profilePhoto || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          username: userData.username || '',
          venmoUsername: userData.venmoUsername || '',
          fullName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
          searchableText: [
            userData.username || '',
            userData.venmoUsername || '',
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
          ].filter(Boolean).join(' ').toLowerCase()
        };
        
        await usersIndex.saveObject(searchableUser);
      } else {
        await usersIndex.deleteObject(userId);
      }
    } catch (error) {
      throw error;
    }
  });

exports.sendTestNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const userId = context.auth.uid;
    
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User profile not found');
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      throw new functions.https.HttpsError('failed-precondition', 'FCM token not found');
    }

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

    return {
      success: true,
      messageId: response,
      message: 'Test push notification sent successfully!'
    };

  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to send test notification');
  }
});

exports.sendNotificationToUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const { targetUserId, title, body, data: notificationData } = data;
    
    if (!targetUserId || !title || !body) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const userDoc = await admin.firestore().collection('users').doc(targetUserId).get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      throw new functions.https.HttpsError('failed-precondition', 'Target user has no FCM token');
    }

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

    return {
      success: true,
      messageId: response,
      message: 'Notification sent successfully!'
    };

  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});

// Helper function to send notifications to multiple users
async function sendNotificationsToUsers(userIds, title, body, notificationData = {}) {
  const batch = admin.firestore().batch();
  const messages = [];

  for (const userId of userIds) {
    try {
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;
        
        if (fcmToken) {
          // Check user notification preferences
          const preferences = userData.notificationPreferences || {
            expenses: true,
            friends: true,
            payments: true,
            settlements: true
          };
          
          const notificationType = notificationData.type || 'expenses';
          
          if (preferences[notificationType] !== false) {
            messages.push({
              notification: {
                title,
                body,
              },
              data: {
                ...notificationData,
                timestamp: Date.now().toString(),
              },
              token: fcmToken,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to prepare notification for user ${userId}:`, error);
    }
  }

  if (messages.length > 0) {
    try {
      const response = await admin.messaging().sendAll(messages);
      console.log(`Successfully sent ${response.successCount} notifications`);
      return response;
    } catch (error) {
      console.error('Failed to send batch notifications:', error);
      throw error;
    }
  }
  
  return { successCount: 0, failureCount: 0 };
}

// Trigger: New expense created
exports.onExpenseCreated = functions.firestore
  .document('expenses/{expenseId}')
  .onCreate(async (snap, context) => {
    const expense = snap.data();
    const expenseId = context.params.expenseId;
    
    try {
      // Get creator info
      const creatorDoc = await admin.firestore().collection('users').doc(expense.createdBy).get();
      const creatorData = creatorDoc.data();
      const creatorName = `${creatorData.firstName} ${creatorData.lastName}`.trim();
      
      // Get all participant user IDs (excluding creator)
      const participantIds = Object.keys(expense.participantsMap || {}).filter(id => id !== expense.createdBy);
      
      if (participantIds.length > 0) {
        const title = 'New Expense Added';
        const body = `${creatorName} added a new expense: ${expense.title || 'Untitled'}`;
        
        await sendNotificationsToUsers(participantIds, title, body, {
          type: 'expenses',
          route: 'expense',
          expenseId: expenseId,
          createdBy: expense.createdBy
        });
      }
    } catch (error) {
      console.error('Error in onExpenseCreated:', error);
    }
  });

// Trigger: Expense updated
exports.onExpenseUpdated = functions.firestore
  .document('expenses/{expenseId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const expenseId = context.params.expenseId;
    
    try {
      // Only notify if significant changes occurred
      const significantChanges = [
        'title', 'totalAmount', 'items', 'participantsMap'
      ];
      
      const hasSignificantChange = significantChanges.some(field => {
        return JSON.stringify(before[field]) !== JSON.stringify(after[field]);
      });
      
      if (!hasSignificantChange) return;
      
      // Get updater info
      const updaterDoc = await admin.firestore().collection('users').doc(after.updatedBy || after.createdBy).get();
      const updaterData = updaterDoc.data();
      const updaterName = `${updaterData.firstName} ${updaterData.lastName}`.trim();
      
      // Get all participant user IDs (excluding updater)
      const participantIds = Object.keys(after.participantsMap || {}).filter(id => 
        id !== (after.updatedBy || after.createdBy)
      );
      
      if (participantIds.length > 0) {
        const title = 'Expense Updated';
        const body = `${updaterName} updated the expense: ${after.title || 'Untitled'}`;
        
        await sendNotificationsToUsers(participantIds, title, body, {
          type: 'expenses',
          route: 'expense',
          expenseId: expenseId,
          updatedBy: after.updatedBy || after.createdBy
        });
      }
    } catch (error) {
      console.error('Error in onExpenseUpdated:', error);
    }
  });

// Trigger: Expense settled
exports.onExpenseSettled = functions.firestore
  .document('expenses/{expenseId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const expenseId = context.params.expenseId;
    
    try {
      // Check if expense was just settled
      if (!before.settled && after.settled) {
        // Get all participant user IDs
        const participantIds = Object.keys(after.participantsMap || {});
        
        if (participantIds.length > 0) {
          const title = 'Expense Settled';
          const body = `The expense "${after.title || 'Untitled'}" has been settled!`;
          
          await sendNotificationsToUsers(participantIds, title, body, {
            type: 'settlements',
            route: 'expense',
            expenseId: expenseId
          });
        }
      }
    } catch (error) {
      console.error('Error in onExpenseSettled:', error);
    }
  });

// Trigger: Friend request sent
exports.onFriendRequestSent = functions.firestore
  .document('friendRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    const requestId = context.params.requestId;
    
    try {
      // Get sender info
      const senderDoc = await admin.firestore().collection('users').doc(request.fromUserId).get();
      const senderData = senderDoc.data();
      const senderName = `${senderData.firstName} ${senderData.lastName}`.trim();
      
      // Send notification to recipient
      const title = 'New Friend Request';
      const body = `${senderName} sent you a friend request`;
      
      await sendNotificationsToUsers([request.toUserId], title, body, {
        type: 'friends',
        route: 'friend',
        userId: request.fromUserId,
        requestId: requestId
      });
    } catch (error) {
      console.error('Error in onFriendRequestSent:', error);
    }
  });

// Trigger: Payment request sent
exports.onPaymentRequestSent = functions.firestore
  .document('paymentRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    const requestId = context.params.requestId;
    
    try {
      // Get sender info
      const senderDoc = await admin.firestore().collection('users').doc(request.fromUserId).get();
      const senderData = senderDoc.data();
      const senderName = `${senderData.firstName} ${senderData.lastName}`.trim();
      
      // Send notification to recipient
      const title = 'Payment Request';
      const body = `${senderName} requested $${request.amount} from you`;
      
      await sendNotificationsToUsers([request.toUserId], title, body, {
        type: 'payments',
        route: 'settle',
        requestId: requestId,
        amount: request.amount.toString()
      });
    } catch (error) {
      console.error('Error in onPaymentRequestSent:', error);
    }
  });

// Trigger: User joins expense via join code
exports.onExpenseJoin = functions.firestore
  .document('expenses/{expenseId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const expenseId = context.params.expenseId;
    
    try {
      // Check if someone new joined
      const beforeParticipants = Object.keys(before.participantsMap || {});
      const afterParticipants = Object.keys(after.participantsMap || {});
      
      const newParticipants = afterParticipants.filter(id => !beforeParticipants.includes(id));
      
      if (newParticipants.length > 0) {
        // Get joiner info
        const joinerId = newParticipants[0];
        const joinerDoc = await admin.firestore().collection('users').doc(joinerId).get();
        const joinerData = joinerDoc.data();
        const joinerName = `${joinerData.firstName} ${joinerData.lastName}`.trim();
        
        // Notify all existing participants (excluding the joiner)
        const existingParticipants = beforeParticipants.filter(id => id !== joinerId);
        
        if (existingParticipants.length > 0) {
          const title = 'Someone Joined Your Expense';
          const body = `${joinerName} joined the expense: ${after.title || 'Untitled'}`;
          
          await sendNotificationsToUsers(existingParticipants, title, body, {
            type: 'expenses',
            route: 'expense',
            expenseId: expenseId,
            joinedBy: joinerId
          });
        }
      }
    } catch (error) {
      console.error('Error in onExpenseJoin:', error);
    }
  });
