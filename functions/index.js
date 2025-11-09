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

// Update user information across all expenses
exports.updateUserInExpenses = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const { userId, firstName, lastName, username, profilePhoto } = data;
    
    if (!userId || !firstName || !lastName) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: userId, firstName, lastName');
    }

    const db = admin.firestore();
    
    // Query all expenses where this user is a participant
    const expensesQuery = db.collection('expenses').where(`participantsMap.${userId}`, '==', true);
    const expensesSnapshot = await expensesQuery.get();
    
    if (expensesSnapshot.empty) {
      return {
        success: true,
        message: 'No expenses found for this user',
        expensesUpdated: 0
      };
    }

    let expensesUpdated = 0;
    let batch = db.batch();
    let batchCount = 0;
    const maxBatchSize = 500; // Firestore batch limit

    // Update each expense
    for (const expenseDoc of expensesSnapshot.docs) {
      const expenseData = expenseDoc.data();
      const participants = expenseData.participants || [];
      
      // Find and update the user's participant entry
      let participantUpdated = false;
      const updatedParticipants = participants.map(participant => {
        if (participant.userId === userId) {
          participantUpdated = true;
          return {
            ...participant,
            name: `${firstName} ${lastName}`.trim(),
            username: username || participant.username,
            profilePhoto: profilePhoto || participant.profilePhoto
          };
        }
        return participant;
      });

      // Only update if the participant was found and changed
      if (participantUpdated) {
        batch.update(expenseDoc.ref, {
          participants: updatedParticipants,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        expensesUpdated++;
        batchCount++;

        // Commit batch if we've reached the limit
        if (batchCount >= maxBatchSize) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    // Commit any remaining operations
    if (batchCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Successfully updated user information in ${expensesUpdated} expenses`,
      expensesUpdated: expensesUpdated
    };

  } catch (error) {
    console.error('Error in updateUserInExpenses:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update user in expenses: ' + error.message);
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
    
    console.log(`Created ${userIds.length} synthetic users`);

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

      // Create participantsMap
      const participantsMap = {};
      expenseParticipants.forEach(userId => {
        participantsMap[userId] = true;
      });

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
        participantsMap,
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

    console.log(`Created ${expensesCreated.length} synthetic expenses`);

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

    console.log(`Deleted ${expensesDeleted} synthetic expenses`);

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

    console.log(`Deleted ${usersDeleted} synthetic users from Firestore`);

    // Delete Auth users (batch delete up to 1000 at a time)
    // Firebase Auth allows deleting up to 1000 users per batch
    const authBatchSize = 1000;
    for (let i = 0; i < userIdsToDelete.length; i += authBatchSize) {
      const batch = userIdsToDelete.slice(i, i + authBatchSize);
      try {
        const deleteResult = await admin.auth().deleteUsers(batch);
        authUsersDeleted += deleteResult.successCount;
        console.log(`Deleted ${deleteResult.successCount} Auth users (batch ${Math.floor(i / authBatchSize) + 1})`);
        
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
