import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';

const ExpenseFooter = ({ 
  isEditing = false,
  loading = false,
  onSavePress,
  onSettlePress,
  saveButtonText,
  settleButtonText
}) => {
  const insets = useSafeAreaInsets();

  const getSaveButtonText = () => {
    if (saveButtonText) return saveButtonText;
    if (loading) return 'Saving...';
    return isEditing ? 'Update' : 'Create';
  };

  const getSettleButtonText = () => {
    if (settleButtonText) return settleButtonText;
    return isEditing ? 'Update & Settle' : 'Settle Now';
  };

  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
      <View style={styles.footerButtons}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.buttonDisabled]}
          onPress={onSavePress}
          disabled={loading}
          activeOpacity={0.7}
        >
          <View style={styles.buttonContent}>
            <Ionicons 
              name={isEditing ? "checkmark-circle" : "add-circle"} 
              size={22} 
              color={Colors.textSecondary} 
            />
            <Text style={styles.saveButtonText}>
              {getSaveButtonText()}
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.settleButton, loading && styles.buttonDisabled]}
          onPress={onSettlePress}
          disabled={loading}
          activeOpacity={0.7}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="card" size={22} color={Colors.white} />
            <Text style={styles.settleButtonText}>
              {getSettleButtonText()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  settleButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accentDark,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  saveButtonText: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  settleButtonText: {
    ...Typography.title,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    backgroundColor: Colors.textSecondary,
    borderColor: Colors.textSecondary,
  },
});

export default ExpenseFooter;