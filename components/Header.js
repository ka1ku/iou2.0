import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../design/tokens';

const Header = ({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  onLeftPress,
  onRightPress,
  leftIconColor,
  rightIconColor,
  style,
  titleStyle,
  subtitleStyle,
  showBackButton = false,
  onBackPress,
  ...props
}) => {
  const renderLeftIcon = () => {
    if (showBackButton) {
      return (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onBackPress}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={leftIconColor || Colors.textPrimary} 
          />
        </TouchableOpacity>
      );
    }
    
    if (leftIcon) {
      return (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onLeftPress}
          activeOpacity={0.7}
          disabled={!onLeftPress}
        >
          <Ionicons 
            name={leftIcon} 
            size={24} 
            color={leftIconColor || Colors.textPrimary} 
          />
        </TouchableOpacity>
      );
    }
    
    return <View style={styles.iconButton} />;
  };

  const renderRightIcon = () => {
    if (rightIcon) {
      return (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onRightPress}
          activeOpacity={0.7}
          disabled={!onRightPress}
        >
          <Ionicons 
            name={rightIcon} 
            size={24} 
            color={rightIconColor || Colors.textPrimary} 
          />
        </TouchableOpacity>
      );
    }
    
    return <View style={styles.iconButton} />;
  };

  return (
    <View style={[styles.container, style]} {...props}>
      {renderLeftIcon()}
      
      <View style={styles.content}>
        {title && (
          <Text style={[styles.title, titleStyle]}>
            {title}
          </Text>
        )}
        {subtitle && (
          <Text style={[styles.subtitle, subtitleStyle]}>
            {subtitle}
          </Text>
        )}
      </View>
      
      {renderRightIcon()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

export default Header;
