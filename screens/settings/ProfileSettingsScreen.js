import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
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
    phoneNumber: '',
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
        phoneNumber: userProfile.phoneNumber || '',
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
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Photo Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Profile Photo</Text>
          <View style={styles.settingsList}>
            <View style={styles.photoSection}>
              <View style={styles.photoContainer}>
                {localProfile.profilePhoto ? (
                  <Image 
                    source={{ uri: localProfile.profilePhoto }} 
                    style={styles.profileImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Ionicons name="person" size={40} color={Colors.textSecondary} />
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.changePhotoButton}
                onPress={pickImage}
              >
                <Ionicons name="camera" size={16} color={Colors.accent} />
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.settingsList}>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>First Name</Text>
              <TextInput
                style={styles.textInput}
                value={localProfile.firstName}
                onChangeText={(value) => handleInputChange('firstName', value)}
                placeholder="Enter first name"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Last Name</Text>
              <TextInput
                style={styles.textInput}
                value={localProfile.lastName}
                onChangeText={(value) => handleInputChange('lastName', value)}
                placeholder="Enter last name"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.textInput}
                value={localProfile.username}
                onChangeText={(value) => handleInputChange('username', value)}
                placeholder="Enter username"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={[styles.textInput, styles.disabledInput]}
                value={localProfile.phoneNumber}
                editable={false}
                placeholder="Phone number"
                placeholderTextColor={Colors.textSecondary}
              />
              <Text style={styles.disabledNote}>Phone number cannot be changed</Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        {hasChanges && (
          <View style={styles.saveSection}>
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={saveProfile}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="small" color={Colors.accent} />
                  <Text style={styles.saveButtonText}>Updating profile...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={24} color={Colors.accent} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
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
  settingsList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  photoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  photoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
    ...Shadows.avatar,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profilePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  changePhotoText: {
    ...Typography.body,
    color: Colors.accent,
    marginLeft: Spacing.xs,
    fontFamily: Typography.familySemiBold,
  },
  inputItem: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  inputLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontFamily: Typography.familySemiBold,
    marginBottom: Spacing.sm,
  },
  textInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disabledInput: {
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
  },
  disabledNote: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  saveSection: {
    margin: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  saveButton: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    ...Shadows.card,
  },
  saveButtonText: {
    ...Typography.body,
    color: Colors.accent,
    fontFamily: Typography.familySemiBold,
    marginLeft: Spacing.sm,
  },
});

export default ProfileSettingsScreen;
