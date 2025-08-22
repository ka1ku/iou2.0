import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors, Spacing, Radius, Shadows } from '../design/tokens';

const Card = ({
  children,
  style,
  onPress,
  variant = 'default', // 'default', 'elevated', 'outlined', 'flat'
  padding = 'medium', // 'none', 'small', 'medium', 'large'
  margin = 'none', // 'none', 'small', 'medium', 'large'
  borderRadius = 'lg',
  ...props
}) => {
  const getCardStyle = () => {
    const baseStyle = [styles.card, styles[variant]];
    
    if (padding !== 'none') {
      baseStyle.push(styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}`]);
    }
    
    if (margin !== 'none') {
      baseStyle.push(styles[`margin${margin.charAt(0).toUpperCase() + margin.slice(1)}`]);
    }
    
    if (borderRadius !== 'lg') {
      baseStyle.push(styles[`radius${borderRadius.charAt(0).toUpperCase() + borderRadius.slice(1)}`]);
    }
    
    return baseStyle;
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[getCardStyle(), style]}
        onPress={onPress}
        activeOpacity={0.95}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[getCardStyle(), style]} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
  },
  
  // Variants
  default: {
    ...Shadows.card,
  },
  elevated: {
    ...Shadows.card,
    elevation: 8,
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  flat: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  
  // Padding variants
  paddingNone: {},
  paddingSmall: {
    padding: Spacing.sm,
  },
  paddingMedium: {
    padding: Spacing.md,
  },
  paddingLarge: {
    padding: Spacing.lg,
  },
  
  // Margin variants
  marginNone: {},
  marginSmall: {
    margin: Spacing.sm,
  },
  marginMedium: {
    margin: Spacing.md,
  },
  marginLarge: {
    margin: Spacing.lg,
  },
  
  // Border radius variants
  radiusSm: {
    borderRadius: Radius.sm,
  },
  radiusMd: {
    borderRadius: Radius.md,
  },
  radiusLg: {
    borderRadius: Radius.lg,
  },
  radiusXl: {
    borderRadius: Radius.xl,
  },
});

export default Card;
