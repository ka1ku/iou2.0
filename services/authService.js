import auth, { getAuth, onAuthStateChanged, signOut, signInWithPhoneNumber } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  query,
  where,
  getDocs
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { generateFallbackAvatar } from '../utils/venmoUtils';

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
        console.log('Profile picture validation successful:', imageUrl);
        console.log('Content-Type:', contentType);
        console.log('Content-Length:', response.headers.get('content-length'));
        
        // For Venmo profile pictures, return the real image URL
        // This will be used as the background image instead of UI avatar
        return imageUrl;
      } else {
        console.log('Invalid content type for profile picture:', contentType);
      }
    } else {
      console.log('Profile picture validation failed with status:', response.status);
    }
  } catch (error) {
    console.log('Error validating profile picture:', error.message);
  }

  // Fallback to generated avatar only if validation completely fails
  console.log('Using fallback avatar for:', fallbackName);
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
    const firestoreInstance = getFirestore(getApp());
    
    // Query users collection for the username
    const usersRef = collection(firestoreInstance, 'users');
    const q = query(usersRef, where('username', '==', username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking username existence:', error);
    // If there's an error checking, we'll allow the flow to continue
    // This prevents blocking legitimate users due to Firestore issues
    // However, we should log this for monitoring purposes
    console.warn('Username existence check failed, allowing signup to proceed');
    return false;
  }
};

// Check if phone number already exists in users collection
export const checkPhoneNumberExists = async (phoneNumber) => {
  try {
    const firestoreInstance = getFirestore(getApp());
    
    // Query users collection for the phone number
    const usersRef = collection(firestoreInstance, 'users');
    const q = query(usersRef, where('phoneNumber', '==', phoneNumber));
    const querySnapshot = await getDocs(q);
    
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking phone number existence:', error);
    // If there's an error checking, we'll allow the flow to continue
    // This prevents blocking legitimate users due to Firestore issues
    // However, we should log this for monitoring purposes
    console.warn('Phone number existence check failed, allowing signup to proceed');
    return false;
  }
};

// Check if phone number exists in Firebase Auth (more comprehensive check)
export const checkPhoneNumberExistsInAuth = async (phoneNumber) => {
  try {
    // First check Firestore users collection
    const existsInFirestore = await checkPhoneNumberExists(phoneNumber);
    if (existsInFirestore) {
      console.log('Phone number found in Firestore:', phoneNumber);
      return true;
    }
    
    // Note: Firebase Auth doesn't provide a direct way to check if a phone number exists
    // without actually sending an OTP. The Firestore check is our primary method.
    // This function is here for future extensibility if we find better methods.
    
    console.log('Phone number not found in Firestore:', phoneNumber);
    return false;
  } catch (error) {
    console.error('Error in comprehensive phone number check:', error);
    // Log additional context for debugging
    console.warn('Phone number check failed for:', phoneNumber, 'Error:', error.message);
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
      throw new Error('Invalid phone number format. Please enter a valid phone number.');
    }
    
    console.log('Sending OTP to:', formattedPhone);
    
    // Check if phone number already exists in users collection (only for signup)
    if (!skipExistenceCheck) {
      const phoneExists = await checkPhoneNumberExistsInAuth(formattedPhone);
      if (phoneExists) {
        throw new Error('An account with this phone number already exists. Please sign in instead or use a different phone number.');
      }
    }
    
    // Use React Native Firebase phone auth - new modular API
    const authInstance = getAuth();
    const confirmation = await signInWithPhoneNumber(authInstance, formattedPhone);
    
    // Store the confirmation state globally
    globalPhoneAuthState = confirmation;
    
    console.log('SMS sent successfully');
    return {
      success: true,
      verificationId: confirmation.verificationId || 'rnfirebase-confirmation',
      confirmation // For direct access if needed
    };
  } catch (error) {
    console.error('Error sending OTP:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    // Handle specific Firebase errors
    if (error.code === 'auth/invalid-phone-number') {
      throw new Error('Invalid phone number format. Please enter a valid phone number.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many verification attempts. Please try again later.');
    } else if (error.code === 'auth/quota-exceeded') {
      throw new Error('SMS quota exceeded. Please try again later.');
    } else if (error.code === 'auth/invalid-app-credential') {
      throw new Error('Invalid app credential. Please check your Firebase configuration.');
    } else if (error.code === 'auth/app-not-authorized') {
      throw new Error('This app is not authorized to use Firebase Authentication. Please check your Firebase console settings.');
    } else if (error.code === 'auth/invalid-oauth-client-id') {
      throw new Error('Firebase configuration error. Please ensure you have the correct GoogleService-Info.plist and google-services.json files from your Firebase Console.');
    }
    
    throw new Error(`Failed to send verification code: ${error.message}`);
  }
};

