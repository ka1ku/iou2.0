import auth, { getAuth, onAuthStateChanged, signOut, signInWithPhoneNumber } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  query,
  where,
  getDocs
} from '@react-native-firebase/firestore';
import { getFirestoreInstance } from '../utils/firestoreUtils';
import { generateFallbackAvatar } from '../utils/venmoUtils';
import { downloadAndUploadImage } from './imageHandler';
import { handleError, ERROR_MESSAGES } from '../utils/errorHandler';

// Store verification session globally for access in verify function
let globalPhoneAuthState = null;

// Helper function to validate and optimize profile picture URLs
export const validateAndOptimizeProfilePicture = async (imageUrl, fallbackName = 'User') => {
  if (!imageUrl || imageUrl.includes('ui-avatars.com')) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&size=200&background=3d95ce&color=fff&bold=true`;
  }

  try {
    // Try to fetch the image to validate it exists and is accessible
    const response = await fetch(imageUrl, {
      method: 'HEAD', // Only get headers, not the full image
      timeout: 10000, // 10 second timeout for Venmo images
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      // Verify it's actually an image
      if (contentType && contentType.startsWith('image/')) {
        
        // For Venmo profile pictures, return the real image URL
        // This will be used as the background image instead of UI avatar
        return imageUrl;
      } else {
      }
    } else {
    }
  } catch (error) {
  }

  // Fallback to generated avatar only if validation completely fails
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&size=200&background=3d95ce&color=fff&bold=true`;
};

// Format phone number consistently across the app
export const formatPhoneNumber = (phoneNumber) => {
  // Remove all non-digits
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If it's already in international format, return as is
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }
  
  // Add +1 prefix for US numbers
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If it already has country code, return as is
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // Return the original if we can't determine format
  return phoneNumber;
};

// Check if username already exists in users collection
export const checkUsernameExists = async (username) => {
  try {
    const firestoreInstance = getFirestoreInstance();
    
    // Query users collection for the username
    const usersRef = collection(firestoreInstance, 'users');
    const q = query(usersRef, where('username', '==', username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    return !querySnapshot.empty;
  } catch (error) {
    // If there's an error checking, we'll allow the flow to continue
    // This prevents blocking legitimate users due to Firestore issues
    // However, we should log this for monitoring purposes
    return false;
  }
};

// Check if phone number already exists in users collection
export const checkPhoneNumberExists = async (phoneNumber) => {
  try {
    const firestoreInstance = getFirestoreInstance();
    
    // Query users collection for the phone number
    const usersRef = collection(firestoreInstance, 'users');
    const q = query(usersRef, where('phoneNumber', '==', phoneNumber));
    const querySnapshot = await getDocs(q);
    
    return !querySnapshot.empty;
  } catch (error) {
    // If there's an error checking, we'll allow the flow to continue
    // This prevents blocking legitimate users due to Firestore issues
    // However, we should log this for monitoring purposes
    return false;
  }
};

// Check if phone number exists in Firebase Auth (more comprehensive check)
export const checkPhoneNumberExistsInAuth = async (phoneNumber) => {
  try {
    // First check Firestore users collection
    const existsInFirestore = await checkPhoneNumberExists(phoneNumber);
    if (existsInFirestore) {
      return true;
    }
    
    // Note: Firebase Auth doesn't provide a direct way to check if a phone number exists
    // without actually sending an OTP. The Firestore check is our primary method.
    // This function is here for future extensibility if we find better methods.
    
    return false;
  } catch (error) {
    // Log additional context for debugging
    return false;
  }
};

// Send OTP using React Native Firebase phone authentication
export const sendOTP = async (phoneNumber, skipExistenceCheck = false) => {
  try {
    // Validate phone number input
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error('Invalid phone number provided');
    }
    
    // Format phone number consistently
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Validate formatted phone number
    if (!formattedPhone.startsWith('+') || formattedPhone.length < 10) {
      throw new Error(ERROR_MESSAGES['auth/invalid-phone-number']);
    }
    
    
    // Check if phone number already exists in users collection (only for signup)
    if (!skipExistenceCheck) {
      const phoneExists = await checkPhoneNumberExistsInAuth(formattedPhone);
      if (phoneExists) {
        throw new Error(ERROR_MESSAGES.ACCOUNT_EXISTS);
      }
    }
    
    // Use React Native Firebase phone auth - new modular API
    const authInstance = getAuth();
    const confirmation = await signInWithPhoneNumber(authInstance, formattedPhone);
    
    // Store the confirmation state globally
    globalPhoneAuthState = confirmation;
    
    return {
      success: true,
      verificationId: confirmation.verificationId || 'rnfirebase-confirmation',
      confirmation // For direct access if needed
    };
  } catch (error) {
    throw new Error(handleError(error, 'sendOTP'));
  }
};

// Verify OTP and complete sign in
export const verifyOTP = async (verificationId, otp) => {
  try {
    
    // Use the global phone auth state if available
    if (globalPhoneAuthState) {
      const credential = await globalPhoneAuthState.confirm(otp);
      
      if (credential.user) {
        return credential.user;
      } else {
        throw new Error('Verification failed - no user returned');
      }
    } else {
      // Fallback to manual verification (should not happen with React Native Firebase)
      throw new Error('Verification session expired. Please request a new code.');
    }
  } catch (error) {
    throw new Error(handleError(error, 'verifyOTP'));
  }
};

// Handle multi-factor auth required error
export const handleMultiFactorError = async (error) => {
  if (error.code === 'auth/multi-factor-auth-required') {
    const resolver = error.resolver;
    const hints = resolver.hints;
    
    
    // For now, we'll handle phone-based MFA
    const phoneHints = hints.filter(hint => hint.factorId === 'phone');
    if (phoneHints.length > 0) {
      const phoneHint = phoneHints[0];
      
      // Send verification code to the enrolled phone number
      const authInstance = getAuth();
      const confirmation = await signInWithPhoneNumber(authInstance, phoneHint.phoneNumber);
      
      return {
        resolver,
        confirmation,
        phoneNumber: phoneHint.phoneNumber
      };
    }
  }
  
  throw error;
};

// Resolve 2FA challenge
export const resolve2FAChallenge = async (verificationId, otp, resolver) => {
  try {
    
    const credential = await resolver.confirm(otp);
    
    if (credential.user) {
      return credential.user;
    } else {
      throw new Error('2FA verification failed - no user returned');
    }
  } catch (error) {
    throw error;
  }
};

// Sign out user
export const signOutUser = async () => {
  try {
    const authInstance = getAuth();
    await signOut(authInstance);
  } catch (error) {
    throw error;
  }
};

// Listen for auth state changes
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(getAuth(), callback);
};

