import { 
  doc, 
  getDoc
} from '@react-native-firebase/firestore';
import { getFirestoreInstance } from '../utils/firestoreUtils';

export const getUserProfile = async (userId) => {
  try {
    const firestoreInstance = getFirestoreInstance();
    
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
