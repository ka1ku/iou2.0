import { 
  getFirestore, 
  doc, 
  getDoc
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

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
