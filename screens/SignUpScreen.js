import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { sendOTP, validateAndOptimizeProfilePicture, storeTemporarySignupData, clearTemporarySignupData, getTemporarySignupData } from '../services/authService';
import VenmoProfilePicture from '../components/VenmoProfilePicture';

/**
 * Decodes HTML entities in text (e.g., &amp; -> &)
 */
const decodeHtmlEntities = (text) => {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

/**
 * Extracts profile image URL from HTML using multiple fallback methods
 * Priority: Open Graph > Twitter Card > Class-based > Data-src
 */
const extractProfileImage = (html) => {
  // Method 1: Open Graph image (most reliable)
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch?.[1]) {
    return decodeHtmlEntities(ogMatch[1]);
  }

  // Method 2: Twitter card image
  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (twitterMatch?.[1]) {
    return decodeHtmlEntities(twitterMatch[1]);
  }

  // Method 3: Profile image with specific classes
  const profileMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*class=["'][^"']*(?:profile|avatar|user)[^"']*["']/i);
  if (profileMatch?.[1]) {
    return decodeHtmlEntities(profileMatch[1]);
  }

  // Method 4: Data-src (lazy loaded images)
  const dataSrcMatch = html.match(/<img[^>]+data-src=["']([^"']+)["']/i);
  if (dataSrcMatch?.[1]) {
    return decodeHtmlEntities(dataSrcMatch[1]);
  }

  return null;
};

/**
 * Extracts display name from HTML page title
 */
const extractDisplayName = (html) => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/[^\w\s]/g, '').trim();
  }
  return null;
};

