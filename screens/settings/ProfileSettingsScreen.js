import React, { useState, useEffect } from 'react';
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

const ProfileSettingsScreen = ({ navigation }) => {
  const { userProfile, refreshUserProfile } = useExpenseData();
  
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
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const saveProfile = async () => {
    if (!hasChanges) return;
    
    setIsLoading(true);
    try {
      await updateUserProfile(localProfile);
      await refreshUserProfile();
      setHasChanges(false);
      Alert.alert('Success', 'Profile updated successfully! Your changes have been applied to all your expenses.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>Loading profile...</Text>
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
        <Text style={styles.headerTitle}>Profile Settings</Text>
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
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Profile Photo</Text>
            <View style={styles.photoCard}>
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
                <View style={styles.editPhotoButton}>
                  <Ionicons name="camera" size={18} color={Colors.white} />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Tap to change photo</Text>
            </View>
          </View>

          {/* Personal Information */}
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.settingsList}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>FIRST NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={localProfile.firstName}
                  onChangeText={(value) => handleInputChange('firstName', value)}
                  placeholder="Enter first name"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>LAST NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={localProfile.lastName}
                  onChangeText={(value) => handleInputChange('lastName', value)}
                  placeholder="Enter last name"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>

              <View style={[styles.inputContainer, styles.lastInputContainer]}>
                <Text style={styles.inputLabel}>USERNAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={localProfile.username}
                  onChangeText={(value) => handleInputChange('username', value)}
                  placeholder="Enter username"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          {hasChanges && (
            <View style={styles.saveButtonContainer}>
              <Button
                title="Save Changes"
                onPress={saveProfile}
                disabled={isLoading}
                loading={isLoading}
                variant="primary"
                fullWidth
                icon="checkmark-circle"
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
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
  settingsSection: {
    margin: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  photoCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.card,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profilePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.avatar,
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.card,
    ...Shadows.button,
  },
  photoHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  settingsList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  lastInputContainer: {
    marginBottom: 0,
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
  saveButtonContainer: {
    margin: Spacing.lg,
    marginTop: Spacing.md,
  },
});

export default ProfileSettingsScreen;
