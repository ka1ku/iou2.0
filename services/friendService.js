import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  getDoc,
  setDoc,
  onSnapshot,
  writeBatch
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { getCurrentUser } from './authService';

// Friend system data models:
// Friend: {
//   id: string,
//   userId: string, // Current user's ID
//   friendId: string, // Friend's user ID
//   friendData: {
//     firstName: string,
//     lastName: string,
//     phoneNumber: string,
//     venmoUsername?: string,
//     venmoProfilePic?: string
//   },
//   status: 'pending' | 'accepted' | 'blocked',
//   createdAt: timestamp,
//   updatedAt: timestamp
// }

// FriendRequest: {
//   id: string,
//   fromUserId: string,
//   toUserId: string,
//   fromUserData: {
//     firstName: string,
//     lastName: string,
//     phoneNumber: string,
//     venmoUsername?: string
//   },
//   status: 'pending' | 'accepted' | 'declined',
//   createdAt: timestamp,
//   updatedAt: timestamp
// }

// Internal: fetch minimal profile for friend data
const getMinimalProfile = async (userId) => {
  const firestoreInstance = getFirestore(getApp());
  const snap = await getDoc(doc(firestoreInstance, 'users', userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    firstName: (data.firstName || '').trim(),
    lastName: (data.lastName || '').trim(),
    phoneNumber: (data.phoneNumber || '').trim(),
    venmoUsername: data.venmoUsername || null,
    profilePhoto: data.profilePhoto || data.venmoProfilePic || null, // Use profilePhoto, fallback to venmoProfilePic for backward compatibility
  };
};

// Create a friend request (store only IDs; hydrate profiles on read)
export const createFriendRequest = async (fromUserId, toUserId) => {
  try {
    if (fromUserId === toUserId) {
      throw new Error('Cannot send a friend request to yourself');
    }
    const firestoreInstance = getFirestore(getApp());
    
    // Check if request already exists
    const existingRequestQuery = query(
      collection(firestoreInstance, 'friendRequests'),
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId)
    );
    
    const existingSnapshot = await getDocs(existingRequestQuery);
    if (!existingSnapshot.empty) {
      throw new Error('Friend request already exists');
    }
    
    // Check if they're already friends
    const existingFriendQuery = query(
      collection(firestoreInstance, 'friends'),
      where('userId', '==', fromUserId),
      where('friendId', '==', toUserId)
    );
    
    const existingFriendSnapshot = await getDocs(existingFriendQuery);
    if (!existingFriendSnapshot.empty) {
      throw new Error('Already friends with this user');
    }
    
    // Create the friend request with IDs only
    const friendRequest = {
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(firestoreInstance, 'friendRequests'), friendRequest);
    
    return {
      ...friendRequest,
      id: docRef.id
    };
  } catch (error) {
    console.error('Error creating friend request:', error);
    throw error;
  }
};