const SignUpScreen = ({ navigation }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [venmoUsername, setVenmoUsername] = useState('');
  const [venmoProfilePic, setVenmoProfilePic] = useState(null);
  const [venmoVerified, setVenmoVerified] = useState(false);
  const [verifyingVenmo, setVerifyingVenmo] = useState(false);
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
        }
      } catch (error) {
        console.error('Error loading temporary signup data:', error);
        setUserData(null);
      }
    };

    loadTemporaryData();
  }, []);

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

  /**
   * Fetches and validates Venmo profile information
   * Attempts to extract profile picture and display name from public profile page
   */
  const fetchVenmoProfile = async (username) => {
    if (!username.trim()) return;
    
    setVerifyingVenmo(true);
    try {
      const normalized = username.replace(/^@+/, '');
      const profileUrl = `https://account.venmo.com/u/${encodeURIComponent(normalized)}`;
      
      console.log('Fetching Venmo profile for:', normalized);
      
      const response = await fetch(profileUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Profile not found (${response.status})`);
      }

      const html = await response.text();
      console.log('HTML received, length:', html.length);

      // Extract profile image and display name
      const imageUrl = extractProfileImage(html);
      const displayName = extractDisplayName(html);

      // Fallback to generated avatar if no image found
      if (!imageUrl) {
        const nameForAvatar = displayName || normalized;
        imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar)}&size=200&background=3d95ce&color=fff&bold=true&font-size=0.4`;
        console.log('Using generated avatar for:', nameForAvatar);
      }

      // Ensure the image URL is absolute
      if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = `https://account.venmo.com${imageUrl}`;
      }

      // Validate and optimize the profile picture
      const validatedImageUrl = await validateAndOptimizeProfilePicture(imageUrl, displayName || normalized);

      setVenmoProfilePic(validatedImageUrl);
      setVenmoVerified(true);
      setVenmoUsername(normalized);
      
      console.log('Successfully set Venmo profile:', {
        username: normalized,
        imageUrl: validatedImageUrl,
        displayName: displayName
      });

    } catch (error) {
      console.error('Error fetching Venmo profile:', error);
      Alert.alert(
        'Could not verify automatically',
        'We could not confirm this Venmo username. You can still continue without Venmo or try again.',
        [
          { text: 'Continue Without Venmo', onPress: () => setVenmoUsername('') },
          { text: 'Try Again', style: 'cancel' },
        ]
      );
    } finally {
      setVerifyingVenmo(false);
    }
  };

  const handleVenmoUsernameSubmit = () => {
    if (!venmoUsername.trim()) {
      Alert.alert('Required Field', 'Please enter your Venmo username');
      return;
    }
    fetchVenmoProfile(venmoUsername);
  };

  const openVenmoApp = async () => {
    try {
      const normalized = (venmoUsername || '').replace(/^@+/, '');
      const venmoAppUrl = normalized
        ? `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(normalized)}&amount=0&note=Verification`
        : 'venmo://';
      const canOpen = await Linking.canOpenURL(venmoAppUrl);
      
      if (canOpen) {
        await Linking.openURL(venmoAppUrl);
      } else {
        const storeUrl = Platform.OS === 'ios' 
          ? 'https://apps.apple.com/us/app/venmo/id351727428'
          : 'https://play.google.com/store/apps/details?id=com.venmo';
        await Linking.openURL(storeUrl);
      }
    } catch (error) {
      console.error('Error opening Venmo app:', error);
      Alert.alert('Error', 'Unable to open Venmo app. Please install Venmo from the app store.');
    }
  };

  const validateStep1 = () => {
    if (!firstName.trim()) {
      Alert.alert('Required Field', 'Please enter your first name');
      return false;
    }
    if (!lastName.trim()) {
      Alert.alert('Required Field', 'Please enter your last name');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    // Venmo step - optional, always valid
    return true;
  };

  const validateStep3 = () => {
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
      if (validateStep2()) {
        // Store temporary data before proceeding to phone verification
        const tempData = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          venmoUsername: venmoVerified ? venmoUsername : null,
          venmoProfilePic: venmoVerified ? venmoProfilePic : null,
        };
        
        await storeTemporarySignupData(tempData);
        
        // Verify the data was stored before proceeding
        const storedData = await getTemporarySignupData();
        if (storedData) {
          isProceedingToVerification.current = true;
          animateStepTransition(() => setCurrentStep(3));
        } else {
          Alert.alert('Error', 'Failed to save your information. Please try again.');
        }
      }
    } else if (currentStep === 3) {
      if (validateStep3()) {
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
      Alert.alert('Error', error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 2) {
      // Clear Venmo data when going back from Venmo step
      setVenmoUsername('');
      setVenmoProfilePic(null);
      setVenmoVerified(false);
      animateStepTransition(() => setCurrentStep(1));
    } else if (currentStep === 3) {
      // Don't clear temporary data when going back from phone verification
      // This data is needed for the verification process
      isProceedingToVerification.current = false;
      animateStepTransition(() => setCurrentStep(2));
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
            { width: `${(currentStep / 3) * 100}%` }
          ]} 
        />
      </View>
      <Text style={styles.progressText}>Step {currentStep} of 3</Text>
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
            onChangeText={setFirstName}
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
            onChangeText={setLastName}
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
        <View style={styles.venmoIconContainer}>
          <View style={styles.venmoIcon}>
            <Text style={styles.venmoIconText}>V</Text>
          </View>
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
              <VenmoProfilePicture
                source={venmoProfilePic}
                size={50}
                username={venmoUsername}
                style={styles.profilePic}
              />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>@{venmoUsername}</Text>
                <Text style={styles.profileStatus}>✓ Verified Venmo Account</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => {
                setVenmoVerified(false);
                setVenmoProfilePic(null);
                setVenmoUsername('');
              }}
            >
              <Text style={styles.changeButtonText}>Change Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.setupContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Venmo Username</Text>
              <View style={styles.venmoInputContainer}>
                <Text style={styles.atSymbol}>@</Text>
                <TextInput
                  style={styles.venmoInput}
                  value={venmoUsername}
                  onChangeText={setVenmoUsername}
                  placeholder="your-venmo-username"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleVenmoUsernameSubmit}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.verifyButton, verifyingVenmo && styles.verifyButtonDisabled]}
              onPress={handleVenmoUsernameSubmit}
              disabled={verifyingVenmo}
            >
              {verifyingVenmo ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Venmo Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.openVenmoButton} onPress={openVenmoApp}>
              <Ionicons name="open-outline" size={20} color={Colors.accent} />
              <Text style={styles.openVenmoText}>Open Venmo App</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderStep3 = () => {
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
            {currentStep > 1 && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  Alert.alert(
                    'Cancel Sign Up?',
                    'Are you sure you want to cancel? All entered information will be lost.',
                    [
                      { text: 'Keep Going', style: 'cancel' },
                      { 
                        text: 'Cancel', 
                        style: 'destructive',
                        onPress: () => {
                          isProceedingToVerification.current = false; // Reset flag when canceling
                          clearTemporarySignupData();
                          navigation.navigate('Welcome');
                        }
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progress Bar */}
          {renderProgressBar()}

          {/* Step Content */}
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

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
  cancelButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
  },
  cancelButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '600',
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
  // Venmo styles
  venmoIconContainer: {
    marginBottom: Spacing.lg,
  },
  venmoIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3d95ce',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  venmoIconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  setupContainer: {
    width: '100%',
  },
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
    width: '100%',
    ...Shadows.card,
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: Spacing.md,
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
    color: Colors.success,
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
  venmoInputContainer: {
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
  verifyButton: {
    height: 44,
    backgroundColor: '#3d95ce',
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    ...Typography.title,
    color: 'white',
    fontSize: 14,
  },
  openVenmoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  openVenmoText: {
    ...Typography.body,
    color: Colors.accent,
    marginLeft: Spacing.sm,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default SignUpScreen;
