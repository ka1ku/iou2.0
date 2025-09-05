import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import { sendOTP, storeTemporarySignupData, clearTemporarySignupData, getTemporarySignupData, checkUsernameExists } from '../../services/authService';
import { fetchVenmoProfile, generateFallbackAvatar } from '../../utils/venmoUtils';
import ProfilePicture from '../../components/VenmoProfilePicture';



const SignUpScreen = ({ navigation }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Venmo profile state
  const [venmoUsername, setVenmoUsername] = useState('');
  const [venmoProfilePic, setVenmoProfilePic] = useState('');
  const [venmoVerified, setVenmoVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState(null);
  const [lastVerifiedUsername, setLastVerifiedUsername] = useState('');
  
  const [userData, setUserData] = useState(null);
  const isProceedingToVerification = useRef(false);
  // const [fadeAnim] = useState(() => new Animated.Value(1)); // Temporarily disabled

  // Cleanup temporary data when component unmounts
  useEffect(() => {
    return () => {
      // Only clear if we're not proceeding to verification
      if (!isProceedingToVerification.current) {
        clearTemporarySignupData();
      }
    };
  }, []);

  // Retrieve temporary signup data when component mounts
  useEffect(() => {
    const loadTemporaryData = async () => {
      try {
        const tempData = await getTemporarySignupData();
        if (tempData) {
          setUserData(tempData);
          // Restore form data if available
          if (tempData.firstName) setFirstName(tempData.firstName);
          if (tempData.lastName) setLastName(tempData.lastName);
          if (tempData.username) setUsername(tempData.username);
        }
      } catch (error) {
        console.error('Error loading temporary signup data:', error);
        setUserData(null);
      }
    };

    loadTemporaryData();
  }, []);

  // Cleanup Venmo timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  /**
   * Automatically verify Venmo profile after typing stops
   */
  const verifyVenmoProfile = useCallback(async (usernameToVerify) => {
    if (!usernameToVerify.trim()) {
      setVenmoVerified(false);
      setVenmoProfilePic(null);
      setVerificationError(null);
      return;
    }

    // Don't re-verify if we already verified this exact username
    if (lastVerifiedUsername === usernameToVerify.trim()) {
      return;
    }
    
    setIsVerifying(true);
    setVerificationError(null);
    
    try {
      console.log('Verifying Venmo profile for:', usernameToVerify);
      
      // Use the real Venmo profile fetching logic
      const profileData = await fetchVenmoProfile(usernameToVerify, firstName, lastName);
      
      console.log('Venmo profile data received:', profileData);
      
      // Always set the username and profile picture
      setVenmoUsername(profileData.username);
      setVenmoProfilePic(profileData.imageUrl);
      
      // Use the userExists field to determine verification status
      if (profileData.userExists === true) {
        // User definitely exists
        setVenmoVerified(true);
        setVerificationError(null);
        setLastVerifiedUsername(profileData.username);
        
        // Check if they have a real profile picture
        const hasRealProfilePic = !profileData.imageUrl.includes('ui-avatars.com');
        
        console.log('Venmo verification completed successfully:', {
          username: profileData.username,
          userExists: true,
          hasRealProfilePic,
          profilePic: profileData.imageUrl,
          displayName: profileData.displayName
        });
      } else if (profileData.userExists === false) {
        // User definitely doesn't exist
        setVenmoVerified(false);
        setVerificationError('Venmo user does not exist. Please check the username and try again.');
        
        console.log('Venmo user does not exist, showing error');
      } else {
        // userExists is null - network or other error, can't determine
        setVenmoVerified(false);
        setVerificationError('Unable to verify Venmo account. Please check your connection and try again.');
        
        console.log('Network or other error, cannot determine if user exists');
      }
      
    } catch (error) {
      console.error('Venmo verification failed:', error);
      
      // This should rarely happen now since fetchVenmoProfile handles most errors
      setVenmoVerified(false);
      setVenmoProfilePic(generateFallbackAvatar(firstName, lastName, usernameToVerify.trim()));
      setVerificationError('Unable to verify Venmo account. Please check your connection and try again.');
      
      console.log('Unexpected error in verification, using fallback avatar');
    } finally {
      setIsVerifying(false);
    }
  }, [firstName, lastName, lastVerifiedUsername]);

  /**
   * Handle username input with debounced verification
   */
  const handleUsernameChange = useCallback((newUsername) => {
    // Clear any existing verification state when username changes
    setVerificationError(null);
    
    // Clear existing timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    // Update username immediately for responsive UI
    setVenmoUsername(newUsername);
    
    // Show loading immediately if there's a username
    if (newUsername.trim()) {
      setIsVerifying(true);
      setVenmoVerified(false); // Reset verification until we confirm
    } else {
      setIsVerifying(false);
      setVenmoVerified(false);
      setVenmoProfilePic(null);
      setLastVerifiedUsername('');
    }
    
    // Set new timeout for verification
    setDebounceTimeout(setTimeout(() => {
      if (newUsername.trim()) {
        verifyVenmoProfile(newUsername);
      }
    }, 1000)); // Wait 1 second after typing stops
  }, [verifyVenmoProfile]);

  /**
   * Reset Venmo profile data
   */
  const resetVenmoProfile = useCallback(() => {
    setVenmoUsername('');
    setVenmoProfilePic(null);
    setVenmoVerified(false);
    setIsVerifying(false);
    setVerificationError(null);
    setLastVerifiedUsername('');
    
    // Clear any pending verification
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
  }, [debounceTimeout]);

  /**
   * Get current Venmo data
   */
  const getVenmoData = useCallback(() => ({
    username: venmoUsername,
    profilePic: venmoProfilePic,
    verified: venmoVerified
  }), [venmoUsername, venmoProfilePic, venmoVerified]);

  const formatPhoneNumber = (text) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    
    // Apply formatting: (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneNumberChange = (text) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  // Validate and format name input (only allow letters, spaces, hyphens, apostrophes)
  const handleFirstNameChange = (text) => {
    // Only allow letters, spaces, hyphens, and apostrophes
    const filtered = text.replace(/[^a-zA-Z\s\-']/g, '');
    setFirstName(filtered);
  };

  const handleLastNameChange = (text) => {
    // Only allow letters, spaces, hyphens, and apostrophes
    const filtered = text.replace(/[^a-zA-Z\s\-']/g, '');
    setLastName(filtered);
  };

  // Venmo verification is now automatic after typing stops



  const validateStep1 = () => {
    if (!firstName.trim()) {
      Alert.alert('Required Field', 'Please enter your first name');
      return false;
    }
    if (!lastName.trim()) {
      Alert.alert('Required Field', 'Please enter your last name');
      return false;
    }
    
    // Validate first name format (letters, spaces, hyphens, apostrophes only)
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(firstName.trim())) {
      Alert.alert('Invalid First Name', 'First name can only contain letters, spaces, hyphens, and apostrophes');
      return false;
    }
    
    // Validate last name format (letters, spaces, hyphens, apostrophes only)
    if (!nameRegex.test(lastName.trim())) {
      Alert.alert('Invalid Last Name', 'Last name can only contain letters, spaces, hyphens, and apostrophes');
      return false;
    }
    
    // Check minimum length (at least 2 characters)
    if (firstName.trim().length < 2) {
      Alert.alert('Invalid First Name', 'First name must be at least 2 characters long');
      return false;
    }
    
    if (lastName.trim().length < 2) {
      Alert.alert('Invalid Last Name', 'Last name must be at least 2 characters long');
      return false;
    }
    
    return true;
  };

  const validateStep2 = async () => {
    if (!username.trim()) {
      Alert.alert('Required Field', 'Please enter a username');
      return false;
    }
    
    // Check username format (alphanumeric, 3-20 characters)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username.trim())) {
      Alert.alert('Invalid Username', 'Username must be 3-20 characters long and contain only letters, numbers, and underscores');
      return false;
    }
    
    // Check if username is already taken
    try {
      const usernameExists = await checkUsernameExists(username.trim());
      if (usernameExists) {
        Alert.alert('Username Taken', 'This username is already taken. Please choose a different one.');
        return false;
      }
    } catch (error) {
      console.error('Error checking username:', error);
      Alert.alert('Error', 'Unable to check username availability. Please try again.');
      return false;
    }
    
    return true;
  };

  const validateStep3 = () => {
    // Venmo step - optional, always valid
    return true;
  };

  const validateStep4 = () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Required Field', 'Please enter your phone number');
      return false;
    }

    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return false;
    }
    return true;
  };

  const handleNextStep = async () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        animateStepTransition(() => setCurrentStep(2));
      }
    } else if (currentStep === 2) {
      if (await validateStep2()) {
        animateStepTransition(() => setCurrentStep(3));
      }
    } else if (currentStep === 3) {
      if (validateStep3()) {
        // Store temporary data before proceeding to phone verification
        const venmoData = getVenmoData();
        const tempData = {
          firstName: firstName.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
          lastName: lastName.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
          username: username.trim().toLowerCase(),
          venmoUsername: venmoData.verified ? venmoData.username : null,
          venmoProfilePic: venmoData.verified ? venmoData.profilePic : null,
        };
       
        await storeTemporarySignupData(tempData);
        
        // Verify the data was stored before proceeding
        const storedData = await getTemporarySignupData();
        if (storedData) {
          isProceedingToVerification.current = true;
          animateStepTransition(() => setCurrentStep(4));
        } else {
          Alert.alert('Error', 'Failed to save your information. Please try again.');
        }
      }
    } else if (currentStep === 4) {
      if (validateStep4()) {
        // Ensure flag is set before proceeding to OTP
        if (!isProceedingToVerification.current) {
          isProceedingToVerification.current = true;
        }
        handleSendOTP();
      }
    }
  };

  const handleSendOTP = async () => {
    setLoading(true);
    
    // Set flag to preserve data during navigation
    isProceedingToVerification.current = true;
    
    try {
      const digits = phoneNumber.replace(/\D/g, '');
      const result = await sendOTP(`+1${digits}`);
      
      if (!result || !result.verificationId) {
        throw new Error('Invalid verification response received');
      }
      
      navigation.navigate('VerifyOTP', { 
        phoneNumber: `+1${digits}`,
        verificationId: result.verificationId,
        isInitialAuth: true,
        isSignUp: true,
      });
    } catch (error) {
      // Reset flag if OTP sending fails
      isProceedingToVerification.current = false;
      
      // Handle phone number already exists error specifically
      if (error.message.includes('already exists')) {
        Alert.alert(
          'Account Already Exists',
          'This phone number is already registered. You can either sign in with this number or use a different phone number to create a new account.',
          [
            { text: 'Sign In Instead', onPress: () => navigation.navigate('SignIn') },
            { text: 'Use Different Number', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to send verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 2) {
      animateStepTransition(() => setCurrentStep(1));
    } else if (currentStep === 3) {
      // Clear Venmo data when going back from Venmo step
      resetVenmoProfile();
      animateStepTransition(() => setCurrentStep(2));
    } else if (currentStep === 4) {
      // Don't clear temporary data when going back from phone verification
      // This data is needed for the verification process
      isProceedingToVerification.current = false;
      animateStepTransition(() => setCurrentStep(3));
    }
  };

  const animateStepTransition = (callback) => {
    // Simple step transition without animation for now
    callback();
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${(currentStep / 4) * 100}%` }
          ]} 
        />
      </View>
      <Text style={styles.progressText}>Step {currentStep} of 4</Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>What's your name?</Text>
        <Text style={styles.stepSubtitle}>
          We'll use this to identify you to your friends
        </Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>First Name</Text>
          <TextInput
            style={styles.textInput}
            value={firstName}
            onChangeText={handleFirstNameChange}
            placeholder="Enter your first name"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="words"
            autoFocus
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Last Name</Text>
          <TextInput
            style={styles.textInput}
            value={lastName}
            onChangeText={handleLastNameChange}
            placeholder="Enter your last name"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="words"
          />
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Choose a username</Text>
        <Text style={styles.stepSubtitle}>
          This will be your unique identifier in the app
        </Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.textInput}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter a username"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <Text style={styles.inputHint}>
            3-20 characters, letters, numbers, and underscores only
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.venmoIconContainer}>
          <Image 
            source={require('../../assets/venmo.png')} 
            style={styles.venmoLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.stepTitle}>Link Your Venmo</Text>
        <Text style={styles.stepSubtitle}>
          Connect your Venmo to make splitting expenses easier (optional)
        </Text>
      </View>

      <View style={styles.formContainer}>
        {venmoVerified ? (
          <View style={styles.verifiedContainer}>
            <View style={styles.profileContainer}>
              <ProfilePicture
                source={venmoProfilePic}
                size={50}
                username={venmoUsername}
                style={styles.profilePic}
              />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>@{venmoUsername}</Text>
                <Text style={[styles.profileStatus, { 
                  color: (venmoProfilePic && !venmoProfilePic.includes('ui-avatars.com')) 
                    ? Colors.success 
                    : Colors.textSecondary 
                }]}>
                  {(venmoProfilePic && !venmoProfilePic.includes('ui-avatars.com'))
                    ? '✓ Verified Venmo Account'
                    : '✓ Venmo Account (No Profile Picture)'
                  }
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.changeButton}
              onPress={resetVenmoProfile}
            >
              <Text style={styles.changeButtonText}>Change Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.venmoInputContainer}>
              <Text style={styles.venmoInputLabel}>Venmo Username</Text>
              <View style={styles.venmoInputWrapper}>
                <Text style={styles.atSymbol}>@</Text>
                <TextInput
                  style={styles.venmoInput}
                  value={venmoUsername}
                  onChangeText={handleUsernameChange}
                  placeholder="your-venmo-username"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                />
                
                {/* Loading indicator or checkmark on the right */}
                <View style={styles.venmoInputRightIcon}>
                  {isVerifying ? (
                    <ActivityIndicator color={Colors.accent} size="small" />
                  ) : venmoVerified ? (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
                  ) : null}
                </View>
              </View>
            </View>
            
            {/* Show verification error if any */}
            {verificationError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={Colors.error} />
                <Text style={styles.errorText}>{verificationError}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );

  const renderStep4 = () => {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Phone Number</Text>
          <Text style={styles.stepSubtitle}>
            We'll send you a verification code to confirm your number
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>🇺🇸 +1</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={handlePhoneNumberChange}
                placeholder="(555) 123-4567"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
                maxLength={14}
                autoFocus
              />
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (currentStep === 1) {
                  navigation.goBack();
                } else {
                  handlePrevStep();
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
          </View>

          {/* Progress Bar */}
          {renderProgressBar()}

          {/* Step Content */}
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}

          {/* Bottom Section */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[styles.nextButton, loading && styles.nextButtonDisabled]}
              onPress={handleNextStep}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>
                {loading ? 'Sending...' : 
                 currentStep === 1 ? 'Continue' : 
                 currentStep === 2 ? 'Continue' : 
                 currentStep === 3 ? (venmoVerified ? 'Continue' : 'Skip') : 
                 'Send Verification Code'}
              </Text>
              <Ionicons 
                name="arrow-forward" 
                size={20} 
                color="white" 
                style={styles.buttonIcon} 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signInLink}
              onPress={() => navigation.navigate('SignIn')}
            >
              <Text style={styles.signInLinkText}>
                Already have an account? <Text style={styles.signInLinkAccent}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
    ...Shadows.card,
  },

  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  progressContainer: {
    marginBottom: Spacing.xxl,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
  },
  progressText: {
    ...Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    marginBottom: Spacing.xxl,
    alignItems: 'center',
  },
  stepTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  stepSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  inputHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '08',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error + '20',
    ...Shadows.card,
  },
  errorText: {
    ...Typography.body,
    color: Colors.error,
    marginLeft: Spacing.sm,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
  },
  countryCodeText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  bottomSection: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  nextButton: {
    height: 56,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    ...Typography.title,
    color: 'white',
    fontSize: 16,
  },
  buttonIcon: {
    marginLeft: Spacing.sm,
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  signInLinkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  signInLinkAccent: {
    color: Colors.accent,
    fontWeight: '600',
  },
  // Venmo logo styles
  venmoIconContainer: {
    marginBottom: Spacing.lg,
  },
  venmoLogo: {
    width: 60,
    height: 60,
    ...Shadows.card,
  },
  // Inlined VenmoProfileDisplay styles
  verifiedContainer: {
    width: '100%',
    alignItems: 'center',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg,
    width: '100%',
    ...Shadows.card,
  },
  profilePic: {
    marginRight: 48,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    fontSize: 16,
  },
  profileStatus: {
    ...Typography.body,
    fontSize: 12,
  },
  changeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  changeButtonText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  // Inlined VenmoInputForm styles
  venmoInputContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  venmoInputLabel: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  venmoInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  atSymbol: {
    paddingLeft: Spacing.lg,
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  venmoInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  venmoInputRightIcon: {
    paddingRight: Spacing.lg,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SignUpScreen;
