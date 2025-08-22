import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';

const FormInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  editable = true,
  error,
  success,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  labelStyle,
  containerStyle,
  ...props
}) => {
  const getInputContainerStyle = () => {
    const baseStyle = [styles.inputContainer];
    
    if (error) {
      baseStyle.push(styles.inputContainerError);
    } else if (success) {
      baseStyle.push(styles.inputContainerSuccess);
    }
    
    if (!editable) {
      baseStyle.push(styles.inputContainerDisabled);
    }
    
    return baseStyle;
  };

  const getInputStyle = () => {
    const baseStyle = [styles.input];
    
    if (multiline) {
      baseStyle.push(styles.inputMultiline);
    }
    
    if (!editable) {
      baseStyle.push(styles.inputDisabled);
    }
    
    return baseStyle;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
        </Text>
      )}
      
      <View style={[getInputContainerStyle(), style]}>
        {leftIcon && (
          <Ionicons 
            name={leftIcon} 
            size={20} 
            color={Colors.textSecondary} 
            style={styles.leftIcon} 
          />
        )}
        
        <TextInput
          style={[getInputStyle(), inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          editable={editable}
          {...props}
        />
        
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIconContainer}
            disabled={!onRightIconPress}
          >
            <Ionicons 
              name={rightIcon} 
              size={20} 
              color={onRightIconPress ? Colors.accent : Colors.textSecondary} 
            />
          </TouchableOpacity>
        )}
      </View>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      {success && (
        <Text style={styles.successText}>{success}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  
  label: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  
  inputContainerError: {
    borderColor: Colors.danger,
  },
  
  inputContainerSuccess: {
    borderColor: Colors.success,
  },
  
  inputContainerDisabled: {
    backgroundColor: Colors.divider,
    opacity: 0.7,
  },
  
  leftIcon: {
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  
  rightIconContainer: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    fontFamily: Typography.familyRegular,
    color: Colors.textPrimary,
    minHeight: 48,
  },
  
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  
  inputDisabled: {
    color: Colors.textSecondary,
  },
  
  errorText: {
    ...Typography.label,
    color: Colors.danger,
    marginTop: Spacing.xs,
    fontSize: 12,
  },
  
  successText: {
    ...Typography.label,
    color: Colors.success,
    marginTop: Spacing.xs,
    fontSize: 12,
  },
});

export default FormInput;
