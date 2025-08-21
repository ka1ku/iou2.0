import auth, { getAuth, onAuthStateChanged, signOut, signInWithPhoneNumber } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

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

// Send OTP using React Native Firebase phone authentication
export const sendOTP = async (phoneNumber) => {
  try {
    // Format phone number to include country code if not present
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber}`;
    
    console.log('Sending OTP to:', formattedPhone);
    
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

// Test Firestore connection
export const testFirestoreConnection = async () => {
  try {
    // Get Firestore instance using getApp() as per migration guide
    const firestoreInstance = getFirestore(getApp());
    
    // Test creating a simple document using the modular API
    const testDoc = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Firestore connection test'
    };
    
    const testDocRef = await addDoc(collection(firestoreInstance, 'test'), testDoc);
    
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    return false;
  }
};

// Create user profile in Firestore after successful 2FA verification
export const createUserProfile = async (userData, phoneNumber) => {
  try {
    const authInstance = getAuth();
    const user = authInstance.currentUser;
    
    if (!user) {
      throw new Error('No user signed in');
    }

    // Test Firestore connection first
    const connectionTest = await testFirestoreConnection();
    if (!connectionTest) {
      throw new Error('Firestore connection test failed');
    }

    // Validate required fields
    if (!userData.firstName || !userData.lastName) {
      throw new Error('Missing required user data: firstName and lastName are required');
    }

    if (!phoneNumber && !user.phoneNumber) {
      throw new Error('Missing phone number');
    }

    // Clean and prepare user data
    const cleanUserData = {
      firstName: (userData.firstName || '').trim(),
      lastName: (userData.lastName || '').trim(),
      phoneNumber: (phoneNumber || user.phoneNumber || '').trim(),
      venmoUsername: userData.venmoUsername ? userData.venmoUsername.trim() : null,
      venmoProfilePic: null
    };

    // Handle Venmo profile picture safely
    if (userData.venmoProfilePic) {
      try {
        // Basic URL validation
        const url = new URL(userData.venmoProfilePic);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          cleanUserData.venmoProfilePic = userData.venmoProfilePic.trim();
        }
      } catch (urlError) {
        // Skip invalid URLs
      }
    }

    // Create user document with auth UID as document ID
    const userDoc = {
      firstName: cleanUserData.firstName,
      lastName: cleanUserData.lastName,
      phoneNumber: cleanUserData.phoneNumber,
      venmoUsername: cleanUserData.venmoUsername,
      venmoProfilePic: cleanUserData.venmoProfilePic,
      phoneVerified: true,
      accountStatus: 'active',
      createdAt: serverTimestamp()
    };

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