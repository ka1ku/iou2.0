import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';


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
