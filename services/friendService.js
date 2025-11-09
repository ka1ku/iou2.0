import { 
  getFirestore, 
  doc, 
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { getCurrentUser } from './authService';

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
    return null;
  }
};

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
    return null;
  }
};

// Get starred users for the current user
export const getStarredUsers = async (userId) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    const userDoc = await getDoc(doc(firestoreInstance, 'users', userId));
    
    if (!userDoc.exists()) {
      return [];
    }
    
    const userData = userDoc.data();
    const starredUserIds = userData.starredUsers || [];
    
    // Fetch profile data for each starred user
    const starredUsersPromises = starredUserIds.map(async (starredUserId) => {
      try {
        const starredUserDoc = await getDoc(doc(firestoreInstance, 'users', starredUserId));
        if (starredUserDoc.exists()) {
          const starredUserData = starredUserDoc.data();
          return {
            id: starredUserDoc.id,
            objectID: starredUserDoc.id,
            firstName: starredUserData.firstName || '',
            lastName: starredUserData.lastName || '',
            fullName: `${starredUserData.firstName || ''} ${starredUserData.lastName || ''}`.trim(),
            username: starredUserData.username || '',
            profilePhoto: starredUserData.profilePhoto || null,
            venmoUsername: starredUserData.venmoUsername || null,
          };
        }
        return null;
      } catch (error) {
        return null;
      }
    });
    
    const starredUsers = await Promise.all(starredUsersPromises);
    return starredUsers.filter(user => user !== null);
  } catch (error) {
    return [];
  }
};

// Star a user
export const starUser = async (targetUserId, userData = null) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('No authenticated user');
    }
    
    const firestoreInstance = getFirestore(getApp());
    const userDocRef = doc(firestoreInstance, 'users', currentUser.uid);
    
    // Add the user ID to starredUsers array
    await updateDoc(userDocRef, {
      starredUsers: arrayUnion(targetUserId)
    });
    
    return true;
  } catch (error) {
    throw error;
  }
};

// Unstar a user
export const unstarUser = async (targetUserId) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('No authenticated user');
    }
    
    const firestoreInstance = getFirestore(getApp());
    const userDocRef = doc(firestoreInstance, 'users', currentUser.uid);
    
    // Remove the user ID from starredUsers array
    await updateDoc(userDocRef, {
      starredUsers: arrayRemove(targetUserId)
    });
    
    return true;
  } catch (error) {
    throw error;
  }
};

// Check if a user is starred
export const isUserStarred = async (targetUserId) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return false;
    }
    
    const firestoreInstance = getFirestore(getApp());
    const userDoc = await getDoc(doc(firestoreInstance, 'users', currentUser.uid));
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    const starredUsers = userData.starredUsers || [];
    return starredUsers.includes(targetUserId);
  } catch (error) {
    return false;
  }
};
