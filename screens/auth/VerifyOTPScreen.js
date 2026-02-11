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
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import { verifyOTP, sendOTP, resolve2FAChallenge, createUserProfile, getTemporarySignupData, clearTemporarySignupData } from '../../services/authService';
import LoadingSpinner from '../../components/LoadingSpinner';

  import { useTranslation } from '../../contexts/LanguageContext';

const VerifyOTPScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
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

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

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
      Alert.alert(t('common.error'), t('auth.verifyOTP.errors.invalidCodeLength'));
      return;
    }

    if (!currentVerificationId && is2FA) {
      Alert.alert(t('common.error'), t('auth.verifyOTP.errors.noSession'));
      return;
    }

    setLoading(true);
    try {
      
      let user;
      if (is2FA && resolver) {
        user = await resolve2FAChallenge(currentVerificationId, code, resolver);
      } else {
        user = await verifyOTP(currentVerificationId, code);
        
        if (isSignUp) {
          if (!userData) {
            Alert.alert(
              t('auth.verifyOTP.errors.signupMissing'),
              t('auth.verifyOTP.errors.signupMissingDesc'),
              [{ text: 'OK' }]
            );
            return;
          }
          
          try {
            const hasRealVenmoProfile = userData.venmoProfilePic && !userData.venmoProfilePic.includes('ui-avatars.com');
            
            if (hasRealVenmoProfile) {
              setLoadingMessage(t('auth.verifyOTP.loading.uploading'));
            } else {
              setLoadingMessage(t('auth.verifyOTP.loading.creating'));
            }
            
            const createdUser = await createUserProfile(userData, phoneNumber);
            
            setLoadingMessage(t('auth.verifyOTP.loading.finalizing'));
            await clearTemporarySignupData();
            
            setLoadingMessage(t('auth.verifyOTP.loading.securing'));
            await new Promise(resolve => setTimeout(resolve, 1000));

            setLoading(false);
            setLoadingMessage('');
            // Navigation handled automatically by auth state listener in App.js
          } catch (profileError) {
            
            setLoadingMessage('');
            
            Alert.alert(
              t('auth.verifyOTP.errors.profileFailed'),
              t('auth.verifyOTP.errors.profileFailedDesc', { message: profileError.message }),
              [{ text: 'OK' }]
            );
          }
        }
      }
      
    } catch (error) {
      Alert.alert(t('auth.verifyOTP.errors.verificationFailed'), error.message);
      // Clear the OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (is2FA) {
      Alert.alert(t('common.info'), t('auth.verifyOTP.errors.noResend2FA'));
      return;
    }

    setResendLoading(true);
    try {
      const result = await sendOTP(phoneNumber, true); // Skip existence check for resend
      setCurrentVerificationId(result.verificationId);
      setTimer(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      Alert.alert(t('common.success'), t('auth.verifyOTP.success.resend'));
    } catch (error) {
      Alert.alert(t('common.error'), error.message || t('auth.verifyOTP.errors.resendFailed'));
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
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (isSignUp) {
                clearTemporarySignupData();
                }
                navigation.goBack();
              }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>
              {is2FA ? t('auth.verifyOTP.title2FA') : t('auth.verifyOTP.title')}
            </Text>
            <Text style={styles.subtitle}>
              {is2FA 
                ? t('auth.verifyOTP.subtitle2FA')
                : t('auth.verifyOTP.subtitle', { phone: formatPhoneNumber(phoneNumber) })
              }
            </Text>
          </View>

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

          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
            onPress={() => handleVerifyOTP()}
            disabled={loading || otp.some(digit => !digit)}
            activeOpacity={0.8}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" color={Colors.white} />
                <Text style={styles.verifyButtonText}>{t('auth.verifyOTP.verifying')}</Text>
              </>
            ) : (
              <Text style={styles.verifyButtonText}>{t('auth.verifyOTP.button')}</Text>
            )}
          </TouchableOpacity>

          {loading && loadingMessage && (
            <View style={styles.loadingMessageContainer}>
              <LoadingSpinner size="small" />
              <Text style={styles.loadingMessageText}>
                {loadingMessage}
              </Text>
            </View>
          )}

          {!is2FA && (
            <View style={styles.resendContainer}>
              {canResend ? (
                <TouchableOpacity
                  onPress={handleResendOTP}
                  disabled={resendLoading}
                  style={styles.resendButton}
                >
                  {resendLoading ? (
                    <>
                      <LoadingSpinner size="small" color={Colors.accent} />
                      <Text style={styles.resendText}>{t('auth.verifyOTP.sending')}</Text>
                    </>
                  ) : (
                    <Text style={styles.resendText}>{t('auth.verifyOTP.resend')}</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <Text style={styles.timerText}>
                  {t('auth.verifyOTP.resendTimer', { timer })}
                </Text>
              )}
            </View>
          )}

          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              {t('auth.verifyOTP.info')}
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
    flexDirection: 'row',
    gap: Spacing.sm,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    ...Shadows.card,
  },
  loadingMessageText: {
    ...Typography.body,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});

export default VerifyOTPScreen;

