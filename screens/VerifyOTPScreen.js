import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { verifyOTP, sendOTP, resolve2FAChallenge, createUserProfile, getTemporarySignupData, clearTemporarySignupData } from '../services/authService';

const VerifyOTPScreen = ({ navigation, route }) => {
  const { phoneNumber, verificationId, isInitialAuth = true, is2FA = false, resolver = null, isSignUp = false } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [currentVerificationId, setCurrentVerificationId] = useState(verificationId);
  const [userData, setUserData] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const inputRefs = useRef([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Retrieve temporary signup data when component mounts
  useEffect(() => {
    const loadTemporaryData = async () => {
      if (isSignUp) {
        try {
          const tempData = await getTemporarySignupData();
          if (tempData) {
            setUserData(tempData);
          }
        } catch (error) {
          console.error('Error loading temporary signup data:', error);
          setUserData(null);
        }
      }
    };

    loadTemporaryData();
  }, [isSignUp]);

  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits are entered
    if (newOtp.every(digit => digit !== '') && newOtp.length === 6) {
      handleVerifyOTP(newOtp.join(''));
    }
  };

  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpCode = null) => {
    const code = otpCode || otp.join('');
    
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }

    // For React Native Firebase, verificationId might be null or 'rnfirebase-confirmation'
    // but verification still works via globalPhoneAuthState
    if (!currentVerificationId && is2FA) {
      Alert.alert('Error', 'No verification session found. Please request a new code.');
      return;
    }

    setLoading(true);
    try {
      
      let user;
      if (is2FA && resolver) {
        // Handle 2FA challenge resolution
        user = await resolve2FAChallenge(currentVerificationId, code, resolver);
      } else {
        // Handle initial phone authentication
        user = await verifyOTP(currentVerificationId, code);
        
        // If this is a signup flow, ensure we have user data
        if (isSignUp) {
          if (!userData) {
            console.error('No user data available for signup flow');
            Alert.alert(
              'Signup Data Missing',
              'Unable to create your profile. Please try signing up again.',
              [{ text: 'OK' }]
            );
            return;
          }
          
          try {
            setLoadingMessage('Creating your profile...');
            const createdUser = await createUserProfile(userData, phoneNumber);
            
            // Clear temporary data after successful profile creation
            setLoadingMessage('Finalizing your account...');
            await clearTemporarySignupData();
            
            // Add a loading buffer to ensure Firestore operation completes
            setLoadingMessage('Securing your data...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Navigate directly to main app without success alert
            setLoading(false);
            setLoadingMessage('');
            navigation.navigate('Home');
          } catch (profileError) {
            console.error('Error creating user profile:', profileError);
            
            // Reset loading state and message
            setLoadingMessage('');
            
            Alert.alert(
              'Profile Creation Failed',
              `Your phone was verified but we could not create your profile: ${profileError.message}`,
              [{ text: 'OK' }]
            );
          }
        }
      }
      
    } catch (error) {
      Alert.alert('Verification Failed', error.message);
      // Clear the OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    // Don't allow resending for 2FA challenges
    if (is2FA) {
      Alert.alert('Info', 'Cannot resend 2FA verification codes. Please try entering the code again or sign in again.');
      return;
    }

    setResendLoading(true);
    try {
      const result = await sendOTP(phoneNumber);
      setCurrentVerificationId(result.verificationId);
      setTimer(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      Alert.alert('Success', 'Verification code sent successfully');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const formatPhoneNumber = (phone) => {
    const digits = phone.replace(/\D/g, '').slice(1); // Remove +1
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (isSignUp) {
                  // Clear temporary data when going back from verification
                  clearTemporarySignupData();
                  console.log('Temporary signup data cleared when going back');
                }
                navigation.goBack();
              }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>
              {is2FA ? 'Two-Factor Authentication' : 'Verify Phone Number'}
            </Text>
            <Text style={styles.subtitle}>
              {is2FA 
                ? 'Enter the 6-digit code sent to your enrolled device'
                : `Enter the 6-digit code sent to\n${formatPhoneNumber(phoneNumber)}`
              }
            </Text>
          </View>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.otpInput,
                  digit && styles.otpInputFilled,
                  loading && styles.otpInputDisabled
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
            onPress={() => handleVerifyOTP()}
            disabled={loading || otp.some(digit => !digit)}
            activeOpacity={0.8}
          >
            <Text style={styles.verifyButtonText}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </Text>
          </TouchableOpacity>

          {/* Loading Message */}
          {loading && loadingMessage && (
            <View style={styles.loadingMessageContainer}>
              <Text style={styles.loadingMessageText}>
                {loadingMessage}
              </Text>
            </View>
          )}

          {/* Resend Section - Hide for 2FA */}
          {!is2FA && (
            <View style={styles.resendContainer}>
              {canResend ? (
                <TouchableOpacity
                  onPress={handleResendOTP}
                  disabled={resendLoading}
                  style={styles.resendButton}
                >
                  <Text style={styles.resendText}>
                    {resendLoading ? 'Sending...' : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.timerText}>
                  Resend code in {timer} seconds
                </Text>
              )}
            </View>
          )}

          {/* Info */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              Didn't receive the code? Check your signal and try again.
            </Text>
          </View>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'left',
    lineHeight: 22,
  },
  phoneNumber: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.sm,
  },
  otpInput: {
    width: 45,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.divider,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  otpInputFilled: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surface,
  },
  otpInputDisabled: {
    opacity: 0.6,
  },
  verifyButton: {
    height: 56,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    ...Typography.title,
    color: 'white',
    fontSize: 16,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  resendButton: {
    padding: Spacing.md,
  },
  resendText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
  },
  timerText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xl,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
    flex: 1,
    lineHeight: 20,
  },
  loadingMessageContainer: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.card,
  },
  loadingMessageText: {
    ...Typography.body,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});

export default VerifyOTPScreen;

