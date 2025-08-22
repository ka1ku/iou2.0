import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import DeleteButton from '../../components/DeleteButton';
import {
  getEnrolledFactors,
  enrollPhoneNumberFor2FA,
  complete2FAEnrollment,
  unenroll2FA,
} from '../../services/authService';

const TwoFactorAuthScreen = ({ navigation }) => {
  const [enrolledFactors, setEnrolledFactors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    loadEnrolledFactors();
  }, []);

  const loadEnrolledFactors = async () => {
    try {
      setLoading(true);
      const factors = await getEnrolledFactors();
      setEnrolledFactors(factors);
    } catch (error) {
      console.error('Error loading enrolled factors:', error);
      Alert.alert('Error', 'Failed to load 2FA settings');
    } finally {
      setLoading(false);
    }
  };

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

  const startEnrollment = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    setEnrolling(true);
    try {
      const result = await enrollPhoneNumberFor2FA(`+1${digits}`);
      setVerificationId(result.verificationId);
      setSessionInfo(result.sessionInfo);
      setVerificationStep(true);
      Alert.alert('Success', 'Verification code sent to your phone');
    } catch (error) {
      console.error('Error starting enrollment:', error);
      Alert.alert('Error', error.message || 'Failed to start 2FA enrollment');
    } finally {
      setEnrolling(false);
    }
  };

  const completeEnrollment = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }

    setEnrolling(true);
    try {
      await complete2FAEnrollment(verificationId, otp, sessionInfo, 'Phone');
      Alert.alert('Success', '2FA enrollment completed successfully');
      
      // Reset form and reload factors
      setShowEnrollForm(false);
      setVerificationStep(false);
      setPhoneNumber('');
      setOtp('');
      setVerificationId('');
      setSessionInfo(null);
      await loadEnrolledFactors();
    } catch (error) {
      console.error('Error completing enrollment:', error);
      Alert.alert('Error', error.message || 'Failed to complete 2FA enrollment');
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async (factorUid, displayName) => {
    Alert.alert(
      'Remove 2FA Method',
      `Are you sure you want to remove "${displayName}" from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await unenroll2FA(factorUid);
              Alert.alert('Success', '2FA method removed successfully');
              await loadEnrolledFactors();
            } catch (error) {
              console.error('Error removing 2FA method:', error);
              Alert.alert('Error', error.message || 'Failed to remove 2FA method');
            }
          },
        },
      ]
    );
  };

  const cancelEnrollment = () => {
    setShowEnrollForm(false);
    setVerificationStep(false);
    setPhoneNumber('');
    setOtp('');
    setVerificationId('');
    setSessionInfo(null);
  };

  const renderEnrollmentForm = () => {
    if (!verificationStep) {
      return (
        <View style={styles.enrollForm}>
          <Text style={styles.formTitle}>Add Phone Number for 2FA</Text>
          <Text style={styles.formDescription}>
            Enter a phone number to receive verification codes for two-factor authentication.
          </Text>
          
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
              />
            </View>
          </View>

          <View style={styles.formButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={cancelEnrollment}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, enrolling && styles.buttonDisabled]}
              onPress={startEnrollment}
              disabled={enrolling}
            >
              <Text style={styles.primaryButtonText}>
                {enrolling ? 'Sending...' : 'Send Code'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.enrollForm}>
        <Text style={styles.formTitle}>Verify Phone Number</Text>
        <Text style={styles.formDescription}>
          Enter the 6-digit code sent to your phone.
        </Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Verification Code</Text>
          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            placeholder="123456"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        </View>

        <View style={styles.formButtons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={cancelEnrollment}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, enrolling && styles.buttonDisabled]}
            onPress={completeEnrollment}
            disabled={enrolling}
          >
            <Text style={styles.primaryButtonText}>
              {enrolling ? 'Verifying...' : 'Verify & Enable'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Two-Factor Authentication</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading 2FA settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Two-Factor Authentication</Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={32} color={Colors.accent} />
            <Text style={styles.infoTitle}>Enhanced Security</Text>
            <Text style={styles.infoDescription}>
              Two-factor authentication adds an extra layer of security to your account by requiring a verification code from your phone in addition to your password.
            </Text>
          </View>
        </View>

        {/* Enrolled Factors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enrolled Methods</Text>
          {enrolledFactors.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="phone-portrait-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyStateText}>No 2FA methods enrolled</Text>
              <Text style={styles.emptyStateSubtext}>
                Add a phone number to get started with two-factor authentication
              </Text>
            </View>
          ) : (
            <View style={styles.factorsList}>
              {enrolledFactors.map((factor) => (
                <View key={factor.uid} style={styles.factorItem}>
                  <View style={styles.factorInfo}>
                    <Ionicons name="phone-portrait" size={24} color={Colors.accent} />
                    <View style={styles.factorDetails}>
                      <Text style={styles.factorName}>{factor.displayName || 'Phone'}</Text>
                      <Text style={styles.factorDate}>
                        Enrolled {new Date(factor.enrollmentTime).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <DeleteButton
                    onPress={() => handleUnenroll(factor.uid, factor.displayName || 'Phone')}
                    size="medium"
                    variant="subtle"
                    testID="remove-2fa-factor"
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Add New Method */}
        {!showEnrollForm && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowEnrollForm(true)}
          >
            <Ionicons name="add-circle" size={24} color={Colors.accent} />
            <Text style={styles.addButtonText}>Add Phone Number</Text>
          </TouchableOpacity>
        )}

        {/* Enrollment Form */}
        {showEnrollForm && renderEnrollmentForm()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  header: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
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
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  descriptionContainer: {
    marginBottom: Spacing.xl,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.card,
  },
  infoTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  infoDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyStateText: {
    ...Typography.title,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  factorsList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  factorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  factorDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  factorName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  factorDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    marginBottom: Spacing.xl,
  },
  addButtonText: {
    ...Typography.body,
    color: Colors.accent,
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
  enrollForm: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  formTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  formDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
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
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
  },
  countryCodeText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  otpInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
  },
  formButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    ...Shadows.card,
  },
  primaryButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default TwoFactorAuthScreen;
