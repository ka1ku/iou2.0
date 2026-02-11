import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';
import storage from '@react-native-firebase/storage';
import * as FileSystem from 'expo-file-system';


export const checkCameraPermissions = async () => {
  try {
    let { status: cameraStatus } = await ImagePicker.getCameraPermissionsAsync();

    if (cameraStatus !== 'granted') {
      const { status: newCameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      cameraStatus = newCameraStatus;
    }

    if (cameraStatus !== 'granted') {
      Alert.alert(
        'Camera Permission Needed',
        'Camera permission is required to take photos. Please grant camera permission in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }

    return true;
  } catch (error) {
    Alert.alert('Error', 'Failed to access camera');
    return false;
  }
};

export const checkMediaLibraryPermissions = async () => {
  try {
    let { status: libraryStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

    if (libraryStatus !== 'granted') {
      const { status: newLibraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      libraryStatus = newLibraryStatus;
    }

    if (libraryStatus !== 'granted') {
      Alert.alert(
        'Photo Library Permission Needed',
        'Photo library permission is required to select images. Please grant photo library permission in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }

    return true;
  } catch (error) {
    Alert.alert('Error', 'Failed to access photo library');
    return false;
  }
};

export const takePhoto = async (onImageSelected, onError, onStateChange) => {
  try {
    if (onStateChange) onStateChange(true);

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      await onImageSelected(result.assets[0].uri);
    }

    if (onStateChange) onStateChange(false);
  } catch (error) {
    if (onError) onError('Failed to take photo');
    if (onStateChange) onStateChange(false);
  }
};

export const pickImage = async (onImageSelected, onError, onStateChange) => {
  try {
    if (onStateChange) onStateChange(true);

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      await onImageSelected(result.assets[0].uri);
    }

    if (onStateChange) onStateChange(false);
  } catch (error) {
    if (onError) onError('Failed to pick image');
    if (onStateChange) onStateChange(false);
  }
};

export const handleTakePhoto = async (onImageSelected, onError, onStateChange) => {
  const hasPermission = await checkCameraPermissions();
  if (hasPermission) {
    await takePhoto(onImageSelected, onError, onStateChange);
  }
};

export const handlePickImage = async (onImageSelected, onError, onStateChange) => {
  const hasPermission = await checkMediaLibraryPermissions();
  if (hasPermission) {
    await pickImage(onImageSelected, onError, onStateChange);
  }
};

export const imageToBase64 = async (uri) => {
  try {
    const FileSystem = require('expo-file-system');

    let filePath = uri;
    if (uri.startsWith('file://')) {
      filePath = uri.replace('file://', '');
    }
    const base64 = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64
    });
    return base64;

  } catch (error) {
    throw new Error('Failed to convert image to base64. Please try a different image format or restart the app.');
  }
};

/**
 * Download an image from a URL to a local temporary file
 * @param {string} imageUrl - The URL of the image to download
 * @returns {Promise<string>} - The local file URI
 */
export const downloadImageFromUrl = async (imageUrl) => {
  try {
    // Create a temporary file path
    const filename = `temp_profile_${Date.now()}.jpg`;
    const localUri = `${FileSystem.cacheDirectory}${filename}`;

    // Download the image
    const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);

    if (downloadResult.status !== 200) {
      throw new Error('Failed to download image');
    }

    return downloadResult.uri;
  } catch (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
};

/**
 * Upload an image to Firebase Storage
 * @param {string} localUri - The local file URI of the image to upload
 * @param {string} userId - The user's UID to use in the storage path
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export const uploadImageToStorage = async (localUri, userId) => {
  try {
    // Create a reference to the storage location
    const filename = `profile_${userId}_${Date.now()}.jpg`;
    const storageRef = storage().ref(`profile_pictures/${userId}/${filename}`);

    // Upload the file
    await storageRef.putFile(localUri);

    // Get the download URL
    const downloadUrl = await storageRef.getDownloadURL();

    return downloadUrl;
  } catch (error) {
    throw new Error(`Failed to upload image to storage: ${error.message}`);
  }
};

/**
 * Download an image from URL and upload it to Firebase Storage
 * @param {string} imageUrl - The URL of the image to download
 * @param {string} userId - The user's UID
 * @returns {Promise<string>} - The Firebase Storage download URL
 */
export const downloadAndUploadImage = async (imageUrl, userId) => {
  let localUri = null;

  try {
    // Skip if it's a ui-avatars fallback
    if (imageUrl.includes('ui-avatars.com')) {
      return imageUrl;
    }

    // Check if it's already a local file
    if (imageUrl.startsWith('file://')) {
      // It's a local file, upload directly
      const storageUrl = await uploadImageToStorage(imageUrl, userId);
      return storageUrl;
    }

    // It's a remote URL, download it first
    // Download the image to local storage
    localUri = await downloadImageFromUrl(imageUrl);

    // Upload to Firebase Storage
    const storageUrl = await uploadImageToStorage(localUri, userId);

    // Clean up the temporary file
    try {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return storageUrl;
  } catch (error) {
    // Clean up on error
    if (localUri) {
      try {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
};
