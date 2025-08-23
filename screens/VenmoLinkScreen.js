import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { sendOTP } from '../services/authService';
import { useVenmoProfile } from '../hooks/useVenmoProfile';
import VenmoProfileDisplay from '../components/VenmoProfileDisplay';
import VenmoInputForm from '../components/VenmoInputForm';

const VenmoLinkScreen = ({ navigation, route }) => {
  const { firstName, lastName, phoneNumber, isSignUp } = route.params;
  const [loading, setLoading] = useState(false);
  
  // Use the hook with correct variable names
  const {
    username,
    venmoProfilePic,
    venmoVerified,
    isVerifying,
    verificationError,
    handleUsernameChange,
    resetVenmoProfile,
    getVenmoData
  } = useVenmoProfile(firstName, lastName);

  /**
   * Handles Venmo username submission
   */
  const handleVenmoUsernameSubmit = () => {
    // This is now handled automatically by the hook
    // No need to manually call verification
  };

  const handleSkipVenmo = () => {
    Alert.alert(
      'Skip Venmo Setup?',
      'You can always link your Venmo account later from your profile settings.',
      [
        { text: 'Go Back', style: 'cancel' },
        { text: 'Skip for Now', onPress: proceedWithSignUp }
      ]
    );
  };

  const proceedWithSignUp = async () => {
    setLoading(true);
    try {
      const result = await sendOTP(phoneNumber); // Don't skip existence check for signup
      
      const venmoData = getVenmoData();
      navigation.navigate('VerifyOTP', { 
        phoneNumber,
        verificationId: result.verificationId,
        isInitialAuth: true,
        isSignUp: true,
        userData: {
          firstName,
          lastName,
          venmoUsername: venmoData.verified ? venmoData.username : null,
          venmoProfilePic: venmoData.verified ? venmoData.profilePic : null,
        }
      });
    } catch (error) {
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

  const renderVenmoSetup = () => {
    if (venmoVerified) {
      return (
        <VenmoProfileDisplay
          username={username}
          profilePic={venmoProfilePic}
          onChangeAccount={resetVenmoProfile}
          profileSize={60}
        />
      );
    }

    return (
      <VenmoInputForm
        username={username}
        onUsernameChange={handleUsernameChange}
        verifying={isVerifying}
        verified={venmoVerified}
      />
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
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Link Venmo</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <View style={styles.venmoIcon}>
                <Text style={styles.venmoIconText}>V</Text>
              </View>
            </View>

            <Text style={styles.mainTitle}>Connect Your Venmo</Text>
            <Text style={styles.subtitle}>
              Link your Venmo account to make splitting expenses with friends even easier
            </Text>

            {renderVenmoSetup()}

            {/* Show verification error if any */}
            {verificationError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{verificationError}</Text>
              </View>
            )}

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefit}>
                <Ionicons name="flash-outline" size={24} color={Colors.accent} />
                <Text style={styles.benefitText}>Instant payments</Text>
              </View>
              <View style={styles.benefit}>
                <Ionicons name="people-outline" size={24} color={Colors.accent} />
                <Text style={styles.benefitText}>Split with anyone</Text>
              </View>
              <View style={styles.benefit}>
                <Ionicons name="shield-checkmark-outline" size={24} color={Colors.accent} />
                <Text style={styles.benefitText}>Secure & trusted</Text>
              </View>
            </View>
          </View>

          {/* Bottom Buttons */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[
                styles.continueButton, 
                loading && styles.continueButtonDisabled,
                !venmoVerified && styles.continueButtonSecondary
              ]}
              onPress={proceedWithSignUp}
              disabled={loading}
            >
              <Text style={styles.continueButtonText}>
                {loading ? 'Creating Account...' : venmoVerified ? 'Create Account' : 'Continue Without Venmo'}
              </Text>
            </TouchableOpacity>

            {!venmoVerified && (
              <TouchableOpacity style={styles.skipButton} onPress={handleSkipVenmo}>
                <Text style={styles.skipButtonText}>Skip for now</Text>
              </TouchableOpacity>
            )}
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
  content: {
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  venmoIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    backgroundColor: '#3d95ce',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  venmoIconText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  mainTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  errorContainer: {
    backgroundColor: Colors.error + '20',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  errorText: {
    ...Typography.body,
    color: Colors.error,
    textAlign: 'center',
  },
  benefitsContainer: {
    width: '100%',
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  benefitText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
  },
  bottomSection: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    width: '100%',
  },
  continueButton: {
    height: 56,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  continueButtonSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    ...Typography.title,
    color: 'white',
    fontSize: 16,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
});

export default VenmoLinkScreen;
