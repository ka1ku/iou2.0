/**
 * Button Component
 * 
 * A highly customizable, reusable button component that supports multiple variants,
 * sizes, states, and icon configurations. Built on top of React Native's TouchableOpacity
 * with consistent styling and behavior patterns.
 * 
 * Features:
 * - Multiple visual variants (primary, secondary, outline, danger, ghost)
 * - Three size options (small, medium, large)
 * - Loading and disabled states
 * - Icon support with configurable positioning
 * - Full-width option
 * - Custom styling override support
 * - Consistent design token usage
 * 
 * @component
 * @example
 * <Button 
 *   title="Save Expense" 
 *   onPress={handleSave} 
 *   variant="primary" 
 *   size="large" 
 * />
 */
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

/**
 * Button component with comprehensive customization options
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Button text to display
 * @param {Function} props.onPress - Function called when button is pressed
 * @param {string} [props.variant='primary'] - Visual style variant: 'primary', 'secondary', 'outline', 'danger', 'ghost'
 * @param {string} [props.size='medium'] - Button size: 'small', 'medium', 'large'
 * @param {boolean} [props.loading=false] - Shows loading spinner when true
 * @param {boolean} [props.disabled=false] - Disables button interaction when true
 * @param {string} [props.icon] - Ionicons icon name to display
 * @param {string} [props.iconPosition='left'] - Icon position: 'left' or 'right'
 * @param {Object} [props.style] - Additional styles for the button container
 * @param {Object} [props.textStyle] - Additional styles for the button text
 * @param {boolean} [props.fullWidth=false] - Makes button span full width when true
 * @param {React.ReactNode} [props.children] - Custom content to render instead of title
 * @param {...Object} props - Additional props passed to TouchableOpacity
 * @returns {React.ReactElement} A customizable button component
 */
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
  /**
   * Generates the button container styles based on variant, size, and state
   * 
   * @returns {Array} Array of style objects to apply to the button
   */
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

  /**
   * Generates the button text styles based on variant, size, and state
   * 
   * @returns {Array} Array of style objects to apply to the button text
   */
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

  /**
   * Renders the icon on the button with appropriate styling and positioning
   * 
   * @returns {React.ReactElement|null} Icon component or null if no icon
   */
  const renderIcon = () => {
    if (!icon) return null;
    
    const iconStyle = [
      styles.icon,
      iconPosition === 'right' && styles.iconRight,
      styles[`${size}Icon`]
    ];
    
    return <Ionicons name={icon} size={getIconSize()} color={getIconColor()} style={iconStyle} />;
  };

  /**
   * Returns the appropriate icon size based on button size
   * 
   * @returns {number} Icon size in pixels
   */
  const getIconSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'large': return 24;
      default: return 20;
    }
  };

  /**
   * Returns the appropriate icon color based on variant and state
   * 
   * @returns {string} Icon color value
   */
  const getIconColor = () => {
    if (disabled || loading) return Colors.textSecondary;
    if (variant === 'outline' || variant === 'ghost') return Colors.accent;
    return Colors.white;
  };

  /**
   * Renders the button content (icon, text, or custom children)
   * 
   * @returns {React.ReactElement} Button content with proper layout
   */
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
