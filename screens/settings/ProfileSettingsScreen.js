import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import Button from '../../components/Button';
import { useExpenseData } from '../../contexts/ExpenseDataContext';
import { updateUserProfile } from '../../services/authService';
import LoadingSpinner from '../../components/LoadingSpinner';
import ChangeVenmoBottomSheet from '../../components/ChangeVenmoBottomSheet';

import { useTranslation } from '../../contexts/LanguageContext';

const ProfileSettingsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { userProfile } = useExpenseData();
  const venmoBottomSheetRef = useRef(null);
  
  const [localProfile, setLocalProfile] = useState({
    firstName: '',
    lastName: '',
    username: '',
    profilePhoto: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (userProfile) {
      setLocalProfile({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        username: userProfile.username || '',
        profilePhoto: userProfile.profilePhoto || null,
      });
    }
  }, [userProfile]);

  const handleInputChange = (field, value) => {
    setLocalProfile(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setLocalProfile(prev => ({
          ...prev,
          profilePhoto: result.assets[0].uri
        }));
        setHasChanges(true);
      }
    } catch (error) {
      Alert.alert(t('settings.profileSettings.error'), t('settings.profileSettings.selectImageError'));
    }
  };

  const saveProfile = async () => {
    if (!hasChanges) return;
    
    setIsLoading(true);
    try {
      await updateUserProfile(localProfile);

      setHasChanges(false);
      Alert.alert(t('settings.profileSettings.success'), t('settings.profileSettings.updateSuccess'), [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert(t('settings.profileSettings.error'), error.message || t('settings.profileSettings.updateError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>{t('settings.profileSettings.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.profileSettings.title')}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <TouchableOpacity 
              style={styles.photoContainer}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              {localProfile.profilePhoto ? (
                <Image 
                  source={{ uri: localProfile.profilePhoto }} 
                  style={styles.profileImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={48} color={Colors.white} />
                </View>
              )}
              <View style={styles.editIconBadge}>
                <Ionicons name="camera" size={16} color={Colors.white} />
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>{t('settings.profileSettings.changePhoto')}</Text>
          </View>

          {/* Personal Information */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('settings.profileSettings.firstName')}</Text>
              <TextInput
                style={styles.textInput}
                value={localProfile.firstName}
                onChangeText={(value) => handleInputChange('firstName', value)}
                placeholder={t('settings.profileSettings.firstName')}
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('settings.profileSettings.lastName')}</Text>
              <TextInput
                style={styles.textInput}
                value={localProfile.lastName}
                onChangeText={(value) => handleInputChange('lastName', value)}
                placeholder={t('settings.profileSettings.lastName')}
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('settings.profileSettings.username')}</Text>
              <TextInput
                style={styles.textInput}
                value={localProfile.username}
                onChangeText={(value) => handleInputChange('username', value)}
                placeholder="@username"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Venmo Account Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{t('settings.profileSettings.paymentMethods')}</Text>
            <TouchableOpacity 
              style={styles.venmoRow}
              onPress={() => venmoBottomSheetRef.current?.open()}
              activeOpacity={0.6}
            >
              <View style={styles.venmoRowLeft}>
                <View style={styles.venmoIconWrapper}>
                  <Image
                    source={require('../../assets/venmo.png')}
                    style={styles.venmoIcon}
                    contentFit="contain"
                  />
                </View>
                <View style={styles.venmoTextContainer}>
                  <Text style={styles.venmoLabel}>{t('settings.profileSettings.venmo')}</Text>
                  <Text style={styles.venmoValue}>
                    {userProfile?.venmoUsername ? `@${userProfile.venmoUsername}` : t('settings.profileSettings.notConnected')}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.infoText}>
            {t('settings.profileSettings.visibilityInfo')}
          </Text>

          {/* Save Button */}
          {hasChanges && (
            <View style={styles.saveButtonContainer}>
              <Button
                title={t('settings.profileSettings.save')}
                onPress={saveProfile}
                disabled={isLoading}
                loading={isLoading}
                variant="primary"
                fullWidth
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ChangeVenmoBottomSheet ref={venmoBottomSheetRef} />
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
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    // Seamless header
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
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
  photoSection: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.surface,
  },
  profilePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: Colors.surface,
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
  },
  photoHint: {
    ...Typography.label,
    color: Colors.brand,
    marginTop: Spacing.xs,
  },
  formContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.card,
    elevation: 2,
    shadowOpacity: 0.05,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    height: 56,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body1,
    color: Colors.textPrimary,
    width: 100,
  },
  textInput: {
    flex: 1,
    ...Typography.body1,
    color: Colors.textSecondary, // Input string color (often lighter if existing value, or dark)
    // Actually standard input text should be primary
    color: Colors.textPrimary,
    height: '100%',
    textAlign: 'right', // iOS style usually aligns right for values? Or left. Let's stick to standard left for now but iOS settings often puts Value on right.
    // Let's keep it left for better editing experience, or right if it feels more like 'Detail' view. 
    // Generally editable fields are left-aligned or right-aligned. Let's try right-aligned for 'settings' style but for text input left is safer for long names.
    textAlign: 'left',
  },
  infoText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  saveButtonContainer: {
    margin: Spacing.lg,
  },
  sectionContainer: {
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  venmoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Shadows.card,
    elevation: 2,
    shadowOpacity: 0.05,
  },
  venmoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  venmoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  venmoIcon: {
    width: 24,
    height: 24,
  },
  venmoTextContainer: {
    flex: 1,
  },
  venmoLabel: {
    ...Typography.body1,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  venmoValue: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 13,
  },
});

export default ProfileSettingsScreen;
