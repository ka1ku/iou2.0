const functions = require('firebase-functions');
const admin = require('firebase-admin');
const algoliasearch = require('algoliasearch');

admin.initializeApp();

// Expo Push Notification API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const algoliaClient = algoliasearch('I0T07P5NB6', 'fb4e3327d2030d4c281cdc6fa64f7984');
const usersIndex = algoliaClient.initIndex('users');
const expensesIndex = algoliaClient.initIndex('expenses');

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

// Trigger: Update user information in all expenses when profile changes
exports.onUserProfileUpdate = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const userId = context.params.userId;
    const before = change.before.data();
    const after = change.after.data();
    
    try {
      // Check if firstName, lastName, or username changed
      const firstNameChanged = before.firstName !== after.firstName;
      const lastNameChanged = before.lastName !== after.lastName;
      const usernameChanged = before.username !== after.username;
      const profilePhotoChanged = before.profilePhoto !== after.profilePhoto;
      
      // Only proceed if relevant fields changed
      if (!firstNameChanged && !lastNameChanged && !usernameChanged && !profilePhotoChanged) {
        return null;
      }
      
      // Prepare updated user data
      const updatedName = `${after.firstName || ''} ${after.lastName || ''}`.trim();
      const updatedUsername = after.username || '';
      const updatedProfilePhoto = after.profilePhoto || null;
      
      // Query all expenses where this user is a participant
      const db = admin.firestore();
      const expensesQuery = db.collection('expenses').where('participantIds', 'array-contains', userId);
      const expensesSnapshot = await expensesQuery.get();
      
      if (expensesSnapshot.empty) {
        return null;
      }
      
      
      // Batch write updates (Firestore allows up to 500 operations per batch)
      const batchSize = 500;
      const expenses = expensesSnapshot.docs;
      
      for (let i = 0; i < expenses.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = expenses.slice(i, i + batchSize);
        
        for (const expenseDoc of batchDocs) {
          const expenseData = expenseDoc.data();
          const participants = expenseData.participants || [];
          
          // Find and update the participant data for this user
          const updatedParticipants = participants.map(participant => {
            if (participant.userId === userId) {
              const updatedParticipant = { ...participant };
              
              // Update name if firstName or lastName changed
              if (firstNameChanged || lastNameChanged) {
                updatedParticipant.name = updatedName || participant.name;
              }
              
              // Update username if it changed
              if (usernameChanged) {
                updatedParticipant.username = updatedUsername || participant.username;
              }
              
              // Update profilePhoto if it changed
              if (profilePhotoChanged) {
                updatedParticipant.profilePhoto = updatedProfilePhoto || participant.profilePhoto;
              }
              
              return updatedParticipant;
            }
            return participant;
          });
          
          // Only update if the participant was found and updated
          const participantFound = participants.some(p => p.userId === userId);
          if (participantFound) {
            batch.update(expenseDoc.ref, {
              participants: updatedParticipants,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
        
        // Commit this batch
        await batch.commit();
      }
      
      return null;
    } catch (error) {
      console.error(`Error updating user info in expenses for user ${userId}:`, error);
      // Don't throw error to avoid retrying the entire function
      // The error is logged for monitoring
      return null;
    }
  });

exports.syncExpenseToAlgolia = functions.firestore
  .document('expenses/{expenseId}')
  .onWrite(async (change, context) => {
    const expenseId = context.params.expenseId;
    const expenseData = change.after.exists ? change.after.data() : null;
    
    try {
      if (change.after.exists && expenseData) {
        // Extract searchable fields
        const title = expenseData.title || '';
        const expenseType = expenseData.expenseType || '';
        
        // Extract participant names and usernames
        const participantNames = (expenseData.participants || []).map(p => p.name || '').filter(Boolean);
        const participantUsernames = (expenseData.participants || []).map(p => p.username || '').filter(Boolean);
        
        // Extract item names
        const itemNames = (expenseData.items || []).map(item => item.name || '').filter(Boolean);
        
        // Create searchable text combining all searchable fields
        const searchableText = [
          title,
          expenseType,
          ...participantNames,
          ...participantUsernames,
          ...itemNames
        ].filter(Boolean).join(' ').toLowerCase();
        
        // Get timestamps for sorting
        let createdAt = 0;
        let updatedAt = 0;
        
        if (expenseData.createdAt) {
          if (expenseData.createdAt.toMillis) {
            createdAt = expenseData.createdAt.toMillis();
          } else if (expenseData.createdAt.seconds) {
            createdAt = expenseData.createdAt.seconds * 1000;
          } else if (expenseData.createdAt instanceof Date) {
            createdAt = expenseData.createdAt.getTime();
          }
        }
        
        if (expenseData.updatedAt) {
          if (expenseData.updatedAt.toMillis) {
            updatedAt = expenseData.updatedAt.toMillis();
          } else if (expenseData.updatedAt.seconds) {
            updatedAt = expenseData.updatedAt.seconds * 1000;
          } else if (expenseData.updatedAt instanceof Date) {
            updatedAt = expenseData.updatedAt.getTime();
          }
        }
        
        const searchableExpense = {
          objectID: expenseId,
          title: title,
          expenseType: expenseType,
          participantIds: expenseData.participantIds || [],
          participantNames: participantNames,
          participantUsernames: participantUsernames,
          itemNames: itemNames,
          searchableText: searchableText,
          createdBy: expenseData.createdBy || '',
          createdAt: createdAt,
          updatedAt: updatedAt,
          settled: expenseData.settled || false,
          // Include full expense data for retrieval (or minimal fields)
          total: expenseData.total || 0,
        };
        
        await expensesIndex.saveObject(searchableExpense);
      } else {
        await expensesIndex.deleteObject(expenseId);
      }
    } catch (error) {
      console.error('Error syncing expense to Algolia:', error);
      throw error;
    }
  });

// Helper function to send Expo push notifications
async function sendExpoPushNotification(pushToken, title, body, data = {}) {
  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: {
        ...data,
        timestamp: Date.now().toString(),
      },
      badge: 1,
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (result.data && result.data.status === 'ok') {
      return { success: true, id: result.data.id };
    } else {
      console.error('Expo push notification failed:', result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error('Error sending Expo push notification:', error);
    return { success: false, error: error.message };
  }
}

// Send Expo test notification
exports.sendExpoTestNotification = functions.https.onCall(async (data, context) => {
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
    const expoPushToken = userData.expoPushToken;

    if (!expoPushToken) {
      throw new functions.https.HttpsError('failed-precondition', 'Expo push token not found');
    }

    const result = await sendExpoPushNotification(
      expoPushToken,
      'Test Push Notification',
      'This is a test push notification from IOU App! 🎉',
      {
        type: 'test_notification',
        route: 'Profile',
      }
    );

    if (result.success) {
      return {
        success: true,
        messageId: result.id,
        message: 'Test push notification sent successfully!'
      };
    } else {
      throw new functions.https.HttpsError('internal', 'Failed to send notification: ' + (result.error || 'Unknown error'));
    }

  } catch (error) {
    console.error('Error sending test notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send test notification: ' + error.message);
  }
});

// Legacy FCM test notification (kept for backwards compatibility)
exports.sendTestNotification = functions.https.onCall(async (data, context) => {
  // Redirect to Expo test notification
  return exports.sendExpoTestNotification(data, context);
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
    const expoPushToken = userData.expoPushToken;

    if (!expoPushToken) {
      throw new functions.https.HttpsError('failed-precondition', 'Target user has no Expo push token');
    }

    const result = await sendExpoPushNotification(
      expoPushToken,
      title,
      body,
      notificationData || {}
    );

    if (result.success) {
      return {
        success: true,
        messageId: result.id,
        message: 'Notification sent successfully!'
      };
    } else {
      throw new functions.https.HttpsError('internal', 'Failed to send notification: ' + (result.error || 'Unknown error'));
    }

  } catch (error) {
    console.error('Error sending notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification: ' + error.message);
  }
});

// Helper function to send notifications to multiple users
async function sendNotificationsToUsers(userIds, title, body, notificationData = {}) {
  const notifications = [];
  const db = admin.firestore();

  for (const userId of userIds) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const expoPushToken = userData.expoPushToken;
        
        if (expoPushToken) {
          // Check user notification preferences
          const preferences = userData.notificationPreferences || {
            expenses: true,
            payments: true,
            settlements: true
          };
          
          const notificationType = notificationData.type || 'expenses';
          
          // Check if user wants to receive this type of notification
          if (preferences[notificationType] !== false) {
            // Check do not disturb
            let shouldSend = true;
            if (preferences.doNotDisturb && preferences.doNotDisturb.enabled) {
              const now = new Date();
              const currentTime = now.getHours() * 60 + now.getMinutes();
              
              const [startHour, startMin] = preferences.doNotDisturb.start.split(':').map(Number);
              const [endHour, endMin] = preferences.doNotDisturb.end.split(':').map(Number);
              
              const startTime = startHour * 60 + startMin;
              const endTime = endHour * 60 + endMin;
              
              if (startTime > endTime) {
                // Overnight DND
                if (currentTime >= startTime || currentTime <= endTime) {
                  shouldSend = false;
                }
              } else {
                // Same day DND
                if (currentTime >= startTime && currentTime <= endTime) {
                  shouldSend = false;
                }
              }
            }
            
            if (shouldSend) {
              notifications.push({
                token: expoPushToken,
                title,
                body,
                data: notificationData
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to prepare notification for user ${userId}:`, error);
    }
  }

  if (notifications.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  // Send notifications in batches (Expo recommends batching)
  const batchSize = 100;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize);
    
    try {
      // Send batch to Expo
      const messages = batch.map(notif => ({
        to: notif.token,
        sound: 'default',
        title: notif.title,
        body: notif.body,
        data: {
          ...notif.data,
          timestamp: Date.now().toString(),
        },
        badge: 1,
      }));

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      
      if (Array.isArray(result.data)) {
        result.data.forEach((item, index) => {
          if (item.status === 'ok') {
            successCount++;
          } else {
            failureCount++;
            console.error(`Failed to send notification ${i + index}:`, item);
          }
        });
      } else if (result.data && result.data.status === 'ok') {
        successCount += batch.length;
      } else {
        failureCount += batch.length;
        console.error('Batch notification failed:', result);
      }
    } catch (error) {
      console.error('Error sending batch notifications:', error);
      failureCount += batch.length;
    }
  }

  return { successCount, failureCount };
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
      const participantIds = (expense.participantIds || []).filter(id => id !== expense.createdBy);
      
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
        'title', 'totalAmount', 'items', 'participantIds'
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
      const participantIds = (after.participantIds || []).filter(id => 
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
        // Get all participant user IDs (excluding the person who settled it)
        const settledBy = after.settledBy || after.updatedBy || after.createdBy;
        const participantIds = (after.participantIds || []).filter(id => id !== settledBy);
        
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
      const beforeParticipants = before.participantIds || [];
      const afterParticipants = after.participantIds || [];
      
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

// Generate synthetic users and expenses for testing
exports.createSyntheticData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const { numUsers = 10 } = data;
    
    if (numUsers < 1 || numUsers > 100) {
      throw new functions.https.HttpsError('invalid-argument', 'numUsers must be between 1 and 100');
    }

    const db = admin.firestore();
    
    // Arrays of random names
    const firstNames = [
      'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
      'Blake', 'Cameron', 'Dakota', 'Drew', 'Ellis', 'Finley', 'Harper', 'Hayden',
      'Jamie', 'Kai', 'Logan', 'Marley', 'Noah', 'Parker', 'Phoenix', 'Reese',
      'Rowan', 'Sage', 'Skyler', 'Tyler', 'Aiden', 'Emma', 'Olivia', 'Liam',
      'Noah', 'Ava', 'Isabella', 'Sophia', 'Mason', 'James', 'William', 'Benjamin',
      'Lucas', 'Henry', 'Alexander', 'Michael', 'Daniel', 'Matthew', 'Jackson', 'Sebastian',
      'David', 'Joseph', 'Emily', 'Madison', 'Charlotte', 'Amelia', 'Harper', 'Evelyn',
      'Abigail', 'Mia', 'Elizabeth', 'Sofia', 'Avery', 'Ella', 'Scarlett', 'Grace'
    ];
    
    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
      'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Sanchez',
      'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
      'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams',
      'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
      'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards',
      'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers'
    ];

    // Helper function to generate random name
    const getRandomName = () => {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      return { firstName, lastName };
    };

    // Helper function to generate random profile photo URL
    const generateProfilePhoto = (firstName, lastName) => {
      const name = `${firstName} ${lastName}`;
      const colors = ['3d95ce', 'f39c12', 'e74c3c', '9b59b6', '1abc9c', '3498db', 'e67e22', '16a085'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=${color}&color=fff&bold=true&font-size=0.4`;
    };

    // Helper function to generate random phone number
    const generatePhoneNumber = () => {
      // Generate a valid US phone number format: +1XXXXXXXXXX
      // Area code: 200-999 (not starting with 0 or 1)
      const areaCodeFirst = Math.floor(Math.random() * 8) + 2; // 2-9
      const areaCodeSecond = Math.floor(Math.random() * 10); // 0-9
      const areaCodeThird = Math.floor(Math.random() * 10); // 0-9
      const areaCode = `${areaCodeFirst}${areaCodeSecond}${areaCodeThird}`;
      
      // Exchange: 200-999 (first digit 2-9, avoid ending in 11)
      const exchangeFirst = Math.floor(Math.random() * 8) + 2; // 2-9
      const exchangeSecond = Math.floor(Math.random() * 10); // 0-9
      let exchangeThird = Math.floor(Math.random() * 10); // 0-9
      // Avoid exchange ending in 11
      if (exchangeSecond === 1 && exchangeThird === 1) {
        exchangeThird = (exchangeThird + 1) % 10;
      }
      const exchange = `${exchangeFirst}${exchangeSecond}${exchangeThird}`;
      
      // Last 4 digits
      const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `+1${areaCode}${exchange}${number}`;
    };

    // Helper function to generate join code
    const generateJoinCode = () => {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let result = '';
      for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Helper function to generate invite token
    const generateInviteToken = () => Math.random().toString(36).slice(2, 12);

    // Create synthetic users
    const userIds = [];
    const userData = [];
    let userBatch = db.batch();
    let batchCount = 0;
    const maxBatchSize = 500; // Firestore batch limit
    const baseTimestamp = Date.now();

    for (let i = 0; i < numUsers; i++) {
      const { firstName, lastName } = getRandomName();
      const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
      const venmoUsername = `@${username}`;
      const profilePhoto = generateProfilePhoto(firstName, lastName);
      const phoneNumber = generatePhoneNumber();

      // Create auth user with unique email
      const authUser = await admin.auth().createUser({
        email: `synthetic_${baseTimestamp}_${i}_${Math.random().toString(36).slice(2, 8)}@synthetic.io`,
        password: Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15) + 'A1!',
        phoneNumber: phoneNumber,
        displayName: `${firstName} ${lastName}`,
        disabled: false
      });

      const userId = authUser.uid;
      userIds.push(userId);

      // Create user document
      const userDoc = {
        firstName,
        lastName,
        username,
        phoneNumber,
        venmoUsername,
        profilePhoto,
        phoneVerified: true,
        accountStatus: 'active',
        synthetic: true, // Mark as synthetic for easy deletion
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      userData.push({
        userId,
        ...userDoc
      });

      const userRef = db.collection('users').doc(userId);
      userBatch.set(userRef, userDoc);
      batchCount++;

      // Commit batch if we've reached the limit
      if (batchCount >= maxBatchSize) {
        await userBatch.commit();
        userBatch = db.batch();
        batchCount = 0;
      }
    }

    // Commit any remaining users
    if (batchCount > 0) {
      await userBatch.commit();
    }
    

    // Create synthetic expenses
    const expenseTitles = [
      'Dinner at Restaurant', 'Uber Ride', 'Grocery Shopping', 'Movie Tickets',
      'Coffee Meeting', 'Concert Tickets', 'Hotel Room', 'Gas Fill Up',
      'Brunch', 'Bar Tab', 'Airbnb', 'Group Activity', 'Team Lunch',
      'Weekend Trip', 'Shopping Spree', 'Food Delivery', 'Concert', 'Festival',
      'Sports Event', 'Night Out', 'Rent Split', 'Utilities', 'Internet Bill'
    ];

    const itemNames = [
      'Burger', 'Pizza', 'Salad', 'Pasta', 'Sushi', 'Tacos', 'Steak', 'Chicken',
      'Soup', 'Sandwich', 'Fries', 'Drink', 'Appetizer', 'Dessert', 'Coffee',
      'Beer', 'Wine', 'Cocktail', 'Ticket', 'Room', 'Gas', 'Grocery Item'
    ];

    const expensesCreated = [];
    const numExpenses = Math.floor(numUsers * 1.5); // Create 1.5x expenses per user

    for (let i = 0; i < numExpenses; i++) {
      const expenseBatch = db.batch();
      
      // Select random participants (2-5 users)
      const numParticipants = Math.min(Math.floor(Math.random() * 4) + 2, userIds.length);
      const shuffledUsers = [...userIds].sort(() => Math.random() - 0.5);
      const expenseParticipants = shuffledUsers.slice(0, numParticipants);
      const creatorId = expenseParticipants[0];

      // Create participants array
      const participants = expenseParticipants.map(userId => {
        const user = userData.find(u => u.userId === userId);
        return {
          name: `${user.firstName} ${user.lastName}`,
          userId: userId,
          phoneNumber: user.phoneNumber,
          username: user.username,
          profilePhoto: user.profilePhoto,
          placeholder: false
        };
      });

      // Create participantIds array for efficient array-contains queries
      const participantIds = [...expenseParticipants];

      // Create items (1-4 items)
      const numItems = Math.floor(Math.random() * 4) + 1;
      const items = [];
      let totalAmount = 0;

      for (let j = 0; j < numItems; j++) {
        const itemName = itemNames[Math.floor(Math.random() * itemNames.length)];
        const itemAmount = Math.round((Math.random() * 100 + 5) * 100) / 100; // $5-$105
        totalAmount += itemAmount;

        // Random consumers (at least 1, up to all participants)
        const numConsumers = Math.floor(Math.random() * participants.length) + 1;
        const selectedConsumers = [];
        for (let k = 0; k < numConsumers; k++) {
          selectedConsumers.push(k);
        }

        // Random payers (at least 1)
        const numPayers = Math.floor(Math.random() * participants.length) + 1;
        const selectedPayers = [];
        for (let k = 0; k < numPayers; k++) {
          selectedPayers.push(k);
        }

        // Calculate splits (equal split for simplicity)
        const splits = selectedConsumers.map(() => 
          Math.round((itemAmount / selectedConsumers.length) * 100) / 100
        );

        items.push({
          id: `${baseTimestamp}_${i}_${j}`,
          name: itemName,
          amount: itemAmount,
          selectedConsumers,
          selectedPayers,
          splits
        });
      }

      // Create expense document
      const expenseTitle = expenseTitles[Math.floor(Math.random() * expenseTitles.length)];
      const expense = {
        title: expenseTitle,
        total: Math.round(totalAmount * 100) / 100,
        expenseType: 'expense',
        createdBy: creatorId,
        participants,
        participantIds,
        items,
        fees: [],
        join: {
          enabled: true,
          code: generateJoinCode(),
          token: generateInviteToken(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        synthetic: true, // Mark as synthetic for easy deletion
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        settled: false
      };

      const expenseRef = db.collection('expenses').doc();
      expenseBatch.set(expenseRef, expense);
      await expenseBatch.commit();

      expensesCreated.push(expenseRef.id);
    }


    return {
      success: true,
      message: `Successfully created ${userIds.length} synthetic users and ${expensesCreated.length} synthetic expenses`,
      usersCreated: userIds.length,
      expensesCreated: expensesCreated.length,
      userIds: userIds,
      expenseIds: expensesCreated
    };

  } catch (error) {
    console.error('Error in createSyntheticData:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create synthetic data: ' + error.message);
  }
});

// Delete all synthetic users and expenses
exports.deleteSyntheticData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const db = admin.firestore();
    
    // Delete synthetic expenses
    const expensesQuery = db.collection('expenses').where('synthetic', '==', true);
    const expensesSnapshot = await expensesQuery.get();
    
    let expensesDeleted = 0;
    let expenseBatch = db.batch();
    let expenseBatchCount = 0;
    const maxBatchSize = 500;

    for (const doc of expensesSnapshot.docs) {
      expenseBatch.delete(doc.ref);
      expensesDeleted++;
      expenseBatchCount++;

      if (expenseBatchCount >= maxBatchSize) {
        await expenseBatch.commit();
        expenseBatch = db.batch();
        expenseBatchCount = 0;
      }
    }

    // Commit remaining expense deletions
    if (expenseBatchCount > 0) {
      await expenseBatch.commit();
    }


    // Delete synthetic users (both Firestore and Auth)
    const usersQuery = db.collection('users').where('synthetic', '==', true);
    const usersSnapshot = await usersQuery.get();
    
    let usersDeleted = 0;
    let authUsersDeleted = 0;
    let userBatch = db.batch();
    let userBatchCount = 0;
    const userIdsToDelete = [];

    // Collect user IDs and prepare Firestore batch deletions
    for (const doc of usersSnapshot.docs) {
      userIdsToDelete.push(doc.id);
      userBatch.delete(doc.ref);
      usersDeleted++;
      userBatchCount++;

      if (userBatchCount >= maxBatchSize) {
        await userBatch.commit();
        userBatch = db.batch();
        userBatchCount = 0;
      }
    }

    // Commit remaining user Firestore deletions
    if (userBatchCount > 0) {
      await userBatch.commit();
    }


    // Delete Auth users (batch delete up to 1000 at a time)
    // Firebase Auth allows deleting up to 1000 users per batch
    const authBatchSize = 1000;
    for (let i = 0; i < userIdsToDelete.length; i += authBatchSize) {
      const batch = userIdsToDelete.slice(i, i + authBatchSize);
      try {
        const deleteResult = await admin.auth().deleteUsers(batch);
        authUsersDeleted += deleteResult.successCount;
        
        if (deleteResult.errors && deleteResult.errors.length > 0) {
          console.error('Errors deleting Auth users:', deleteResult.errors);
        }
      } catch (authError) {
        console.error(`Error deleting Auth users batch:`, authError);
        // Continue with other batches even if one fails
      }
    }

    return {
      success: true,
      message: `Successfully deleted ${usersDeleted} synthetic users and ${expensesDeleted} synthetic expenses`,
      usersDeleted: usersDeleted,
      expensesDeleted: expensesDeleted,
      authUsersDeleted: authUsersDeleted
    };

  } catch (error) {
    console.error('Error in deleteSyntheticData:', error);
    throw new functions.https.HttpsError('internal', 'Failed to delete synthetic data: ' + error.message);
  }
});
