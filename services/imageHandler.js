import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/**
 * Image Handler Service
 * Handles all image picking and camera functionality
 */

/**
 * Check camera permissions and request if needed
 * @returns {Promise<boolean>} True if permission granted, false otherwise
 */
export const checkCameraPermissions = async () => {
  try {
    let { status: cameraStatus } = await ImagePicker.getCameraPermissionsAsync();
    
    // Request permission if not granted
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
    console.error('Error handling camera permission:', error);
    Alert.alert('Error', 'Failed to access camera');
    return false;
  }
};

/**
 * Check media library permissions and request if needed
 * @returns {Promise<boolean>} True if permission granted, false otherwise
 */
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
    console.error('Error handling media library permission:', error);
    Alert.alert('Error', 'Failed to access photo library');
    return false;
  }
};

/**
 * Take a photo using the camera
 * @param {Function} onImageSelected - Callback function when image is selected
 * @param {Function} onError - Callback function for errors
 * @param {Function} onStateChange - Callback function for state changes (scanning state)
 * @returns {Promise<void>}
 */
export const takePhoto = async (onImageSelected, onError, onStateChange) => {
  try {
    // Set global scanning state to true
    if (onStateChange) onStateChange(true);
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      await onImageSelected(result.assets[0].uri);
    }
    
    // Reset scanning state
    if (onStateChange) onStateChange(false);
  } catch (error) {
    console.error('Error taking photo:', error);
    if (onError) onError('Failed to take photo');
    // Reset scanning state on error
    if (onStateChange) onStateChange(false);
  }
};

/**
 * Pick an image from the media library
 * @param {Function} onImageSelected - Callback function when image is selected
 * @param {Function} onError - Callback function for errors
 * @param {Function} onStateChange - Callback function for state changes (scanning state)
 * @returns {Promise<void>}
 */
export const pickImage = async (onImageSelected, onError, onStateChange) => {
  try {
    // Set global scanning state to true
    if (onStateChange) onStateChange(true);
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      await onImageSelected(result.assets[0].uri);
    }
    
    // Reset scanning state
    if (onStateChange) onStateChange(false);
  } catch (error) {
    console.error('Error picking image:', error);
    if (onError) onError('Failed to pick image');
    // Reset scanning state on error
    if (onStateChange) onStateChange(false);
  }
};

/**
 * Handle taking a photo with permission checking
 * @param {Function} onImageSelected - Callback function when image is selected
 * @param {Function} onError - Callback function for errors
 * @param {Function} onStateChange - Callback function for state changes (scanning state)
 * @returns {Promise<void>}
 */
export const handleTakePhoto = async (onImageSelected, onError, onStateChange) => {
  const hasPermission = await checkCameraPermissions();
  if (hasPermission) {
    await takePhoto(onImageSelected, onError, onStateChange);
  }
};

/**
 * Handle picking an image with permission checking
 * @param {Function} onImageSelected - Callback function when image is selected
 * @param {Function} onError - Callback function for errors
 * @param {Function} onStateChange - Callback function for state changes (scanning state)
 * @returns {Promise<void>}
 */
export const handlePickImage = async (onImageSelected, onError, onStateChange) => {
  const hasPermission = await checkMediaLibraryPermissions();
  if (hasPermission) {
    await pickImage(onImageSelected, onError, onStateChange);
  }
};

/**
 * Convert image URI to base64 string
 * @param {string} uri - Image URI
 * @returns {Promise<string>} Base64 encoded image string
 */
export const imageToBase64 = async (uri) => {
  try {
    // For React Native, let's try a simpler approach
    // First, try to use expo-file-system with proper import
    const FileSystem = await import('expo-file-system');
    
    // Convert the URI to a file path if it's a file:// URI
    let filePath = uri;
    if (uri.startsWith('file://')) {
      filePath = uri.replace('file://', '');
    }
    
    // Read the file as base64 using expo-file-system
    const base64 = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64
    });
    return base64;
    
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to convert image to base64. Please try a different image format or restart the app.');
  }
};
