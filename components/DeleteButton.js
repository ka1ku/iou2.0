import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';

const DeleteButton = ({
  onPress,
  size = 'medium',
  variant = 'default',
  style,
  disabled = false,
  testID,
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: Spacing.xs,
          iconSize: 16,
        };
      case 'large':
        return {
          padding: Spacing.md,
          iconSize: 28,
        };
      case 'medium':
      default:
        return {
          padding: Spacing.sm,
          iconSize: 22,
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'subtle':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
        };
      case 'filled':
        return {
          backgroundColor: Colors.danger + '15',
          borderColor: Colors.danger + '30',
          borderWidth: 1,
        };
      case 'default':
      default:
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          padding: sizeStyles.padding,
          ...variantStyles,
        },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      testID={testID}
    >
      <Ionicons
        name="close"
        size={sizeStyles.iconSize}
        color={disabled ? Colors.textSecondary : Colors.textSecondary}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    minWidth: 32,
    minHeight: 32,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default DeleteButton;
