import { useFocusEffect } from '@react-navigation/native';
import { Alert } from 'react-native';

/**
 * Custom hook to warn users when navigating away from a form with unsaved changes
 * @param {boolean} hasChanges - Whether the form has unsaved changes
 * @param {Function} navigation - Navigation object from React Navigation
 * @param {Function} onConfirmNavigation - Callback to execute when user confirms navigation
 * @param {string} warningMessage - Custom warning message
 */
const useNavigationWarning = (
  hasChanges,
  navigation,
  onConfirmNavigation = null,
  warningMessage = 'You have unsaved changes. Are you sure you want to leave?'
) => {
  // Handle back button press, swipe gestures, and hardware back button
  useFocusEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges) {
        // If no changes, allow navigation
        return;
      }

      // Prevent default navigation
      e.preventDefault();

      // Show confirmation dialog
      Alert.alert(
        'Unsaved Changes',
        warningMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              // Do nothing, stay on current screen
            },
          },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              // Execute custom callback if provided, otherwise just navigate
              if (onConfirmNavigation) {
                onConfirmNavigation();
              } else {
                navigation.dispatch(e.data.action);
              }
            },
          },
        ]
      );
    });

    return unsubscribe;
  });
};

export default useNavigationWarning;
