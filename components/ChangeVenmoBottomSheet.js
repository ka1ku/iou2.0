import React, { forwardRef, useImperativeHandle, useRef, useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { fetchVenmoProfile, generateFallbackAvatar } from '../utils/venmoUtils';
import ProfilePicture from './VenmoProfilePicture';
import { updateVenmoProfile } from '../services/authService';
import { useExpenseData } from '../contexts/ExpenseDataContext';
import LoadingSpinner from './LoadingSpinner';
import { useTranslation } from '../contexts/LanguageContext';

const ChangeVenmoBottomSheet = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['85%',], []);
  const [index, setIndex] = useState(-1);
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
      setVenmoProfilePic(userProfile.profilePhoto || '');
      setVenmoVerified(true);
      setLastVerifiedUsername(userProfile.venmoUsername);
    }
  }, [userProfile?.venmoUsername]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSheetChanges = useCallback((idx) => {
    setIndex(idx);
    // Reset state when closing
    if (idx === -1) {
      if (userProfile?.venmoUsername) {
        setVenmoUsername(userProfile.venmoUsername);
        setVenmoProfilePic(userProfile.profilePhoto || '');
        setVenmoVerified(true);
        setLastVerifiedUsername(userProfile.venmoUsername);
      } else {
        setVenmoUsername('');
        setVenmoProfilePic('');
        setVenmoVerified(false);
        setLastVerifiedUsername('');
      }
      setVerificationError('');
      setIsVerifying(false);
    }
  }, [userProfile]);

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
      
      setVenmoUsername(profileData.username);
      setVenmoProfilePic(profileData.imageUrl);
      
      if (profileData.userExists === true) {
        setVenmoVerified(true);
        setVerificationError(null);
        setLastVerifiedUsername(profileData.username);
      } else if (profileData.userExists === false) {
        setVenmoVerified(false);
        setVerificationError(t('components.changeVenmo.userNotFound'));
      } else {
        setVenmoVerified(false);
        setVerificationError(t('components.changeVenmo.verifyError'));
      }
    } catch (error) {
      setVenmoVerified(false);
      setVenmoProfilePic(generateFallbackAvatar(
        userProfile?.firstName || '',
        userProfile?.lastName || '',
        usernameToVerify.trim()
      ));
      setVerificationError(t('components.changeVenmo.verifyError'));
    } finally {
      setIsVerifying(false);
    }
  }, [userProfile, lastVerifiedUsername]);

  /**
   * Handle username input with debounced verification
   */
  const handleUsernameChange = useCallback((newUsername) => {
    setVerificationError(null);
    
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    setVenmoUsername(newUsername);
    
    if (newUsername.trim()) {
      setIsVerifying(true);
      setVenmoVerified(false);
    } else {
      setIsVerifying(false);
      setVenmoVerified(false);
      setVenmoProfilePic(null);
      setLastVerifiedUsername('');
    }
    
    setDebounceTimeout(setTimeout(() => {
      if (newUsername.trim()) {
        verifyVenmoProfile(newUsername);
      }
    }, 1000));
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
    
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
  }, [debounceTimeout]);

  /**
   * Handle save
   */
  const handleSave = async () => {
    if (venmoUsername.trim() && !venmoVerified && !isVerifying) {
      Alert.alert(
        t('components.changeVenmo.verificationRequired'),
        t('components.changeVenmo.verificationRequiredDesc'),
      );
      return;
    }

    if (isVerifying) {
      Alert.alert(
        t('components.changeVenmo.verificationInProgress'),
        t('components.changeVenmo.verificationInProgressDesc'),
      );
      return;
    }

    setIsSaving(true);
    try {
      const venmoData = {
        venmoUsername: venmoUsername.trim() && venmoVerified ? venmoUsername.trim() : null,
        venmoProfilePic: venmoUsername.trim() && venmoVerified ? venmoProfilePic : null,
      };

      await updateVenmoProfile(venmoData);
      
      Alert.alert(
        t('common.success'),
        venmoData.venmoUsername 
          ? t('components.changeVenmo.updateSuccess')
          : t('components.changeVenmo.removeSuccess'),
        [
          {
            text: 'OK',
            onPress: () => {
              bottomSheetRef.current?.close();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error updating Venmo profile:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('components.changeVenmo.updateError')
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

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={index}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView style={[styles.contentContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.header}>
          <View style={styles.venmoIconContainer}>
            <Image
              source={require('../assets/venmo.png')}
              style={styles.venmoLogo}
              contentFit="contain"
              transition={200}
            />
          </View>
          <Text style={styles.title}>{t('components.changeVenmo.title')}</Text>
          <Text style={styles.subtitle}>
            {t('components.changeVenmo.subtitle')}
          </Text>
        </View>

        <View style={styles.formContainer}>
          {venmoVerified ? (
            <View style={styles.verifiedContainer}>
              <View style={styles.profileContainer}>
                <ProfilePicture
                  source={venmoProfilePic}
                  size={48}
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
                      ? '✓ ' + t('components.changeVenmo.verified')
                      : '✓ ' + t('components.changeVenmo.noProfilePic')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.changeButton}
                onPress={resetVenmoProfile}
              >
                <Text style={styles.changeButtonText}>{t('components.changeVenmo.changeAccount')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.venmoInputContainer}>
                <Text style={styles.venmoInputLabel}>{t('components.changeVenmo.usernameLabel')}</Text>
                <View style={styles.venmoInputWrapper}>
                  <Text style={styles.atSymbol}>@</Text>
                  <BottomSheetTextInput
                    style={styles.venmoInput}
                    value={venmoUsername}
                    onChangeText={handleUsernameChange}
                    placeholder={t('components.changeVenmo.usernamePlaceholder')}
                    placeholderTextColor={Colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                    keyboardType="default"
                  />

                  <View style={styles.venmoInputRightIcon}>
                    {isVerifying ? (
                      <LoadingSpinner size="small" />
                    ) : venmoVerified ? (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
                    ) : null}
                  </View>
                </View>
              </View>

              {verificationError && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color={Colors.error} />
                  <Text style={styles.errorText}>{verificationError}</Text>
                </View>
              )}

              {!venmoUsername.trim() && (
                <Text style={styles.helperText}>
                  {t('components.changeVenmo.removeHint')}
                </Text>
              )}
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <LoadingSpinner size="small" color={Colors.white} />
          ) : (
            <>
              <Text style={styles.saveButtonText}>{t('components.changeVenmo.save')}</Text>
              <Ionicons name="checkmark" size={20} color="white" style={styles.buttonIcon} />
            </>
          )}
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
});

ChangeVenmoBottomSheet.displayName = 'ChangeVenmoBottomSheet';

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    ...Shadows.card,
  },
  handleIndicator: {
    backgroundColor: Colors.divider,
    width: 40,
    height: 4,
    marginTop: Spacing.sm,
  },
  contentContainer: {
    flex: 1,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  venmoIconContainer: {
    marginBottom: Spacing.md,
    // Eliminated heavy shadow for simpler look
  },
  venmoLogo: {
    width: 48,
    height: 48,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  formContainer: {
    flex: 1,
    marginBottom: Spacing.lg,
  },
  verifiedContainer: {
    width: '100%',
    alignItems: 'center',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background, // Flat background instead of card
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  profilePic: {
    // Removed margin since it wasn't being applied to the container
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  profileName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    fontSize: 16,
  },
  profileStatus: {
    ...Typography.caption,
    fontSize: 12,
  },
  changeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  changeButtonText: {
    ...Typography.body,
    color: Colors.brand,
    fontWeight: '600',
    fontSize: 14,
  },
  venmoInputContainer: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  venmoInputLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  venmoInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider, // Use cleaner border instead of shadow
  },
  atSymbol: {
    paddingLeft: Spacing.sm,
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  venmoInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: Spacing.sm,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  venmoInputRightIcon: {
    paddingRight: Spacing.sm,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5', // Lighter error bg
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  errorText: {
    ...Typography.body,
    color: Colors.error,
    marginLeft: Spacing.xs,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  helperText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
    fontSize: 12,
  },
  saveButton: {
    height: 56,
    backgroundColor: Colors.brand,
    borderRadius: Radius.pill, // Modern pill shape button
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: Spacing.xs,
    color: Colors.surface,
  },
});

export default ChangeVenmoBottomSheet;
