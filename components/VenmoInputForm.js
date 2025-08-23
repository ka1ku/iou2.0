import React from 'react';
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';

/**
 * Reusable component for Venmo username input with automatic verification
 */
const VenmoInputForm = ({ 
  username, 
  onUsernameChange, 
  verifying, 
  verified
}) => {

  return (
    <View style={styles.setupContainer}>
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Venmo Username</Text>
        <View style={styles.venmoInputContainer}>
          <Text style={styles.atSymbol}>@</Text>
          <TextInput
            style={styles.venmoInput}
            value={username}
            onChangeText={onUsernameChange}
            placeholder="your-venmo-username"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
          />
          
          {/* Loading indicator or checkmark on the right */}
          <View style={styles.inputRightIcon}>
            {verifying ? (
              <ActivityIndicator color={Colors.accent} size="small" />
            ) : verified ? (
              <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  setupContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  venmoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  atSymbol: {
    paddingLeft: Spacing.lg,
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  venmoInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  inputRightIcon: {
    paddingRight: Spacing.lg,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },


});

export default VenmoInputForm;
