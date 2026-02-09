import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import LoadingSpinner from '../../components/LoadingSpinner';
import DeleteButton from '../../components/DeleteButton';
import {
  getEnrolledFactors,
  enrollPhoneNumberFor2FA,
  complete2FAEnrollment,
  unenroll2FA,
} from '../../services/authService';

import { useTranslation } from '../../contexts/LanguageContext';

const TwoFactorAuthScreen = ({ navigation }) => {
  const { t } = useTranslation();
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
      Alert.alert(t('common.error'), t('auth.twoFactor.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (text) => {
    const cleaned = text.replace(/\D/g, '');
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
      Alert.alert(t('common.error'), t('auth.twoFactor.errors.missingPhone'));
      return;
    }

    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      Alert.alert(t('common.error'), t('auth.twoFactor.errors.invalidPhone'));
      return;
    }

    setEnrolling(true);
    try {
      const result = await enrollPhoneNumberFor2FA(`+1${digits}`);
      setVerificationId(result.verificationId);
      setSessionInfo(result.sessionInfo);
      setVerificationStep(true);
      Alert.alert(t('common.success'), t('auth.twoFactor.success.codeSent'));
    } catch (error) {
      Alert.alert(t('common.error'), error.message || t('auth.twoFactor.errors.startFailed'));
    } finally {
      setEnrolling(false);
    }
  };

  const completeEnrollment = async () => {
    if (otp.length !== 6) {
      Alert.alert(t('common.error'), t('auth.twoFactor.errors.invalidCode'));
      return;
    }

    setEnrolling(true);
    try {
      await complete2FAEnrollment(verificationId, otp, sessionInfo, 'Phone');
      Alert.alert(t('common.success'), t('auth.twoFactor.success.enrolled'));
      
      // Reset form and reload factors
      setShowEnrollForm(false);
      setVerificationStep(false);
      setPhoneNumber('');
      setOtp('');
      setVerificationId('');
      setSessionInfo(null);
      await loadEnrolledFactors();
    } catch (error) {
      Alert.alert(t('common.error'), error.message || t('auth.twoFactor.errors.completeFailed'));
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async (factorUid, displayName) => {
    Alert.alert(
      t('auth.twoFactor.methods.remove.title'),
      t('auth.twoFactor.methods.remove.message', { name: displayName }),
      [
        { text: t('auth.twoFactor.methods.remove.cancel'), style: 'cancel' },
        {
          text: t('auth.twoFactor.methods.remove.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await unenroll2FA(factorUid);
              Alert.alert(t('common.success'), t('auth.twoFactor.success.removed'));
              await loadEnrolledFactors();
            } catch (error) {
              Alert.alert(t('common.error'), error.message || t('auth.twoFactor.methods.removeFailed'));
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
          <Text style={styles.formTitle}>{t('auth.twoFactor.add.title')}</Text>
          <Text style={styles.formDescription}>
            {t('auth.twoFactor.add.description')}
          </Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('auth.twoFactor.add.label')}</Text>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>{t('auth.common.usCountryCode')}</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={handlePhoneNumberChange}
                placeholder={t('auth.twoFactor.add.placeholder')}
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
              <Text style={styles.cancelButtonText}>{t('auth.twoFactor.add.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, enrolling && styles.buttonDisabled]}
              onPress={startEnrollment}
              disabled={enrolling}
            >
              <Text style={styles.primaryButtonText}>
                {enrolling ? t('auth.twoFactor.add.sending') : t('auth.twoFactor.add.send')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.enrollForm}>
        <Text style={styles.formTitle}>{t('auth.twoFactor.verify.title')}</Text>
        <Text style={styles.formDescription}>
          {t('auth.twoFactor.verify.description')}
        </Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('auth.twoFactor.verify.label')}</Text>
          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            placeholder={t('auth.twoFactor.verify.placeholder')}
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
            <Text style={styles.cancelButtonText}>{t('auth.twoFactor.verify.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, enrolling && styles.buttonDisabled]}
            onPress={completeEnrollment}
            disabled={enrolling}
          >
            <Text style={styles.primaryButtonText}>
              {enrolling ? t('auth.twoFactor.verify.verifying') : t('auth.twoFactor.verify.submit')}
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
          <Text style={styles.title}>{t('auth.twoFactor.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
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
          <Text style={styles.title}>{t('auth.twoFactor.screenTitle')}</Text>
        </View>

        <View style={styles.descriptionContainer}>
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={32} color={Colors.accent} />
            <Text style={styles.infoTitle}>{t('auth.twoFactor.description.title')}</Text>
            <Text style={styles.infoDescription}>
              {t('auth.twoFactor.description.text')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('auth.twoFactor.methods.title')}</Text>
          {enrolledFactors.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="phone-portrait-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyStateText}>{t('auth.twoFactor.methods.empty')}</Text>
              <Text style={styles.emptyStateSubtext}>
                {t('auth.twoFactor.methods.emptyDesc')}
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
                        {t('auth.twoFactor.methods.enrolledAt', { date: new Date(factor.enrollmentTime).toLocaleDateString() })}
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

        {!showEnrollForm && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowEnrollForm(true)}
          >
            <Ionicons name="add-circle" size={24} color={Colors.accent} />
            <Text style={styles.addButtonText}>{t('auth.twoFactor.add.button')}</Text>
          </TouchableOpacity>
        )}

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
