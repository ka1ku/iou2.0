import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../design/tokens';

const SectionHeader = ({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  rightText,
  onLeftPress,
  onRightPress,
  leftIconColor,
  rightIconColor,
  leftIconSize = 20,
  rightIconSize = 20,
  style,
  titleStyle,
  subtitleStyle,
  rightTextStyle,
  showDivider = true,
  ...props
}) => {
  const renderLeftContent = () => {
    if (leftIcon) {
      return (
        <TouchableOpacity
          style={styles.iconContainer}
          onPress={onLeftPress}
          disabled={!onLeftPress}
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
    if (rightText) {
      return (
        <TouchableOpacity
          style={styles.rightContainer}
          onPress={onRightPress}
          disabled={!onRightPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.rightText, rightTextStyle]}>
            {rightText}
          </Text>
          {onRightPress && (
            <Ionicons 
              name="chevron-forward" 
              size={16} 
              color={Colors.accent} 
              style={styles.chevron} 
            />
          )}
        </TouchableOpacity>
      );
    }
    
    if (rightIcon) {
      return (
        <TouchableOpacity
          style={styles.iconContainer}
          onPress={onRightPress}
          disabled={!onRightPress}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={rightIcon} 
            size={rightIconSize} 
            color={rightIconColor || Colors.accent} 
          />
        </TouchableOpacity>
      );
    }
    
    return null;
  };

  return (
    <View style={[styles.container, style]} {...props}>
      <View style={styles.header}>
        <View style={styles.leftSection}>
          {renderLeftContent()}
          <View style={styles.textSection}>
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
        </View>
        
        {renderRightContent()}
      </View>
      
      {showDivider && <View style={styles.divider} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  
  textSection: {
    flex: 1,
  },
  
  title: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  rightText: {
    ...Typography.label,
    color: Colors.accent,
    fontSize: 14,
    marginRight: Spacing.xs,
  },
  
  chevron: {
    marginLeft: Spacing.xs,
  },
  
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.lg,
  },
});

export default SectionHeader;
