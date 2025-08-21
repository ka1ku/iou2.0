import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { sendOTP, handleMultiFactorError } from '../services/authService';

const SignInScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleSendOTP = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    // Extract digits only for validation
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting to send OTP to:', `+1${digits}`);
      const result = await sendOTP(`+1${digits}`);
      
      console.log('OTP sent successfully, navigating to verify screen');
      // Navigate to OTP verification screen with verificationId
      navigation.navigate('VerifyOTP', { 
        phoneNumber: `+1${digits}`,
        verificationId: result.verificationId,
        isInitialAuth: true
      });
    } catch (error) {
      console.error('Error in handleSendOTP:', error);
      
      // Check if it's a multi-factor auth error
      try {
        const mfaResult = await handleMultiFactorError(error);
        if (mfaResult.type === 'multi-factor-required') {
          console.log('Multi-factor auth required, navigating to 2FA screen');
          navigation.navigate('VerifyOTP', {
            phoneNumber: mfaResult.phoneNumber,
            verificationId: mfaResult.verificationId,
            isInitialAuth: false,
            is2FA: true,
            resolver: mfaResult.resolver
          });
          return;
        }
      } catch (mfaError) {
        // If MFA handling fails, fall through to regular error handling
        console.log('MFA handling failed, treating as regular error');
      }
      
      Alert.alert('Error', error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
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
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your existing account</Text>
          </View>

          {/* Phone Number Input */}
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
                  maxLength={14} // (XXX) XXX-XXXX format
                  autoFocus
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.sendButton, loading && styles.sendButtonDisabled]}
              onPress={handleSendOTP}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.sendButtonText}>
                {loading ? 'Sending...' : 'Send Verification Code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signUpLink}
              onPress={() => navigation.navigate('SignUp')}
            >
              <Text style={styles.signUpLinkText}>
                Don't have an account? <Text style={styles.signUpLinkAccent}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Info Section */}
          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark-outline" size={24} color={Colors.accent} />
              <Text style={styles.infoText}>
                We'll send you a verification code via SMS
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="lock-closed-outline" size={24} color={Colors.accent} />
              <Text style={styles.infoText}>
                Your phone number is kept secure and private
              </Text>
            </View>
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
  },
  formContainer: {
    marginBottom: Spacing.xxl,
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
  sendButton: {
    height: 56,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    ...Typography.title,
    color: 'white',
    fontSize: 16,
  },
  infoContainer: {
    marginTop: Spacing.xl,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
    flex: 1,
    lineHeight: 20,
  },
  recaptchaContainer: {
    position: 'absolute',
    top: -1000, // Hide off-screen
    left: -1000,
    width: 1,
    height: 1,
    opacity: 0,
  },
  recaptchaWebView: {
    width: 1,
    height: 1,
  },
  signUpLink: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  signUpLinkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  signUpLinkAccent: {
    color: Colors.accent,
    fontWeight: '600',
  },

});

export default SignInScreen;