// Get current user
export const getCurrentUser = () => {
  const authInstance = getAuth();
  return authInstance.currentUser;
};



// Create user profile in Firestore after successful 2FA verification
export const createUserProfile = async (userData, phoneNumber) => {
  try {
    const authInstance = getAuth();
    const user = authInstance.currentUser;
    
    if (!user) {
      throw new Error(ERROR_MESSAGES.NO_USER_SIGNED_IN);
    }



    // Validate required fields
    if (!userData.firstName || !userData.lastName) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
    }
    
    if (!userData.username) {
      throw new Error(ERROR_MESSAGES.MISSING_USERNAME);
    }

    if (!phoneNumber && !user.phoneNumber) {
      throw new Error(ERROR_MESSAGES.MISSING_PHONE_NUMBER);
    }

    // Clean and prepare user data
    const cleanUserData = {
      firstName: (userData.firstName || '').trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      lastName: (userData.lastName || '').trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      username: (userData.username || '').trim().toLowerCase(),
      phoneNumber: (phoneNumber || user.phoneNumber || '').trim(),
      venmoUsername: userData.venmoUsername ? userData.venmoUsername.trim() : null,
      profilePhoto: null
    };

    // Determine profile photo: Venmo profile pic if available, otherwise generated avatar
    if (userData.venmoProfilePic) {
      try {
        // Check if this is a real Venmo profile picture (not a fallback avatar)
        const isRealVenmoProfile = !userData.venmoProfilePic.includes('ui-avatars.com');
        
        if (isRealVenmoProfile) {
          // This is a real Venmo profile picture - download and upload to Firebase Storage
          try {
            cleanUserData.profilePhoto = await downloadAndUploadImage(userData.venmoProfilePic.trim(), user.uid);
          } catch (uploadError) {
            // If upload fails, fallback to the original Venmo URL
            cleanUserData.profilePhoto = userData.venmoProfilePic.trim();
          }
        } else {
          // This is a fallback avatar - generate a new one based on user's name
          cleanUserData.profilePhoto = generateFallbackAvatar(cleanUserData.firstName, cleanUserData.lastName, 'User');
        }
      } catch (urlError) {
        // Fallback to generated avatar if Venmo URL parsing fails
        cleanUserData.profilePhoto = generateFallbackAvatar(cleanUserData.firstName, cleanUserData.lastName, 'User');
      }
    } else {
      // No Venmo profile picture, use generated avatar
      cleanUserData.profilePhoto = generateFallbackAvatar(cleanUserData.firstName, cleanUserData.lastName, 'User');
    }

    // Create user document with auth UID as document ID
    const userDoc = {
      firstName: cleanUserData.firstName,
      lastName: cleanUserData.lastName,
      username: cleanUserData.username,
      phoneNumber: cleanUserData.phoneNumber,
      venmoUsername: cleanUserData.venmoUsername,
      profilePhoto: cleanUserData.profilePhoto,
      phoneVerified: true,
      accountStatus: 'active',
      createdAt: serverTimestamp()
    };

    // Log what's being saved

    // Store in Firestore using the auth UID as document ID
    const firestoreInstance = getFirestoreInstance();
    const docRef = doc(firestoreInstance, 'users', user.uid);
    await setDoc(docRef, userDoc);
    
    return {
      ...userDoc,
      id: user.uid
    };
  } catch (error) {
    throw error;
  }
};

// Store temporary signup data (before phone verification)
export const storeTemporarySignupData = async (data) => {
  try {
    const tempData = {
      ...data,
      createdAt: new Date().toISOString(),
      isTemporary: true,
    };
    
    // Store in AsyncStorage with a temporary key
    await AsyncStorage.setItem('temp_signup_data', JSON.stringify(tempData));
    return tempData;
  } catch (error) {
    throw error;
  }
};

// Get temporary signup data
export const getTemporarySignupData = async () => {
  try {
    const tempDataString = await AsyncStorage.getItem('temp_signup_data');
    if (tempDataString) {
      return JSON.parse(tempDataString);
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Clear temporary signup data
export const clearTemporarySignupData = async () => {
  try {
    await AsyncStorage.removeItem('temp_signup_data');
  } catch (error) {
  }
};