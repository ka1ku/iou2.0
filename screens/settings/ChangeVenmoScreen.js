import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import { fetchVenmoProfile, generateFallbackAvatar } from '../../utils/venmoUtils';
import ProfilePicture from '../../components/VenmoProfilePicture';
import { updateVenmoProfile } from '../../services/authService';
import { useExpenseData } from '../../contexts/ExpenseDataContext';

const ChangeVenmoScreen = ({ navigation }) => {
  const { userProfile } = useExpenseData();
  const [venmoUsername, setVenmoUsername] = useState(userProfile?.venmoUsername || '');
  const [venmoProfilePic, setVenmoProfilePic] = useState('');
  const [venmoVerified, setVenmoVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState(null);
  const [lastVerifiedUsername, setLastVerifiedUsername] = useState('');

  // Initialize with current Venmo if exists
  useEffect(() => {
    if (userProfile?.venmoUsername) {
      setVenmoUsername(userProfile.venmoUsername);
      // Set initial profile pic from userProfile, but verification will update it
      setVenmoProfilePic(userProfile.profilePhoto || '');
      setVenmoVerified(true);
      setLastVerifiedUsername(userProfile.venmoUsername);
    }
  }, [userProfile?.venmoUsername]);

  /**
   * Verify Venmo profile
   */
  const verifyVenmoProfile = useCallback(async (usernameToVerify) => {
    if (!usernameToVerify.trim()) {
      setVenmoVerified(false);
      setVerificationError('');
      return;
    }

    if (usernameToVerify.trim() === lastVerifiedUsername) {
      // Already verified this username, skip
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    
    try {
      const profileData = await fetchVenmoProfile(
        usernameToVerify,
        userProfile?.firstName || '',
        userProfile?.lastName || ''
      );
      
      // Always set the username and profile picture
      setVenmoUsername(profileData.username);
      setVenmoProfilePic(profileData.imageUrl);
      
      // Use the userExists field to determine verification status
      if (profileData.userExists === true) {
        // User definitely exists
        setVenmoVerified(true);
        setVerificationError(null);
        setLastVerifiedUsername(profileData.username);
      } else if (profileData.userExists === false) {
        // User definitely doesn't exist
        setVenmoVerified(false);
        setVerificationError('Venmo user does not exist. Please check the username and try again.');
      } else {
        // userExists is null - network or other error, can't determine
        setVenmoVerified(false);
        setVerificationError('Unable to verify Venmo account. Please check your connection and try again.');
      }
    } catch (error) {
      setVenmoVerified(false);
      setVenmoProfilePic(generateFallbackAvatar(
        userProfile?.firstName || '',
        userProfile?.lastName || '',
        usernameToVerify.trim()
      ));
      setVerificationError('Unable to verify Venmo account. Please check your connection and try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [userProfile, lastVerifiedUsername]);

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
  }, [verifyVenmoProfile, debounceTimeout]);

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
   * Handle save
   */
  const handleSave = async () => {
    // If there's a username entered but it's not verified, prevent saving
    if (venmoUsername.trim() && !venmoVerified && !isVerifying) {
      Alert.alert(
        'Verification Required',
        'Please wait for Venmo verification to complete or enter a valid Venmo username.',
      );
      return;
    }

    // If verification is in progress, prevent saving
    if (isVerifying) {
      Alert.alert(
        'Verification in Progress',
        'Please wait for Venmo verification to complete.',
      );
      return;
    }

    setIsSaving(true);
    try {
      // If username is empty, remove Venmo (set to null)
      // If username exists and is verified, use it
      const venmoData = {
        venmoUsername: venmoUsername.trim() && venmoVerified ? venmoUsername.trim() : null,
        venmoProfilePic: venmoUsername.trim() && venmoVerified ? venmoProfilePic : null,
      };

      await updateVenmoProfile(venmoData);
      
      Alert.alert(
        'Success',
        venmoData.venmoUsername 
          ? 'Your Venmo account has been updated successfully.'
          : 'Your Venmo account has been removed successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error updating Venmo profile:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to update Venmo account. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Venmo</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.stepHeader}>
              <View style={styles.venmoIconContainer}>
                <Image
                  source={require('../../assets/venmo.png')}
                  style={styles.venmoLogo}
                  contentFit="contain"
                  transition={200}
                />
              </View>
              <Text style={styles.stepTitle}>Link Your Venmo</Text>
              <Text style={styles.stepSubtitle}>
                Connect your Venmo to make splitting expenses easier
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
                      <Text
                        style={[
                          styles.profileStatus,
                          {
                            color:
                              venmoProfilePic && !venmoProfilePic.includes('ui-avatars.com')
                                ? Colors.success
                                : Colors.textSecondary,
                          },
                        ]}
                      >
                        {venmoProfilePic && !venmoProfilePic.includes('ui-avatars.com')
                          ? '✓ Verified Venmo Account'
                          : '✓ Venmo Account (No Profile Picture)'}
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
                        keyboardType="default"
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

                  {!venmoUsername.trim() && (
                    <Text style={styles.helperText}>
                      Leave blank to remove your Venmo account
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text style={styles.saveButtonText}>Save Changes</Text>
                <Ionicons name="checkmark" size={20} color="white" style={styles.buttonIcon} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.xl,
  },
  stepHeader: {
    marginBottom: Spacing.xxl,
    alignItems: 'center',
  },
  venmoIconContainer: {
    marginBottom: Spacing.lg,
  },
  venmoLogo: {
    width: 60,
    height: 60,
    ...Shadows.card,
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
  verifiedContainer: {
    width: '100%',
    alignItems: 'center',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
    width: '100%',
    ...Shadows.card,
  },
  profilePic: {
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
    backgroundColor: Colors.card,
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
  helperText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bottomSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  saveButton: {
    height: 56,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...Typography.title,
    color: 'white',
    fontSize: 16,
  },
  buttonIcon: {
    marginLeft: Spacing.sm,
  },
});

export default ChangeVenmoScreen;

