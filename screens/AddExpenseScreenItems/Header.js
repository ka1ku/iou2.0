import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../../design/tokens';

/**
 * Header Component
 * 
 * Displays the header section with back button, title, and settings button.
 * Used in the AddExpenseScreen for navigation and title display.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isEditing - Whether the screen is in edit mode
 * @param {Function} props.onBack - Callback when back button is pressed
 * @param {Function} props.onSettings - Callback when settings button is pressed
 * @param {number} props.topInset - Top safe area inset
 * @returns {React.ReactElement} Header with navigation and title
 */
const Header = ({ isEditing, onBack, onSettings, topInset }) => {
  return (
    <View style={[styles.header, { paddingTop: topInset + Spacing.lg }]}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={onBack}
      >
        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {isEditing ? 'Edit Expense' : 'Add Expense'}
      </Text>
      <TouchableOpacity 
        style={styles.settingsButton}
        onPress={onSettings}
      >
        <Ionicons name="settings-outline" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
});

export default Header;
