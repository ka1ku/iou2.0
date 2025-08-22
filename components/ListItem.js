import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';

const ListItem = ({
  title,
  subtitle,
  description,
  leftIcon,
  rightIcon,
  leftImage,
  rightImage,
  onPress,
  onLeftPress,
  onRightPress,
  leftIconColor,
  rightIconColor,
  leftIconSize = 24,
  rightIconSize = 20,
  showChevron = false,
  chevronColor,
  style,
  titleStyle,
  subtitleStyle,
  descriptionStyle,
  leftIconStyle,
  rightIconStyle,
  disabled = false,
  selected = false,
  ...props
}) => {
  const renderLeftContent = () => {
    if (leftImage) {
      return (
        <Image 
          source={leftImage} 
          style={[styles.leftImage, leftIconStyle]} 
        />
      );
    }
    
    if (leftIcon) {
      return (
        <TouchableOpacity
          style={[styles.iconContainer, leftIconStyle]}
          onPress={onLeftPress}
          disabled={!onLeftPress || disabled}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={leftIcon} 
            size={leftIconSize} 
            color={leftIconColor || Colors.accent} 
          />
        </TouchableOpacity>
      );
    }
    
    return null;
  };

  const renderRightContent = () => {
    if (rightImage) {
      return (
        <Image 
          source={rightImage} 
          style={[styles.rightImage, rightIconStyle]} 
        />
      );
    }
    
    if (rightIcon) {
      return (
        <TouchableOpacity
          style={[styles.iconContainer, rightIconStyle]}
          onPress={onRightPress}
          disabled={!onRightPress || disabled}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={rightIcon} 
            size={rightIconSize} 
            color={rightIconColor || Colors.textSecondary} 
          />
        </TouchableOpacity>
      );
    }
    
    if (showChevron) {
      return (
        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={chevronColor || Colors.textSecondary} 
        />
      );
    }
    
    return null;
  };

  const renderContent = () => {
    return (
      <View style={styles.content}>
        {renderLeftContent()}
        
        <View style={styles.textContainer}>
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
          {description && (
            <Text style={[styles.description, descriptionStyle]}>
              {description}
            </Text>
          )}
        </View>
        
        {renderRightContent()}
      </View>
    );
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[
          styles.container,
          selected && styles.selected,
          disabled && styles.disabled,
          style
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        {...props}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return (
    <View 
      style={[
        styles.container,
        selected && styles.selected,
        disabled && styles.disabled,
        style
      ]} 
      {...props}
    >
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  
  selected: {
    backgroundColor: Colors.accent + '20',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  
  disabled: {
    opacity: 0.5,
  },
  
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  
  leftImage: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    marginRight: Spacing.md,
  },
  
  rightImage: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    marginLeft: Spacing.md,
  },
  
  textContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  
  title: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  
  description: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontSize: 12,
  },
});

export default ListItem;