// Verify OTP and complete sign in
export const verifyOTP = async (verificationId, otp) => {
  try {
    console.log('Verifying OTP:', otp);
    
    // Use the global phone auth state if available
    if (globalPhoneAuthState) {
      console.log('Using global phone auth state for verification');
      const credential = await globalPhoneAuthState.confirm(otp);
      
      if (credential.user) {
        console.log('Phone verification successful');
        globalPhoneAuthState = null; // Clear the global state
        return credential.user;
      } else {
        throw new Error('Verification failed - no user returned');
      }
    } else {
      // Fallback to manual verification (should not happen with React Native Firebase)
      console.log('No global phone auth state, attempting manual verification');
      throw new Error('Verification session expired. Please request a new code.');
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    
    // Handle specific verification errors
    if (error.code === 'auth/invalid-verification-code') {
      throw new Error('Invalid verification code. Please check the code and try again.');
    } else if (error.code === 'auth/invalid-verification-id') {
      throw new Error('Verification session expired. Please request a new code.');
    } else if (error.code === 'auth/code-expired') {
      throw new Error('Verification code has expired. Please request a new code.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many verification attempts. Please try again later.');
    }
    
    throw error;
  }
};

// Handle multi-factor auth required error
export const handleMultiFactorError = async (error) => {
  if (error.code === 'auth/multi-factor-auth-required') {
    const resolver = error.resolver;
    const hints = resolver.hints;
    
    console.log('Multi-factor auth required');
    console.log('Available hints:', hints.length);
    
    // For now, we'll handle phone-based MFA
    const phoneHints = hints.filter(hint => hint.factorId === 'phone');
    if (phoneHints.length > 0) {
      const phoneHint = phoneHints[0];
      console.log('Using phone hint:', phoneHint.uid);
      
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
    console.log('Resolving 2FA challenge with OTP:', otp);
    
    const credential = await resolver.confirm(otp);
    
    if (credential.user) {
      console.log('2FA challenge resolved successfully');
      return credential.user;
    } else {
      throw new Error('2FA verification failed - no user returned');
    }
  } catch (error) {
    console.error('Error resolving 2FA challenge:', error);
    throw error;
  }
};

// Sign out user
export const signOutUser = async () => {
  try {
    const authInstance = getAuth();
    await signOut(authInstance);
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Error signing out:', error);
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
      throw new Error('No user signed in');
    }



    // Validate required fields
    if (!userData.firstName || !userData.lastName) {
      throw new Error('Missing required user data: firstName and lastName are required');
    }
    
    if (!userData.username) {
      throw new Error('Missing required user data: username is required');
    }

    if (!phoneNumber && !user.phoneNumber) {
      throw new Error('Missing phone number');
    }

    // Clean and prepare user data
    const cleanUserData = {
      firstName: (userData.firstName || '').trim(),
      lastName: (userData.lastName || '').trim(),
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
          // This is a real Venmo profile picture - use it
          cleanUserData.profilePhoto = userData.venmoProfilePic.trim();
          console.log('Using real Venmo profile picture');
        } else {
          // This is a fallback avatar - generate a new one based on user's name
          cleanUserData.profilePhoto = generateFallbackAvatar(cleanUserData.firstName, cleanUserData.lastName, 'User');
          console.log('Using fallback avatar (Venmo user exists but no pfp)');
        }
      } catch (urlError) {
        // Fallback to generated avatar if Venmo URL parsing fails
        cleanUserData.profilePhoto = generateFallbackAvatar(cleanUserData.firstName, cleanUserData.lastName, 'User');
        console.log('URL parsing failed, using fallback avatar');
      }
    } else {
      // No Venmo profile picture, use generated avatar
      cleanUserData.profilePhoto = generateFallbackAvatar(cleanUserData.firstName, cleanUserData.lastName, 'User');
      console.log('No Venmo data, using fallback avatar');
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
    console.log('Creating user profile with data:', {
      firstName: cleanUserData.firstName,
      lastName: cleanUserData.lastName,
      username: cleanUserData.username,
      phoneNumber: cleanUserData.phoneNumber,
      venmoUsername: cleanUserData.venmoUsername,
      hasVenmoUsername: !!cleanUserData.venmoUsername,
      profilePhoto: cleanUserData.profilePhoto,
      isRealVenmoProfile: cleanUserData.profilePhoto && !cleanUserData.profilePhoto.includes('ui-avatars.com')
    });

    // Store in Firestore using the auth UID as document ID
    const firestoreInstance = getFirestore(getApp());
    const docRef = doc(firestoreInstance, 'users', user.uid);
    await setDoc(docRef, userDoc);
    
    return {
      ...userDoc,
      id: user.uid
    };
  } catch (error) {
    console.error('Error creating user profile:', error);
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
    console.log('Temporary signup data stored');
    return tempData;
  } catch (error) {
    console.error('Error storing temporary signup data:', error);
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
    console.error('Error getting temporary signup data:', error);
    return null;
  }
};

// Clear temporary signup data
export const clearTemporarySignupData = async () => {
  try {
    await AsyncStorage.removeItem('temp_signup_data');
    console.log('Temporary signup data cleared');
  } catch (error) {
    console.error('Error clearing temporary signup data:', error);
  }
};