// Accept a friend request
export const acceptFriendRequest = async (requestId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('No user signed in');
    }
    
    // Get the friend request
    const requestRef = doc(firestoreInstance, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      throw new Error('Friend request not found');
    }
    
    const requestData = requestSnap.data();
    
    if (requestData.toUserId !== currentUser.uid) {
      throw new Error('Not authorized to accept this request');
    }
    
    if (requestData.status !== 'pending') {
      throw new Error('Request is no longer pending');
    }
    
    // Fetch both user profiles to populate friendData accurately
    const [acceptorProfile, requesterProfile] = await Promise.all([
      getMinimalProfile(currentUser.uid),
      getMinimalProfile(requestData.fromUserId)
    ]);

    // Use a batch to ensure atomicity
    const batch = writeBatch(firestoreInstance);
    
    // Update request status
    batch.update(requestRef, {
      status: 'accepted',
      updatedAt: serverTimestamp()
    });
    
    // Create friend relationship for current user (the acceptor sees requester)
    const currentUserFriendRef = doc(collection(firestoreInstance, 'friends'));
    batch.set(currentUserFriendRef, {
      userId: currentUser.uid,
      friendId: requestData.fromUserId,
      friendData: requesterProfile || requestData.fromUserData,
      status: 'accepted',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Create friend relationship for the other user (the requester sees acceptor)
    const otherUserFriendRef = doc(collection(firestoreInstance, 'friends'));
    batch.set(otherUserFriendRef, {
      userId: requestData.fromUserId,
      friendId: currentUser.uid,
      friendData: acceptorProfile || {
        firstName: 'User',
        lastName: '',
        phoneNumber: currentUser.phoneNumber || '',
        venmoUsername: null,
        profilePhoto: null,
      },
      status: 'accepted',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    await batch.commit();
    
    return true;
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

// Decline a friend request
export const declineFriendRequest = async (requestId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('No user signed in');
    }
    
    const requestRef = doc(firestoreInstance, 'friendRequests', requestId);
    await updateDoc(requestRef, {
      status: 'declined',
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error declining friend request:', error);
    throw error;
  }
};

// Get friend requests for current user
export const getFriendRequests = async (userId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    
    const requestsQuery = query(
      collection(firestoreInstance, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(requestsQuery);
    const requests = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    if (requests.length === 0) return [];

    // Hydrate profiles in batch
    const ids = Array.from(new Set(requests.flatMap(r => [r.fromUserId, r.toUserId])));
    const profiles = await Promise.all(ids.map(id => getMinimalProfile(id)));
    const idToProfile = {};
    ids.forEach((id, idx) => { idToProfile[id] = profiles[idx]; });

    return requests.map(r => ({
      ...r,
      fromUserProfile: idToProfile[r.fromUserId] || null,
      toUserProfile: idToProfile[r.toUserId] || null,
    }));
  } catch (error) {
    console.error('Error getting friend requests:', error);
    return [];
  }
};

// Get all friends for current user
export const getUserFriends = async (userId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    
    const friendsQuery = query(
      collection(firestoreInstance, 'friends'),
      where('userId', '==', userId),
      where('status', '==', 'accepted'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(friendsQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting user friends:', error);
    return [];
  }
};

// Remove a friend
export const removeFriend = async (friendId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('No user signed in');
    }
    
    // Use a batch to remove both friend relationships
    const batch = writeBatch(firestoreInstance);
    
    // Find and remove current user's friend relationship
    const currentUserFriendQuery = query(
      collection(firestoreInstance, 'friends'),
      where('userId', '==', currentUser.uid),
      where('friendId', '==', friendId)
    );
    
    const currentUserFriendSnapshot = await getDocs(currentUserFriendQuery);
    currentUserFriendSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Find and remove the other user's friend relationship
    const otherUserFriendQuery = query(
      collection(firestoreInstance, 'friends'),
      where('userId', '==', friendId),
      where('friendId', '==', currentUser.uid)
    );
    
    const otherUserFriendSnapshot = await getDocs(otherUserFriendQuery);
    otherUserFriendSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    return true;
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

// Find user by phone number
export const findUserByPhoneNumber = async (phoneNumber) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    
    const userQuery = query(
      collection(firestoreInstance, 'users'),
      where('phoneNumber', '==', phoneNumber)
    );
    
    const snapshot = await getDocs(userQuery);
    
    if (snapshot.empty) {
      return null;
    }
    
    const userDoc = snapshot.docs[0];
    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error finding user by phone number:', error);
    return null;
  }
};

// Find user by username (case-insensitive, without leading @)
export const findUserByUsername = async (username) => {
  try {
    if (!username) return null;
    const normalized = username.replace(/^@+/, '').trim();
    if (!normalized) return null;
    const firestoreInstance = getFirestore(getApp());

    const userQuery = query(
      collection(firestoreInstance, 'users'),
      where('username', '==', normalized)
    );

    const snapshot = await getDocs(userQuery);

    if (snapshot.empty) {
      return null;
    }

    const userDoc = snapshot.docs[0];
    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error finding user by username:', error);
    return null;
  }
};

// Get user profile by ID
export const getUserProfile = async (userId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    
    const userDoc = await getDoc(doc(firestoreInstance, 'users', userId));
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// Listen to friend requests in real-time
export const listenToFriendRequests = (userId, callback) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    
    const requestsQuery = query(
      collection(firestoreInstance, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(requestsQuery, async (snapshot) => {
      const requests = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      if (requests.length === 0) {
        callback([]);
        return;
      }
      const ids = Array.from(new Set(requests.flatMap(r => [r.fromUserId, r.toUserId])));
      const profiles = await Promise.all(ids.map(id => getMinimalProfile(id)));
      const idToProfile = {};
      ids.forEach((id, idx) => { idToProfile[id] = profiles[idx]; });
      callback(requests.map(r => ({
        ...r,
        fromUserProfile: idToProfile[r.fromUserId] || null,
        toUserProfile: idToProfile[r.toUserId] || null,
      })));
    });
  } catch (error) {
    console.error('Error setting up friend requests listener:', error);
    return null;
  }
};

// Listen to friends list in real-time
export const listenToFriends = (userId, callback) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    
    const friendsQuery = query(
      collection(firestoreInstance, 'friends'),
      where('userId', '==', userId),
      where('status', '==', 'accepted'),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(friendsQuery, (snapshot) => {
      const friends = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(friends);
    });
  } catch (error) {
    console.error('Error setting up friends listener:', error);
    return null;
  }
};

// Generate deep link for friend invitation
export const generateFriendInviteLink = (userId, userData) => {
  const baseUrl = 'com.kailee.iou20://friend-invite';
  const params = new URLSearchParams({
    uid: userId,
    fn: userData.firstName || '',
    ln: userData.lastName || '',
    pn: userData.phoneNumber || ''
  });
  
  return `${baseUrl}?${params.toString()}`;
};

// Parse deep link invitation
export const parseFriendInviteLink = (url) => {
  try {
    if (!url.includes('friend-invite')) {
      return null;
    }
    
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    return {
      uid: params.get('uid'),
      firstName: params.get('fn'),
      lastName: params.get('ln'),
      phoneNumber: params.get('pn')
    };
  } catch (error) {
    console.error('Error parsing friend invite link:', error);
    return null;
  }
};

// One-time backfill for pending friend requests to ensure accurate user data
// Removed backfill: hydration done on read for cleanliness
