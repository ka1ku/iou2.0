import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';

const Button = ({
  title,
  onPress,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'danger', 'ghost'
  size = 'medium', // 'small', 'medium', 'large'
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left', // 'left', 'right'
  style,
  textStyle,
  fullWidth = false,
  children,
  ...props
}) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[size]];
    
    if (variant === 'primary') {
      baseStyle.push(styles.primary);
    } else if (variant === 'secondary') {
      baseStyle.push(styles.secondary);
    } else if (variant === 'outline') {
      baseStyle.push(styles.outline);
    } else if (variant === 'danger') {
      baseStyle.push(styles.danger);
    } else if (variant === 'ghost') {
      baseStyle.push(styles.ghost);
    }
    
    if (fullWidth) {
      baseStyle.push(styles.fullWidth);
    }
    
    if (disabled || loading) {
      baseStyle.push(styles.disabled);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseTextStyle = [styles.text, styles[`${size}Text`]];
    
    if (variant === 'primary') {
      baseTextStyle.push(styles.primaryText);
    } else if (variant === 'outline' || variant === 'ghost') {
      baseTextStyle.push(styles.outlineText);
    }
    
    if (disabled || loading) {
      baseTextStyle.push(styles.disabledText);
    }
    
    return baseTextStyle;
  };

  const renderIcon = () => {
    if (!icon) return null;
    
    const iconStyle = [
      styles.icon,
      iconPosition === 'right' && styles.iconRight,
      styles[`${size}Icon`]
    ];
    
    return <Ionicons name={icon} size={getIconSize()} color={getIconColor()} style={iconStyle} />;
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'large': return 24;
      default: return 20;
    }
  };

  const getIconColor = () => {
    if (disabled || loading) return Colors.textSecondary;
    if (variant === 'outline' || variant === 'ghost') return Colors.accent;
    return Colors.white;
  };

  const renderContent = () => {
    if (children) return children;
    
    return (
      <View style={styles.content}>
        {iconPosition === 'left' && renderIcon()}
        {loading ? (
          <ActivityIndicator 
            size="small" 
            color={variant === 'outline' || variant === 'ghost' ? Colors.accent : Colors.white} 
          />
        ) : (
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        )}
        {iconPosition === 'right' && renderIcon()}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Shadows.button,
  },
  
  // Size variants
  small: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 36,
  },
  medium: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 48,
  },
  large: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    minHeight: 56,
  },
  
  // Color variants
  primary: {
    backgroundColor: Colors.accent,
  },
  secondary: {
    backgroundColor: Colors.blue,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  danger: {
    backgroundColor: Colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  
  // States
  disabled: {
    opacity: 0.6,
  },
  fullWidth: {
    width: '100%',
  },
  
  // Content
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Text styles
  text: {
    fontFamily: Typography.familySemiBold,
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  primaryText: {
    color: Colors.white,
  },
  outlineText: {
    color: Colors.accent,
  },
  disabledText: {
    color: Colors.textSecondary,
  },
  
  // Icon styles
  icon: {
    marginRight: Spacing.sm,
  },
  iconRight: {
    marginRight: 0,
    marginLeft: Spacing.sm,
  },
  smallIcon: {
    marginHorizontal: Spacing.xs,
  },
  mediumIcon: {
    marginHorizontal: Spacing.sm,
  },
  largeIcon: {
    marginHorizontal: Spacing.md,
  },
});

export default Button;
